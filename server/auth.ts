import { Router, type Request, type Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import db from "./db";

const router = Router();

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

// POST /auth/signup — create a new account
router.post("/auth/signup", (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  // Check if email already exists
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  const result = db.prepare(
    "INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)"
  ).run(email.trim().toLowerCase(), passwordHash, salt);

  res.status(201).json({
    id: result.lastInsertRowid,
    email: email.trim().toLowerCase(),
  });
});

// POST /auth/login — authenticate with email and password
router.post("/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const user = db.prepare(
    "SELECT id, email, password_hash, salt FROM users WHERE email = ?"
  ).get(email.trim().toLowerCase()) as { id: number; email: string; password_hash: string; salt: string } | undefined;

  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json({ id: user.id, email: user.email });
});

export default router;
