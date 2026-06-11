import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Basic validation
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Normalize
    username = username.trim();
    email = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR email = ?").get(username, email);
    if (existingUser) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, username, email, password, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, email, hashedPassword, createdAt);

    // Create a corresponding profile
    db.prepare(`
      INSERT INTO profiles (id, displayName, email, createdAt, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, email, createdAt, "developer");

    // Generate token
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: "24h" });

    res.status(201).json({
      token,
      user: { id: userId, username, email }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    let { username, password } = req.body; // username can be email or username

    if (!username || !password) {
      return res.status(400).json({ error: "Username/email and password are required" });
    }

    const identifier = username.trim();
    const isEmail = identifier.includes("@");

    // Find user by username or email
    let user;
    if (isEmail) {
      user = db.prepare("SELECT * FROM users WHERE email = ?").get(identifier.toLowerCase()) as any;
    } else {
      user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(identifier) as any;
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// GET /api/auth/me - Verify token and return user info
router.get("/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare("SELECT id, username, email, createdAt FROM users WHERE id = ?").get(decoded.userId) as any;
    
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
