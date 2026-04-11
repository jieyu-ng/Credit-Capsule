import React, { useState, useEffect } from "react";
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
  const [scenarioResults, setScenarioResults] = useState({});
  const [msg, setMsg] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [bankData, setBankData] = useState(null);
  const [useBankData, setUseBankData] = useState(false);

  if (!user) return <div className="card">Please login first.</div>;

  // Fetch bank data when component mounts or user changes
  useEffect(() => {
    if (user?.bankLinked) {
      fetchBankData();
    }
  }, [user]);

  const fetchBankData = async () => {
    try {
      const response = await api.get('/api/auth/bank-data');
      if (response.data.success && response.data.data) {
        setBankData(response.data.data);
        
        // Auto-populate fields with real bank data
        if (response.data.data.averageMonthlyIncome) {
          setIncomeMean(response.data.data.averageMonthlyIncome);
          setIncomeStdev(Math.round(response.data.data.incomeVolatility * response.data.data.averageMonthlyIncome));
          setExpMean(response.data.data.averageMonthlyExpenses);
          setExpStdev(Math.round(response.data.data.expenseVolatility * response.data.data.averageMonthlyExpenses));
          setUseBankData(true);
          setMsg("✅ Bank data loaded! Parameters updated with your actual financial data.");
          setTimeout(() => setMsg(""), 3000);
        }
      }
    } catch (err) {
      console.error("Failed to fetch bank data:", err);
    }
  };

  async function run() {
    setMsg("");
    setIsRunning(true);
    try {
      const payload = {
        simulations: Number(simulations),
        months: 6,
        monthlyIncomeMean: Number(incomeMean),
        monthlyIncomeStdev: Number(incomeStdev),
        monthlyExpenseMean: Number(expMean),
        monthlyExpenseStdev: Number(expStdev),
        jobLossProb: Number(jobLossProb),
        emergencyProb: Number(emProb)
      };
      
      // Add bank context if available
      if (useBankData && bankData) {
        payload.bankContext = {
          accountType: bankData.accountType,
          linkedDate: bankData.linkedDate,
          incomeVolatility: bankData.incomeVolatility,
          bankName: bankData.bankName
        };
      }
      
      const r = await api.post("/api/risk/simulate", payload);
      setResult(r.data);
      localStorage.setItem("lastPD", String(r.data.pd));
      
      // Store simulation context with bank data
      if (useBankData) {
        localStorage.setItem("simulationContext", JSON.stringify({
          usedBankData: true,
          bankName: bankData?.bankName,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (e) {
      setMsg(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : "Simulation failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function runScenarios() {
    setMsg("");
    setIsRunning(true);
    const scenarios = {
      "Optimistic": { incomeMean: incomeMean * 1.2, jobLossProb: jobLossProb * 0.5, emProb: emProb * 0.7 },
      "Base": { incomeMean, jobLossProb, emProb },
      "Stress": { incomeMean: incomeMean * 0.8, jobLossProb: jobLossProb * 2, emProb: emProb * 2 }
    };
    
    const results = {};
    for (const [name, params] of Object.entries(scenarios)) {
      try {
        const r = await api.post("/api/risk/simulate", {
          simulations: Math.min(2000, Number(simulations)),
          months: 6,
          monthlyIncomeMean: Number(params.incomeMean),
          monthlyIncomeStdev: Number(incomeStdev),
          monthlyExpenseMean: Number(expMean),
          monthlyExpenseStdev: Number(expStdev),
          jobLossProb: Number(params.jobLossProb),
          emergencyProb: Number(params.emProb)
        });
        results[name] = r.data;
      } catch (e) {
        results[name] = { pd: 0, suggestedCapsuleLimit: 0, factor: 0, error: true };
      }
    }
    setScenarioResults(results);
    setIsRunning(false);
    setMsg("✅ Scenario comparison complete");
    setTimeout(() => setMsg(""), 3000);
  }

  async function runSensitivity() {
    setMsg("");
    setIsRunning(true);
    const incomeVariations = [0.8, 0.9, 1.0, 1.1, 1.2];
    const results = [];
    
    for (const factor of incomeVariations) {
      try {
        const r = await api.post("/api/risk/simulate", {
          simulations: 1000,
          months: 6,
          monthlyIncomeMean: Number(incomeMean) * factor,
          monthlyIncomeStdev: Number(incomeStdev),
          monthlyExpenseMean: Number(expMean),
          monthlyExpenseStdev: Number(expStdev),
          jobLossProb: Number(jobLossProb),
          emergencyProb: Number(emProb)
        });
        results.push({ factor: `${(factor * 100).toFixed(0)}%`, pd: r.data.pd, limit: r.data.suggestedCapsuleLimit });
      } catch (e) {
        results.push({ factor: `${(factor * 100).toFixed(0)}%`, pd: 0, limit: 0 });
      }
    }
    setScenarioResults({ sensitivity: results });
    setIsRunning(false);
    setMsg("✅ Sensitivity analysis complete");
    setTimeout(() => setMsg(""), 3000);
  }

  const getRiskColor = (pd) => {
    if (pd < 0.03) return "#4caf50";
    if (pd < 0.08) return "#ff9800";
    return "#f44336";
  };

  const getRiskLabel = (pd) => {
    if (pd < 0.03) return "Low Risk";
    if (pd < 0.08) return "Medium Risk";
    return "High Risk";
  };

  return (
    <div className="card">
      <h3>🎲 Monte Carlo Risk Engine</h3>
      <div className="small">Simulates income volatility + shock scenarios over 6 months</div>

      {/* Bank Data Status Banner */}
      {user.bankLinked && (
        <div style={{ 
          marginBottom: 15, 
          padding: "12px", 
          background: useBankData && bankData ? "#e8f5e9" : "#fff3e0", 
          borderRadius: "8px",
          borderLeft: `4px solid ${useBankData && bankData ? "#4caf50" : "#ff9800"}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <strong>🏦 Bank Account Linked</strong>
              {bankData && (
                <div className="small">
                  {bankData.bankName} • {bankData.accountNumber} • Avg Income: ${bankData.averageMonthlyIncome}/mo
                </div>
              )}
              {!bankData && (
                <div className="small">
                  Click refresh to load your bank data
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {bankData && (
                <button 
                  style={{
                    background: useBankData ? "#4caf50" : "#666",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                  onClick={() => {
                    setUseBankData(!useBankData);
                    if (!useBankData && bankData) {
                      setIncomeMean(bankData.averageMonthlyIncome);
                      setIncomeStdev(Math.round(bankData.incomeVolatility * bankData.averageMonthlyIncome));
                      setExpMean(bankData.averageMonthlyExpenses);
                      setExpStdev(Math.round(bankData.expenseVolatility * bankData.averageMonthlyExpenses));
                      setMsg("✅ Using bank data for simulation");
                    } else {
                      setMsg("📝 Using manual parameters");
                    }
                    setTimeout(() => setMsg(""), 2000);
                  }}
                >
                  {useBankData ? "✓ Using Bank Data" : "Use Bank Data"}
                </button>
              )}
              <button 
                style={{
                  background: "#2196f3",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
                onClick={fetchBankData}
              >
                🔄 Refresh Bank Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <div className="col">
          <label>Simulations (1,000–10,000)</label>
          <input className="input" type="number" value={simulations} onChange={(e)=>setSimulations(e.target.value)} />
          <label>Monthly income mean ($)</label>
          <input className="input" type="number" value={incomeMean} onChange={(e)=>setIncomeMean(e.target.value)} />
          <label>Monthly income stdev ($)</label>
          <input className="input" type="number" value={incomeStdev} onChange={(e)=>setIncomeStdev(e.target.value)} />
        </div>
        <div className="col">
          <label>Monthly expense mean ($)</label>
          <input className="input" type="number" value={expMean} onChange={(e)=>setExpMean(e.target.value)} />
          <label>Monthly expense stdev ($)</label>
          <input className="input" type="number" value={expStdev} onChange={(e)=>setExpStdev(e.target.value)} />
          <label>Job loss prob / month (%)</label>
          <input className="input" type="number" step="0.01" value={jobLossProb * 100} onChange={(e)=>setJobLossProb(e.target.value / 100)} />
          <label>Emergency prob / month (%)</label>
          <input className="input" type="number" step="0.01" value={emProb * 100} onChange={(e)=>setEmProb(e.target.value / 100)} />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={run} disabled={isRunning}>
          {isRunning ? "⏳ Running..." : "🎲 Run Single Simulation"}
        </button>
        <button className="btn-secondary" onClick={runScenarios} disabled={isRunning}>
          📊 Compare Scenarios
        </button>
        <button className="btn-secondary" onClick={() => setShowSensitivity(!showSensitivity)}>
          🎛️ {showSensitivity ? "Hide" : "Show"} Sensitivity
        </button>
      </div>

      {showSensitivity && (
        <div style={{ marginTop: 15, padding: "15px", background: "#f5f5f5", borderRadius: "8px" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>🎛️ Income Sensitivity Analysis</h4>
          <button className="btn-small" onClick={runSensitivity} disabled={isRunning}>
            Run Sensitivity Analysis
          </button>
        </div>
      )}

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}

      {/* Single Simulation Result */}
      {result && (
        <div className="result-card" style={{ 
          marginTop: 15, 
          padding: "15px", 
          background: "#f5f5f5", 
          borderRadius: "8px",
          borderLeft: `4px solid ${getRiskColor(result.pd)}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div>📊 Probability of Default: <b style={{ color: getRiskColor(result.pd) }}>{(result.pd * 100).toFixed(2)}%</b></div>
              <div>⚠️ Risk Rating: <b>{getRiskLabel(result.pd)}</b></div>
              <div>💰 Suggested Capsule Limit: <b>${result.suggestedCapsuleLimit}</b> (factor {result.factor})</div>
              {useBankData && bankData && (
                <div className="small" style={{ marginTop: "5px", color: "#4caf50" }}>
                  🏦 Based on linked bank data from {bankData.bankName}
                </div>
              )}
            </div>
            <div className="small">
              Based on {simulations.toLocaleString()} simulations over 6 months
            </div>
          </div>
        </div>
      )}

      {/* Scenario Comparison Results */}
      {Object.keys(scenarioResults).length > 0 && !scenarioResults.sensitivity && (
        <div className="result-card" style={{ marginTop: 15 }}>
          <h4 style={{ margin: "0 0 10px 0" }}>📊 Scenario Comparison</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
            {Object.entries(scenarioResults).map(([name, data]) => (
              <div key={name} style={{ 
                padding: "12px", 
                background: data.error ? "#ffebee" : "white", 
                borderRadius: "8px",
                border: `1px solid ${getRiskColor(data.pd)}`
              }}>
                <div style={{ fontWeight: "bold", marginBottom: "8px" }}>{name}</div>
                <div>PD: <b style={{ color: getRiskColor(data.pd) }}>{(data.pd * 100).toFixed(1)}%</b></div>
                <div className="small">Limit: ${data.suggestedCapsuleLimit}</div>
                <div className="small">Factor: {data.factor}</div>
              </div>
            ))}
          </div>
          <div className="small" style={{ marginTop: 10 }}>
            💡 Optimistic assumes +20% income, Stress assumes -20% income + 2x shock probability
          </div>
        </div>
      )}

      {/* Sensitivity Results */}
      {scenarioResults.sensitivity && (
        <div className="result-card" style={{ marginTop: 15 }}>
          <h4 style={{ margin: "0 0 10px 0" }}>🎛️ Income Sensitivity Analysis</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <th style={{ padding: "8px", textAlign: "left" }}>Income Change</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>Probability of Default</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>Suggested Limit</th>
                </tr>
              </thead>
              <tbody>
                {scenarioResults.sensitivity.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px" }}>{item.factor}</td>
                    <td style={{ padding: "8px", textAlign: "center", color: getRiskColor(item.pd) }}>
                      {(item.pd * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "8px", textAlign: "center" }}>${item.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .btn-primary {
          background: linear-gradient(135deg, #4caf50, #45a049);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-secondary {
          background: #666;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-small {
          background: #2196f3;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
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
      `}</style>
    </div>
  );
}