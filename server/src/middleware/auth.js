import jwt from "jsonwebtoken";
import { getClient } from "../services/dashClient.js";

// Store nonces (use Redis in production)
const nonceStore = new Map();

// Request nonce for Dash authentication
export async function requestNonce(req, res) {
  const { identityId } = req.body;
  if (!identityId) {
    return res.status(400).json({ error: "Missing identityId" });
  }

  const crypto = await import('crypto');
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 300000;

  nonceStore.set(identityId, { nonce, expiresAt });
  setTimeout(() => nonceStore.delete(identityId), 300000);

  return res.json({ nonce, message: `Sign this nonce: ${nonce}` });
}

// Main auth middleware (supports both JWT and Dash)
export async function requireAuth(req, res, next) {
  // Try JWT first (existing users)
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
      if (payload.userId) {
        req.user = payload;
        return next();
      }
    } catch (error) {
      // JWT invalid, try Dash auth
    }
  }

  // Try Dash authentication
  const identityId = req.headers['x-dash-identity'];
  const signature = req.headers['x-dash-signature'];
  const nonce = req.headers['x-dash-nonce'];

  if (identityId && signature && nonce) {
    try {
      const storedNonce = nonceStore.get(identityId);
      if (!storedNonce || storedNonce.nonce !== nonce || storedNonce.expiresAt < Date.now()) {
        return res.status(401).json({ error: "Invalid or expired nonce" });
      }

      // For now, accept any signature (in production, verify properly)
      // You'll need to implement proper signature verification

      nonceStore.delete(identityId);

      // Find or create user
      const { db } = await import('../storage/memoryDb.js');
      let user = [...db.users.values()].find(u => u.identityId === identityId);

      if (!user) {
        const { nextId } = await import('../storage/memoryDb.js');
        const id = nextId();
        user = {
          id,
          identityId,
          email: null,
          approvedLimit: 5000,
          userAddress: identityId.substring(0, 42),
          createdAt: Date.now()
        };
        db.users.set(id, user);
      }

      req.user = { userId: user.id, identityId };
      req.identity = { id: identityId };
      return next();

    } catch (error) {
      console.error('Dash auth error:', error);
      return res.status(401).json({ error: "Dash authentication failed" });
    }
  }

  return res.status(401).json({ error: "Authentication required" });
}