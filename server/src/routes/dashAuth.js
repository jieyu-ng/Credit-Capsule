import express from "express";
import { requestNonce, requireAuth, createSession } from "../middleware/auth.js";
import { getClient } from "../services/dashClient.js";
import { db } from "../storage/memoryDb.js";

export const dashAuthRouter = express.Router();

// Request nonce for authentication
dashAuthRouter.post("/nonce", requestNonce);

// Get current Dash identity (with session token support)
dashAuthRouter.get("/me", requireAuth, (req, res) => {
    const user = db.users.get(req.user.userId);

    const response = {
        identityId: req.identity?.id || user?.identityId,
        userId: req.user.userId.toString(),
        email: user?.email || null,
        authenticated: true,
        approvedLimit: user?.approvedLimit || 5000
    };

    // If this was a fresh authentication (not an existing session), create and return a session token
    if (req.authMethod === 'dash' && !req.headers['x-dash-session']) {
        const sessionToken = createSession(req.identity?.id || user?.identityId, req.user.userId);
        response.sessionToken = sessionToken;
        console.log(`✅ Created new session for user: ${req.user.userId}`);
    }

    res.json(response);
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

// Get server identity (for frontend)
dashAuthRouter.get("/identity", (req, res) => {
    res.json({
        identityId: process.env.DASH_IDENTITY_ID,
        contractId: process.env.DASH_CONTRACT_ID,
        network: process.env.DASH_NETWORK
    });
});

// Initiate login session (for demo)
dashAuthRouter.post("/init-login", async (req, res) => {
    try {
        res.json({
            identityId: process.env.DASH_IDENTITY_ID,
            message: "Use this identity to authenticate"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout endpoint to invalidate session
dashAuthRouter.post("/logout", (req, res) => {
    const sessionToken = req.headers['x-dash-session'];
    if (sessionToken) {
        // Import the invalidateSession function from auth.js
        // You'll need to add this function to auth.js
        invalidateSession(sessionToken);
    }
    res.json({ success: true, message: "Logged out successfully" });
});