export const db = {
  users: new Map(),
  sessions: new Map(),
  capsules: new Map(),
  deviceState: new Map(),
  transactions: [],
  auditLogs: [],
  emergencyHistory: [],
  emergencyVerifications: [],
  get txns() {
    return this.transactions;
  }
};

let _id = 1;
export function nextId() {
  return String(_id++);
}

export const findUserByEmail = (email) => {
  return [...db.users.values()].find(u => u.email === email);
};

export const findUserById = (id) => {
  return db.users.get(id);
};

export const addUser = (user) => {
  db.users.set(user.id, user);
  return user;
};

export const addCapsule = (capsule) => {
  db.capsules.set(capsule.id, capsule);
  return capsule;
};

export const findCapsuleById = (id) => {
  return db.capsules.get(id);
};

export const findCapsulesByUserId = (userId) => {
  return [...db.capsules.values()].filter(c => c.userId === userId);
};

export const updateCapsule = (id, updates) => {
  const existingCapsule = db.capsules.get(id);
  if (existingCapsule) {
    const updatedCapsule = { ...existingCapsule, ...updates };
    db.capsules.set(id, updatedCapsule);
    return updatedCapsule;
  }
  return null;
};

export const linkBank = (userId, bankName, transactionData) => {
  const user = db.users.get(userId);
  if (user) {
    user.bankLinked = true;
    user.bankName = bankName;
    user.bankLinkedAt = new Date().toISOString();
    user.bankTransactionData = transactionData;
    db.users.set(userId, user);
    return true;
  }
  return false;
};

export const getBankData = (userId) => {
  const user = db.users.get(userId);
  if (user && user.bankLinked) {
    return {
      linked: true,
      bankName: user.bankName,
      bankLinkedAt: user.bankLinkedAt,
      transactionData: user.bankTransactionData
    };
  }
  return { linked: false };
};

export const addTransaction = (transaction) => {
  const id = nextId();
  const newTransaction = { id, ...transaction, timestamp: new Date().toISOString() };
  db.transactions.push(newTransaction);
  return newTransaction;
};

export const getTransactionsByUserId = (userId) => {
  return db.transactions
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const getAllTransactions = () => {
  return [...db.transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const addAuditLog = (log) => {
  const id = nextId();
  const auditLog = { id, ...log, timestamp: new Date().toISOString() };
  db.auditLogs.push(auditLog);
  return auditLog;
};

export const getAuditLogs = (userId = null) => {
  if (userId) {
    return db.auditLogs.filter(l => l.userId === userId);
  }
  return db.auditLogs;
};

export const getDeviceState = (userId) => {
  return db.deviceState.get(userId);
};

export const setDeviceState = (userId, state) => {
  db.deviceState.set(userId, state);
};

export const initializeDemoData = async () => {
  const existingDemo = findUserByEmail('demo@example.com');
  if (!existingDemo) {
    const bcrypt = await import('bcryptjs');
    const demoUser = {
      id: nextId(),
      email: 'demo@example.com',
      passwordHash: await bcrypt.hash('demo123', 10),
      approvedLimit: 5000,
      userAddress: '0x0000000000000000000000000000000000000001',
      role: 'user',
      bankLinked: false,
      bankName: null,
      bankLinkedAt: null,
      bankTransactionData: null
    };
    db.users.set(demoUser.id, demoUser);
    console.log('Demo user created:', demoUser.email);
  }

  const existingLender = findUserByEmail('lender@example.com');
  if (!existingLender) {
    const bcrypt = await import('bcryptjs');
    const lenderUser = {
      id: nextId(),
      email: 'lender@example.com',
      passwordHash: await bcrypt.hash('lender123', 10),
      approvedLimit: 100000,
      userAddress: '0x0000000000000000000000000000000000000002',
      role: 'lender',
      bankLinked: false,
      bankName: null,
      bankLinkedAt: null,
      bankTransactionData: null
    };
    db.users.set(lenderUser.id, lenderUser);
    console.log('Demo lender created:', lenderUser.email);
  }
};

export const clearDatabase = () => {
  db.users.clear();
  db.sessions.clear();
  db.capsules.clear();
  db.deviceState.clear();
  db.transactions = [];
  db.auditLogs = [];
  db.emergencyHistory = [];
  db.emergencyVerifications = [];
  _id = 1;
};

export { db as default };