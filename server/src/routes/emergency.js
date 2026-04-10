import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";
import { logEmergencyVerified } from "../services/auditChain.js";

export const emergencyRouter = express.Router();

// POST /api/emergency/verify - Verify emergency document
emergencyRouter.post("/verify", requireAuth, async (req, res) => {
  try {
    const { emergencyType, documentName } = req.body;
    const userId = req.user.userId;
    
    if (!emergencyType) {
      return res.status(400).json({ approved: false, reason: "Emergency type not specified" });
    }
    
    // Mock verification logic (in production, use OCR + AI)
    // For prototype, we'll simulate verification
    const mockVerification = () => {
      // Simulate different verification outcomes
      // 80% approval rate for prototype
      const approved = Math.random() > 0.2;
      
      // Add some realistic denial reasons
      const denialReasons = [
        "Document is blurry or unreadable",
        "Document type doesn't match emergency type",
        "Document appears to be expired",
        "Information in document doesn't match user profile"
      ];
      
      return {
        approved,
        reason: approved ? "Document verified successfully" : denialReasons[Math.floor(Math.random() * denialReasons.length)]
      };
    };
    
    const result = mockVerification();
    
    // Store verification record
    if (!db.emergencyVerifications) db.emergencyVerifications = [];
    db.emergencyVerifications.push({
      userId: userId,
      emergencyType: emergencyType,
      documentName: documentName || "mock_document.pdf",
      approved: result.approved,
      reason: result.reason,
      timestamp: new Date().toISOString()
    });
    
    // Log to blockchain if approved
    if (result.approved) {
      const user = db.users.get(userId);
      if (user) {
        await logEmergencyVerified({
          userAddress: user.userAddress,
          emergencyType: emergencyType,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.json({
      approved: result.approved,
      reason: result.reason,
      verificationId: `ver_${Date.now()}`
    });
    
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ approved: false, reason: "Verification service error" });
  }
});

// GET /api/emergency/history - Get user's emergency history
emergencyRouter.get("/history", requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  const history = db.emergencyHistory?.filter(e => e.userId === userId) || [];
  const verifications = db.emergencyVerifications?.filter(v => v.userId === userId) || [];
  
  res.json({
    history,
    verifications,
    canRequestNew: history.length === 0 || history.every(h => new Date(h.createdAt) < new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000))
  });
});