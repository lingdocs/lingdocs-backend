import session from "express-session";
import { Express } from "express";
import { createClient } from "redis";
import inProd from "../lib/inProd";
import env from "../lib/env-vars";

const FileStore = !inProd ? require("session-file-store")(session) : undefined;

const RedisStore = require("connect-redis")(session);

const store = inProd
  ? new RedisStore({ client: createClient().connect() })
  : FileStore({});

store.on("error", (err: any) => console.error("Session store error", err));

function setupSession(app: Express) {
  console.log("setting up session", { inProd }, env.cookieSecret);
  app.use(
    session({
      secret: env.cookieSecret,
      name: "__session",
      resave: false,
      saveUninitialized: false,
      proxy: inProd,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 * 30 * 6,
        secure: inProd,
        sameSite: "lax",
        domain: inProd ? "lingdocs.com" : undefined,
        httpOnly: true,
      },
      store,
    }),
  );
}

export default setupSession;
