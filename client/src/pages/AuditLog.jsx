import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ethers } from "ethers";

export default function AuditLog({ user }) {
  const [meta, setMeta] = useState(null);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");

  if (!user) return <div className="card">Please login first.</div>;

  useEffect(() => {
    (async () => {
      const m = await api.get("/api/audit/meta");
      setMeta(m.data);
    })();
  }, []);

  async function loadOnChain() {
    setMsg("");
    setEvents([]);

    if (!meta?.enabled) {
      setMsg("Chain logs disabled (ENABLE_CHAIN_LOGS=false) or missing config.");
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL || "http://127.0.0.1:8545");
      const contract = new ethers.Contract(meta.address, meta.abi, provider);

      const userAddr = user.userAddress;

      const capsuleLogs = await contract.queryFilter(contract.filters.CapsuleCreated(userAddr));
      const txnLogs = await contract.queryFilter(contract.filters.TxnDecision(userAddr));

      const formatted = [
        ...capsuleLogs.map(l => ({ type: "CapsuleCreated", args: l.args, blockNumber: l.blockNumber })),
        ...txnLogs.map(l => ({ type: "TxnDecision", args: l.args, blockNumber: l.blockNumber }))
      ].sort((a,b)=> (b.blockNumber - a.blockNumber));

      setEvents(formatted);
    } catch (e) {
      setMsg("Failed to read chain logs. Check VITE_CHAIN_RPC_URL + hardhat node.");
    }
  }

  return (
    <div className="card">
      <h3>Audit Log Viewer</h3>
      <div className="small">
        Off-chain makes decisions; on-chain stores immutable logs. (Not payments)
      </div>

      <div className="card">
        <div className="small">Chain enabled: <b>{String(meta?.enabled)}</b></div>
        <div className="small">Contract: {meta?.address || "(unset)"}</div>
        <button className="btn" style={{ marginTop: 10 }} onClick={loadOnChain}>Load on-chain logs</button>
        {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {events.length === 0 ? (
        <div className="small">No events loaded yet.</div>
      ) : (
        events.map((e, i) => (
          <div key={i} className="card">
            <div><b>{e.type}</b> (block {e.blockNumber})</div>
            <div className="small">{JSON.stringify(e.args)}</div>
          </div>
        ))
      )}
    </div>
  );
}