// Demo in-memory DB (swap to Postgres/Mongo later)
export const db = {
  users: new Map(),      // id -> {id,email,passwordHash,approvedLimit, phoneOtpSecret?}
  sessions: new Map(),   // tokenId -> ...
  capsules: new Map(),   // userId -> { rules, capsuleLimit, spentTotal, spentToday, todayDate }
  deviceState: new Map(),// userId -> { lastDeviceId, lastGeo }
  txns: []               // push {userId, merchant, mcc, amount, approved, riskTier, reason, ts}
};

let _id = 1;
export function nextId() {
  return String(_id++);
}