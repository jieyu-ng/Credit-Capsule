import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db, getBankData, findUserById } from "../storage/memoryDb.js";
import { logCapsuleCreated } from "../services/auditChain.js";
import { simulatePD, pdToCapsuleLimit, computeRiskTier } from "../services/riskEngine.js";

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

// Replace the entire /create endpoint (from line ~30 to ~85)
capsuleRouter.post("/create", requireAuth, async (req, res) => {
  try {
    const parsed = capsuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = db.users.get(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let rules = parsed.data;
    
    // Get bank data for risk assessment
    const bankData = getBankData(req.user.userId);
    let riskResults = { pd: 0.02 }; // Default low risk

    if (bankData.linked) {
      // Use the Monte Carlo engine from riskEngine.js
      riskResults = simulatePD({
        monthlyIncomeMean: bankData.avgIncome,
        monthlyIncomeStdev: bankData.incomeVolatility,
        startingCash: bankData.currentBalance
      });
    }

    const { capsuleLimit, factor } = pdToCapsuleLimit({ 
      approvedLimit: user.approvedLimit, 
      pd: riskResults.pd 
    });

    // Update the newCapsule object to include these results
    const newCapsule = {
      id: req.user.userId,
      ...parsed.data,
      capsuleLimit: capsuleLimit, // This is now dynamically calculated
      riskPD: riskResults.pd,
      factor: factor,
      spentTotal: 0,
      createdAt: new Date()
    };

    // Run Monte Carlo simulation if bank data is available
    let riskAssessment = null;
    let adjustedLimit = rules.capsuleLimit;
    
    if (bankData.linked && bankData.transactionData) {
      // Use YOUR original Monte Carlo simulation
      const simulationResult = simulatePD({
        simulations: 5000,
        months: 6,
        startingCash: 500,
        monthlyIncomeMean: bankData.transactionData.averageMonthlyIncome,
        monthlyIncomeStdev: bankData.transactionData.incomeVolatility * bankData.transactionData.averageMonthlyIncome,
        monthlyExpenseMean: bankData.transactionData.averageMonthlyExpenses,
        monthlyExpenseStdev: bankData.transactionData.expenseVolatility * bankData.transactionData.averageMonthlyExpenses,
        jobLossProb: 0.04,
        emergencyProb: 0.06,
        emergencyCostMean: 900,
        emergencyCostStdev: 300,
        minCashBuffer: 0
      });
      
      // Use YOUR pdToCapsuleLimit function
      const limitResult = pdToCapsuleLimit({ 
        approvedLimit: user.approvedLimit, 
        pd: simulationResult.pd 
      });
      
      riskAssessment = {
        pd: simulationResult.pd,
        riskLevel: simulationResult.pd > 0.15 ? 'HIGH' : simulationResult.pd > 0.05 ? 'MEDIUM' : 'LOW',
        recommendedCapsuleLimit: limitResult.capsuleLimit,
        simulations: simulationResult.simulations,
        defaults: simulationResult.defaults,
        months: simulationResult.months
      };
      
      // Adjust requested limit based on risk assessment
      adjustedLimit = Math.min(rules.capsuleLimit, limitResult.capsuleLimit);
      rules.capsuleLimit = adjustedLimit;
    } else if (rules.capsuleLimit > user.approvedLimit) {
      return res.status(400).json({ 
        error: "Capsule limit exceeds approved limit. Link bank account for risk-based assessment." 
      });
    }
    
    // Final check against approved limit
    if (rules.capsuleLimit > user.approvedLimit) {
      return res.status(400).json({ error: "Capsule limit exceeds approved limit" });
    }

    const today = new Date().toISOString().slice(0, 10);
    
    db.capsules.set(req.user.userId, {
      rules,
      capsuleLimit: rules.capsuleLimit,
      spentTotal: 0,
      spentToday: 0,
      todayDate: today,
      riskAssessment: riskAssessment,
      bankDataUsed: bankData.linked,
      createdAt: new Date().toISOString()
    });

    const rulesHash = "0x" + crypto.createHash("sha256").update(JSON.stringify(rules)).digest("hex");
    const chain = await logCapsuleCreated({ 
      userAddress: user.userAddress, 
      rulesHash, 
      limit: rules.capsuleLimit 
    });

    return res.json({ 
      ok: true, 
      rulesHash, 
      chain,
      adjustedLimit: adjustedLimit !== parsed.data.capsuleLimit,
      riskAssessment: riskAssessment ? {
        pd: riskAssessment.pd,
        riskLevel: riskAssessment.riskLevel,
        recommendedLimit: riskAssessment.recommendedCapsuleLimit,
        simulationDetails: {
          simulations: riskAssessment.simulations,
          defaults: riskAssessment.defaults,
          months: riskAssessment.months
        }
      } : null
    });
  } catch (error) {
    console.error('Create capsule error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Risk assessment endpoint that uses bank data
// Replace the entire /assess-risk endpoint
capsuleRouter.post('/assess-risk', requireAuth, async (req, res) => {
  try {
    const { requestedAmount, capsuleType, duration } = req.body;
    const userId = req.user.userId;
    const user = findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get bank data if linked
    const bankData = getBankData(userId);
    
    let riskAssessment = null;
    
    if (bankData.linked && bankData.transactionData) {
      // Use YOUR original Monte Carlo simulation
      const simulationResult = simulatePD({
        simulations: 5000,
        months: duration || 6,
        startingCash: 500,
        monthlyIncomeMean: bankData.transactionData.averageMonthlyIncome,
        monthlyIncomeStdev: bankData.transactionData.incomeVolatility * bankData.transactionData.averageMonthlyIncome,
        monthlyExpenseMean: bankData.transactionData.averageMonthlyExpenses,
        monthlyExpenseStdev: bankData.transactionData.expenseVolatility * bankData.transactionData.averageMonthlyExpenses,
        jobLossProb: 0.04,
        emergencyProb: 0.06,
        emergencyCostMean: 900,
        emergencyCostStdev: 300,
        minCashBuffer: 0
      });
      
      // Use YOUR pdToCapsuleLimit function
      const limitResult = pdToCapsuleLimit({ 
        approvedLimit: requestedAmount, 
        pd: simulationResult.pd 
      });
      
      // Determine risk level based on PD
      let riskLevel = 'LOW';
      let recommendation = '';
      
      if (simulationResult.pd <= 0.05) {
        riskLevel = 'LOW';
        recommendation = 'Approved - Low risk profile based on Monte Carlo simulation';
      } else if (simulationResult.pd <= 0.15) {
        riskLevel = 'MEDIUM';
        recommendation = 'Approved with caution - Consider lower limit or additional monitoring';
      } else if (simulationResult.pd <= 0.30) {
        riskLevel = 'HIGH';
        recommendation = 'Review Required - High risk profile, consider reducing limit';
      } else {
        riskLevel = 'VERY_HIGH';
        recommendation = 'Declined or very low limit - Risk exceeds acceptable threshold';
      }
      
      riskAssessment = {
        pd: simulationResult.pd,
        riskLevel: riskLevel,
        recommendedCapsuleLimit: limitResult.capsuleLimit,
        confidence: 'HIGH',
        simulationDetails: {
          simulations: simulationResult.simulations,
          defaults: simulationResult.defaults,
          months: simulationResult.months,
          defaultRate: (simulationResult.defaults / simulationResult.simulations * 100).toFixed(2) + '%'
        },
        factors: {
          incomeStability: 1 - bankData.transactionData.incomeVolatility,
          savingsRate: (bankData.transactionData.averageMonthlyIncome - bankData.transactionData.averageMonthlyExpenses) / bankData.transactionData.averageMonthlyIncome,
          volatility: bankData.transactionData.incomeVolatility
        },
        recommendation: recommendation
      };
    } else {
      // No bank data - use conservative estimates
      riskAssessment = {
        pd: 0.15,
        riskLevel: 'MEDIUM',
        recommendedCapsuleLimit: Math.min(requestedAmount, user.approvedLimit * 0.5),
        confidence: 'LOW',
        factors: {
          incomeStability: 0.5,
          savingsRate: 0.15,
          volatility: 0.3
        },
        recommendation: 'Link bank account for accurate risk assessment and better limits'
      };
    }
    
    res.json(riskAssessment);
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate a transaction (for demo purposes)
capsuleRouter.post('/simulate-transaction', requireAuth, async (req, res) => {
  try {
    const { amount, merchant, mcc } = req.body;
    const userId = req.user.userId;
    
    const capsule = db.capsules.get(userId);
    if (!capsule) {
      return res.status(404).json({ error: 'No active capsule found' });
    }
    
    const today = new Date().toISOString().slice(0, 10);
    
    // Reset daily spending if new day
    if (capsule.todayDate !== today) {
      capsule.spentToday = 0;
      capsule.todayDate = today;
      db.capsules.set(userId, capsule);
    }
    
    // Check rules
    let approved = true;
    let reason = '';
    
    // Check if amount exceeds max transaction
    if (amount > capsule.rules.maxTransaction) {
      approved = false;
      reason = `Amount exceeds max transaction limit of ${capsule.rules.maxTransaction}`;
    }
    // Check daily cap
    else if (capsule.spentToday + amount > capsule.rules.dailyCap) {
      approved = false;
      reason = `Would exceed daily cap of ${capsule.rules.dailyCap}`;
    }
    // Check total limit
    else if (capsule.spentTotal + amount > capsule.capsuleLimit) {
      approved = false;
      reason = `Would exceed total capsule limit of ${capsule.capsuleLimit}`;
    }
    // Check MCC
    else if (!capsule.rules.allowedMcc.includes(mcc)) {
      approved = false;
      reason = `Merchant category ${mcc} not allowed`;
    }
    
    if (approved) {
      capsule.spentToday += amount;
      capsule.spentTotal += amount;
      db.capsules.set(userId, capsule);
    }
    
    // Determine risk tier based on spending pattern
    let riskTier = 'LOW';
    const utilization = capsule.spentTotal / capsule.capsuleLimit;
    if (utilization > 0.8) riskTier = 'HIGH';
    else if (utilization > 0.5) riskTier = 'MEDIUM';
    
    // Log transaction decision
    const transactionLog = {
      id: Date.now().toString(),
      userId,
      amount,
      merchant,
      mcc,
      approved,
      reason,
      riskTier,
      timestamp: new Date().toISOString()
    };
    
    if (!db.transactions) db.transactions = new Map();
    db.transactions.set(transactionLog.id, transactionLog);
    
    res.json({
      approved,
      reason: reason || 'Transaction approved',
      remainingLimit: capsule.capsuleLimit - capsule.spentTotal,
      remainingDaily: capsule.rules.dailyCap - capsule.spentToday,
      riskTier
    });
  } catch (error) {
    console.error('Simulate transaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transaction history
capsuleRouter.get('/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = db.transactions 
      ? [...db.transactions.values()].filter(t => t.userId === userId).reverse()
      : [];
    res.json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update capsule rules (for lender dashboard)
capsuleRouter.put('/update-rules', requireAuth, async (req, res) => {
  try {
    // Only lenders can update rules
    const user = db.users.get(req.user.userId);
    if (user.role !== 'lender') {
      return res.status(403).json({ error: 'Only lenders can update rules' });
    }
    
    const { userId, rules } = req.body;
    const targetUser = db.users.get(userId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const capsule = db.capsules.get(userId);
    if (!capsule) {
      return res.status(404).json({ error: 'No capsule found for user' });
    }
    
    // Update rules
    capsule.rules = { ...capsule.rules, ...rules };
    db.capsules.set(userId, capsule);
    
    res.json({ success: true, rules: capsule.rules });
  } catch (error) {
    console.error('Update rules error:', error);
    res.status(500).json({ error: error.message });
  }
});