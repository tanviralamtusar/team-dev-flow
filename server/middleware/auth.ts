import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

// Looked up fresh from the DB on every call (not baked into the JWT) so that
// promoting/demoting an admin takes effect immediately instead of waiting up
// to 24h for their token to expire.
export const isUserAdmin = (userId: string | undefined): boolean => {
  if (!userId) return false;
  const row = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(userId) as
    | { isAdmin: number }
    | undefined;
  return !!row?.isAdmin; // better-sqlite3 returns 0/1 for INTEGER columns, not a JS boolean
};

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token." });
  }
};
