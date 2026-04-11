import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { logCapsuleCreated } from "../services/auditChain.js";
import { getClient, mineBlocks } from "../services/dashClient.js";

export const capsuleRouter = express.Router();

// Base schema for all capsules
const baseCapsuleSchema = {
  allowedMcc: z.array(z.string().min(2)).min(1),
  maxTransaction: z.number().int().positive(),
  dailyCap: z.number().int().positive(),
  capsuleLimit: z.number().int().positive()
};

// Regular capsule schema
const regularCapsuleSchema = z.object(baseCapsuleSchema);

// Emergency capsule schema (extends base)
const emergencyCapsuleSchema = z.object({
  ...baseCapsuleSchema,
  type: z.literal("EMERGENCY"),
  emergencyType: z.enum(["NATURAL_DISASTER", "HEALTH_CRISIS", "INCOME_SHOCK", "FAMILY_EMERGENCY"]),
  verificationDoc: z.string().min(1),
  verificationStatus: z.literal("approved")
});

// Combined schema for validation
const createCapsuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REGULAR").optional(), ...baseCapsuleSchema }),
  emergencyCapsuleSchema
]);

// Dash anchoring function
async function anchorToDash(identityId, rulesHash, rules, capsuleType = "REGULAR", emergencyType = null) {
  if (!process.env.DASH_CONTRACT_ID) {
    console.log('⚠️ No DASH_CONTRACT_ID, skipping Dash anchor');
    return null;
  }

  try {
    const client = getClient();
    const identity = await client.platform.identities.get(identityId);

    if (!identity) {
      console.warn(`⚠️ Identity ${identityId} not found`);
      return null;
    }

    // Get a wallet address for mining
    const account = await client.wallet.getAccount();
    const address = await account.getUnusedAddress();
    const miningAddress = address.address;

    const typeLocator = 'creditCapsuleApp.creditCapsuleV3';
    console.log(`📝 Using type locator: ${typeLocator}`);

    const doc = await client.platform.documents.create(
      typeLocator,
      identity,
      {
        ownerId: identityId,
        rulesHash: rulesHash,
        rules: JSON.stringify(rules),
        capsuleType: capsuleType,
        emergencyType: emergencyType || "",
        createdAt: Date.now(),
      }
    );

    await client.platform.documents.broadcast({ create: [doc] }, identity);

    if (process.env.DASH_NETWORK === 'local') {
      await mineBlocks(5, miningAddress);
    }

    console.log(`✅ Anchored to Dash: ${doc.getId()}`);
    return { documentId: doc.getId().toString() };

  } catch (error) {
    console.warn('⚠️ Failed to anchor to Dash:', error.message);
    return null;
  }
}

// GET /api/capsule - Get user's capsule
capsuleRouter.get("/", requireAuth, (req, res) => {
  const cap = db.capsules.get(req.user.userId) || null;
  return res.json({ capsule: cap });
});

// GET /api/capsule/emergency-types - Get available emergency types
capsuleRouter.get("/emergency-types", requireAuth, (req, res) => {
  const emergencyTypes = [
    { id: "NATURAL_DISASTER", name: "Natural Disaster", feeWaiver: "100%", extensionDays: 30, maxAmount: 1000 },
    { id: "HEALTH_CRISIS", name: "Medical Emergency", feeWaiver: "100%", extensionDays: 60, maxAmount: 500 },
    { id: "INCOME_SHOCK", name: "Sudden Job Loss", feeWaiver: "50%", extensionDays: 90, maxAmount: 300 },
    { id: "FAMILY_EMERGENCY", name: "Family Crisis", feeWaiver: "50%", extensionDays: 30, maxAmount: 250 }
  ];
  return res.json({ emergencyTypes });
});

// GET /api/capsule/emergency-status - Get emergency verification status
capsuleRouter.get("/emergency-status", requireAuth, (req, res) => {
  const userId = req.user.userId;

  const activeCapsule = db.capsules.get(userId);
  const hasActiveEmergency = activeCapsule && activeCapsule.type === "EMERGENCY" && activeCapsule.status === "ACTIVE";

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentEmergency = db.emergencyHistory?.find(e =>
    e.userId === userId && new Date(e.createdAt) > sixMonthsAgo
  );

  res.json({
    hasActiveEmergency,
    canRequestEmergency: !hasActiveEmergency && !recentEmergency,
    lastEmergency: recentEmergency || null,
    activeCapsule: hasActiveEmergency ? activeCapsule : null
  });
});

