// TODO: REDO THIS THIS IS UGLY

const names = [
  "LINGDOCS_EMAIL_HOST",
  "LINGDOCS_EMAIL_USER",
  "LINGDOCS_EMAIL_PASS",
  "LINGDOCS_COUCHDB",
  "LINGDOCS_COUCHDB_USERNAME",
  "LINGDOCS_COUCHDB_PASSWORD",
  "LINGDOCS_ACCOUNT_COOKIE_SECRET",
  "LINGDOCS_ACCOUNT_GOOGLE_CLIENT_SECRET",
  "LINGDOCS_ACCOUNT_TWITTER_CLIENT_SECRET",
  "LINGDOCS_ACCOUNT_GITHUB_CLIENT_SECRET",
  "LINGDOCS_ACCOUNT_RECAPTCHA_SECRET",
  "LINGDOCS_ACCOUNT_UPGRADE_PASSWORD",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "LINGDOCS_SERVICE_ACCOUNT_KEY",
  "LINGDOCS_SERVICE_ACCOUNT_EMAIL",
  "LINGDOCS_DICTIONARY_SPREADSHEET",
  "LINGDOCS_DICTIONARY_SHEET_ID",
] as const;

const values = names.map((name) => ({
  name,
  value:
    name === "LINGDOCS_SERVICE_ACCOUNT_KEY"
      ? Buffer.from(process.env[name] || "").toString("base64")
      : process.env[name] || "",
}));

const missing = values.filter((v) => !v.value);
if (missing.length) {
  console.error(
    "Missing evironment variable(s):",
    missing.map((m) => m.name).join(", "),
  );
  process.exit(1);
}

export default {
  emailHost: values[0].value,
  emailUser: values[1].value,
  emailPass: values[2].value,
  couchDbURL: values[3].value,
  couchDbUsername: values[4].value,
  couchDbPassword: values[5].value,
  cookieSecret: values[6].value,
  googleClientSecret: values[7].value,
  twitterClientSecret: values[8].value,
  githubClientSecret: values[9].value,
  recaptchaSecret: values[10].value,
  upgradePassword: values[11].value,
  stripeSecretKey: values[12].value,
  stripeWebhookSecret: values[13].value,
  lingdocsServiceAccountKey: values[14].value,
  lingdocsServiceAccountEmail: values[15].value,
  lingdocsDictionarySpreadsheet: values[16].value,
  lingdocsDictionarySheetId: values[17].value,
};
