import express from "express";
import { requestNonce, requireAuth } from "../middleware/auth.js";
import { getClient } from "../services/dashClient.js";
import { db } from "../storage/memoryDb.js";

export const dashAuthRouter = express.Router();

// Request nonce for authentication
dashAuthRouter.post("/nonce", requestNonce);

// Get current Dash identity
dashAuthRouter.get("/me", requireAuth, (req, res) => {
    const user = db.users.get(req.user.userId);
    res.json({
        identityId: req.identity?.id || user?.identityId,
        userId: req.user.userId,
        email: user?.email,
        authenticated: true
    });
});

// Verify identity exists on network
dashAuthRouter.get("/verify/:identityId", async (req, res) => {
    const { identityId } = req.params;
    const client = getClient();

    try {
        const identity = await client.platform.identities.get(identityId);
        res.json({ valid: true, identityId: identity.getId().toString() });
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});