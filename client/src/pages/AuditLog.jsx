import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ethers } from "ethers";

export default function AuditLog({ user }) {
  const [meta, setMeta] = useState(null);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  
  // Filter states
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
      const m = await api.get("/api/audit/meta");
      setMeta(m.data);
    })();
  }, []);

  // Apply filters whenever events or filters change
  useEffect(() => {
    let filtered = [...events];
    
    // Filter by event type
    if (filters.eventType !== "all") {
      filtered = filtered.filter(e => e.type === filters.eventType);
    }
    
    // Filter by source
    if (filters.source !== "all") {
      filtered = filtered.filter(e => e.source === filters.source);
    }
    
    // Filter by status (for TxnDecision events)
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
    
    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(e => {
        const argsStr = JSON.stringify(formatArgs(e.args)).toLowerCase();
        return argsStr.includes(searchLower) || 
               e.type.toLowerCase().includes(searchLower) ||
               (e.transactionHash && e.transactionHash.toLowerCase().includes(searchLower));
      });
    }
    
    // Filter by date range
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
    
    // Custom date range
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
        merchant: "MyMart",
        type: "GROCERY",
        amount: "150",
        tier: "MEDIUM",
        status: "APPROVED",
        reason: "APPROVED",
        timestamp: Date.now() - 7200000
      },
      {
        merchant: "MyMart",
        type: "TRANSPORT",
        amount: "1000",
        tier: "MEDIUM",
        status: "DENIED",
        reason: "EXCEEDS_MAX_TRANSACTION",
        timestamp: Date.now() - 10800000
      },
      {
        merchant: "Shopee",
        type: "TRANSPORT",
        amount: "50",
        tier: "MEDIUM",
        status: "APPROVED",
        reason: "APPROVED",
        timestamp: Date.now() - 14400000
      },
      {
        merchant: "Shopee",
        type: "Groceries",
        amount: "50",
        tier: "MEDIUM",
        status: "DENIED",
        reason: "MCC_NOT_ALLOWED",
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
        timestamp: decision.timestamp
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

  const convertToCSV = (eventsData) => {
    if (eventsData.length === 0) return "";
    
    const headers = [
      "Source",
      "Type",
      "Block Number",
      "Transaction Hash",
      "Block Hash",
      "Log Index",
      "Timestamp (Local)",
      "Arguments (JSON)"
    ];
    
    const rows = eventsData.map(event => {
      const argsObj = formatArgs(event.args);
      return [
        event.source || "unknown",
        event.type,
        event.blockNumber,
        event.transactionHash,
        event.blockHash,
        event.logIndex,
        new Date().toLocaleString(),
        JSON.stringify(argsObj)
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
      blockHash: event.blockHash,
      logIndex: event.logIndex,
      exportDate: new Date().toISOString(),
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
      setMsg("⚠️ No events to export. Please load logs first.");
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
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Exported") ? "" : prev);
    }, 3000);
  };

  const handleCopyToClipboard = async () => {
    if (filteredEvents.length === 0) {
      setMsg("⚠️ No events to copy.");
      return;
    }

    const jsonData = convertToJSON(filteredEvents);
    try {
      await navigator.clipboard.writeText(jsonData);
      setMsg(`📋 Copied ${filteredEvents.length} events to clipboard`);
      setTimeout(() => {
        setMsg(prev => prev.includes("copied") ? "" : prev);
      }, 3000);
    } catch (err) {
      setMsg("❌ Failed to copy to clipboard");
    }
  };

  const getSummary = () => {
    const capsuleCount = filteredEvents.filter(e => e.type === "CapsuleCreated").length;
    const txnCount = filteredEvents.filter(e => e.type === "TxnDecision").length;
    const approvedCount = filteredEvents.filter(e => {
      if (e.type === "TxnDecision") {
        const args = formatArgs(e.args);
        return args.approved === true;
      }
      return false;
    }).length;
    
    return { capsuleCount, txnCount, total: filteredEvents.length, approvedCount };
  };

  const summary = getSummary();

  const getSourceBadge = (source) => {
    switch(source) {
      case 'on-chain': return { color: '#4caf50', label: '⛓️ On-Chain' };
      case 'off-chain': return { color: '#ff9800', label: '📋 Off-Chain' };
      case 'demo': return { color: '#2196f3', label: '🧪 Demo' };
      default: return { color: '#999', label: '❓ Unknown' };
    }
  };

  return (
    <div className="card">
      <h3>📋 Audit Log Viewer</h3>
      <div className="small">
        🔄 Off-chain makes decisions; ⛓️ on-chain stores immutable logs.
      </div>

      {/* Data Source Buttons */}
      <div className="card">
        <div style={{ display: "flex", gap: "12px", marginBottom: 15, flexWrap: "wrap" }}>
          <button className="btn btn-onchain" onClick={loadOnChain} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "⛓️ Load Blockchain Logs"}
          </button>
          <button className="btn btn-offchain" onClick={loadRecentDecisions} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "📋 Load Recent Decisions"}
          </button>
          <button className="btn btn-demo" onClick={loadMockData} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "🧪 Load Demo Data"}
          </button>
        </div>

        {/* Filter Section */}
        <div style={{ 
          borderTop: "1px solid #e0e0e0", 
          paddingTop: 15,
          marginBottom: 15
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: "14px" }}>🔍 Filters</h4>
            <button onClick={resetFilters} className="btn-small" style={{ padding: "4px 12px" }}>
              Reset All
            </button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <select 
              value={filters.eventType} 
              onChange={(e) => setFilters({...filters, eventType: e.target.value})}
              className="filter-select"
            >
              <option value="all">All Event Types</option>
              <option value="CapsuleCreated">📦 Capsule Created</option>
              <option value="TxnDecision">💳 Transaction Decision</option>
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
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginTop: "10px" }}>
            <input 
              type="text" 
              placeholder="🔎 Search in arguments, transaction hash..." 
              value={filters.searchText}
              onChange={(e) => setFilters({...filters, searchText: e.target.value})}
              className="filter-input"
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="date" 
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="filter-input"
                style={{ width: "130px" }}
              />
              <span className="small">to</span>
              <input 
                type="date" 
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="filter-input"
                style={{ width: "130px" }}
              />
            </div>
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
            <button className="btn-primary" onClick={handleExport}>
              💾 Download ({filteredEvents.length} events)
            </button>
            <button className="btn" onClick={handleCopyToClipboard}>
              📋 Copy to Clipboard
            </button>
          </div>
        )}
        
        {msg && (
          <div className="small" style={{ 
            marginTop: 12, 
            padding: "10px", 
            background: msg.includes("❌") || msg.includes("⚠️") ? "#fff3e0" : "#e8f5e9", 
            borderRadius: "6px",
            borderLeft: msg.includes("❌") || msg.includes("⚠️") ? "4px solid #ff9800" : "4px solid #4caf50"
          }}>
            {msg}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {filteredEvents.length > 0 && (
        <div className="card" style={{ background: "#f5f5f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <strong>📊 Filtered Results</strong>
              <div className="small">
                📈 Total: {summary.total} | 
                📦 Capsules: {summary.capsuleCount} | 
                💳 Transactions: {summary.txnCount} |
                ✅ Approved: {summary.approvedCount}
              </div>
            </div>
            <div className="small">
              🕐 Showing {filteredEvents.length} of {events.length} total events
            </div>
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
              <div key={i} className="event-card" style={{ 
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
      
      <style jsx>{`
        .btn-primary {
          background: linear-gradient(135deg, #4caf50, #45a049);
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn {
          cursor: pointer;
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 14px;
          border: 1px solid #ccc;
          background: white;
        }
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
        .btn-small {
          background: #666;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
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
      `}</style>
    </div>
  );
}