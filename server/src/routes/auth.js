import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, nextId } from "../storage/memoryDb.js";

export const authRouter = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  approvedLimit: z.number().int().positive().max(50000).default(5000)
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, approvedLimit } = parsed.data;
  const exists = [...db.users.values()].some(u => u.email === email);
  if (exists) return res.status(409).json({ error: "Email already exists" });

  const id = nextId();
  const passwordHash = await bcrypt.hash(password, 10);

  // Demo “blockchain user address”: derived-ish fake (don’t do this in prod)
  const userAddress = "0x" + id.padStart(40, "0");

  const identityId = process.env.DASH_IDENTITY_ID;

  db.users.set(id, { id, email, passwordHash, approvedLimit, userAddress, identityId });

  return res.json({ ok: true });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = [...db.users.values()].find(u => u.email === email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || "dev", {
    expiresIn: "8h"
  });

  return res.json({
    token,
    user: { id: user.id, email: user.email, approvedLimit: user.approvedLimit, userAddress: user.userAddress, identityId: user.identityId }
  });
});