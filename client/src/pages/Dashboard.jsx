import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Dashboard({ user }) {
  const [capsule, setCapsule] = useState(null);
  const [txns, setTxns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cap = await api.get("/api/capsule");
      setCapsule(cap.data.capsule);
      const t = await api.get("/api/audit/txns");
      setTxns(t.data.txns);
    })();
  }, [user]);

  if (!user) return <div className="card">🔐 Please login first.</div>;

  // Calculate transaction analytics
  const totalTransactions = txns.length;
  const approvedTxns = txns.filter(t => t.approved === true).length;
  const deniedTxns = txns.filter(t => t.approved === false).length;
  const approvalRate = totalTransactions > 0 ? ((approvedTxns / totalTransactions) * 100).toFixed(1) : 0;
  const denialRate = totalTransactions > 0 ? ((deniedTxns / totalTransactions) * 100).toFixed(1) : 0;
  
  const totalVolume = txns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const avgTransaction = totalTransactions > 0 ? (totalVolume / totalTransactions).toFixed(2) : 0;
  
  // Risk tier breakdown
  const riskTiers = {
    LOW: txns.filter(t => t.riskTier === "LOW").length,
    MEDIUM: txns.filter(t => t.riskTier === "MEDIUM").length,
    HIGH: txns.filter(t => t.riskTier === "HIGH").length
  };
  
  // MCC category breakdown
  const mccBreakdown = {};
  txns.forEach(t => {
    if (t.mcc) {
      mccBreakdown[t.mcc] = (mccBreakdown[t.mcc] || 0) + 1;
    }
  });
  
  // Top merchants by volume
  const merchantVolume = {};
  txns.forEach(t => {
    if (t.merchant && t.approved) {
      const amount = parseFloat(t.amount) || 0;
      merchantVolume[t.merchant] = (merchantVolume[t.merchant] || 0) + amount;
    }
  });
  const topMerchants = Object.entries(merchantVolume)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Function to manually refresh transactions
  const refreshTransactions = async () => {
    setIsLoading(true);
    try {
      const t = await api.get("/api/audit/txns");
      setTxns(t.data.txns);
    } catch (error) {
      console.error("Failed to refresh transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Analytics Dashboard Section */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h3 style={{ margin: 0 }}>📊 Transaction Analytics Dashboard</h3>
          <button 
            onClick={refreshTransactions} 
            disabled={isLoading}
            style={{
              padding: "6px 12px",
              background: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            {isLoading ? "⏳ Refreshing..." : "🔄 Refresh Data"}
          </button>
        </div>
        
        {/* KPI Cards */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "15px",
          marginBottom: "20px"
        }}>
          <div style={{ 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
            padding: "15px", 
            borderRadius: "10px",
            color: "white",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>TOTAL TRANSACTIONS</div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>{totalTransactions}</div>
          </div>
          
          <div style={{ 
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", 
            padding: "15px", 
            borderRadius: "10px",
            color: "white",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>APPROVAL RATE</div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>{approvalRate}%</div>
            <div style={{ fontSize: "11px" }}>({approvedTxns} / {totalTransactions})</div>
          </div>
          
          <div style={{ 
            background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", 
            padding: "15px", 
            borderRadius: "10px",
            color: "white",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>DENIAL RATE</div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>{denialRate}%</div>
            <div style={{ fontSize: "11px" }}>({deniedTxns} / {totalTransactions})</div>
          </div>
          
          <div style={{ 
            background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", 
            padding: "15px", 
            borderRadius: "10px",
            color: "#333",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>TOTAL VOLUME</div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>${totalVolume.toFixed(2)}</div>
          </div>
          
          <div style={{ 
            background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", 
            padding: "15px", 
            borderRadius: "10px",
            color: "#333",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>AVG TRANSACTION</div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>${avgTransaction}</div>
          </div>
        </div>
        
        {/* Two-column layout for charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Risk Tier Distribution */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "10px", padding: "15px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>⚠️ Risk Tier Distribution</h4>
            {totalTransactions === 0 ? (
              <div className="small" style={{ textAlign: "center", padding: "20px" }}>No transaction data available</div>
            ) : (
              <div>
                {Object.entries(riskTiers).map(([tier, count]) => {
                  const percentage = (count / totalTransactions) * 100;
                  const colors = { LOW: "#4caf50", MEDIUM: "#ff9800", HIGH: "#f44336" };
                  return (
                    <div key={tier} style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                        <span>{tier} Risk</span>
                        <span>{count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div style={{ background: "#e0e0e0", borderRadius: "5px", overflow: "hidden" }}>
                        <div style={{ 
                          width: `${percentage}%`, 
                          background: colors[tier], 
                          height: "8px", 
                          borderRadius: "5px" 
                        }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* MCC Category Breakdown */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "10px", padding: "15px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>🏷️ Transaction Categories (MCC)</h4>
            <div style={{ maxHeight: "150px", overflowY: "auto" }}>
              {Object.entries(mccBreakdown).length === 0 ? (
                <div className="small" style={{ textAlign: "center", padding: "20px" }}>No transaction data available</div>
              ) : (
                Object.entries(mccBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([mcc, count]) => {
                    const percentage = (count / totalTransactions) * 100;
                    return (
                      <div key={mcc} style={{ marginBottom: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                          <span>{mcc}</span>
                          <span>{count} txns</span>
                        </div>
                        <div style={{ background: "#e0e0e0", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${percentage}%`, background: "#2196f3", height: "4px" }}></div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
        
        {/* Top Merchants Table */}
        {topMerchants.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>🏪 Top Merchants by Volume</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Rank</th>
                  <th style={{ padding: "8px" }}>Merchant</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>Volume ($)</th>
                </tr>
              </thead>
              <tbody>
                {topMerchants.map(([merchant, volume], idx) => (
                  <tr key={merchant} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px" }}>#{idx + 1}</td>
                    <td style={{ padding: "8px" }}>{merchant}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>${volume.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Original Dashboard Sections */}
      <div className="card">
        <h3>👤 Profile</h3>
        <div>Email: <b>{user.email}</b></div>
        <div>Approved limit: <b>{user.approvedLimit}</b></div>
        <div className="small">UserAddress (demo): {user.userAddress}</div>
      </div>

      <div className="card">
        <h3>💊 Capsule Summary</h3>
        {!capsule ? (
          <div className="small">No capsule yet. Go to Capsule Setup.</div>
        ) : (
          <>
            <div>Capsule limit: <b>{capsule.capsuleLimit}</b></div>
            <div>Spent today: <b>{capsule.spentToday}</b> / daily cap <b>{capsule.rules.dailyCap}</b></div>
            <div>Spent total: <b>{capsule.spentTotal}</b></div>
            <div className="small">Allowed MCC: {capsule.rules.allowedMcc.join(", ")}</div>
          </>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3 style={{ margin: 0 }}>📋 Recent Decisions (off-chain)</h3>
          <button 
            onClick={refreshTransactions} 
            disabled={isLoading}
            style={{
              padding: "4px 10px",
              background: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "11px"
            }}
          >
            🔄 Refresh
          </button>
        </div>
        {txns.length === 0 ? (
          <div className="small">No transactions yet. Go to Transaction Test to make some.</div>
        ) : (
          txns.slice(0, 8).map((t, i) => (
            <div key={i} className="small" style={{ 
              marginBottom: 8, 
              padding: "8px", 
              background: t.approved ? "#e8f5e9" : "#ffebee", 
              borderRadius: "5px",
              borderLeft: t.approved ? "3px solid #4caf50" : "3px solid #f44336"
            }}>
              <b>{t.approved ? "✅ APPROVED" : "❌ DENIED"}</b> • {t.merchant} • {t.mcc} • ${t.amount} • tier={t.riskTier} • {t.reason}
            </div>
          ))
        )}
      </div>
      
      <style jsx>{`
        .card {
          margin-bottom: 20px;
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          background: white;
        }
        h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }
        .small {
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
}