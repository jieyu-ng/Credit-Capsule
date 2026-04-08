import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ethers } from "ethers";

export default function AuditLog({ user }) {
  const [meta, setMeta] = useState(null);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");

  if (!user) return <div className="card">🔐 Please login first.</div>;

  useEffect(() => {
    (async () => {
      const m = await api.get("/api/audit/meta");
      setMeta(m.data);
    })();
  }, []);

  // Load Recent Off-Chain Decisions (from your table)
  async function loadRecentDecisions() {
    setMsg("");
    setIsLoading(true);
    
    // Convert the "Recent Decisions" table data into event format
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
      source: "off-chain"  // Mark as off-chain source
    }));
    
    setEvents(formattedEvents);
    setMsg(`✅ Loaded ${formattedEvents.length} recent off-chain decisions from transaction history`);
    setIsLoading(false);
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Loaded") ? "" : prev);
    }, 3000);
  }

  // Load Generic Demo Data (for testing)
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
        args: { user: "0x1234...5678", merchant: "Supermarket", amount: "25.50", approved: true, riskTier: "LOW", timestamp: Date.now() },
        blockNumber: 12346,
        transactionHash: "0xdef456ghi789...",
        blockHash: "0x345mno678pqr...",
        logIndex: 1,
        source: "demo"
      },
      {
        type: "TxnDecision",
        args: { user: "0x1234...5678", merchant: "Entertainment", amount: "50.00", approved: false, riskTier: "HIGH", reason: "Blocked by capsule rules", timestamp: Date.now() },
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
      }
    ];
    
    setEvents(mockEvents);
    setMsg("✅ Loaded 4 mock events (generic demo data) - For testing export/copy features");
    setIsLoading(false);
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Loaded") ? "" : prev);
    }, 3000);
  }

  // Load Real On-Chain Blockchain Logs
  async function loadOnChain() {
    setMsg("");
    setEvents([]);
    setIsLoading(true);

    if (!meta?.enabled) {
      setMsg("⚠️ Chain logs disabled. Please enable blockchain connection to load real logs.");
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
      setMsg(`✅ Loaded ${formatted.length} on-chain events from blockchain`);
    } catch (e) {
      console.error(e);
      setMsg("❌ Failed to read chain logs. Make sure blockchain is running and configured correctly.");
    } finally {
      setIsLoading(false);
    }
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
    if (events.length === 0) {
      setMsg("⚠️ No events to export. Please load logs first using one of the buttons above.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const username = user?.username || user?.userAddress?.slice(0, 8) || "user";
    
    if (exportFormat === "csv") {
      const csvData = convertToCSV(events);
      downloadFile(csvData, `audit_log_${username}_${timestamp}.csv`, "text/csv");
      setMsg(`📊 Exported ${events.length} events to CSV file. Check your downloads folder.`);
    } else {
      const jsonData = convertToJSON(events);
      downloadFile(jsonData, `audit_log_${username}_${timestamp}.json`, "application/json");
      setMsg(`🔧 Exported ${events.length} events to JSON file. Check your downloads folder.`);
    }
    
    setTimeout(() => {
      setMsg(prev => prev.includes("Exported") ? "" : prev);
    }, 3000);
  };

  const handleCopyToClipboard = async () => {
    if (events.length === 0) {
      setMsg("⚠️ No events to copy. Please load logs first using one of the buttons above.");
      return;
    }

    const jsonData = convertToJSON(events);
    try {
      await navigator.clipboard.writeText(jsonData);
      setMsg("📋 Audit logs copied to clipboard! You can now paste them anywhere (Ctrl+V or Cmd+V).");
      setTimeout(() => {
        setMsg(prev => prev.includes("copied") ? "" : prev);
      }, 3000);
    } catch (err) {
      setMsg("❌ Failed to copy to clipboard. Your browser may not support this feature.");
    }
  };

  const getSummary = () => {
    const capsuleCount = events.filter(e => e.type === "CapsuleCreated").length;
    const txnCount = events.filter(e => e.type === "TxnDecision").length;
    const onChainCount = events.filter(e => e.source === "on-chain").length;
    const offChainCount = events.filter(e => e.source === "off-chain").length;
    const demoCount = events.filter(e => e.source === "demo").length;
    
    return { capsuleCount, txnCount, total: events.length, onChainCount, offChainCount, demoCount };
  };

  const summary = getSummary();

  // Helper to get source badge color
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
        🔄 Off-chain makes decisions; ⛓️ on-chain stores immutable logs. (Not payments)
      </div>

      <div className="card">
        <div className="small">🔗 Chain enabled: <b>{String(meta?.enabled)}</b></div>
        <div className="small">📄 Contract: {meta?.address || "(unset)"}</div>
        
        {/* Button row 1: Three data source buttons */}
        <div style={{ display: "flex", gap: "12px", marginTop: 15, marginBottom: 15, flexWrap: "wrap" }}>
          <button className="btn btn-onchain" onClick={loadOnChain} disabled={isLoading} title="Connect to blockchain and fetch real audit logs">
            {isLoading ? "⏳ Loading..." : "⛓️ Load Blockchain Logs"}
          </button>
          
          <button className="btn btn-offchain" onClick={loadRecentDecisions} disabled={isLoading} title="Load recent off-chain decisions from transaction history">
            {isLoading ? "⏳ Loading..." : "📋 Load Recent Decisions (Off-Chain)"}
          </button>
          
          <button className="btn btn-demo" onClick={loadMockData} disabled={isLoading} title="Load sample data for testing export/copy features">
            {isLoading ? "⏳ Loading..." : "🧪 Load Demo Data"}
          </button>
        </div>
        
        {/* Button row 2: Export controls */}
        {events.length > 0 && (
          <div style={{ 
            display: "flex", 
            gap: "12px", 
            alignItems: "center", 
            flexWrap: "wrap",
            paddingTop: 12,
            borderTop: "1px solid #e0e0e0",
            marginTop: 5
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="small">📤 Export as:</span>
              <select 
                value={exportFormat} 
                onChange={(e) => setExportFormat(e.target.value)}
                style={{ 
                  padding: "8px 12px", 
                  borderRadius: "6px", 
                  border: "1px solid #ccc", 
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                <option value="csv">📊 CSV (Excel)</option>
                <option value="json">🔧 JSON (Developer)</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleExport} title="Download all logs as a file">
              💾 Download {exportFormat.toUpperCase()} File
            </button>
            <button className="btn" onClick={handleCopyToClipboard} title="Copy all logs to clipboard">
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

      {events.length > 0 && (
        <div className="card" style={{ background: "#f5f5f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <strong>📊 Summary</strong>
              <div className="small">
                📈 Total: {summary.total} | 
                📦 Capsules: {summary.capsuleCount} | 
                💳 Transactions: {summary.txnCount}
              </div>
              <div className="small" style={{ marginTop: "5px" }}>
                {summary.onChainCount > 0 && `⛓️ On-Chain: ${summary.onChainCount} | `}
                {summary.offChainCount > 0 && `📋 Off-Chain: ${summary.offChainCount} | `}
                {summary.demoCount > 0 && `🧪 Demo: ${summary.demoCount}`}
              </div>
            </div>
            <div className="small">
              🕐 Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="small">💡 No events loaded yet. Choose a data source above to load audit records.</div>
      ) : (
        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {events.map((e, i) => {
            const sourceBadge = getSourceBadge(e.source);
            return (
              <div key={i} className="card" style={{ marginBottom: "10px" }}>
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
                    <span className="small"> (Block #{e.blockNumber})</span>
                  </div>
                  {e.transactionHash && e.source === "on-chain" && (
                    <div className="small" style={{ fontFamily: "monospace", fontSize: "10px" }}>
                      🔗 TX: {e.transactionHash.slice(0, 10)}...{e.transactionHash.slice(-8)}
                    </div>
                  )}
                  {e.source === "off-chain" && (
                    <div className="small" style={{ fontStyle: "italic", fontSize: "10px" }}>
                      📋 Off-chain record (not on blockchain)
                    </div>
                  )}
                </div>
                <div className="small" style={{ marginTop: "5px", wordBreak: "break-all" }}>
                  {JSON.stringify(formatArgs(e.args), null, 2)}
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
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn-primary:hover {
          background: linear-gradient(135deg, #45a049, #3d8b40);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .btn-onchain {
          background: linear-gradient(135deg, #4caf50, #388e3c);
          color: white;
          border: none;
        }
        .btn-onchain:hover {
          background: linear-gradient(135deg, #388e3c, #2e7d32);
          transform: translateY(-1px);
        }
        .btn-offchain {
          background: linear-gradient(135deg, #ff9800, #f57c00);
          color: white;
          border: none;
        }
        .btn-offchain:hover {
          background: linear-gradient(135deg, #f57c00, #ef6c00);
          transform: translateY(-1px);
        }
        .btn-demo {
          background: linear-gradient(135deg, #2196f3, #1976d2);
          color: white;
          border: none;
        }
        .btn-demo:hover {
          background: linear-gradient(135deg, #1976d2, #1565c0);
          transform: translateY(-1px);
        }
        .btn {
          cursor: pointer;
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        select {
          visibility: visible;
          opacity: 1;
          display: inline-flex;
          align-items: center;
        }
        .card {
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
}