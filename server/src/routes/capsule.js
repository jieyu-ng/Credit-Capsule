import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { logCapsuleCreated } from "../services/auditChain.js";

export const capsuleRouter = express.Router();

const capsuleSchema = z.object({
  allowedMcc: z.array(z.string().min(2)).min(1),
  maxTransaction: z.number().int().positive(),
  dailyCap: z.number().int().positive(),
  capsuleLimit: z.number().int().positive(),
  emergencyType: z.string().optional(),
  verificationDoc: z.string().optional(),
  verificationStatus: z.string().optional()
});

capsuleRouter.get("/", requireAuth, (req, res) => {
  const cap = db.capsules.get(req.user.userId) || null;
  return res.json({ capsule: cap });
});

// Get available emergency types 
capsuleRouter.get("/emergency-types", requireAuth, (req, res) => {
  const emergencyTypes = [
    { id: "NATURAL_DISASTER", name: "Natural Disaster", feeWaiver: "100%", extensionDays: 30, maxAmount: 1000 },
    { id: "HEALTH_CRISIS", name: "Medical Emergency", feeWaiver: "100%", extensionDays: 60, maxAmount: 500 },
    { id: "INCOME_SHOCK", name: "Sudden Job Loss", feeWaiver: "50%", extensionDays: 90, maxAmount: 300 },
    { id: "FAMILY_EMERGENCY", name: "Family Crisis", feeWaiver: "50%", extensionDays: 30, maxAmount: 250 }
  ];
  return res.json({ emergencyTypes });
});

capsuleRouter.post("/create", requireAuth, async (req, res) => {
  const parsed = capsuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = db.users.get(req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { type, emergencyType, verificationDoc, verificationStatus, ...rules } = parsed.data;
  
  let finalRules = { ...rules };
  let emergencyMetadata = null;

  //Emergency Capsule
  if (type === "EMERGENCY") {
    // Check if verification was approved
    if (verificationStatus !== "approved") {
      return res.status(400).json({ error: "Emergency verification required before creating capsule" });
    }
    
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
    }[emergencyType];
    
    if (!emergencyRules) {
      return res.status(400).json({ error: "Invalid emergency type" });
    }
    
    // Apply emergency rules (override)
    finalRules.capsuleLimit = Math.min(rules.capsuleLimit, emergencyRules.maxAmount);
    finalRules.feeRate = emergencyRules.feeWaiver === "100%" ? 0 : 0.5;
    finalRules.expiryDays = emergencyRules.extensionDays;
    finalRules.allowedMcc = ["GROCERY", "MEDICAL", "PHARMACY", "UTILITIES"];
    
    emergencyMetadata = {
      emergencyType: emergencyType,
      verificationDoc: verificationDoc,
      feeWaiver: emergencyRules.feeWaiver,
      expiryDate: new Date(Date.now() + (emergencyRules.extensionDays * 24 * 60 * 60 * 1000)).toISOString()
    };
    
    console.log(`🚨 EMERGENCY CAPSULE: ${emergencyType} for user ${req.user.userId}`);
  }
  
  //Regular Capsule
  else {
    if (finalRules.capsuleLimit > user.approvedLimit) {
      return res.status(400).json({ error: "Capsule limit exceeds approved limit" });
    }
  }
  

  const today = new Date().toISOString().slice(0, 10);

  const capsuleData = {
    type: type,
    rules: finalRules,
    capsuleLimit: finalRules.capsuleLimit,
    spentTotal: 0,
    spentToday: 0,
    todayDate: today,
    status: "ACTIVE",
    createdAt: new Date().toString(),
    ...emergencyMetadata
  }

  db.capsules.set(req.user.userId, capsuleData);

  const rulesHash = "0x" + crypto.createHash("sha256").update(JSON.stringify(rules)).digest("hex");
  const chain = await logCapsuleCreated({ userAddress: user.userAddress, rulesHash, limit: rules.capsuleLimit, capsuleType: type, emergencyType: emergencyType||null });

  const message = type === "EMERGENCY" 
    ? `Emergency capsule activated with ${emergencyMetadata.feeWaiver} fee waiver for ${emergencyMetadata.expiryDate}`
    : "Regular capsule created successfully";

  return res.json({ ok: true, rulesHash, chain, capsuleType: type, message });
});

//Close Capsule
capsuleRouter.post("/close", requireAuth,(req,res)=> {
  const capsule = db.capsules.get(req.user.userId);
  if (!capsule) {
    return res.status(404).json({error:"No active capsule found"});
  }
  db.capsules.delete(req.user.userId);

  return res.json({ok: true, message: capsule.type==="emergency"? "Emergency fund capsule closed.":"Capsule closed succesfully" })
})

// Get emergency verification status
capsuleRouter.get("/emergency-status", requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  // Check if user has active emergency capsule
  const activeCapsule = db.capsules.get(userId);
  const hasActiveEmergency = activeCapsule && activeCapsule.type === "emergency" && activeCapsule.status === "ACTIVE";
  
  // Check recent emergency history (last 6 months)
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
