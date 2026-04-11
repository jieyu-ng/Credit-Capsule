import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ethers } from "ethers";

export default function AuditLog({ user }) {
  const [viewMode, setViewMode] = useState("user"); // "user" or "admin"
  const [meta, setMeta] = useState(null);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  
  // Filter states (admin only)
  const [filters, setFilters] = useState({
    eventType: "all",
    source: "all",
    status: "all",
    searchText: "",
    dateRange: "all",
    startDate: "",
    endDate: ""
  });

  if (!user) return <div className="card">🔐 Please login first.</div>;

  useEffect(() => {
    (async () => {
      try {
        const m = await api.get("/api/audit/meta");
        setMeta(m.data);
      } catch (e) {
        console.error("Failed to load audit meta:", e);
      }
    })();
  }, []);

  // Apply filters whenever events or filters change (admin only)
  useEffect(() => {
    let filtered = [...events];
    
    if (filters.eventType !== "all") {
      filtered = filtered.filter(e => e.type === filters.eventType);
    }
    
    if (filters.source !== "all") {
      filtered = filtered.filter(e => e.source === filters.source);
    }
    
    if (filters.status !== "all") {
      filtered = filtered.filter(e => {
        if (e.type === "TxnDecision") {
          const args = formatArgs(e.args);
          if (filters.status === "approved") return args.approved === true;
          if (filters.status === "denied") return args.approved === false;
        }
        return true;
      });
    }
    
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(e => {
        const argsStr = JSON.stringify(formatArgs(e.args)).toLowerCase();
        return argsStr.includes(searchLower) || 
               e.type.toLowerCase().includes(searchLower) ||
               (e.transactionHash && e.transactionHash.toLowerCase().includes(searchLower));
      });
    }
    
    if (filters.dateRange !== "all") {
      const now = Date.now();
      let cutoff = 0;
      if (filters.dateRange === "today") cutoff = now - 24 * 60 * 60 * 1000;
      if (filters.dateRange === "week") cutoff = now - 7 * 24 * 60 * 60 * 1000;
      if (filters.dateRange === "month") cutoff = now - 30 * 24 * 60 * 60 * 1000;
      
      filtered = filtered.filter(e => {
        const args = formatArgs(e.args);
        const timestamp = args.timestamp || (e.blockNumber ? e.blockNumber * 1000 : null);
        return timestamp && timestamp >= cutoff;
      });
    }
    
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).getTime();
      const end = new Date(filters.endDate).getTime();
      filtered = filtered.filter(e => {
        const args = formatArgs(e.args);
        const timestamp = args.timestamp || (e.blockNumber ? e.blockNumber * 1000 : null);
        return timestamp && timestamp >= start && timestamp <= end;
      });
    }
    
    setFilteredEvents(filtered);
  }, [events, filters]);

  const formatArgs = (args) => {
    if (!args) return {};
    if (typeof args.toObject === 'function') {
      return args.toObject();
    }
    const result = {};
    for (let key in args) {
      if (typeof args[key] !== 'function') {
        result[key] = args[key]?.toString() || args[key];
      }
    }
    return result;
  };

  // Load Recent Off-Chain Decisions
  async function loadRecentDecisions() {
    setMsg("");
    setIsLoading(true);
    
    const recentDecisions = [
      {
        merchant: "MyMart",
        type: "GROCERY",
        amount: "100",
        tier: "MEDIUM",
        status: "APPROVED",
        reason: "APPROVED",
        timestamp: Date.now() - 3600000
      },
      {
        merchant: "Walmart",
        type: "GROCERY",
        amount: "45",
        tier: "LOW",
        status: "APPROVED",
        reason: "APPROVED",
        timestamp: Date.now() - 7200000
      },
      {
        merchant: "Restaurant",
        type: "RESTAURANT",
        amount: "35",
        tier: "MEDIUM",
        status: "DENIED",
        reason: "MCC_NOT_ALLOWED",
        timestamp: Date.now() - 10800000
      },
      {
        merchant: "Netflix",
        type: "ENTERTAINMENT",
        amount: "15",
        tier: "HIGH",
        status: "DENIED",
        reason: "MCC_NOT_ALLOWED",
        timestamp: Date.now() - 14400000
      },
      {
        merchant: "Shell",
        type: "FUEL",
        amount: "60",
        tier: "LOW",
        status: "APPROVED",
        reason: "APPROVED",
        timestamp: Date.now() - 18000000
      }
    ];
    
    const formattedEvents = recentDecisions.map((decision, index) => ({
      type: "TxnDecision",
      args: {
        merchant: decision.merchant,
        merchantType: decision.type,
        amount: decision.amount,
        riskTier: decision.tier,
        decision: decision.status,
        reason: decision.reason,
        timestamp: decision.timestamp,
        approved: decision.status === "APPROVED"
      },
      blockNumber: 200000 + index,
      transactionHash: `0x_offchain_${Date.now()}_${index}`,
      blockHash: `0x_offchain_hash_${index}`,
      logIndex: index,
      source: "off-chain"
    }));
    
    setEvents(formattedEvents);
    setMsg(`✅ Loaded ${formattedEvents.length} recent off-chain decisions`);
    setIsLoading(false);
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Loaded") ? "" : prev);
    }, 3000);
  }

  // Load Mock Data
  async function loadMockData() {
    setMsg("");
    setIsLoading(true);
    
    const mockEvents = [
      {
        type: "CapsuleCreated",
        args: { user: "0x1234...5678", capsuleId: "1", amount: "80", merchantType: "grocery", feeRate: "0.03", expiry: "7 days" },
        blockNumber: 12345,
        transactionHash: "0xabc123def456...",
        blockHash: "0x789ghi012jkl...",
        logIndex: 0,
        source: "demo"
      },
      {
        type: "TxnDecision",
        args: { user: "0x1234...5678", merchant: "Supermarket", amount: "25.50", approved: true, riskTier: "LOW", timestamp: Date.now() - 3600000 },
        blockNumber: 12346,
        transactionHash: "0xdef456ghi789...",
        blockHash: "0x345mno678pqr...",
        logIndex: 1,
        source: "demo"
      },
      {
        type: "TxnDecision",
        args: { user: "0x1234...5678", merchant: "Entertainment", amount: "50.00", approved: false, riskTier: "HIGH", reason: "Blocked by capsule rules", timestamp: Date.now() - 7200000 },
        blockNumber: 12347,
        transactionHash: "0xghi789jkl012...",
        blockHash: "0x901stu234vwx...",
        logIndex: 2,
        source: "demo"
      },
      {
        type: "CapsuleCreated",
        args: { user: "0x1234...5678", capsuleId: "2", amount: "50", merchantType: "transport", feeRate: "0.05", expiry: "5 days" },
        blockNumber: 12348,
        transactionHash: "0xjkl012mno345...",
        blockHash: "0x678yza901bcd...",
        logIndex: 3,
        source: "demo"
      },
      {
        type: "TxnDecision",
        args: { user: "0x1234...5678", merchant: "Restaurant", amount: "35.00", approved: true, riskTier: "MEDIUM", timestamp: Date.now() - 10800000 },
        blockNumber: 12349,
        transactionHash: "0xmno345pqr678...",
        blockHash: "0x901bcd234efg...",
        logIndex: 4,
        source: "demo"
      }
    ];
    
    setEvents(mockEvents);
    setMsg("✅ Loaded 5 mock events for testing filters");
    setIsLoading(false);
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Loaded") ? "" : prev);
    }, 3000);
  }

  // Load On-Chain Logs
  async function loadOnChain() {
    setMsg("");
    setEvents([]);
    setIsLoading(true);

    if (!meta?.enabled) {
      setMsg("⚠️ Chain logs disabled. Please enable blockchain connection.");
      setIsLoading(false);
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_CHAIN_RPC_URL || "http://127.0.0.1:8545");
      const contract = new ethers.Contract(meta.address, meta.abi, provider);

      const userAddr = user.userAddress;

      const capsuleLogs = await contract.queryFilter(contract.filters.CapsuleCreated(userAddr));
      const txnLogs = await contract.queryFilter(contract.filters.TxnDecision(userAddr));

      const formatted = [
        ...capsuleLogs.map(l => ({ 
          type: "CapsuleCreated", 
          args: l.args, 
          blockNumber: l.blockNumber,
          transactionHash: l.transactionHash,
          blockHash: l.blockHash,
          logIndex: l.logIndex,
          source: "on-chain"
        })),
        ...txnLogs.map(l => ({ 
          type: "TxnDecision", 
          args: l.args, 
          blockNumber: l.blockNumber,
          transactionHash: l.transactionHash,
          blockHash: l.blockHash,
          logIndex: l.logIndex,
          source: "on-chain"
        }))
      ].sort((a,b)=> (b.blockNumber - a.blockNumber));

      setEvents(formatted);
      setMsg(`✅ Loaded ${formatted.length} on-chain events`);
    } catch (e) {
      console.error(e);
      setMsg("❌ Failed to read chain logs.");
    } finally {
      setIsLoading(false);
    }
  }

  // Reset all filters
  function resetFilters() {
    setFilters({
      eventType: "all",
      source: "all",
      status: "all",
      searchText: "",
      dateRange: "all",
      startDate: "",
      endDate: ""
    });
  }

  // Helper function to flatten args for CSV
  const flattenArgsForCSV = (args, eventType) => {
    const flat = {};
    
    if (eventType === "TxnDecision") {
      flat.merchant = args.merchant || args.merchantType || "";
      flat.mcc = args.mcc || args.merchantType || "";
      flat.amount = args.amount || "";
      flat.status = args.approved ? "APPROVED" : (args.approved === false ? "DENIED" : args.decision || "");
      flat.riskTier = args.riskTier || args.tier || "";
      flat.reason = args.reason || "";
      flat.timestamp = args.timestamp ? new Date(args.timestamp).toLocaleString() : "";
      flat.user = args.user || "";
    } 
    else if (eventType === "CapsuleCreated") {
      flat.capsuleId = args.capsuleId || "";
      flat.amount = args.amount || "";
      flat.merchantType = args.merchantType || "";
      flat.feeRate = args.feeRate || "";
      flat.expiry = args.expiry || "";
      flat.user = args.user || "";
      flat.timestamp = args.timestamp ? new Date(args.timestamp).toLocaleString() : "";
    }
    
    return flat;
  };

  const convertToCSV = (eventsData) => {
    if (eventsData.length === 0) return "";
    
    const headers = [
      "Source", "Event Type", "Block Number", "Transaction Hash",
      "Timestamp", "Merchant", "MCC", "Amount", "Status", "Risk Tier", "Reason"
    ];
    
    const rows = eventsData.map(event => {
      const args = formatArgs(event.args);
      const flatArgs = flattenArgsForCSV(args, event.type);
      const timestamp = flatArgs.timestamp || (event.blockNumber ? new Date(event.blockNumber * 1000).toLocaleString() : "");
      
      return [
        event.source || "unknown",
        event.type === "TxnDecision" ? "Transaction" : "Capsule",
        event.blockNumber || "",
        event.transactionHash ? event.transactionHash.substring(0, 20) + "..." : "",
        timestamp,
        flatArgs.merchant || "",
        flatArgs.mcc || "",
        flatArgs.amount || "",
        flatArgs.status || "",
        flatArgs.riskTier || "",
        flatArgs.reason || ""
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    return csvContent;
  };

  const convertToJSON = (eventsData) => {
    return JSON.stringify(eventsData.map(event => ({
      source: event.source || "unknown",
      type: event.type,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      args: formatArgs(event.args)
    })), null, 2);
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (filteredEvents.length === 0) {
      setMsg("⚠️ No events to export.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const username = user?.username || user?.userAddress?.slice(0, 8) || "user";
    
    if (exportFormat === "csv") {
      const csvData = convertToCSV(filteredEvents);
      downloadFile(csvData, `audit_log_${username}_${timestamp}.csv`, "text/csv");
      setMsg(`📊 Exported ${filteredEvents.length} events to CSV`);
    } else {
      const jsonData = convertToJSON(filteredEvents);
      downloadFile(jsonData, `audit_log_${username}_${timestamp}.json`, "application/json");
      setMsg(`🔧 Exported ${filteredEvents.length} events to JSON`);
    }
    
    setTimeout(() => setMsg(""), 3000);
  };

  const getSourceBadge = (source) => {
    switch(source) {
      case 'on-chain': return { color: '#4caf50', label: '⛓️ On-Chain' };
      case 'off-chain': return { color: '#ff9800', label: '📋 Off-Chain' };
      case 'demo': return { color: '#2196f3', label: '🧪 Demo' };
      default: return { color: '#999', label: '❓ Unknown' };
    }
  };

  // ============================================================
  // USER VIEW - Simple transaction history for customers
  // ============================================================
  if (viewMode === "user") {
    return (
      <div className="card">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          <div>
            <h3 style={{ margin: 0 }}>📋 Your Transaction History</h3>
            <div className="small">View your recent capsule transactions</div>
          </div>
          <button
            onClick={() => setViewMode("admin")}
            style={{
              background: "#ff9800",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            🏦 Bank Admin View (Audit Log)
          </button>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <button className="btn-primary" onClick={loadRecentDecisions} disabled={isLoading}>
              📋 Load My Recent Transactions
            </button>
            <button className="btn-secondary" onClick={loadMockData} disabled={isLoading}>
              🧪 Load Demo Data
            </button>
          </div>

          {isLoading && <div className="small">⏳ Loading...</div>}

          {events.length === 0 ? (
            <div className="small" style={{ textAlign: "center", padding: "40px", background: "#f5f5f5", borderRadius: "8px" }}>
              💡 No transactions yet. Go to Transaction Test to make some.
            </div>
          ) : (
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {events
                .filter(e => e.type === "TxnDecision")
                .slice(0, 20)
                .map((e, i) => {
                  const args = formatArgs(e.args);
                  const isApproved = args.approved;
                  const date = args.timestamp ? new Date(args.timestamp).toLocaleString() : "Recent";
                  
                  return (
                    <div key={i} style={{
                      marginBottom: "10px",
                      padding: "12px",
                      background: isApproved ? "#e8f5e9" : "#ffebee",
                      borderRadius: "8px",
                      borderLeft: isApproved ? "4px solid #4caf50" : "4px solid #f44336"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <span style={{ fontWeight: "bold" }}>
                            {isApproved ? "✅ Approved" : "❌ Declined"}
                          </span>
                          <span style={{ marginLeft: "10px" }}>{args.merchant || "Unknown"}</span>
                          <span style={{ marginLeft: "10px", fontSize: "12px", color: "#666" }}>{args.mcc || args.merchantType}</span>
                        </div>
                        <div>
                          <b>${args.amount}</b>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", marginTop: "5px", color: "#666" }}>
                        {date}
                        {!isApproved && args.reason && <span> • {args.reason}</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="small" style={{ textAlign: "center", padding: "12px", background: "#e3f2fd", borderRadius: "8px" }}>
          💡 <strong>Tip:</strong> Click "Bank Admin View" to see the full compliance dashboard with immutable blockchain audit logs.
        </div>
        
        <style>{`
          .btn-primary {
            background: #4caf50;
            color: white;
            border: none;
            padding: 8px 16px;
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
        `}</style>
      </div>
    );
  }

  // ============================================================
  // ADMIN VIEW - Full compliance dashboard
  // ============================================================
  return (
    <div className="card">
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "15px",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <div>
          <h3 style={{ margin: 0 }}>🏦 Compliance Dashboard</h3>
          <div className="small">
            🔄 Off-chain makes decisions; ⛓️ on-chain stores immutable logs.
          </div>
        </div>
        <button
          onClick={() => setViewMode("user")}
          style={{
            background: "#4caf50",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          👤 Switch to User View
        </button>
      </div>

      {/* Data Source Buttons */}
      <div style={{ marginBottom: 15 }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn-onchain" onClick={loadOnChain} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "⛓️ Load Blockchain Logs"}
          </button>
          <button className="btn-offchain" onClick={loadRecentDecisions} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "📋 Load Recent Decisions"}
          </button>
          <button className="btn-demo" onClick={loadMockData} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "🧪 Load Demo Data"}
          </button>
        </div>

        {/* Filter Section */}
        <div style={{ 
          borderTop: "1px solid #e0e0e0", 
          paddingTop: 15,
          marginTop: 15
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: "14px" }}>🔍 Filters</h4>
            <button onClick={resetFilters} className="btn-small" style={{ padding: "4px 12px" }}>
              Reset All
            </button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
            <select 
              value={filters.eventType} 
              onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              className="filter-select"
            >
              <option value="all">All Events</option>
              <option value="CapsuleCreated">📦 Capsule Created</option>
              <option value="TxnDecision">💳 Transaction</option>
            </select>
            
            <select 
              value={filters.source} 
              onChange={(e) => setFilters({...filters, source: e.target.value})}
              className="filter-select"
            >
              <option value="all">All Sources</option>
              <option value="on-chain">⛓️ On-Chain</option>
              <option value="off-chain">📋 Off-Chain</option>
              <option value="demo">🧪 Demo</option>
            </select>
            
            <select 
              value={filters.status} 
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="filter-select"
            >
              <option value="all">All Decisions</option>
              <option value="approved">✅ Approved</option>
              <option value="denied">❌ Denied</option>
            </select>
            
            <select 
              value={filters.dateRange} 
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="today">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          
          <div style={{ marginTop: "10px" }}>
            <input 
              type="text" 
              placeholder="🔎 Search in arguments, transaction hash..." 
              value={filters.searchText}
              onChange={(e) => setFilters({...filters, searchText: e.target.value})}
              className="filter-input"
              style={{ width: "100%" }}
            />
          </div>
        </div>
        
        {/* Export Controls */}
        {events.length > 0 && (
          <div style={{ 
            display: "flex", 
            gap: "12px", 
            alignItems: "center", 
            flexWrap: "wrap",
            paddingTop: 12,
            marginTop: 12,
            borderTop: "1px solid #e0e0e0"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="small">📤 Export as:</span>
              <select 
                value={exportFormat} 
                onChange={(e) => setExportFormat(e.target.value)}
                className="filter-select"
                style={{ width: "auto" }}
              >
                <option value="csv">📊 CSV</option>
                <option value="json">🔧 JSON</option>
              </select>
            </div>
            <button className="btn-primary-small" onClick={handleExport}>
              💾 Download {exportFormat.toUpperCase()}
            </button>
          </div>
        )}
        
        {msg && (
          <div className="small" style={{ 
            marginTop: 12, 
            padding: "10px", 
            background: msg.includes("❌") || msg.includes("⚠️") ? "#fff3e0" : "#e8f5e9", 
            borderRadius: "6px"
          }}>
            {msg}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {filteredEvents.length > 0 && (
        <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px", marginBottom: "15px" }}>
          <div className="small">
            📊 Showing {filteredEvents.length} of {events.length} total events
          </div>
        </div>
      )}

      {/* Events List */}
      {filteredEvents.length === 0 && events.length > 0 ? (
        <div className="small">🔍 No events match your filters. Try adjusting the filters above.</div>
      ) : filteredEvents.length === 0 ? (
        <div className="small">💡 No events loaded yet. Choose a data source above.</div>
      ) : (
        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {filteredEvents.map((e, i) => {
            const sourceBadge = getSourceBadge(e.source);
            const args = formatArgs(e.args);
            const isApproved = args.approved;
            
            return (
              <div key={i} style={{ 
                marginBottom: "10px", 
                padding: "12px",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                background: e.type === "TxnDecision" && isApproved !== undefined 
                  ? (isApproved ? "#e8f5e9" : "#ffebee")
                  : "white"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ 
                      display: "inline-block", 
                      padding: "2px 8px", 
                      borderRadius: "4px", 
                      fontSize: "10px", 
                      fontWeight: "bold",
                      backgroundColor: sourceBadge.color,
                      color: "white",
                      marginRight: "8px"
                    }}>
                      {sourceBadge.label}
                    </span>
                    <b>
                      {e.type === "CapsuleCreated" ? "📦 Capsule Created" : "💳 Transaction Decision"}
                    </b>
                    {e.type === "TxnDecision" && isApproved !== undefined && (
                      <span style={{ marginLeft: "8px", fontSize: "12px" }}>
                        {isApproved ? "✅ APPROVED" : "❌ DENIED"}
                      </span>
                    )}
                    <span className="small"> (Block #{e.blockNumber})</span>
                  </div>
                  {e.transactionHash && e.source === "on-chain" && (
                    <div className="small" style={{ fontFamily: "monospace", fontSize: "10px" }}>
                      🔗 TX: {e.transactionHash.slice(0, 10)}...{e.transactionHash.slice(-8)}
                    </div>
                  )}
                </div>
                <div className="small" style={{ marginTop: "5px", wordBreak: "break-all" }}>
                  {JSON.stringify(args, null, 2)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <style>{`
        .btn-onchain, .btn-offchain, .btn-demo {
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          border: none;
          color: white;
        }
        .btn-onchain { background: #4caf50; }
        .btn-offchain { background: #ff9800; }
        .btn-demo { background: #2196f3; }
        .btn-primary-small {
          background: #4caf50;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-small {
          background: #666;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          padding: 4px 12px;
        }
        .filter-select, .filter-input {
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 13px;
        }
        .card {
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