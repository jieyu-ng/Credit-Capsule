import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

// Simple bar chart component using CSS
const SimpleBarChart = ({ data, title, valueKey, labelKey, color = "#4caf50" }) => {
  const maxValue = Math.max(...data.map(d => d[valueKey]), 0);
  
  return (
    <div style={{ marginBottom: "20px" }}>
      <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>{title}</h4>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", height: "120px" }}>
        {data.map((item, idx) => {
          const height = maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0;
          return (
            <div key={idx} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ 
                height: `${height}px`, 
                background: color, 
                borderRadius: "5px 5px 0 0",
                transition: "height 0.3s ease",
                position: "relative"
              }}>
                <span style={{ 
                  position: "absolute", 
                  top: "-20px", 
                  left: "50%", 
                  transform: "translateX(-50%)",
                  fontSize: "11px",
                  fontWeight: "bold"
                }}>
                  {item[valueKey]}
                </span>
              </div>
              <div style={{ fontSize: "11px", marginTop: "5px", wordBreak: "break-word" }}>
                {item[labelKey]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Simple line chart for time series
const SimpleLineChart = ({ data, title }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const points = data.map((d, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 100 - ((d.value - minValue) / range) * 90;
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <div style={{ marginBottom: "20px" }}>
      <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>{title}</h4>
      <svg viewBox="0 0 100 60" style={{ width: "100%", height: "80px" }}>
        <polyline
          points={points}
          fill="none"
          stroke="#4caf50"
          strokeWidth="2"
        />
        {data.map((d, idx) => {
          const x = (idx / (data.length - 1)) * 100;
          const y = 100 - ((d.value - minValue) / range) * 90;
          return (
            <circle key={idx} cx={x} cy={y} r="1.5" fill="#2196f3" />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "5px" }}>
        {data.map((d, idx) => (
          <span key={idx}>{d.label}</span>
        ))}
      </div>
    </div>
  );
};

export default function Dashboard({ user }) {
  const [capsule, setCapsule] = useState(null);
  const [txns, setTxns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("week"); // day, week, month
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const cap = await api.get("/api/capsule");
      setCapsule(cap.data.capsule);
      const t = await api.get(`/api/audit/txns?range=${timeRange}`);
      setTxns(t.data.txns);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <div className="card">🔐 Please login first.</div>;

  // Calculate time-based analytics
  const now = new Date();
  const last24h = txns.filter(t => {
    const txnDate = new Date(t.timestamp);
    return (now - txnDate) <= 24 * 60 * 60 * 1000;
  });
  
  // Transaction analytics
  const totalTransactions = txns.length;
  const approvedTxns = txns.filter(t => t.approved === true).length;
  const deniedTxns = txns.filter(t => t.approved === false).length;
  const approvalRate = totalTransactions > 0 ? ((approvedTxns / totalTransactions) * 100).toFixed(1) : 0;
  
  const totalVolume = txns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const avgTransaction = totalTransactions > 0 ? (totalVolume / totalTransactions).toFixed(2) : 0;
  const last24hVolume = last24h.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  
  // Risk tier breakdown
  const riskTiers = {
    LOW: txns.filter(t => t.riskTier === "LOW").length,
    MEDIUM: txns.filter(t => t.riskTier === "MEDIUM").length,
    HIGH: txns.filter(t => t.riskTier === "HIGH").length
  };
  
  // Time series data for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();
  
  const dailyVolume = last7Days.map(day => {
    const dayTxns = txns.filter(t => t.timestamp?.startsWith(day));
    return {
      label: day.slice(5),
      value: dayTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
    };
  });
  
  const dailyApprovals = last7Days.map(day => {
    const dayTxns = txns.filter(t => t.timestamp?.startsWith(day));
    const approved = dayTxns.filter(t => t.approved).length;
    return {
      label: day.slice(5),
      value: approved
    };
  });
  
  // MCC category breakdown with percentages
  const mccBreakdown = {};
  txns.forEach(t => {
    if (t.mcc) {
      mccBreakdown[t.mcc] = (mccBreakdown[t.mcc] || 0) + 1;
    }
  });
  
  const mccChartData = Object.entries(mccBreakdown)
    .map(([mcc, count]) => ({
      label: mcc,
      value: count,
      percentage: ((count / totalTransactions) * 100).toFixed(1)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  
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
  
  // Hourly activity pattern
  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
    const hourTxns = txns.filter(t => {
      const txnHour = t.timestamp ? new Date(t.timestamp).getHours() : -1;
      return txnHour === hour;
    });
    return {
      label: `${hour}:00`,
      value: hourTxns.length
    };
  });
  
  // Capsule utilization metrics
  const capsuleUtilization = capsule ? {
    used: parseFloat(capsule.spentTotal) || 0,
    available: parseFloat(capsule.capsuleLimit) - (parseFloat(capsule.spentTotal) || 0),
    dailyUsed: parseFloat(capsule.spentToday) || 0,
    dailyRemaining: parseFloat(capsule.rules?.dailyCap) - (parseFloat(capsule.spentToday) || 0)
  } : null;

  return (
    <div>
      {/* Header with time filter */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>📊 Analytics Dashboard</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: "5px", border: "1px solid #ddd" }}
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button 
            onClick={loadData} 
            disabled={isLoading}
            style={{
              padding: "5px 12px",
              background: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            {isLoading ? "⏳" : "🔄"}
          </button>
          <button 
            onClick={() => setShowDetailedStats(!showDetailedStats)}
            style={{
              padding: "5px 12px",
              background: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            {showDetailedStats ? "📊 Simple" : "📈 Detailed"}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
        gap: "15px",
        marginBottom: "20px"
      }}>
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <div className="stat-label">TOTAL TRANSACTIONS</div>
          <div className="stat-value">{totalTransactions}</div>
          <div className="stat-trend">+{last24h.length} in 24h</div>
        </div>
        
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
          <div className="stat-label">APPROVAL RATE</div>
          <div className="stat-value">{approvalRate}%</div>
          <div className="stat-trend">{approvedTxns} / {deniedTxns} denied</div>
        </div>
        
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>
          <div className="stat-label">TOTAL VOLUME</div>
          <div className="stat-value">${totalVolume.toFixed(2)}</div>
          <div className="stat-trend">${last24hVolume.toFixed(2)} last 24h</div>
        </div>
        
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" }}>
          <div className="stat-label">AVG TRANSACTION</div>
          <div className="stat-value">${avgTransaction}</div>
          <div className="stat-trend">${(totalVolume / Math.max(1, approvedTxns)).toFixed(2)} avg approved</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="card">
        <h3 style={{ margin: "0 0 15px 0" }}>📈 Transaction Trends</h3>
        
        <div style={{ display: "grid", gridTemplateColumns: showDetailedStats ? "1fr 1fr" : "1fr", gap: "20px" }}>
          <SimpleLineChart data={dailyVolume} title="Daily Transaction Volume ($)" />
          {showDetailedStats && (
            <SimpleLineChart data={dailyApprovals} title="Daily Approvals Count" />
          )}
        </div>
        
        {showDetailedStats && (
          <SimpleBarChart 
            data={hourlyActivity.slice(6, 22)} 
            title="Hourly Activity Pattern (6 AM - 10 PM)"
            valueKey="value"
            labelKey="label"
            color="#ff9800"
          />
        )}
        
        <div style={{ display: "grid", gridTemplateColumns: showDetailedStats ? "1fr 1fr" : "1fr", gap: "20px", marginTop: "20px" }}>
          {/* Risk Tier Distribution */}
          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>⚠️ Risk Tier Distribution</h4>
            {totalTransactions === 0 ? (
              <div className="small" style={{ textAlign: "center", padding: "20px" }}>No data</div>
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
          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>🏷️ Top Categories</h4>
            {mccChartData.length === 0 ? (
              <div className="small" style={{ textAlign: "center", padding: "20px" }}>No data</div>
            ) : (
              <div>
                {mccChartData.map(({ label, value, percentage }) => (
                  <div key={label} style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>{label}</span>
                      <span>{value} ({percentage}%)</span>
                    </div>
                    <div style={{ background: "#e0e0e0", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${percentage}%`, background: "#2196f3", height: "4px" }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Capsule Utilization */}
        {capsuleUtilization && (
          <div style={{ marginTop: "20px", padding: "15px", background: "#f5f5f5", borderRadius: "10px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>💊 Capsule Utilization</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#666" }}>Total Limit Usage</div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                  ${capsuleUtilization.used.toFixed(2)} / ${capsule.capsuleLimit}
                </div>
                <div style={{ background: "#e0e0e0", borderRadius: "5px", marginTop: "5px" }}>
                  <div style={{ 
                    width: `${(capsuleUtilization.used / capsule.capsuleLimit) * 100}%`, 
                    background: "#4caf50", 
                    height: "6px", 
                    borderRadius: "5px" 
                  }}></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#666" }}>Daily Cap Usage</div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                  ${capsuleUtilization.dailyUsed.toFixed(2)} / ${capsule.rules.dailyCap}
                </div>
                <div style={{ background: "#e0e0e0", borderRadius: "5px", marginTop: "5px" }}>
                  <div style={{ 
                    width: `${(capsuleUtilization.dailyUsed / capsule.rules.dailyCap) * 100}%`, 
                    background: "#ff9800", 
                    height: "6px", 
                    borderRadius: "5px" 
                  }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Top Merchants Table */}
        {topMerchants.length > 0 && (
          <div style={{ marginTop: "20px" }}>
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

      {/* Profile and Capsule Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div className="card">
          <h3>👤 Profile</h3>
          <div>Email: <b>{user.email}</b></div>
          <div>Approved limit: <b>${user.approvedLimit}</b></div>
          <div className="small">UserAddress: {user.userAddress?.slice(0, 10)}...</div>
        </div>

        <div className="card">
          <h3>💊 Capsule Summary</h3>
          {!capsule ? (
            <div className="small">No capsule yet. Go to Capsule Setup.</div>
          ) : (
            <>
              <div>Capsule limit: <b>${capsule.capsuleLimit}</b></div>
              <div>Spent today: <b>${capsule.spentToday}</b> / ${capsule.rules?.dailyCap}</div>
              <div>Spent total: <b>${capsule.spentTotal}</b></div>
              <div className="small">Allowed MCC: {capsule.rules?.allowedMcc?.join(", ")}</div>
            </>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3 style={{ margin: 0 }}>📋 Recent Decisions</h3>
          <span className="small">Last {Math.min(10, txns.length)} of {totalTransactions} transactions</span>
        </div>
        {txns.length === 0 ? (
          <div className="small">No transactions yet. Go to Transaction Test to make some.</div>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {txns.slice(0, 10).map((t, i) => (
              <div key={i} className="txn-item" style={{ 
                marginBottom: 8, 
                padding: "10px", 
                background: t.approved ? "#e8f5e9" : "#ffebee", 
                borderRadius: "5px",
                borderLeft: t.approved ? "3px solid #4caf50" : "3px solid #f44336"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>{t.approved ? "✅ APPROVED" : "❌ DENIED"}</b>
                    <span style={{ marginLeft: "10px" }}>{t.merchant}</span>
                    <span style={{ marginLeft: "10px", fontSize: "11px", color: "#666" }}>{t.mcc}</span>
                  </div>
                  <div>
                    <b>${t.amount}</b>
                  </div>
                </div>
                <div style={{ fontSize: "11px", marginTop: "5px" }}>
                  tier={t.riskTier} • {t.reason}
                  {t.timestamp && <span style={{ marginLeft: "10px" }}>• {new Date(t.timestamp).toLocaleTimeString()}</span>}
                </div>
              </div>
            ))}
          </div>
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
        .stat-card {
          padding: 15px;
          border-radius: 10px;
          color: white;
          text-align: center;
        }
        .stat-label {
          font-size: 12px;
          opacity: 0.9;
        }
        .stat-value {
          font-size: 28px;
          font-weight: bold;
        }
        .stat-trend {
          font-size: 10px;
          opacity: 0.8;
          margin-top: 5px;
        }
        .txn-item {
          transition: all 0.2s ease;
        }
        .txn-item:hover {
          transform: translateX(5px);
        }
      `}</style>
    </div>
  );
}