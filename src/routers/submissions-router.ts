import express, { Response } from "express";
import { type AT } from "@lingdocs/auth-shared";
import { receiveSubmissions } from "../lib/submissions";

// TODO: ADD PROPER ERROR HANDLING THAT WILL RETURN JSON ALWAYS

function sendResponse(res: Response, payload: AT.APIResponse) {
  return res.send(payload);
}

const submissionsRouter = express.Router();

// Guard all api with authentication
submissionsRouter.use((req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  const r: AT.APIResponse = { ok: false, error: "401 Unauthorized" };
  return res.status(401).send(r);
});

/**
 * Receive a submissions request from the dictionary app
 */
submissionsRouter.post("/", async (req, res, next) => {
  if (!req.user) return next("user not found");
  const r = await receiveSubmissions(req.body, !!req.user.admin);
  sendResponse(res, r);
});

export default submissionsRouter;
