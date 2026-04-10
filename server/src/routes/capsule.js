import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { logCapsuleCreated } from "../services/auditChain.js";
import { getClient } from "../services/dashClient.js";

export const capsuleRouter = express.Router();

const capsuleSchema = z.object({
  allowedMcc: z.array(z.string().min(2)).min(1),
  maxTransaction: z.number().int().positive(),
  dailyCap: z.number().int().positive(),
  capsuleLimit: z.number().int().positive()
});

capsuleRouter.get("/", requireAuth, (req, res) => {
  const cap = db.capsules.get(req.user.userId) || null;
  return res.json({ capsule: cap });
});

capsuleRouter.post("/create", requireAuth, async (req, res) => {
  const parsed = capsuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = db.users.get(req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const rules = parsed.data;

  if (rules.capsuleLimit > user.approvedLimit) {
    return res.status(400).json({ error: "Capsule limit exceeds approved limit" });
  }

  const today = new Date().toISOString().slice(0, 10);
  db.capsules.set(req.user.userId, {
    rules,
    capsuleLimit: rules.capsuleLimit,
    spentTotal: 0,
    spentToday: 0,
    todayDate: today
  });

  const rulesHash = "0x" + crypto
    .createHash("sha256")
    .update(JSON.stringify(rules))
    .digest("hex");

  // 🔗 Anchor to Dash
  const dashDoc = await anchorCapsuleOnDash(
    req.session.identityId, // or req.user.identityId (depending on your auth)
    rulesHash
  );

  // 🧾 Existing audit chain
  const chain = await logCapsuleCreated({
    userAddress: user.userAddress,
    rulesHash,
    limit: rules.capsuleLimit
  });

  return res.json({
    ok: true,
    rulesHash,
    dash: dashDoc,
    chain
  });
});

async function anchorCapsuleOnDash(identityId, rulesHash) {
  const client = getClient();

  const identity = await client.platform.identities.get(identityId);

  const doc = await client.platform.documents.create(
    `${process.env.DASH_CONTRACT_ID}.creditCapsule`,
    identity,
    {
      ownerId: identityId,
      rulesHash,
      createdAt: Date.now(),
    }
  );

  await client.platform.documents.broadcast(
    { create: [doc] },
    identity
  );

  return doc.toJSON();
}