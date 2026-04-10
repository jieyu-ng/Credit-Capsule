// src/routes/capsule.js
import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { logCapsuleCreated } from "../services/auditChain.js";
import { getClient, mineBlocks } from "../services/dashClient.js";

export const capsuleRouter = express.Router();

const capsuleSchema = z.object({
  allowedMcc: z.array(z.string().min(2)).min(1),
  maxTransaction: z.number().int().positive(),
  dailyCap: z.number().int().positive(),
  capsuleLimit: z.number().int().positive()
});

// Dash anchoring function
async function anchorToDash(identityId, rulesHash, rules) {
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

    const typeLocator = 'creditCapsuleApp.creditCapsuleV2';
    console.log(`📝 Using type locator: ${typeLocator}`);

    const doc = await client.platform.documents.create(
      typeLocator,
      identity,
      {
        ownerId: identityId,
        rulesHash: rulesHash,
        rules: JSON.stringify(rules),
        createdAt: Date.now(),
      }
    );

    await client.platform.documents.broadcast({ create: [doc] }, identity);

    // ✅ Fix: Pass wallet address, not identityId
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

// POST /api/capsule/create - Create a new capsule
capsuleRouter.post("/create", requireAuth, async (req, res) => {
  const parsed = capsuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = db.users.get(req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const rules = parsed.data;

  if (rules.capsuleLimit > user.approvedLimit) {
    return res.status(400).json({ error: "Capsule limit exceeds approved limit" });
  }

  // Save to local database
  const today = new Date().toISOString().slice(0, 10);
  db.capsules.set(req.user.userId, {
    rules,
    capsuleLimit: rules.capsuleLimit,
    spentTotal: 0,
    spentToday: 0,
    todayDate: today
  });

  // Generate rules hash
  const rulesHash = "0x" + crypto
    .createHash("sha256")
    .update(JSON.stringify(rules))
    .digest("hex");

  // 🔗 Anchor to Dash (optional, doesn't break if fails)
  let dashAnchor = null;
  const identityId = req.identity?.id || user.identityId;

  if (identityId && process.env.DASH_CONTRACT_ID) {
    console.log(`🔗 Anchoring capsule to Dash for identity: ${identityId}`);
    dashAnchor = await anchorToDash(identityId, rulesHash, rules);
  } else {
    console.log('⚠️ No Dash identity or contract ID, skipping Dash anchor');
  }

  // Legacy Ethereum audit chain (optional)
  const chain = await logCapsuleCreated({
    userAddress: user.userAddress,
    rulesHash,
    limit: rules.capsuleLimit
  });

  // Return response with Dash anchor info
  return res.json({
    ok: true,
    rulesHash,
    dash: dashAnchor,  // This will be null if Dash anchoring failed
    chain
  });
});

// DELETE /api/capsule - Delete capsule (optional)
capsuleRouter.delete("/", requireAuth, (req, res) => {
  db.capsules.delete(req.user.userId);
  return res.json({ ok: true });
});