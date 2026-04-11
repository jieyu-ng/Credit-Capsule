import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function AuditLog({ user }) {
  const [viewMode, setViewMode] = useState("user"); // "user" or "admin"
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
          e.type.toLowerCase().includes(searchLower) ||
          (e.documentId && e.documentId.toLowerCase().includes(searchLower));
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

  // Load Dash Audit Logs
  async function loadDashAuditLogs() {
    setMsg("");
    setIsLoading(true);
    setEvents([]);

    try {
      const response = await api.get("/api/audit/txns");
      const txns = response.data.txns || [];

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

  // Load Mock Data
  async function loadMockData() {
    setMsg("");
    setIsLoading(true);

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
        amount: "25.50",
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
        amount: "50.00",
        approved: false,
        riskTier: "HIGH",
        reason: "Blocked by capsule rules",
        timestamp: Date.now() - 10800000,
        documentId: "mock_doc_3",
        userAddress: user.userAddress
      },
      {
        type: "CapsuleCreated",
        source: "demo",
        capsuleLimit: 500,
        capsuleType: "SMALL",
        userAddress: user.userAddress,
        timestamp: Date.now() - 14400000,
        documentId: "mock_doc_4"
      },
      {
        type: "TxnDecision",
        source: "demo",
        merchant: "Restaurant",
        mcc: "RESTAURANT",
        amount: "35.00",
        approved: true,
        riskTier: "MEDIUM",
        timestamp: Date.now() - 18000000,
        documentId: "mock_doc_5",
        userAddress: user.userAddress
      }
    ];

    setEvents(mockEvents);
    setMsg(`✅ Loaded ${mockEvents.length} mock events for testing`);
    setIsLoading(false);

    setTimeout(() => {
      setMsg(prev => prev.includes("Loaded") ? "" : prev);
    }, 3000);
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
      flat.reason = event.reason || "";
    }
    else if (event.type === "CapsuleCreated") {
      flat.capsuleId = event.capsuleId || event.documentId || "";
      flat.amount = event.capsuleLimit || "";
      flat.capsuleType = event.capsuleType || "";
      flat.user = event.userAddress || "";
      flat.timestamp = event.timestamp ? new Date(event.timestamp).toLocaleString() : "";
    }

    return flat;
  };

  const convertToCSV = (eventsData) => {
    if (eventsData.length === 0) return "";

    const headers = [
      "Source", "Event Type", "Document ID", "Timestamp",
      "Merchant", "MCC", "Amount", "Status", "Risk Tier", "Reason", "User Address"
    ];

    const rows = eventsData.map(event => {
      const flatArgs = flattenArgsForCSV(event);

      return [
        event.source || "unknown",
        event.type === "TxnDecision" ? "Transaction" : "Capsule",
        event.documentId || "",
        flatArgs.timestamp || "",
        flatArgs.merchant || "",
        flatArgs.mcc || "",
        flatArgs.amount || "",
        flatArgs.status || "",
        flatArgs.riskTier || "",
        flatArgs.reason || "",
        flatArgs.user || ""
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
      documentId: event.documentId,
      timestamp: event.timestamp,
      ...(event.type === "TxnDecision" ? {
        merchant: event.merchant,
        mcc: event.mcc,
        amount: event.amount,
        approved: event.approved,
        riskTier: event.riskTier,
        reason: event.reason
      } : {
        capsuleLimit: event.capsuleLimit,
        capsuleType: event.capsuleType
      })
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
    switch (source) {
      case 'dash': return { color: '#4caf50', label: '⛓️ Dash' };
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
            <button className="btn-primary" onClick={loadDashAuditLogs} disabled={isLoading}>
              📋 Load My Recent Transactions
            </button>
            <button className="btn-secondary" onClick={loadMockData} disabled={isLoading}>
              🧪 Load Demo Data
            </button>
          </div>

          {isLoading && <div className="small">⏳ Loading...</div>}

          {events.length === 0 ? (
            <div className="small" style={{ textAlign: "center", padding: "40px", background: "#f5f5f5", borderRadius: "8px" }}>
              💡 No transactions yet. Click "Load My Recent Transactions" above.
            </div>
          ) : (
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {events
                .filter(e => e.type === "TxnDecision")
                .slice(0, 20)
                .map((e, i) => {
                  const isApproved = e.approved;
                  const date = e.timestamp ? new Date(e.timestamp).toLocaleString() : "Recent";

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
                          <span style={{ marginLeft: "10px" }}>{e.merchant || "Unknown"}</span>
                          <span style={{ marginLeft: "10px", fontSize: "12px", color: "#666" }}>{e.mcc}</span>
                        </div>
                        <div>
                          <b>${e.amount}</b>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", marginTop: "5px", color: "#666" }}>
                        {date}
                        {!isApproved && e.reason && <span> • {e.reason}</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="small" style={{ textAlign: "center", padding: "12px", background: "#e3f2fd", borderRadius: "8px" }}>
          💡 <strong>Tip:</strong> Click "Bank Admin View" to see the full compliance dashboard with immutable Dash audit logs.
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
            🔗 Audit logs stored immutably on Dash Platform
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
          <button className="btn-dash" onClick={loadDashAuditLogs} disabled={isLoading}>
            {isLoading ? "⏳ Loading..." : "⛓️ Load Dash Audit Logs"}
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
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Events</option>
              <option value="CapsuleCreated">📦 Capsule Created</option>
              <option value="TxnDecision">💳 Transaction</option>
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

          <div style={{ marginTop: "10px" }}>
            <input
              type="text"
              placeholder="🔎 Search in merchant, amount, document ID..."
              value={filters.searchText}
              onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              className="filter-input"
              style={{ width: "100%" }}
            />
          </div>

          {/* Date range inputs */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="filter-input"
              placeholder="Start Date"
            />
            <span className="small">to</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="filter-input"
              placeholder="End Date"
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
            const isApproved = e.approved;

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
                  </div>
                  {e.documentId && (
                    <div className="small" style={{ fontFamily: "monospace", fontSize: "10px" }}>
                      📄 Doc: {e.documentId.slice(0, 10)}...
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

      <style>{`
        .btn-dash, .btn-demo {
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          border: none;
          color: white;
        }
        .btn-dash { background: #4caf50; }
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