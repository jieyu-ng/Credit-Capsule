import { logCapsuleToDash, logTxnToDash, getUserAuditLogs } from './dashAudit.js';

const enabled = (process.env.ENABLE_DASH_AUDIT || "true").toLowerCase() === "true";

export async function logCapsuleCreated({ userAddress, rulesHash, limit, capsuleType, emergencyType }) {
  if (!enabled) {
    console.log('📝 Dash audit disabled');
    return { ok: false, skipped: true };
  }

  const { db } = await import('../storage/memoryDb.js');
  const user = [...db.users.values()].find(u => u.userAddress === userAddress);

  if (!user) {
    console.log('⚠️ User not found for audit');
    return { ok: false, error: "User not found" };
  }

  console.log(`📝 Logging capsule creation to Dash for user ${user.id}`);
  return await logCapsuleToDash(
    user.id,
    userAddress,
    rulesHash,
    limit,
    capsuleType || "REGULAR",
    emergencyType || null
  );
}

export async function logTxnDecision({ userAddress, merchant, mcc, amount, approved, riskTier }) {
  if (!enabled) {
    console.log('📝 Dash audit disabled');
    return { ok: false, skipped: true };
  }

  const { db } = await import('../storage/memoryDb.js');
  const user = [...db.users.values()].find(u => u.userAddress === userAddress);

  if (!user) {
    console.log('⚠️ User not found for audit');
    return { ok: false, error: "User not found" };
  }

  console.log(`📝 Logging transaction to Dash for user ${user.id}`);
  return await logTxnToDash(
    user.id,
    userAddress,
    merchant,
    mcc,
    amount,
    approved,
    riskTier
  );
}

export function getAuditAbiAndAddress() {
  return {
    enabled,
    platform: "Dash Platform",
    message: "Audit logs are stored on Dash Platform using existing data contract",
    contractId: process.env.DASH_CONTRACT_ID || ""
  };
}

export async function queryAuditLogs(userId, limit = 50) {
  if (!enabled) {
    return { ok: false, logs: [] };
  }
  return await getUserAuditLogs(userId, limit);
}