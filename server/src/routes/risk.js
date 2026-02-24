import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { simulatePD, pdToCapsuleLimit } from "../services/riskEngine.js";

export const riskRouter = express.Router();

const simSchema = z.object({
  simulations: z.number().int().min(1000).max(10000).default(5000),
  months: z.number().int().min(1).max(12).default(6),
  startingCash: z.number().min(0).max(20000).default(500),
  monthlyIncomeMean: z.number().min(0).max(50000).default(3000),
  monthlyIncomeStdev: z.number().min(0).max(20000).default(600),
  monthlyExpenseMean: z.number().min(0).max(50000).default(2200),
  monthlyExpenseStdev: z.number().min(0).max(20000).default(400),
  jobLossProb: z.number().min(0).max(0.5).default(0.04),
  emergencyProb: z.number().min(0).max(0.8).default(0.06),
  emergencyCostMean: z.number().min(0).max(50000).default(900),
  emergencyCostStdev: z.number().min(0).max(50000).default(300),
  minCashBuffer: z.number().min(-5000).max(5000).default(0)
});

riskRouter.post("/simulate", requireAuth, (req, res) => {
  const parsed = simSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = db.users.get(req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const result = simulatePD(parsed.data);
  const sizing = pdToCapsuleLimit({ approvedLimit: user.approvedLimit, pd: result.pd });

  return res.json({
    pd: result.pd,
    simulations: result.simulations,
    months: result.months,
    suggestedCapsuleLimit: sizing.capsuleLimit,
    factor: sizing.factor
  });
});