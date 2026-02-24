import React, { useState } from "react";
import { api } from "../lib/api.js";

export default function TxnTest({ user }) {
  const [merchant, setMerchant] = useState("MyMart");
  const [mcc, setMcc] = useState("GROCERY");
  const [amount, setAmount] = useState(50);

  const [deviceId, setDeviceId] = useState("device-1");
  const [geo, setGeo] = useState("Kuala Lumpur");

  const [faceToken, setFaceToken] = useState("");
  const [otp, setOtp] = useState("");

  const [resu, setResu] = useState(null);
  const [msg, setMsg] = useState("");

  if (!user) return <div className="card">Please login first.</div>;

  async function submit() {
    setMsg("");
    setResu(null);
    const lastPD = Number(localStorage.getItem("lastPD") || "0.08");

    try {
      const r = await api.post("/api/txn/test", {
        merchant,
        mcc,
        amount: Number(amount),
        deviceId,
        geo,
        pd: lastPD,
        faceToken: faceToken || undefined,
        otp: otp || undefined
      });
      setResu(r.data);
    } catch (e) {
      const data = e?.response?.data;
      setMsg(data?.error || "Txn failed");
      if (data?.risk) setResu({ risk: data.risk });
    }
  }

  return (
    <div className="card">
      <h3>Transaction Authorization Test</h3>
      <div className="small">Backend uses lastPD (from Risk Simulation) + device/geo/velocity to decide step-up + capsule rules.</div>

      <div className="row">
        <div className="col">
          <label>Merchant</label>
          <input className="input" value={merchant} onChange={(e)=>setMerchant(e.target.value)} />
          <label>MCC</label>
          <input className="input" value={mcc} onChange={(e)=>setMcc(e.target.value)} />
          <label>Amount</label>
          <input className="input" type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} />
        </div>
        <div className="col">
          <label>Device ID</label>
          <input className="input" value={deviceId} onChange={(e)=>setDeviceId(e.target.value)} />
          <label>Geo</label>
          <input className="input" value={geo} onChange={(e)=>setGeo(e.target.value)} />
          <hr />
          <label>faceToken (required for MED/HIGH)</label>
          <input className="input" value={faceToken} onChange={(e)=>setFaceToken(e.target.value)} placeholder="e.g. face_ok" />
          <label>OTP (required for HIGH) — demo expects 123456</label>
          <input className="input" value={otp} onChange={(e)=>setOtp(e.target.value)} placeholder="123456" />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={submit}>Authorize</button>
      </div>

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}

      {resu && (
        <div className="card" style={{ marginTop: 12 }}>
          {resu.approved !== undefined && (
            <>
              <div>Decision: <b>{resu.approved ? "APPROVED" : "DENIED"}</b> — {resu.reason}</div>
              <div>Risk tier: <b>{resu.risk?.tier}</b> (score {resu.risk?.score})</div>
              <div className="small">Breakdown: {JSON.stringify(resu.risk?.breakdown)}</div>
              <div className="small">Capsule: {JSON.stringify(resu.capsule)}</div>
              <div className="small">Chain write: {JSON.stringify(resu.chain)}</div>
            </>
          )}
          {resu.risk && resu.approved === undefined && (
            <>
              <div>Risk tier: <b>{resu.risk.tier}</b> (score {resu.risk.score})</div>
              <div className="small">If MED: add faceToken. If HIGH: add faceToken + OTP.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}