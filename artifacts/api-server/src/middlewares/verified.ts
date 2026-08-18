import type { Response, NextFunction } from "express";
import { isEmailUnverified } from "../lib/freeLock";
import type { AuthenticatedRequest } from "./auth";

/** Blocks AI-costing endpoints until the account's email is confirmed. */
export async function requireVerifiedEmail(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (await isEmailUnverified(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "email_unverified" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "requireVerifiedEmail error");
    res.status(500).json({ error: "Server error" });
  }
}
