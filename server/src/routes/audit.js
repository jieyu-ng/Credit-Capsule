import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { getAuditAbiAndAddress } from "../services/auditChain.js";

export const auditRouter = express.Router();

auditRouter.get("/meta", requireAuth, (_req, res) => {
  return res.json(getAuditAbiAndAddress());
});

auditRouter.get("/txns", requireAuth, (req, res) => {
  try {
    let transactions = [];

    if (db.transactions instanceof Map) {
      transactions = Array.from(db.transactions.values());
    } else if (Array.isArray(db.transactions)) {
      transactions = db.transactions;
    }

    const list = transactions
      .filter(t => t && t.userId === req.user.userId)
      .slice(-50)
      .reverse();

    return res.json({ txns: list });
  } catch (error) {
    console.error('Error in /txns:', error);
    return res.status(500).json({ error: error.message });
  }
});

auditRouter.get("/capsule", requireAuth, (req, res) => {
  try {
    const cap = db.capsules.get(req.user.userId) || null;
    return res.json({ capsule: cap });
  } catch (error) {
    console.error('Error in /capsule:', error);
    return res.status(500).json({ error: error.message });
  }
});