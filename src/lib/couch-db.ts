import Nano from "nano";
import { DocumentInsertResponse } from "nano";
import { getTimestamp, type AT } from "@lingdocs/auth-shared";
import env from "./env-vars";

const nano = Nano(env.couchDbURL);
nano.auth(env.couchDbUsername, env.couchDbPassword).catch(console.error);

const usersDb = nano.db.use("lingdocs-users");
const feedbackDb = nano.db.use("feedback");
const paymentsDb = nano.db.use("payments");
export const reviewTasksDb = nano.db.use("review-tasks");
const userDbPrefix = "userdb-";

export async function addFeedback(feedback: any) {
  await feedbackDb.insert(feedback);
}

export async function addToPaymentsDb(payment: any) {
  await paymentsDb.insert(payment);
}

export function updateLastLogin(user: AT.LingdocsUser): AT.LingdocsUser {
  return {
    ...user,
    lastLogin: getTimestamp(),
  };
}

function processAPIResponse(
  user: AT.LingdocsUser,
  response: DocumentInsertResponse,
): AT.LingdocsUser | undefined {
  if (response.ok !== true) return undefined;
  return {
    ...user,
    _id: response.id,
    _rev: response.rev,
  };
}

export async function getLingdocsUser(
  field: "email" | "userId" | "githubId" | "googleId" | "twitterId",
  value: string,
): Promise<undefined | AT.LingdocsUser> {
  const user = await usersDb.find({
    selector:
      field === "githubId"
        ? { github: { id: value } }
        : field === "googleId"
          ? { google: { id: value } }
          : field === "twitterId"
            ? { twitter: { id: value } }
            : { [field]: value },
  });
  if (!user.docs.length) {
    return undefined;
  }
  return user.docs[0] as AT.LingdocsUser;
}

export async function getAllLingdocsUsers(): Promise<AT.LingdocsUser[]> {
  const users = await usersDb.find({
    selector: { userId: { $exists: true } },
    limit: 5000,
  });
  return users.docs as AT.LingdocsUser[];
}

export async function getAllFeedback(): Promise<any[]> {
  const res = await feedbackDb.find({
    selector: {
      feedback: { $exists: true },
    },
    limit: 5000,
  });
  const docs = res.docs;
  // @ts-ignore
  docs.sort((a, b) => b.feedback.ts - a.feedback.ts);
  return docs as any[];
}

export async function insertLingdocsUser(
  user: AT.LingdocsUser,
): Promise<AT.LingdocsUser> {
  try {
    const res = await usersDb.insert(user);
    const newUser = processAPIResponse(user, res);
    if (!newUser) {
      throw new Error("error inserting user");
    }
    return newUser;
  } catch (e) {
    console.log("ERROR on insertLingdocsUser", user);
    throw new Error("error inserting user - on update");
  }
}

export async function deleteLingdocsUser(uuid: AT.UUID): Promise<void> {
  const user = await getLingdocsUser("userId", uuid);
  await deleteCouchDbAuthUser(uuid);
  if (!user) return;
  // TODO: cleanup userdbs etc
  // TODO: Better type certainty here... obviously there is an _id and _rev here
  await usersDb.destroy(user._id as string, user._rev as string);
}

export async function deleteCouchDbAuthUser(uuid: AT.UUID): Promise<void> {
  const authUsers = nano.db.use("_users");
  const user = await authUsers.find({ selector: { name: uuid } });
  if (!user.docs.length) return;
  const u = user.docs[0];
  await authUsers.destroy(u._id, u._rev);
  await nano.db.destroy(getWordlistDbName(uuid));
}

export async function updateLingdocsUser(
  uuid: AT.UUID,
  toUpdate: // TODO: OR USE REDUCER??
  | { name: string }
    | { name?: string; email: string; emailVerified: AT.Hash }
    | { email: string; emailVerified: true }
    | { emailVerified: AT.Hash }
    | { emailVerified: true }
    | { password: AT.Hash }
    | { google: AT.GoogleProfile | undefined }
    | { github: AT.GitHubProfile | undefined }
    | { twitter: AT.TwitterProfile | undefined }
    | {
        passwordReset: {
          tokenHash: AT.Hash;
          requestedOn: AT.TimeStamp;
        };
      }
    | {
        level: "student";
        wordlistDbName: AT.WordlistDbName;
        couchDbPassword: AT.UserDbPassword;
        upgradeToStudentRequest: undefined;
        subscription?: AT.StripeSubscription;
      }
    | {
        level: "basic";
        wordlistDbName: undefined;
        couchDbPassword: undefined;
        upgradeToStudentRequest: undefined;
        subscription: undefined;
      }
    | { upgradeToStudentRequest: "waiting" }
    | { upgradeToStudentRequest: "denied" }
    | { tests: AT.TestResult[] }
    | { wordlistDbName: AT.WordlistDbName; couchDbPassword: AT.UserDbPassword },
): Promise<AT.LingdocsUser> {
  const user = await getLingdocsUser("userId", uuid);
  if (!user) throw new Error("unable to update - user not found " + uuid);
  if ("tests" in toUpdate) {
    return await insertLingdocsUser({
      ...user,
      tests: addNewTests(user.tests, toUpdate.tests, 2),
    });
  }
  if ("password" in toUpdate) {
    const { passwordReset, ...u } = user;
    return await insertLingdocsUser({
      ...u,
      ...toUpdate,
    });
  }
  return await insertLingdocsUser({
    ...user,
    ...toUpdate,
  });
}

