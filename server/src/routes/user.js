import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/memoryDb.js";

export const userRouter = express.Router();

// Get user verification status
userRouter.get("/verification-status", requireAuth, (req, res) => {
    const userId = req.user.userId;
    const user = db.users.get(userId);

    // Return verification status from user record or defaults
    res.json({
        student: user?.verificationStatus?.student || false,
        freelancer: user?.verificationStatus?.freelancer || false,
        premium: user?.verificationStatus?.premium || false,
        student_verified_at: user?.verificationStatus?.student_verified_at || null,
        freelancer_verified_at: user?.verificationStatus?.freelancer_verified_at || null,
        premium_verified_at: user?.verificationStatus?.premium_verified_at || null
    });
});

// Update verification status
userRouter.post("/verify", requireAuth, (req, res) => {
    const { type, verified, verificationData } = req.body;
    const userId = req.user.userId;
    const user = db.users.get(userId);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    if (!user.verificationStatus) {
        user.verificationStatus = {};
    }

    user.verificationStatus[type] = verified;
    if (verified) {
        user.verificationStatus[`${type}_verified_at`] = new Date().toISOString();
    }

    db.users.set(userId, user);

    res.json({ success: true, type, verified });
});