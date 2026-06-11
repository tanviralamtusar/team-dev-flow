import { Response, NextFunction } from "express";
import db from "../db.js";
import { AuthRequest } from "./auth.js";

export const verifyProjectMember = (req: AuthRequest, res: Response, next: NextFunction) => {
  const projectId = req.query.projectId || req.body.projectId;
  const userId = req.user?.userId;

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }

  try {
    const member = db.prepare("SELECT * FROM project_members WHERE projectId = ? AND userId = ?").get(projectId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this project" });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Failed to verify project membership" });
  }
};
