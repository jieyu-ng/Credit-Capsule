import jwt from "jsonwebtoken";
import { getClient } from "../services/dashClient.js";
import crypto from 'crypto';
import { db } from "../storage/memoryDb.js";  // ✅ Add this import

// Store nonces (use Redis in production)
const nonceStore = new Map();

// Store active sessions (use Redis in production)
const sessionStore = new Map();

// Request nonce for Dash authentication
export async function requestNonce(req, res) {
  const { identityId } = req.body;
  if (!identityId) {
    return res.status(400).json({ error: "Missing identityId" });
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 300000; // 5 minutes

  nonceStore.set(identityId, { nonce, expiresAt });
  setTimeout(() => nonceStore.delete(identityId), 300000);

  return res.json({ nonce, message: `Sign this nonce: ${nonce}` });
}

// Create a session after successful authentication
export function createSession(identityId, userId) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const session = {
    identityId,
    userId,
    sessionToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  sessionStore.set(sessionToken, session);

  // Auto-cleanup after expiration
  setTimeout(() => sessionStore.delete(sessionToken), 24 * 60 * 60 * 1000);

  return sessionToken;
}

// Validate a session token
export function validateSession(sessionToken) {
  const session = sessionStore.get(sessionToken);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessionStore.delete(sessionToken);
    return null;
  }
  return session;
}

// Invalidate a session (logout)
export function invalidateSession(sessionToken) {
  return sessionStore.delete(sessionToken);
}

// Main auth middleware (supports JWT, Dash signature, and Dash session)
export async function requireAuth(req, res, next) {
  // Try JWT first (existing users)
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
      if (payload.userId) {
        req.user = payload;
        req.authMethod = 'jwt';
        return next();
      }
    } catch (error) {
      // JWT invalid, try other methods
    }
  }

  // Try Dash session authentication (for subsequent requests)
  const dashSession = req.headers['x-dash-session'];
  const dashIdentity = req.headers['x-dash-identity'];

  if (dashSession && dashIdentity) {
    const session = validateSession(dashSession);
    if (session && session.identityId === dashIdentity) {
      req.user = { userId: session.userId, identityId: session.identityId };
      req.identity = { id: session.identityId, authenticated: true };
      req.authMethod = 'dash_session';
      console.log(`✅ Dash session authentication successful for: ${session.identityId}`);
      return next();
    } else {
      console.log(`❌ Invalid or expired session for identity: ${dashIdentity}`);
      return res.status(401).json({ error: "Invalid or expired session" });
    }
  }

  // Try Dash signature authentication (initial login)
  const identityId = req.headers['x-dash-identity'];
  const signature = req.headers['x-dash-signature'];
  const nonce = req.headers['x-dash-nonce'];

  if (identityId && signature && nonce) {
    try {
      const storedNonce = nonceStore.get(identityId);
      if (!storedNonce || storedNonce.nonce !== nonce || storedNonce.expiresAt < Date.now()) {
        return res.status(401).json({ error: "Invalid or expired nonce" });
      }

      // FOR DEMO: Accept any signature
      console.log(`✅ Demo authentication accepted for identity: ${identityId}`);

      // Clear the used nonce
      nonceStore.delete(identityId);

      // Find or create user - db is now imported
      let user = [...db.users.values()].find(u => u.identityId === identityId);

      if (!user) {
        // Get next ID - handle both cases (if nextId exists or not)
        let nextId = db.nextId ? db.nextId() : db.users.size + 1;
        const id = nextId;
        user = {
          id,
          identityId,
          email: null,
          approvedLimit: 5000,
          userAddress: identityId,
          createdAt: Date.now(),
          authMethod: 'dash'
        };
        db.users.set(id, user);
        console.log(`✅ Created new user with ID: ${id} for identity: ${identityId}`);
      } else {
        console.log(`✅ Found existing user with ID: ${user.id} for identity: ${identityId}`);
      }

      req.user = { userId: user.id, identityId };
      req.identity = { id: identityId, authenticated: true };
      req.authMethod = 'dash';

      console.log(`✅ Dash authentication successful for: ${identityId}`);
      return next();

    } catch (error) {
      console.error('Dash auth error:', error);
      return res.status(401).json({ error: "Dash authentication failed" });
    }
  }

  return res.status(401).json({ error: "Authentication required" });
}


// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt < now) {
      sessionStore.delete(token);
      console.log(`🧹 Cleaned up expired session: ${token}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour