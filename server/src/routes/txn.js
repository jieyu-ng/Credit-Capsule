import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { computeRiskTier } from "../services/riskEngine.js";
import { logTxnDecision } from "../services/auditChain.js";

export const txnRouter = express.Router();

const txnSchema = z.object({
  merchant: z.string().min(2),
  mcc: z.string().min(2),
  amount: z.number().int().positive(),
  deviceId: z.string().min(2),
  geo: z.string().min(2),
  pd: z.number().min(0).max(1),
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
  const now = Date.now();
  const recent = db.txns.filter(t => t.userId === userId && (now - t.ts) < 2 * 60 * 1000);
  return recent.length * 10;
}

// Helper to create a default demo capsule if none exists
function ensureDefaultCapsule(userId, userApprovedLimit = 500) {
  let cap = db.capsules.get(userId);
  if (!cap) {
    const today = new Date().toISOString().slice(0, 10);
    cap = {
      rules: {
        allowedMcc: [
          "GROCERY", "RESTAURANT", "TRANSPORT", "FUEL", 
          "EDUCATION", "MEDICAL", "SHOPPING", "UTILITIES"
        ],
        maxTransaction: 200,
        dailyCap: 300
      },
      capsuleLimit: Math.min(userApprovedLimit, 500),
      spentTotal: 0,
      spentToday: 0,
      todayDate: today
    };
    db.capsules.set(userId, cap);
    console.log(`✅ Auto-created default capsule for user ${userId} with allowed MCCs:`, cap.rules.allowedMcc);
  }
  return cap;
}

txnRouter.post("/test", requireAuth, async (req, res) => {
  const parsed = txnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = req.user.userId;
  const user = db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Auto-create default capsule if none exists (for demo convenience)
  const cap = ensureDefaultCapsule(userId, user.approvedLimit);

  rotateDaily(userId);

  // Anomalies detection
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
      return res.status(401).json({ 
        error: "Step-up required: faceToken", 
        risk,
        requiredAuth: "FACE_TOKEN"
      });
    }
  }
  if (risk.tier === "HIGH") {
    if (!parsed.data.faceToken || !parsed.data.otp) {
      return res.status(401).json({ 
        error: "Step-up required: faceToken + otp", 
        risk,
        requiredAuth: "FACE_TOKEN_AND_OTP"
      });
    }
    if (parsed.data.otp !== "123456") {
      return res.status(401).json({ 
        error: "Invalid OTP (demo expects 123456)", 
        risk 
      });
    }
  }

  // Capsule rules check
  const { merchant, mcc, amount } = parsed.data;
  const rules = cap.rules;
  
  // Case-insensitive MCC check
  const normalizedMcc = mcc.toUpperCase();
  const allowedMccUpper = rules.allowedMcc.map(m => m.toUpperCase());
  
  let approved = true;
  let reason = "APPROVED";
  let debugInfo = {};

  if (!allowedMccUpper.includes(normalizedMcc)) {
    approved = false;
    reason = `MCC_NOT_ALLOWED: "${mcc}" not in allowed list [${rules.allowedMcc.join(", ")}]`;
  } else if (amount > rules.maxTransaction) {
    approved = false;
    reason = `EXCEEDS_MAX_TRANSACTION: $${amount} > $${rules.maxTransaction}`;
  } else if (cap.spentToday + amount > rules.dailyCap) {
    approved = false;
    reason = `EXCEEDS_DAILY_CAP: Daily $${cap.spentToday} + $${amount} > $${rules.dailyCap}`;
  } else if (cap.spentTotal + amount > cap.capsuleLimit) {
    approved = false;
    reason = `EXCEEDS_CAPSULE_LIMIT: Total $${cap.spentTotal} + $${amount} > $${cap.capsuleLimit}`;
  }

  // Update device state
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

  // Log to blockchain (optional, don't fail if it errors)
  let chain = { ok: false, skipped: true };
  try {
    chain = await logTxnDecision({
      userAddress: user.userAddress,
      merchant,
      mcc,
      amount,
      approved,
      riskTier: risk.tier
    });
  } catch (chainError) {
    console.warn("Blockchain logging failed:", chainError.message);
    chain = { ok: false, error: chainError.message };
  }

  return res.json({
    approved,
    reason,
    risk: {
      tier: risk.tier,
      score: risk.score || (risk.tier === "LOW" ? 20 : risk.tier === "MEDIUM" ? 50 : 80),
      breakdown: {
        pdScore: parsed.data.pd > 0.08 ? 30 : parsed.data.pd > 0.03 ? 15 : 5,
        deviceScore: deviceChanged ? 20 : 0,
        geoScore: geoAnomaly ? 15 : 0,
        velScore: vel
      }
    },
    capsule: { 
      spentToday: cap.spentToday, 
      spentTotal: cap.spentTotal, 
      capsuleLimit: cap.capsuleLimit,
      dailyRemaining: rules.dailyCap - cap.spentToday,
      allowedMcc: rules.allowedMcc
    },
    chain
  });
});

// Helper endpoint to check current capsule
txnRouter.get("/capsule-status", requireAuth, (req, res) => {
  const userId = req.user.userId;
  const cap = db.capsules.get(userId);
  
  if (!cap) {
    return res.json({ 
      hasCapsule: false, 
      message: "No capsule. Please create one in Capsule Setup." 
    });
  }
  
  return res.json({
    hasCapsule: true,
    capsule: {
      limit: cap.capsuleLimit,
      spentTotal: cap.spentTotal,
      spentToday: cap.spentToday,
      rules: cap.rules
    }
  });
});

// Quick demo capsule setup (bypasses normal creation)
txnRouter.post("/quick-setup", requireAuth, (req, res) => {
  const userId = req.user.userId;
  const user = db.users.get(userId);
  const today = new Date().toISOString().slice(0, 10);
  
  const demoCapsule = {
    rules: {
      allowedMcc: [
        "GROCERY", "RESTAURANT", "TRANSPORT", "FUEL", "EDUCATION", "MEDICAL", "SHOPPING", "UTILITIES"
      ],
      maxTransaction: 200,
      dailyCap: 300
    },
    capsuleLimit: Math.min(user?.approvedLimit || 500, 500),
    spentTotal: 0,
    spentToday: 0,
    todayDate: today
  };
  
  db.capsules.set(userId, demoCapsule);
  
  res.json({
    success: true,
    message: "Demo capsule created! Allowed MCCs: GROCERY, RESTAURANT, TRANSPORT, FUEL, EDUCATION, MEDICAL",
    capsule: demoCapsule
  });
});