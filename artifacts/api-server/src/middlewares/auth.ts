import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!supabaseUrl || !supabaseServiceKey) {
    req.log.warn("Supabase env vars not configured, using token as user ID");
    req.userId = "mock-user";
    next();
    return;
  }

  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.userId = data.user.id;
    req.userEmail = data.user.email ?? "";
    next();
  } catch (err) {
    req.log.error({ err }, "Auth error");
    res.status(401).json({ error: "Unauthorized" });
  }
}
