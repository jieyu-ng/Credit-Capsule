import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function CapsuleSetup({ user }) {
  const [allowedMcc, setAllowedMcc] = useState("GROCERY,TRANSPORT,FUEL");
  const [maxTransaction, setMaxTransaction] = useState(200);
  const [dailyCap, setDailyCap] = useState(400);
  const [capsuleLimit, setCapsuleLimit] = useState(1000);

  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cap = await api.get("/api/capsule");
      setCurrent(cap.data.capsule);
    })();
  }, [user]);

  if (!user) return <div className="card">Please login first.</div>;

  async function create() {
    setMsg("");
    try {
      const r = await api.post("/api/capsule/create", {
        allowedMcc: allowedMcc.split(",").map(s => s.trim()).filter(Boolean),
        maxTransaction: Number(maxTransaction),
        dailyCap: Number(dailyCap),
        capsuleLimit: Number(capsuleLimit)
      });
      setMsg(`Capsule created. rulesHash=${r.data.rulesHash} chain=${JSON.stringify(r.data.chain)}`);
      const cap = await api.get("/api/capsule");
      setCurrent(cap.data.capsule);
    } catch (e) {
      setMsg(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : "Create failed");
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Create / Update Capsule</h3>
        <label>Allowed MCC (comma separated)</label>
        <input className="input" value={allowedMcc} onChange={(e)=>setAllowedMcc(e.target.value)} />
        <div className="row">
          <div className="col">
            <label>Max per transaction</label>
            <input className="input" type="number" value={maxTransaction} onChange={(e)=>setMaxTransaction(e.target.value)} />
          </div>
          <div className="col">
            <label>Daily cap</label>
            <input className="input" type="number" value={dailyCap} onChange={(e)=>setDailyCap(e.target.value)} />
          </div>
          <div className="col">
            <label>Capsule limit (total)</label>
            <input className="input" type="number" value={capsuleLimit} onChange={(e)=>setCapsuleLimit(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={create}>Create capsule</button>
        </div>
        {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      <div className="card">
        <h3>Current Capsule</h3>
        {!current ? <div className="small">None yet.</div> : (
          <>
            <div>Capsule limit: <b>{current.capsuleLimit}</b></div>
            <div>Spent today: <b>{current.spentToday}</b></div>
            <div>Spent total: <b>{current.spentTotal}</b></div>
            <div className="small">Rules: {JSON.stringify(current.rules)}</div>
          </>
        )}
      </div>
    </div>
  );
}