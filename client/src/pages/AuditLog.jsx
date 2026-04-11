import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

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
      try {
        const m = await api.get("/api/audit/meta");
        setMeta(m.data);
      } catch (err) {
        console.error("Failed to fetch audit meta:", err);
      }
    })();
  }, []);

  // Apply filters whenever events or filters change
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
          if (filters.status === "approved") return e.approved === true;
          if (filters.status === "denied") return e.approved === false;
        }
        return true;
      });
    }

    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(e => {
        const argsStr = JSON.stringify(e).toLowerCase();
        return argsStr.includes(searchLower) ||
          e.type?.toLowerCase().includes(searchLower);
      });
    }

    if (filters.dateRange !== "all") {
      const now = Date.now();
      let cutoff = 0;
      if (filters.dateRange === "today") cutoff = now - 24 * 60 * 60 * 1000;
      if (filters.dateRange === "week") cutoff = now - 7 * 24 * 60 * 60 * 1000;
      if (filters.dateRange === "month") cutoff = now - 30 * 24 * 60 * 60 * 1000;

      filtered = filtered.filter(e => {
        const timestamp = e.timestamp;
        return timestamp && timestamp >= cutoff;
      });
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).getTime();
      const end = new Date(filters.endDate).getTime();
      filtered = filtered.filter(e => {
        const timestamp = e.timestamp;
        return timestamp && timestamp >= start && timestamp <= end;
      });
    }

    setFilteredEvents(filtered);
  }, [events, filters]);

  // Helper function to flatten args for CSV
  const flattenArgsForCSV = (event) => {
    const flat = {};

    if (event.type === "TxnDecision") {
      flat.merchant = event.merchant || "";
      flat.mcc = event.mcc || "";
      flat.amount = event.amount || "";
      flat.status = event.approved ? "APPROVED" : (event.approved === false ? "DENIED" : "");
      flat.riskTier = event.riskTier || "";
      flat.timestamp = event.timestamp ? new Date(event.timestamp).toLocaleString() : "";
      flat.user = event.userAddress || "";
    }
    else if (event.type === "CapsuleCreated") {
      flat.capsuleId = event.capsuleId || "";
      flat.amount = event.capsuleLimit || "";
      flat.user = event.userAddress || "";
      flat.timestamp = event.timestamp ? new Date(event.timestamp).toLocaleString() : "";
    }

    return flat;
  };

  const convertToCSV = (eventsData) => {
    if (eventsData.length === 0) return "";

    const headers = [
      "Source", "Event Type", "Timestamp", "Merchant", "MCC",
      "Amount", "Status", "Risk Tier", "User Address", "Document ID"
    ];

    const rows = eventsData.map(event => {
      const flatArgs = flattenArgsForCSV(event);

      return {
        "Source": event.source || "dash",
        "Event Type": event.type === "TxnDecision" ? "Transaction Decision" : "Capsule Created",
        "Timestamp": flatArgs.timestamp || "",
        "Merchant": flatArgs.merchant || "",
        "MCC": flatArgs.mcc || "",
        "Amount": flatArgs.amount || "",
        "Status": flatArgs.status || "",
        "Risk Tier": flatArgs.riskTier || "",
        "User Address": flatArgs.user || "",
        "Document ID": event.documentId || ""
      };
    });

    const csvRows = [
      headers.join(","),
      ...rows.map(row => {
        return headers.map(header => {
          const value = row[header] || "";
          const escaped = String(value).replace(/"/g, '""');
          return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
        }).join(",");
      })
    ];

    return csvRows.join("\n");
  };

  const convertToJSON = (eventsData) => {
    return JSON.stringify(eventsData, null, 2);
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
    const username = user?.userAddress?.slice(0, 8) || "user";

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

  const handleCopyToClipboard = async () => {
    if (filteredEvents.length === 0) {
      setMsg("⚠️ No events to copy.");
      return;
    }

    const jsonData = convertToJSON(filteredEvents);
    try {
      await navigator.clipboard.writeText(jsonData);
      setMsg(`📋 Copied ${filteredEvents.length} events to clipboard`);
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg("❌ Failed to copy to clipboard");
    }
  };

  // Load Dash Audit Logs
  async function loadDashAuditLogs() {
    setMsg("");
    setIsLoading(true);
    setEvents([]);

    try {
      // Fetch from your backend which queries Dash
      const response = await api.get("/api/audit/txns");
      const txns = response.data.txns || [];

      // Format transactions for display
      const formattedEvents = txns.map(txn => ({
        type: "TxnDecision",
        source: "dash",
        merchant: txn.merchant,
        mcc: txn.mcc,
        amount: txn.amount,
        approved: txn.approved,
        riskTier: txn.riskTier,
        reason: txn.reason,
        timestamp: txn.ts,
        documentId: txn.documentId,
        userAddress: user.userAddress
      }));

      setEvents(formattedEvents);
      setMsg(`✅ Loaded ${formattedEvents.length} audit logs from Dash`);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setMsg("❌ Failed to load audit logs from Dash");
    } finally {
      setIsLoading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  // Load Mock Data for testing
  function loadMockData() {
    const mockEvents = [
      {
        type: "CapsuleCreated",
        source: "demo",
        capsuleLimit: 1000,
        capsuleType: "REGULAR",
        userAddress: user.userAddress,
        timestamp: Date.now() - 3600000,
        documentId: "mock_doc_1"
      },
      {
        type: "TxnDecision",
        source: "demo",
        merchant: "Supermarket",
        mcc: "GROCERY",
        amount: 25.50,
        approved: true,
        riskTier: "LOW",
        timestamp: Date.now() - 7200000,
        documentId: "mock_doc_2",
        userAddress: user.userAddress
      },
      {
        type: "TxnDecision",
        source: "demo",
        merchant: "Entertainment",
        mcc: "ENTERTAINMENT",
        amount: 50.00,
        approved: false,
        riskTier: "HIGH",
        reason: "Blocked by capsule rules",
        timestamp: Date.now() - 10800000,
        documentId: "mock_doc_3",
        userAddress: user.userAddress
      }
    ];

    setEvents(mockEvents);
    setMsg("✅ Loaded mock data for testing");
    setTimeout(() => setMsg(""), 3000);
  }

  const resetFilters = () => {
    setFilters({
      eventType: "all",
      source: "all",
      status: "all",
      searchText: "",
      dateRange: "all",
      startDate: "",
      endDate: ""
    });
  };

  const getSummary = () => {
    const capsuleCount = filteredEvents.filter(e => e.type === "CapsuleCreated").length;
    const txnCount = filteredEvents.filter(e => e.type === "TxnDecision").length;
    const approvedCount = filteredEvents.filter(e => e.approved === true).length;

    return { capsuleCount, txnCount, total: filteredEvents.length, approvedCount };
  };

  const summary = getSummary();

  const getSourceBadge = (source) => {
    switch (source) {
      case 'dash': return { color: '#4caf50', label: '⛓️ Dash' };
      case 'demo': return { color: '#2196f3', label: '🧪 Demo' };
      default: return { color: '#999', label: '❓ Unknown' };
    }
  };

  return (
    <div className="card">
      <h3>📋 Audit Log Viewer (Dash Platform)</h3>
      <div className="small">
        🔗 Audit logs are stored immutably on Dash Platform
      </div>

      {/* Data Source Buttons */}
      <div className="card">
        <div style={{ display: "flex", gap: "12px", marginBottom: 15, flexWrap: "wrap" }}>
          <button className="btn-onchain" onClick={loadDashAuditLogs} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "⛓️ Load Dash Audit Logs"}
          </button>
          <button className="btn-demo" onClick={loadMockData} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "🧪 Load Demo Data"}
          </button>
        </div>

        {/* Filter Section */}
        <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 15, marginBottom: 15 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: "14px" }}>🔍 Filters</h4>
            <button onClick={resetFilters} className="btn-small" style={{ padding: "4px 12px" }}>
              Reset All
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <select
              value={filters.eventType}
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Event Types</option>
              <option value="CapsuleCreated">📦 Capsule Created</option>
              <option value="TxnDecision">💳 Transaction Decision</option>
            </select>

            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Sources</option>
              <option value="dash">⛓️ Dash</option>
              <option value="demo">🧪 Demo</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Decisions</option>
              <option value="approved">✅ Approved</option>
              <option value="denied">❌ Denied</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
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
              placeholder="🔎 Search in transactions..."
              value={filters.searchText}
              onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              className="filter-input"
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="filter-input"
                style={{ width: "130px" }}
              />
              <span className="small">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="filter-input"
                style={{ width: "130px" }}
              />
            </div>
          </div>
        </div>

        {/* Export Controls */}
        {events.length > 0 && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid #e0e0e0" }}>
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
              💾 Download {exportFormat.toUpperCase()}
            </button>
            <button className="btn" onClick={handleCopyToClipboard}>
              📋 Copy to Clipboard
            </button>
          </div>
        )}

        {msg && (
          <div className="small" style={{ marginTop: 12, padding: "10px", background: msg.includes("❌") ? "#fff3e0" : "#e8f5e9", borderRadius: "6px" }}>
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
          </div>
        </div>
      )}

      {/* Events List */}
      {filteredEvents.length === 0 && events.length > 0 ? (
        <div className="small">🔍 No events match your filters. Try adjusting the filters above.</div>
      ) : filteredEvents.length === 0 ? (
        <div className="small">💡 No events loaded yet. Click "Load Dash Audit Logs" above.</div>
      ) : (
        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {filteredEvents.map((e, i) => {
            const sourceBadge = getSourceBadge(e.source);
            const isApproved = e.approved;

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
                  </div>
                  {e.documentId && (
                    <div className="small" style={{ fontFamily: "monospace", fontSize: "10px" }}>
                      📄 ID: {e.documentId.slice(0, 10)}...
                    </div>
                  )}
                </div>
                <div className="small" style={{ marginTop: "5px", wordBreak: "break-all" }}>
                  {e.type === "TxnDecision" ? (
                    <>Merchant: {e.merchant} | MCC: {e.mcc} | Amount: ${e.amount} | Risk: {e.riskTier}</>
                  ) : (
                    <>Capsule Limit: ${e.capsuleLimit} | Type: {e.capsuleType}</>
                  )}
                  {e.timestamp && <div style={{ marginTop: "5px", color: "#666" }}>🕐 {new Date(e.timestamp).toLocaleString()}</div>}
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
        .btn-onchain, .btn-demo {
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          border: none;
          color: white;
        }
        .btn-onchain { background: #4caf50; }
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
        .small {
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
}