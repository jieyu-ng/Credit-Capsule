import { ethers } from "ethers";

const enabled = (process.env.ENABLE_CHAIN_LOGS || "false").toLowerCase() === "true";

const abi = [
  "function logCapsuleCreated(address user, bytes32 rulesHash, uint256 limit) external",
  "function logTxnDecision(address user, string merchant, string mcc, uint256 amount, bool approved, string riskTier) external",
  "event CapsuleCreated(address indexed user, bytes32 indexed rulesHash, uint256 limit, uint256 timestamp)",
  "event TxnDecision(address indexed user, string merchant, string mcc, uint256 amount, bool approved, string riskTier, uint256 timestamp)"
];

function getClient() {
  if (!enabled) return null;

  const rpc = process.env.CHAIN_RPC_URL;
  const addr = process.env.AUDIT_CONTRACT_ADDRESS;
  const pk = process.env.BACKEND_SIGNER_PRIVATE_KEY;

  if (!rpc || !addr || !pk) return null;

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const contract = new ethers.Contract(addr, abi, wallet);
  return { contract, provider };
}

export async function logCapsuleCreated({ userAddress, rulesHash, limit }) {
  const client = getClient();
  if (!client) return { ok: false, skipped: true };

  const tx = await client.contract.logCapsuleCreated(userAddress, rulesHash, BigInt(limit));
  const receipt = await tx.wait();
  return { ok: true, txHash: receipt.hash };
}

export async function logTxnDecision({ userAddress, merchant, mcc, amount, approved, riskTier }) {
  const client = getClient();
  if (!client) return { ok: false, skipped: true };

  const tx = await client.contract.logTxnDecision(
    userAddress,
    merchant,
    mcc,
    BigInt(amount),
    approved,
    riskTier
  );
  const receipt = await tx.wait();
  return { ok: true, txHash: receipt.hash };
}

export function getAuditAbiAndAddress() {
  return {
    enabled,
    address: process.env.AUDIT_CONTRACT_ADDRESS || "",
    abi
  };
}