export async function addCouchDbAuthUser(
  uuid: AT.UUID,
): Promise<{ password: AT.UserDbPassword; userDbName: AT.WordlistDbName }> {
  const password = generateWordlistDbPassword();
  const userDbName = getWordlistDbName(uuid);
  const usersDb = nano.db.use("_users");
  // TODO: prevent conflict if adding an existing user for some reason
  const authUser: AT.CouchDbAuthUser = {
    _id: `org.couchdb.user:${uuid}`,
    type: "user",
    roles: [],
    name: uuid,
    password,
  };
  await usersDb.insert(authUser);
  await nano.db.create(userDbName);
  const userDb = nano.db.use(userDbName);
  await userDb.insert(
    {
      // @ts-ignore
      admins: {
        names: [uuid],
        roles: ["_admin"],
      },
      members: {
        names: [uuid],
        roles: ["_admin"],
      },
    },
    "_security",
  );
  return { password, userDbName };
}

// Instead of these functions, I'm using couch_peruser
// export async function createWordlistDatabase(uuid: T.UUID, password: T.UserDbPassword): Promise<{ name: T.WordlistDbName, password: T.UserDbPassword }> {
//   const name = getWordlistDbName(uuid);
//   // create wordlist database for user
//   await nano.db.create(name);
//   const securityInfo = {
//       admins: {
//           names: [uuid],
//           roles: ["_admin"]
//       },
//       members: {
//           names: [uuid],
//           roles: ["_admin"],
//       },
//   };
//   const userDb = nano.db.use(name);
//   await userDb.insert(securityInfo as any, "_security");
//   return { password, name };
// }

// export async function deleteWordlistDatabase(uuid: T.UUID): Promise<void> {
//   const name = getWordlistDbName(uuid);
//   try {
//     await nano.db.destroy(name);
//   } catch (e) {
//     // allow the error to pass if we're just trying to delete a database that never existed
//     if (e.message !== "Database does not exist.") {
//       throw new Error("error deleting database");
//     }
//   }
// }

export function getWordlistDbName(uid: AT.UUID): AT.WordlistDbName {
  return `${userDbPrefix}${stringToHex(uid)}` as AT.WordlistDbName;
}

export function generateWordlistDbPassword(): AT.UserDbPassword {
  function makeChunk(): string {
    return Math.random().toString(36).slice(2);
  }
  const password = new Array(4)
    .fill(0)
    .reduce((acc: string): string => acc + makeChunk(), "");
  return password as AT.UserDbPassword;
}

function stringToHex(str: string) {
  const arr1 = [];
  for (let n = 0, l = str.length; n < l; n++) {
    const hex = Number(str.charCodeAt(n)).toString(16);
    arr1.push(hex);
  }
  return arr1.join("");
}

/**
 * Adds new tests to a users record, only keeping up to amountToKeep records of the most
 * recent repeat passes/fails
 *
 * @param existing - the existing tests in a users record
 * @param newResults - the tests to be added to a users record
 * @param amountToKeep - the amount of repeat tests to keep (defaults to 2)
 */
function addNewTests(
  existing: Readonly<AT.TestResult[]>,
  toAdd: AT.TestResult[],
  amountToKeep = 2,
): AT.TestResult[] {
  const tests = [...existing];
  // check to make sure that we're only adding test results that are not already added
  const newTests = toAdd.filter((t) => !tests.some((x) => x.time === t.time));
  newTests.forEach((nt) => {
    const repeats = tests.filter((x) => x.id === nt.id && x.done === nt.done);
    if (repeats.length > amountToKeep - 1) {
      // already have enough repeat passes saved, remove the oldest one
      const i = tests.findIndex((x) => x.time === repeats[0].time);
      if (i > -1) tests.splice(i, 1);
    }
    tests.push(nt);
  });
  return tests;
}
