import {
  addDictionaryEntries,
  deleteEntry,
  Sheets,
  updateDictionaryEntries,
  type AT,
} from "@lingdocs/auth-shared";
import { reviewTasksDb } from "./couch-db";
import { google } from "googleapis";
import env from "./env-vars";
import Queue from "bull";

const submissionsQueue = new Queue<
  | {
      type: "edits";
      entries: AT.EntryEdit[];
    }
  | {
      type: "new";
      entries: AT.NewEntry[];
    }
  | AT.EntryDeletion
>("submissions");

const sheetId = parseInt(env.lingdocsDictionarySheetId);
if (isNaN(sheetId)) {
  console.error("Invalid SheetID for LINGDOCS_DICTIONARY_SHEET_ID env var");
  process.exit(1);
}

// TODO: get new env vars on server (remember base64 for key)

const auth = new google.auth.GoogleAuth({
  // TODO: THESE CREDENTIALS ARE NOT WORKING SOMEHOW !!
  credentials: {
    private_key: Buffer.from(env.lingdocsServiceAccountKey, "base64").toString(
      "ascii",
    ),
    client_email: env.lingdocsServiceAccountEmail,
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ],
});
const { spreadsheets } = google.sheets({
  version: "v4",
  auth,
});
const sheets: Sheets = {
  spreadsheetId: env.lingdocsDictionarySpreadsheet,
  spreadsheets,
};

export async function receiveSubmissions(
  e: AT.SubmissionsRequest,
  editor: boolean,
): Promise<AT.SubmissionsResponse> {
  const { edits, reviewTasks } = sortSubmissions(e);

  // TODO: guard against race conditions update!!

  // TODO: BETTER PROMISE MULTI-TASKING
  // 1. Add review tasks to the couchdb
  // 2. Edit dictionary entries
  // 3. Add new dictionary entries

  if (reviewTasks.length) {
    // add whatever review tasks came in to the db
    const docs = reviewTasks.map((task) => ({
      ...task,
      _rev: undefined,
    }));
    await reviewTasksDb.bulk({ docs });
  }

  if (edits.length && editor) {
    const { newEntries, entryEdits, entryDeletions } = sortEdits(edits);
    if (entryEdits.length) {
      submissionsQueue.add({ type: "edits", entries: entryEdits });
    }
    if (newEntries.length) {
      submissionsQueue.add({ type: "new", entries: newEntries });
    }
    entryDeletions.forEach((e) => {
      submissionsQueue.add(e);
    });
  }

  return {
    ok: true,
    message: `received ${reviewTasks.length} review task(s), and ${edits.length} edit(s)`,
    submissions: e,
  };
}

submissionsQueue.process(async function (job, done) {
  try {
    if (job.data.type === "edits") {
      await updateDictionaryEntries(sheets, job.data.entries);
    } else if (job.data.type === "new") {
      await addDictionaryEntries(sheets, job.data.entries);
    } else {
      await deleteEntry(sheets, sheetId, job.data);
    }
  } catch (e) {
    console.error(e);
    if (e instanceof Error) {
      done(e);
    } else {
      throw new Error("unknown error");
    }
  }
  done();
});

type SortedSubmissions = {
  edits: AT.Edit[];
  reviewTasks: AT.ReviewTask[];
};

export function sortSubmissions(
  submissions: AT.Submission[],
): SortedSubmissions {
  const base: SortedSubmissions = {
    edits: [],
    reviewTasks: [],
  };
  return submissions.reduce((acc, s): SortedSubmissions => {
    return {
      ...acc,
      ...(s.type === "edit suggestion" ||
      s.type === "issue" ||
      s.type === "entry suggestion"
        ? {
            reviewTasks: [...acc.reviewTasks, s],
          }
        : {
            edits: [...acc.edits, s],
          }),
    };
  }, base);
}

type SortedEdits = {
  entryEdits: AT.EntryEdit[];
  newEntries: AT.NewEntry[];
  entryDeletions: AT.EntryDeletion[];
};

export function sortEdits(edits: AT.Edit[]): SortedEdits {
  const base: SortedEdits = {
    entryEdits: [],
    newEntries: [],
    entryDeletions: [],
  };
  return edits.reduce(
    (acc, edit): SortedEdits => ({
      ...acc,
      ...(edit.type === "entry edit"
        ? {
            entryEdits: [...acc.entryEdits, edit],
          }
        : edit.type === "new entry"
          ? {
              newEntries: [...acc.newEntries, edit],
            }
          : edit.type === "entry deletion"
            ? {
                entryDeletions: [...acc.entryDeletions, edit],
              }
            : {}),
    }),
    base,
  );
}
