import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { computeRiskTier } from "../services/riskEngine.js";
import { logTxnDecision } from "../services/auditChain.js";

export const txnRouter = express.Router();

const txnSchema = z.object({
  merchant: z.string().min(2),
  mcc: z.string().min(2),           // merchant category code label (e.g., "GROCERY", "FUEL")
  amount: z.number().int().positive(),
  deviceId: z.string().min(2),
  geo: z.string().min(2),           // "Kuala Lumpur" etc.
  pd: z.number().min(0).max(1),     // from simulation result (client can pass last computed PD)
  faceToken: z.string().optional(),
  otp: z.string().optional()
});

function rotateDaily(userId) {
  const cap = db.capsules.get(userId);
  if (!cap) return;

  const today = new Date().toISOString().slice(0, 10);
  if (cap.todayDate !== today) {
    cap.todayDate = today;
    cap.spentToday = 0;
  }
}

function velocityScore(userId) {
  // simplistic: number of txns in last 2 minutes * 10
  const now = Date.now();
  const recent = db.txns.filter(t => t.userId === userId && (now - t.ts) < 2 * 60 * 1000);
  return recent.length * 10;
}

txnRouter.post("/test", requireAuth, async (req, res) => {
  const parsed = txnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user.userId;
  const user = db.users.get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const cap = db.capsules.get(userId);
  if (!cap) return res.status(400).json({ error: "No capsule. Create one first." });

  rotateDaily(userId);

  // anomalies
  const state = db.deviceState.get(userId) || { lastDeviceId: null, lastGeo: null };
  const deviceChanged = state.lastDeviceId && state.lastDeviceId !== parsed.data.deviceId;
  const geoAnomaly = state.lastGeo && state.lastGeo !== parsed.data.geo;

  const vel = velocityScore(userId);

  const risk = computeRiskTier({
    pd: parsed.data.pd,
    deviceChanged,
    geoAnomaly,
    velocityScore: vel
  });

  // Step-up auth enforcement
  if (risk.tier === "MEDIUM") {
    if (!parsed.data.faceToken) {
      return res.status(401).json({ error: "Step-up required: faceToken", risk });
    }
  }
  if (risk.tier === "HIGH") {
    if (!parsed.data.faceToken || !parsed.data.otp) {
      return res.status(401).json({ error: "Step-up required: faceToken + otp", risk });
    }
    // Demo OTP check
    if (parsed.data.otp !== "123456") {
      return res.status(401).json({ error: "Invalid OTP (demo expects 123456)", risk });
    }
  }

  // Capsule rules
  const { merchant, mcc, amount } = parsed.data;
  const rules = cap.rules;

  let approved = true;
  let reason = "APPROVED";

  if (!rules.allowedMcc.includes(mcc)) {
    approved = false; reason = "MCC_NOT_ALLOWED";
  } else if (amount > rules.maxTransaction) {
    approved = false; reason = "EXCEEDS_MAX_TRANSACTION";
  } else if (cap.spentToday + amount > rules.dailyCap) {
    approved = false; reason = "EXCEEDS_DAILY_CAP";
  } else if (cap.spentTotal + amount > rules.capsuleLimit) {
    approved = false; reason = "EXCEEDS_CAPSULE_LIMIT";
  }

  // Apply state updates
  state.lastDeviceId = parsed.data.deviceId;
  state.lastGeo = parsed.data.geo;
  db.deviceState.set(userId, state);

  if (approved) {
    cap.spentToday += amount;
    cap.spentTotal += amount;
  }

  const record = {
    userId,
    merchant,
    mcc,
    amount,
    approved,
    riskTier: risk.tier,
    reason,
    ts: Date.now()
  };
  db.txns.push(record);

  const chain = await logTxnDecision({
    userAddress: user.userAddress,
    merchant,
    mcc,
    amount,
    approved,
    riskTier: risk.tier
  });

  return res.json({
    approved,
    reason,
    risk,
    capsule: { spentToday: cap.spentToday, spentTotal: cap.spentTotal, capsuleLimit: cap.capsuleLimit },
    chain
  });
});