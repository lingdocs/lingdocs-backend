import { type AT } from "@lingdocs/auth-shared";

declare namespace Express {
  export interface Request {
    // TODO: this will be brought in with an import
    user?: AT.LingdocsUser;
  }
}
