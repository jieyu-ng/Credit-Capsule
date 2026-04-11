import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, nextId, findUserByEmail, linkBank, getBankData } from "../storage/memoryDb.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  approvedLimit: z.number().int().positive().max(50000).default(5000)
});

authRouter.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email, password, approvedLimit } = parsed.data;
    const exists = findUserByEmail(email);
    if (exists) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const id = nextId();
    const passwordHash = await bcrypt.hash(password, 10);

    // Demo "blockchain user address": derived-ish fake (don't do this in prod)
    const userAddress = "0x" + id.padStart(40, "0");

    const identityId = process.env.DASH_IDENTITY_ID;

    db.users.set(id, { id, email, passwordHash, approvedLimit, userAddress, identityId });

    return res.json({ ok: true, userId: id });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET || "dev_secret_key",
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      user: { id: user.id, email: user.email, approvedLimit: user.approvedLimit, userAddress: user.userAddress, identityId: user.identityId }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Optional: Add a logout endpoint (stateless JWT, just for completeness)
authRouter.post("/logout", requireAuth, (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  return res.json({ ok: true, message: "Logged out successfully" });
});

// Get current user info
authRouter.get("/me", requireAuth, (req, res) => {
  const user = db.users.get(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    approvedLimit: user.approvedLimit,
    userAddress: user.userAddress,
    identityId: user.identityId
  });
});

// Add bank linking endpoint
authRouter.post("/link-bank", requireAuth, async (req, res) => {
  try {
    const { bankName, transactionData, accountType } = req.body;
    const userId = req.user.userId;

    const success = linkBank(userId, bankName, transactionData);

    if (success) {
      return res.json({ success: true, bankName, accountType });
    } else {
      return res.status(400).json({ error: "Failed to link bank account" });
    }
  } catch (error) {
    console.error('Bank linking error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add bank data endpoint
authRouter.get("/bank-data", requireAuth, (req, res) => {
  const userId = req.user.userId;
  const bankData = getBankData(userId);
  return res.json({ success: true, data: bankData });
});