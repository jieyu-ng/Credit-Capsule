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
  const [batchMode, setBatchMode] = useState(false);
  const [batchTransactions, setBatchTransactions] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  if (!user) return <div className="card">Please login first.</div>;

  // Quick test merchant categories
  const merchantCategories = [
    { name: "Supermarket", mcc: "GROCERY", amount: 45, risk: "LOW" },
    { name: "Restaurant", mcc: "RESTAURANT", amount: 35, risk: "MEDIUM" },
    { name: "Entertainment", mcc: "ENTERTAINMENT", amount: 25, risk: "HIGH" },
    { name: "Electronics", mcc: "ELECTRONICS", amount: 150, risk: "HIGH" },
    { name: "Transport", mcc: "TRANSPORT", amount: 20, risk: "LOW" },
    { name: "Fuel", mcc: "FUEL", amount: 60, risk: "LOW" },
    { name: "Education", mcc: "EDUCATION", amount: 100, risk: "LOW" },
    { name: "Medical", mcc: "MEDICAL", amount: 80, risk: "MEDIUM" }
  ];

  async function testTransaction(txn) {
    const lastPD = Number(localStorage.getItem("lastPD") || "0.08");
    try {
      const r = await api.post("/api/txn/test", {
        merchant: txn.merchant,
        mcc: txn.mcc,
        amount: Number(txn.amount),
        deviceId: txn.deviceId || deviceId,
        geo: txn.geo || geo,
        pd: lastPD,
        faceToken: txn.faceToken || faceToken,
        otp: txn.otp || otp
      });
      return { success: true, data: r.data, txn };
    } catch (e) {
      const data = e?.response?.data;
      return { 
        success: false, 
        data: { approved: false, reason: data?.error || "Failed", risk: data?.risk },
        txn 
      };
    }
  }

  async function submit() {
    setMsg("");
    setResu(null);
    const result = await testTransaction({ merchant, mcc, amount, deviceId, geo, faceToken, otp });
    
    if (result.success) {
      setResu(result.data);
    } else {
      setMsg(result.data.reason || "Txn failed");
      if (result.data.risk) setResu({ risk: result.data.risk });
    }
  }

  async function runBatchTests() {
    if (batchTransactions.length === 0) {
      setMsg("⚠️ Please enter batch transactions first");
      return;
    }
    
    setIsBatchRunning(true);
    setBatchResults([]);
    setMsg(`🔄 Running ${batchTransactions.length} transactions...`);
    
    const results = [];
    for (const txn of batchTransactions) {
      const result = await testTransaction(txn);
      results.push(result);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setBatchResults(results);
    const approved = results.filter(r => r.data?.approved === true).length;
    setMsg(`✅ Batch complete: ${approved}/${results.length} approved`);
    setIsBatchRunning(false);
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Batch complete") ? "" : prev);
    }, 4000);
  }

  function addBatchTransaction() {
    setBatchTransactions([...batchTransactions, { 
      merchant: "", 
      mcc: "GROCERY", 
      amount: 50,
      deviceId: deviceId,
      geo: geo
    }]);
  }

  function updateBatchTransaction(index, field, value) {
    const updated = [...batchTransactions];
    updated[index][field] = value;
    setBatchTransactions(updated);
  }

  function removeBatchTransaction(index) {
    setBatchTransactions(batchTransactions.filter((_, i) => i !== index));
  }

  function loadSampleBatch() {
    setBatchTransactions([
      { merchant: "Walmart", mcc: "GROCERY", amount: 45, deviceId: "device-1", geo: "KL" },
      { merchant: "Netflix", mcc: "ENTERTAINMENT", amount: 15, deviceId: "device-1", geo: "KL" },
      { merchant: "Uber", mcc: "TRANSPORT", amount: 25, deviceId: "device-2", geo: "SG" },
      { merchant: "Apple Store", mcc: "ELECTRONICS", amount: 200, deviceId: "device-1", geo: "KL" },
      { merchant: "Starbucks", mcc: "RESTAURANT", amount: 12, deviceId: "device-1", geo: "KL" }
    ]);
  }

  const getStatusBadge = (approved) => {
    if (approved === true) return { color: "#4caf50", text: "✅ APPROVED" };
    if (approved === false) return { color: "#f44336", text: "❌ DENIED" };
    return { color: "#999", text: "⚠️ ERROR" };
  };

  return (
    <div className="card">
      <h3>💳 Transaction Authorization Test</h3>
      <div className="small">Risk engine uses PD + device/geo/velocity → step-up auth → capsule rules</div>

      {/* Quick Test Buttons */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: "14px", margin: "0 0 10px 0" }}>🔘 Quick Test by Merchant Category</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {merchantCategories.map(cat => (
            <button
              key={cat.mcc}
              className="quick-test-btn"
              style={{
                background: cat.risk === "LOW" ? "#4caf50" : cat.risk === "MEDIUM" ? "#ff9800" : "#f44336",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: "20px",
                cursor: "pointer",
                fontSize: "12px"
              }}
              onClick={() => {
                setMerchant(cat.name);
                setMcc(cat.mcc);
                setAmount(cat.amount);
              }}
            >
              {cat.name} (${cat.amount})
            </button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{ marginBottom: 15, display: "flex", gap: "10px", borderBottom: "1px solid #e0e0e0", paddingBottom: "10px" }}>
        <button 
          className={!batchMode ? "mode-active" : "mode-inactive"}
          onClick={() => setBatchMode(false)}
        >
          Single Transaction
        </button>
        <button 
          className={batchMode ? "mode-active" : "mode-inactive"}
          onClick={() => setBatchMode(true)}
        >
          Batch Test ({batchTransactions.length})
        </button>
      </div>

      {!batchMode ? (
        // Single Transaction Mode
        <>
          <div className="row">
            <div className="col">
              <label>Merchant</label>
              <input className="input" value={merchant} onChange={(e)=>setMerchant(e.target.value)} />
              <label>MCC</label>
              <input className="input" value={mcc} onChange={(e)=>setMcc(e.target.value)} />
              <label>Amount ($)</label>
              <input className="input" type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} />
            </div>
            <div className="col">
              <label>Device ID</label>
              <input className="input" value={deviceId} onChange={(e)=>setDeviceId(e.target.value)} />
              <label>Geo Location</label>
              <input className="input" value={geo} onChange={(e)=>setGeo(e.target.value)} />
              <hr />
              <label>Face Token (for MED/HIGH risk)</label>
              <input className="input" value={faceToken} onChange={(e)=>setFaceToken(e.target.value)} placeholder="e.g. face_ok" />
              <label>OTP (for HIGH risk) — demo: 123456</label>
              <input className="input" value={otp} onChange={(e)=>setOtp(e.target.value)} placeholder="123456" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={submit}>Authorize Transaction</button>
          </div>
        </>
      ) : (
        // Batch Mode
        <div>
          <div style={{ display: "flex", gap: "10px", marginBottom: 15, flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={addBatchTransaction}>+ Add Transaction</button>
            <button className="btn-secondary" onClick={loadSampleBatch}>📋 Load Sample Batch</button>
            <button className="btn-primary" onClick={runBatchTests} disabled={isBatchRunning}>
              {isBatchRunning ? "⏳ Running..." : `▶️ Run ${batchTransactions.length} Tests`}
            </button>
            {batchTransactions.length > 0 && (
              <button className="btn-danger" onClick={() => setBatchTransactions([])}>Clear All</button>
            )}
          </div>
          
          {batchTransactions.length === 0 ? (
            <div className="small" style={{ textAlign: "center", padding: "30px" }}>
              No batch transactions. Click "+ Add Transaction" to start.
            </div>
          ) : (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {batchTransactions.map((txn, idx) => (
                <div key={idx} style={{ 
                  marginBottom: "10px", 
                  padding: "10px", 
                  background: "#f9f9f9", 
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <input 
                      type="text" 
                      placeholder="Merchant"
                      value={txn.merchant}
                      onChange={(e) => updateBatchTransaction(idx, "merchant", e.target.value)}
                      style={{ flex: 2, padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                    />
                    <input 
                      type="text" 
                      placeholder="MCC"
                      value={txn.mcc}
                      onChange={(e) => updateBatchTransaction(idx, "mcc", e.target.value)}
                      style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                    />
                    <input 
                      type="number" 
                      placeholder="Amount"
                      value={txn.amount}
                      onChange={(e) => updateBatchTransaction(idx, "amount", e.target.value)}
                      style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                    />
                    <button 
                      className="btn-small"
                      onClick={() => removeBatchTransaction(idx)}
                      style={{ background: "#f44336" }}
                    >
                      ✕
                    </button>
                  </div>
                  {batchResults[idx] && (
                    <div style={{ marginTop: "8px", fontSize: "11px" }}>
                      <span style={{ 
                        color: batchResults[idx].data?.approved === true ? "#4caf50" : "#f44336",
                        fontWeight: "bold"
                      }}>
                        {batchResults[idx].data?.approved === true ? "✅ APPROVED" : "❌ DENIED"}
                      </span>
                      {" • "}{batchResults[idx].data?.reason || batchResults[idx].data?.error || "No result"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className="small" style={{ 
          marginTop: 12, 
          padding: "10px", 
          background: msg.includes("⚠️") ? "#fff3e0" : "#e8f5e9", 
          borderRadius: "6px" 
        }}>
          {msg}
        </div>
      )}

      {/* Single Result Display */}
      {resu && !batchMode && (
        <div className="result-card" style={{ marginTop: 15 }}>
          {resu.approved !== undefined && (
            <>
              <div>Decision: <b style={{ color: resu.approved ? "#4caf50" : "#f44336" }}>
                {resu.approved ? "APPROVED" : "DENIED"}
              </b> — {resu.reason}</div>
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

      {/* Batch Results Summary */}
      {batchResults.length > 0 && !isBatchRunning && (
        <div className="result-card" style={{ marginTop: 15 }}>
          <h4 style={{ margin: "0 0 10px 0" }}>📊 Batch Results Summary</h4>
          <div>
            {(() => {
              const approved = batchResults.filter(r => r.data?.approved === true).length;
              const denied = batchResults.filter(r => r.data?.approved === false).length;
              const total = batchResults.length;
              return (
                <>
                  <div>✅ Approved: <b>{approved}</b> ({((approved/total)*100).toFixed(0)}%)</div>
                  <div>❌ Denied: <b>{denied}</b> ({((denied/total)*100).toFixed(0)}%)</div>
                  <div className="small">Total: {total} transactions processed</div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .btn-primary {
          background: linear-gradient(135deg, #4caf50, #45a049);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-secondary {
          background: #666;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-danger {
          background: #f44336;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-small {
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          border: none;
          color: white;
        }
        .mode-active {
          background: #2196f3;
          color: white;
          border: none;
          padding: 6px 16px;
          border-radius: 20px;
          cursor: pointer;
        }
        .mode-inactive {
          background: #e0e0e0;
          color: #666;
          border: none;
          padding: 6px 16px;
          border-radius: 20px;
          cursor: pointer;
        }
        .input {
          width: 100%;
          padding: 8px;
          margin: 5px 0 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .row {
          display: flex;
          gap: 15px;
        }
        .col {
          flex: 1;
        }
        .card {
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          background: white;
        }
        .result-card {
          margin-top: 15px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        .small {
          font-size: 12px;
          color: #666;
        }
        .quick-test-btn {
          transition: all 0.2s ease;
        }
        .quick-test-btn:hover {
          transform: translateY(-1px);
          filter: brightness(0.9);
        }
      `}</style>
    </div>
  );
}