import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function CapsuleSetup({ user }) {
  const [allowedMcc, setAllowedMcc] = useState("GROCERY,TRANSPORT,FUEL");
  const [maxTransaction, setMaxTransaction] = useState(200);
  const [dailyCap, setDailyCap] = useState(400);
  const [capsuleLimit, setCapsuleLimit] = useState(1000);
  
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [estimatedMonthlyFee, setEstimatedMonthlyFee] = useState(0);

  // Templates
  const templates = {
    student: { 
      name: "🎓 Student Saver", 
      limit: 200, 
      dailyCap: 50, 
      maxTxn: 50,
      mcc: ["GROCERY", "TRANSPORT", "EDUCATION"],
      feeRate: 0.02,
      description: "Low risk, perfect for daily essentials"
    },
    freelancer: { 
      name: "💼 Freelancer Flex", 
      limit: 500, 
      dailyCap: 150, 
      maxTxn: 150,
      mcc: ["GROCERY", "TRANSPORT", "RESTAURANT", "OFFICE"],
      feeRate: 0.03,
      description: "Moderate flexibility for irregular income"
    },
    emergency: { 
      name: "🚨 Emergency Fund", 
      limit: 1000, 
      dailyCap: 200, 
      maxTxn: 200,
      mcc: ["GROCERY", "TRANSPORT", "MEDICAL", "UTILITIES"],
      feeRate: 0.015,
      description: "Higher limit for unexpected situations"
    },
    premium: { 
      name: "⭐ Premium Spender", 
      limit: 2000, 
      dailyCap: 400, 
      maxTxn: 300,
      mcc: ["ALL"],
      feeRate: 0.025,
      description: "Full flexibility for trusted users"
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cap = await api.get("/api/capsule");
      setCurrent(cap.data.capsule);
    })();
  }, [user]);

  // Calculate estimated monthly fee based on expected usage
  useEffect(() => {
    // Assume 60% utilization of capsule limit
    const expectedUsage = capsuleLimit * 0.6;
    const feeRate = 0.0008; // ~0.08% per day = ~2.4% per month
    const monthlyFee = expectedUsage * feeRate * 30;
    setEstimatedMonthlyFee(monthlyFee);
  }, [capsuleLimit]);

  if (!user) return <div className="card">Please login first.</div>;

  function applyTemplate(templateKey) {
    const template = templates[templateKey];
    setSelectedTemplate(templateKey);
    setCapsuleLimit(template.limit);
    setDailyCap(template.dailyCap);
    setMaxTransaction(template.maxTxn);
    setAllowedMcc(template.mcc.join(","));
  }

  async function create() {
    setMsg("");
    try {
      const r = await api.post("/api/capsule/create", {
        allowedMcc: allowedMcc.split(",").map(s => s.trim()).filter(Boolean),
        maxTransaction: Number(maxTransaction),
        dailyCap: Number(dailyCap),
        capsuleLimit: Number(capsuleLimit)
      });
      setMsg(`✅ Capsule created! rulesHash=${r.data.rulesHash.slice(0, 20)}...`);
      const cap = await api.get("/api/capsule");
      setCurrent(cap.data.capsule);
      setSelectedTemplate(null);
    } catch (e) {
      setMsg(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : "Create failed");
    }
  }

  // Calculate risk score impact (mock)
  const getRiskImpact = (limit) => {
    if (limit <= 200) return "+5 (Low Risk)";
    if (limit <= 500) return "+10 (Medium Risk)";
    if (limit <= 1000) return "+15 (Moderate Risk)";
    return "+25 (Higher Risk)";
  };

  return (
    <div>
      {/* Templates Section */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
          <h3 style={{ margin: 0 }}>📚 Capsule Templates</h3>
          <button 
            className={showComparison?"btn-compare-hide":"btn-compare-active"}
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? "Hide Comparison" : "Compare Templates"}
          </button>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          {Object.entries(templates).map(([key, template]) => (
            <div 
              key={key} 
              className="template-card"
              style={{
                padding: "15px",
                border: selectedTemplate === key ? "2px solid #4caf50" : "1px solid #e0e0e0",
                borderRadius: "10px",
                cursor: "pointer",
                background: selectedTemplate === key ? "#f1f8e9" : "white"
              }}
              onClick={() => applyTemplate(key)}
            >
              <div style={{ fontSize: "20px", marginBottom: "5px" }}>{template.name}</div>
              <div className="small" style={{ color: "#666", marginBottom: "10px" }}>{template.description}</div>
              <div><b>Limit:</b> ${template.limit}</div>
              <div><b>Daily Cap:</b> ${template.dailyCap}</div>
              <div><b>Max/Txn:</b> ${template.maxTxn}</div>
              <div className="small" style={{ marginTop: "8px", color: "#4caf50" }}>
                Fee: {template.feeRate}% per day
              </div>
            </div>
          ))}
        </div>
        
        {selectedTemplate && (
          <div style={{ marginTop: 12, padding: "10px", background: "#e8f5e9", borderRadius: "8px" }}>
            ✅ Template "{templates[selectedTemplate].name}" loaded. Review and click "Create capsule" below.
          </div>
        )}
      </div>

      {/* Comparison View */}
      {showComparison && (
        <div className="card">
          <h3 style={{ margin: "0 0 15px 0" }}>🔄 Template Comparison</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                  <th style={{ padding: "10px", textAlign: "left" }}>Feature</th>
                  {Object.entries(templates).map(([key, template]) => (
                    <th key={key} style={{ padding: "10px", textAlign: "center" }}>{template.name.split(" ")[1]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: "8px" }}>💰 Limit</td>
                  {Object.values(templates).map(t => <td key={t.name} style={{ textAlign: "center" }}>${t.limit}</td>)}
                </tr>
                <tr><td style={{ padding: "8px" }}>📅 Daily Cap</td>
                  {Object.values(templates).map(t => <td key={t.name} style={{ textAlign: "center" }}>${t.dailyCap}</td>)}
                </tr>
                <tr><td style={{ padding: "8px" }}>💸 Est. Monthly Fee*</td>
                  {Object.values(templates).map(t => (
                    <td key={t.name} style={{ textAlign: "center" }}>
                      ${(t.limit * 0.6 * t.feeRate * 30).toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr><td style={{ padding: "8px" }}>⚠️ Risk Impact</td>
                  {Object.values(templates).map(t => (
                    <td key={t.name} style={{ textAlign: "center" }}>{getRiskImpact(t.limit)}</td>
                  ))}
                </tr>
                <tr><td style={{ padding: "8px" }}>🏷️ MCC Restrictions</td>
                  {Object.values(templates).map(t => (
                    <td key={t.name} style={{ textAlign: "center", fontSize: "11px" }}>
                      {t.mcc[0] === "ALL" ? "None" : t.mcc.slice(0, 2).join(", ") + (t.mcc.length > 2 ? "..." : "")}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="small" style={{ marginTop: 10, color: "#666" }}>
            *Estimated monthly fee assumes 60% limit utilization at {0.08}% daily rate
          </div>
        </div>
      )}

      {/* Create Capsule Form */}
      <div className="card">
        <h3>✏️ Create / Update Capsule</h3>
        
        <div style={{ marginBottom: 15, padding: "10px", background: "#f5f5f5", borderRadius: "8px" }}>
          <div className="small">💡 Estimated monthly fee at 60% utilization: <b>${estimatedMonthlyFee.toFixed(2)}</b></div>
          <div className="small">⚠️ Risk impact: {getRiskImpact(capsuleLimit)}</div>
        </div>
        
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
        
        <div style={{ marginTop: 12, display: "flex", gap: "12px" }}>
          <button className="btn-primary" onClick={create}>Create Capsule</button>
          {selectedTemplate && (
            <button className="btn-secondary" onClick={() => setSelectedTemplate(null)}>
              Clear Template
            </button>
          )}
        </div>
        
        {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Current Capsule Display */}
      <div className="card">
        <h3>📊 Current Capsule</h3>
        {!current ? (
          <div className="small">No active capsule. Create one above.</div>
        ) : (
          <>
            <div><b>Capsule limit:</b> ${current.capsuleLimit}</div>
            <div><b>Spent today:</b> ${current.spentToday} / ${current.rules?.dailyCap}</div>
            <div><b>Spent total:</b> ${current.spentTotal}</div>
            <div className="small"><b>Rules:</b> {JSON.stringify(current.rules)}</div>
            <div className="small" style={{ marginTop: "8px", color: "#4caf50" }}>
              📈 Remaining: ${current.capsuleLimit - (current.spentTotal || 0)}
            </div>
          </>
        )}
      </div>
      
      <style jsx>{`
        .btn-primary {
          background: linear-gradient(135deg, #53cc57, #4caf50, #09c313);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow:0 4px 12px rgba(27, 132, 57, 0.47);
        }
        .btn-secondary {
          background: linear-gradient(135deg, #ef4444, #dc2626);;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-secondary:hover {
          transform: translateY(-2px);
          box-shadow:0 4px 12px #cb4c4c;
        }
        .btn-compare-active {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
         }
        .btn-compare-active:hover {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }
        .btn-compare-hide{
          background: transparent;
          color: #ef4444;
          border: 2px solid #ef4444;
          padding: 8px 20px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        .btn-compare-hide:hover {
          background: rgba(239, 68, 68, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
        }
        .template-card {
          transition: all 0.2s ease;
        }
        .template-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
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
          margin-bottom: 20px;
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          background: white;
        }
        .small {
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
}