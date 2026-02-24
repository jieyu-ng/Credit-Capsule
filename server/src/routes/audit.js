import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { getAuditAbiAndAddress } from "../services/auditChain.js";

export const auditRouter = express.Router();

auditRouter.get("/meta", requireAuth, (_req, res) => {
  return res.json(getAuditAbiAndAddress());
});

auditRouter.get("/txns", requireAuth, (req, res) => {
  const list = db.txns.filter(t => t.userId === req.user.userId).slice(-50).reverse();
  return res.json({ txns: list });
});

auditRouter.get("/capsule", requireAuth, (req, res) => {
  const cap = db.capsules.get(req.user.userId) || null;
  return res.json({ capsule: cap });
});