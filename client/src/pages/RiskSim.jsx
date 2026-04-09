import React, { useState } from "react";
import { api } from "../lib/api.js";

export default function RiskSim({ user }) {
  const [simulations, setSimulations] = useState(5000);
  const [incomeMean, setIncomeMean] = useState(3000);
  const [incomeStdev, setIncomeStdev] = useState(600);
  const [expMean, setExpMean] = useState(2200);
  const [expStdev, setExpStdev] = useState(400);
  const [jobLossProb, setJobLossProb] = useState(0.04);
  const [emProb, setEmProb] = useState(0.06);

  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");

  if (!user) return <div className="card">Please login first.</div>;

  async function run() {
    setMsg("");
    try {
      const r = await api.post("/api/risk/simulate", {
        simulations: Number(simulations),
        months: 6,
        monthlyIncomeMean: Number(incomeMean),
        monthlyIncomeStdev: Number(incomeStdev),
        monthlyExpenseMean: Number(expMean),
        monthlyExpenseStdev: Number(expStdev),
        jobLossProb: Number(jobLossProb),
        emergencyProb: Number(emProb)
      });
      setResult(r.data);
      localStorage.setItem("lastPD", String(r.data.pd));
    } catch (e) {
      setMsg(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : "Simulation failed");
    }
  }

  return (
    <div className="card">
      <h3>Monte Carlo Risk Engine</h3>
      <div className="small">Stores PD locally for Transaction Test (lastPD).</div>

      <div className="row">
        <div className="col">
          <label>Simulations (1,000–10,000)</label>
          <input className="input" type="number" value={simulations} onChange={(e)=>setSimulations(e.target.value)} />
          <label>Monthly income mean</label>
          <input className="input" type="number" value={incomeMean} onChange={(e)=>setIncomeMean(e.target.value)} />
          <label>Monthly income stdev</label>
          <input className="input" type="number" value={incomeStdev} onChange={(e)=>setIncomeStdev(e.target.value)} />
        </div>
        <div className="col">
          <label>Monthly expense mean</label>
          <input className="input" type="number" value={expMean} onChange={(e)=>setExpMean(e.target.value)} />
          <label>Monthly expense stdev</label>
          <input className="input" type="number" value={expStdev} onChange={(e)=>setExpStdev(e.target.value)} />
          <label>Job loss prob / month</label>
          <input className="input" type="number" step="0.01" value={jobLossProb} onChange={(e)=>setJobLossProb(e.target.value)} />
          <label>Emergency prob / month</label>
          <input className="input" type="number" step="0.01" value={emProb} onChange={(e)=>setEmProb(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={run}>Run simulation</button>
      </div>

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}

      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <div>PD: <b>{(result.pd * 100).toFixed(2)}%</b></div>
          <div>Suggested capsule limit: <b>{result.suggestedCapsuleLimit}</b> (factor {result.factor})</div>
          <div className="small">Tip: use this suggested limit when creating your capsule.</div>
        </div>
      )}
    </div>
  );
}