// POST /api/capsule/create - Create a new capsule (Regular or Emergency)
capsuleRouter.post("/create", requireAuth, async (req, res) => {
  const parsed = createCapsuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = db.users.get(req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const data = parsed.data;
  const isEmergency = data.type === "EMERGENCY";

  let rules = { ...data };
  let emergencyMetadata = null;

  // Handle Emergency Capsule
  if (isEmergency) {
    // Check if user already has active emergency capsule
    const existingCapsule = db.capsules.get(req.user.userId);
    if (existingCapsule && existingCapsule.type === "EMERGENCY" && existingCapsule.status === "ACTIVE") {
      return res.status(400).json({ error: "You already have an active emergency capsule" });
    }

    // Check cooldown period (6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const pastEmergency = db.emergencyHistory?.find(e =>
      e.userId === req.user.userId &&
      new Date(e.createdAt) > sixMonthsAgo
    );

    if (pastEmergency) {
      return res.status(400).json({ error: "Emergency relief already used in last 6 months" });
    }

    // Get emergency rules
    const emergencyRules = {
      NATURAL_DISASTER: { feeWaiver: "100%", extensionDays: 30, maxAmount: 1000 },
      HEALTH_CRISIS: { feeWaiver: "100%", extensionDays: 60, maxAmount: 500 },
      INCOME_SHOCK: { feeWaiver: "50%", extensionDays: 90, maxAmount: 300 },
      FAMILY_EMERGENCY: { feeWaiver: "50%", extensionDays: 30, maxAmount: 250 }
    }[data.emergencyType];

    if (!emergencyRules) {
      return res.status(400).json({ error: "Invalid emergency type" });
    }

    // Apply emergency rules (override)
    rules.capsuleLimit = Math.min(rules.capsuleLimit, emergencyRules.maxAmount);
    rules.feeRate = emergencyRules.feeWaiver === "100%" ? 0 : 0.5;
    rules.expiryDays = emergencyRules.extensionDays;
    rules.allowedMcc = ["GROCERY", "MEDICAL", "PHARMACY", "UTILITIES"];

    emergencyMetadata = {
      emergencyType: data.emergencyType,
      verificationDoc: data.verificationDoc,
      feeWaiver: emergencyRules.feeWaiver,
      expiryDate: new Date(Date.now() + (emergencyRules.extensionDays * 24 * 60 * 60 * 1000)).toISOString()
    };

    console.log(`🚨 EMERGENCY CAPSULE: ${data.emergencyType} for user ${req.user.userId}`);
  }
  // Handle Regular Capsule
  else {
    if (rules.capsuleLimit > user.approvedLimit) {
      return res.status(400).json({ error: "Capsule limit exceeds approved limit" });
    }
  }

  // Save to local database
  const today = new Date().toISOString().slice(0, 10);
  const capsuleData = {
    type: isEmergency ? "EMERGENCY" : "REGULAR",
    rules: rules,
    capsuleLimit: rules.capsuleLimit,
    spentTotal: 0,
    spentToday: 0,
    todayDate: today,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    ...emergencyMetadata
  };

  db.capsules.set(req.user.userId, capsuleData);

  // Generate rules hash
  const rulesHash = "0x" + crypto
    .createHash("sha256")
    .update(JSON.stringify(rules))
    .digest("hex");

  // 🔗 Anchor to Dash (optional, doesn't break if fails)
  let dashAnchor = null;
  const identityId = req.identity?.id || user.identityId;

  if (identityId && process.env.DASH_CONTRACT_ID) {
    console.log(`🔗 Anchoring ${isEmergency ? 'EMERGENCY' : 'REGULAR'} capsule to Dash for identity: ${identityId}`);
    dashAnchor = await anchorToDash(
      identityId,
      rulesHash,
      rules,
      isEmergency ? "EMERGENCY" : "REGULAR",
      isEmergency ? data.emergencyType : null
    );
  } else {
    console.log('⚠️ No Dash identity or contract ID, skipping Dash anchor');
  }

  // Legacy Ethereum audit chain (optional)
  const chain = await logCapsuleCreated({
    userAddress: user.userAddress,
    rulesHash,
    limit: rules.capsuleLimit,
    capsuleType: isEmergency ? "EMERGENCY" : "REGULAR",
    emergencyType: isEmergency ? data.emergencyType : null
  });

  const message = isEmergency
    ? `Emergency capsule activated with ${emergencyMetadata.feeWaiver} fee waiver until ${emergencyMetadata.expiryDate}`
    : "Regular capsule created successfully";

  return res.json({
    ok: true,
    rulesHash,
    dash: dashAnchor,
    chain,
    capsuleType: isEmergency ? "EMERGENCY" : "REGULAR",
    message
  });
});

// POST /api/capsule/close - Close/Delete capsule
capsuleRouter.post("/close", requireAuth, (req, res) => {
  const capsule = db.capsules.get(req.user.userId);
  if (!capsule) {
    return res.status(404).json({ error: "No active capsule found" });
  }

  // Record emergency history if it was an emergency capsule
  if (capsule.type === "EMERGENCY") {
    if (!db.emergencyHistory) db.emergencyHistory = [];
    db.emergencyHistory.push({
      userId: req.user.userId,
      emergencyType: capsule.emergencyType,
      createdAt: capsule.createdAt,
      closedAt: new Date().toISOString()
    });
  }

  db.capsules.delete(req.user.userId);

  return res.json({
    ok: true,
    message: capsule.type === "EMERGENCY" ? "Emergency fund capsule closed." : "Capsule closed successfully"
  });
});

// DELETE /api/capsule - Delete capsule (alternative endpoint)
capsuleRouter.delete("/", requireAuth, (req, res) => {
  db.capsules.delete(req.user.userId);
  return res.json({ ok: true });
});