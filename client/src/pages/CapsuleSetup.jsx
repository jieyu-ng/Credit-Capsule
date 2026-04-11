import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function CapsuleSetup({ user }) {
  const [allowedMcc, setAllowedMcc] = useState("GROCERY,TRANSPORT,FUEL");
  const [maxTransaction, setMaxTransaction] = useState(200);
  const [dailyCap, setDailyCap] = useState(400);
  const [capsuleLimit, setCapsuleLimit] = useState(1000);
  const [expiryDays, setExpiryDays] = useState(7);

  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [estimatedMonthlyFee, setEstimatedMonthlyFee] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  // Verification states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [verificationInput, setVerificationInput] = useState("");
  const [verificationStatus, setVerificationStatus] = useState({});

  // Templates with verification requirements
  const templates = {
    student: {
      name: "🎓 Student Saver",
      limit: 200,
      dailyCap: 50,
      maxTxn: 50,
      mcc: ["GROCERY", "TRANSPORT", "EDUCATION"],
      feeRate: 0.02,
      expiryDays: 7,
      description: "Low risk, perfect for daily essentials",
      eligibility: {
        type: "student",
        required: true,
        verificationMethod: "student_id",
        prompt: "Please enter your Student ID or upload student ID card",
        allowedDomains: [".edu", "student"],
        incomeLimit: 1000
      }
    },
    freelancer: {
      name: "💼 Freelancer Flex",
      limit: 500,
      dailyCap: 150,
      maxTxn: 150,
      mcc: ["GROCERY", "TRANSPORT", "RESTAURANT", "OFFICE"],
      feeRate: 0.03,
      expiryDays: 14,
      description: "Moderate flexibility for irregular income",
      eligibility: {
        type: "freelancer",
        required: true,
        verificationMethod: "tax_id",
        prompt: "Please enter your Tax ID / Freelancer Registration Number",
        minIncome: 2000
      }
    },
    emergency: {
      name: "🚨 Emergency Fund",
      limit: 1000,
      dailyCap: 200,
      maxTxn: 200,
      mcc: ["GROCERY", "TRANSPORT", "MEDICAL", "UTILITIES"],
      feeRate: 0.015,
      expiryDays: 30,
      description: "Higher limit for unexpected situations",
      eligibility: {
        type: "emergency",
        required: false,
        verificationMethod: "none",
        prompt: "No verification required for emergency capsule",
        note: "Available to all users with good standing"
      }
    },
    premium: {
      name: "⭐ Premium Spender",
      limit: 2000,
      dailyCap: 400,
      maxTxn: 300,
      mcc: ["ALL"],
      feeRate: 0.025,
      expiryDays: 21,
      description: "Full flexibility for trusted users",
      eligibility: {
        type: "premium",
        required: true,
        verificationMethod: "credit_check",
        prompt: "Premium requires credit check and income verification",
        minCreditScore: 700,
        minIncome: 5000
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cap = await api.get("/api/capsule");
      setCurrent(cap.data.capsule);
      // Load user's verification status from backend
      try {
        const verStatus = await api.get("/api/user/verification-status");
        setVerificationStatus(verStatus.data);
      } catch (e) {
        console.error("Failed to load verification status:", e);
      }
    })();
  }, [user]);

  useEffect(() => {
    const expectedUsage = capsuleLimit * 0.6;
    const feeRate = 0.0008;
    const monthlyFee = expectedUsage * feeRate * 30;
    setEstimatedMonthlyFee(monthlyFee);
  }, [capsuleLimit]);

  useEffect(() => {
    if (current && current.spentTotal && current.capsuleLimit) {
      const usagePercent = (current.spentTotal / current.capsuleLimit) * 100;
      setShowWarning(usagePercent > 70);
    } else {
      setShowWarning(false);
    }
  }, [current]);

  if (!user) return <div className="card">Please login first.</div>;

  // Check if user is eligible for a template
  // Replace the checkEligibility function with this hardcoded version
  const checkEligibility = async (templateKey, verificationData) => {
    const template = templates[templateKey];

    if (!template.eligibility.required) {
      return { eligible: true, message: "No verification required" };
    }

    // HARDCODED VERIFICATION VALUES
    const hardcodedValues = {
      student: ["STU12345", "STU67890", "student@university.edu", "STU001", "S1234567"],
      freelancer: ["TAX98765", "FREELANCER123", "FR-2024-001", "FR-2025-002", "TAX001"],
      premium: ["CREDIT_CHECK_PASS", "PREMIUM2024", "CREDIT_OK", "PREMIUM_ACCESS"]
    };

    // Student verification (hardcoded)
    if (template.eligibility.type === "student") {
      if (hardcodedValues.student.includes(verificationData)) {
        return { eligible: true, message: "Student ID verified!" };
      }
      return { eligible: false, message: "Invalid Student ID. Try: STU12345, STU67890, or student@university.edu" };
    }

    // Freelancer verification (hardcoded)
    if (template.eligibility.type === "freelancer") {
      if (hardcodedValues.freelancer.includes(verificationData)) {
        return { eligible: true, message: "Freelancer registration verified!" };
      }
      return { eligible: false, message: "Invalid Tax ID. Try: TAX98765, FREELANCER123, or FR-2024-001" };
    }

    // Premium verification (hardcoded)
    if (template.eligibility.type === "premium") {
      if (hardcodedValues.premium.includes(verificationData)) {
        return { eligible: true, message: "Premium eligibility confirmed!" };
      }
      return { eligible: false, message: "Premium verification failed. Try: CREDIT_CHECK_PASS or PREMIUM2024" };
    }

    return { eligible: false, message: "Eligibility check failed" };
  };

  async function applyTemplate(templateKey) {
    const template = templates[templateKey];

    // Check if verification is required and not already verified
    if (template.eligibility.required && !verificationStatus[template.eligibility.type]) {
      setPendingTemplate(templateKey);
      setShowVerificationModal(true);
      return;
    }

    // Apply template directly if already verified
    applyTemplateDirectly(templateKey);
  }

  function applyTemplateDirectly(templateKey) {
    const template = templates[templateKey];
    setSelectedTemplate(templateKey);
    setCapsuleLimit(template.limit);
    setDailyCap(template.dailyCap);
    setMaxTransaction(template.maxTxn);
    setExpiryDays(template.expiryDays);
    setAllowedMcc(template.mcc.join(","));
    setMsg(`✅ ${template.name} template loaded!`);
    setTimeout(() => setMsg(""), 3000);
  }

  async function submitVerification() {
    if (!pendingTemplate) return;

    const result = await checkEligibility(pendingTemplate, verificationInput);

    if (result.eligible) {
      // Store verification status
      const template = templates[pendingTemplate];
      setVerificationStatus(prev => ({
        ...prev,
        [template.eligibility.type]: true,
        [`${template.eligibility.type}_verified_at`]: new Date().toISOString()
      }));

      setMsg(`✅ ${result.message} You can now use the ${template.name} template.`);
      setShowVerificationModal(false);
      setVerificationInput("");
      applyTemplateDirectly(pendingTemplate);
      setPendingTemplate(null);
    } else {
      setMsg(`❌ Verification failed: ${result.message}`);
    }

    setTimeout(() => setMsg(""), 3000);
  }

  async function create() {
    setMsg("");

    if (expiryDays > 30) {
      setMsg("❌ Expiry cannot exceed 30 days. Please reduce the expiry period.");
      return;
    }
    if (expiryDays < 1) {
      setMsg("❌ Expiry must be at least 1 day.");
      return;
    }

    try {
      const r = await api.post("/api/capsule/create", {
        allowedMcc: allowedMcc.split(",").map(s => s.trim()).filter(Boolean),
        maxTransaction: Number(maxTransaction),
        dailyCap: Number(dailyCap),
        capsuleLimit: Number(capsuleLimit),
        expiryDays: Number(expiryDays)
      });
      setMsg(`✅ Capsule created! Expires in ${expiryDays} days. rulesHash=${r.data.rulesHash.slice(0, 20)}...`);
      const cap = await api.get("/api/capsule");
      setCurrent(cap.data.capsule);
      setSelectedTemplate(null);
      setShowVerification(false);
      setVerificationStatus("pending");
    } catch (e) {
      setMsg(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : "Create failed");
    }
  }

  const getRiskImpact = (limit) => {
    if (limit <= 200) return "+5 (Low Risk)";
    if (limit <= 500) return "+10 (Medium Risk)";
    if (limit <= 1000) return "+15 (Moderate Risk)";
    return "+25 (Higher Risk)";
  };

  const usagePercentage = current ? ((current.spentTotal || 0) / current.capsuleLimit) * 100 : 0;

  return (
    <div>
      {/* Verification Modal */}
      {showVerificationModal && pendingTemplate && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            padding: "25px",
            borderRadius: "15px",
            maxWidth: "400px",
            width: "90%"
          }}>
            <h3 style={{ margin: "0 0 10px 0" }}>🔐 Verification Required</h3>
            <div style={{ marginBottom: "15px" }}>
              <strong>{templates[pendingTemplate].name}</strong>
              <div className="small" style={{ marginTop: "5px" }}>
                {templates[pendingTemplate].eligibility.prompt}
              </div>
            </div>
            <input
              type="text"
              className="input"
              placeholder={templates[pendingTemplate].eligibility.type === "student" ? "Enter Student ID" :
                templates[pendingTemplate].eligibility.type === "freelancer" ? "Enter Tax ID" :
                  "Enter verification code"}
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value)}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button
                className="btn-primary"
                onClick={submitVerification}
                style={{ flex: 1 }}
              >
                Verify
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowVerificationModal(false);
                  setPendingTemplate(null);
                  setVerificationInput("");
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH USAGE WARNING MESSAGE */}
      {showWarning && current && (
        <div className="warning-card" style={{
          background: "linear-gradient(135deg, #fff3e0, #ffe0b2)",
          borderLeft: "4px solid #ff9800",
          padding: "15px",
          borderRadius: "10px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#e65100" }}>High Usage Warning!</strong>
            <div className="small">
              You have used <strong>{usagePercentage.toFixed(1)}%</strong> of your capsule limit (${current.spentTotal} / ${current.capsuleLimit}).
              Consider repaying soon to avoid service interruption.
            </div>
          </div>
          <button
            onClick={() => window.location.href = "/capsule"}
            style={{
              background: "#ff9800",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "20px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Repay Now →
          </button>
        </div>
      )}

      {/* Templates Section */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
          <h3 style={{ margin: 0 }}>📚 Capsule Templates</h3>
          <button
            className="btn-secondary"
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? "Hide Comparison" : "Compare Templates"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px" }}>
          {Object.entries(templates).map(([key, template]) => {
            const isVerified = verificationStatus[template.eligibility.type];
            const requiresVerification = template.eligibility.required;

            return (
              <div
                key={key}
                className="template-card"
                style={{
                  padding: "15px",
                  border: selectedTemplate === key ? "2px solid #4caf50" : "1px solid #e0e0e0",
                  borderRadius: "10px",
                  cursor: "pointer",
                  background: selectedTemplate === key ? "#f1f8e9" : "white",
                  opacity: requiresVerification && !isVerified ? 0.7 : 1
                }}
                onClick={() => applyTemplate(key)}
              >
                <div style={{ fontSize: "20px", marginBottom: "5px" }}>{template.name}</div>
                <div className="small" style={{ color: "#666", marginBottom: "10px" }}>{template.description}</div>
                <div><b>Limit:</b> ${template.limit}</div>
                <div><b>Daily Cap:</b> ${template.dailyCap}</div>
                <div><b>Max/Txn:</b> ${template.maxTxn}</div>
                <div><b>⏰ Expiry:</b> {template.expiryDays} days</div>
                <div className="small" style={{ marginTop: "8px", color: "#4caf50" }}>
                  Fee: {template.feeRate}% per day
                </div>
                {requiresVerification && (
                  <div className="small" style={{ marginTop: "8px", color: isVerified ? "#4caf50" : "#ff9800" }}>
                    {isVerified ? "✅ Verified" : "🔐 Verification required"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedTemplate && (
          <div style={{ marginTop: 12, padding: "10px", background: "#e8f5e9", borderRadius: "8px" }}>
            ✅ Template "{templates[selectedTemplate].name}" loaded. Review and click "Create capsule" below.
          </div>
        )}
      </div>

      {/* Comparison View (keep as is) */}
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
                <tr><td style={{ padding: "8px" }}>⏰ Expiry (days)</td>
                  {Object.values(templates).map(t => <td key={t.name} style={{ textAlign: "center" }}>{t.expiryDays}</td>)}
                </tr>
                <tr><td style={{ padding: "8px" }}>🔐 Verification</td>
                  {Object.values(templates).map(t => (
                    <td key={t.name} style={{ textAlign: "center", fontSize: "11px" }}>
                      {t.eligibility.required ? (t.eligibility.type === "student" ? "Student ID" :
                        t.eligibility.type === "freelancer" ? "Tax ID" : "Credit Check") : "None"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Capsule Form (keep as is) */}
      <div className="card">
        <h3>✏️ Create / Update Capsule</h3>

        <div style={{ marginBottom: 15, padding: "10px", background: "#f5f5f5", borderRadius: "8px" }}>
          <div className="small">💡 Estimated monthly fee at 60% utilization: <b>${estimatedMonthlyFee.toFixed(2)}</b></div>
          <div className="small">⚠️ Risk impact: {getRiskImpact(capsuleLimit)}</div>
          <div className="small" style={{ color: "#ff9800", marginTop: "5px" }}>
            ⏰ Maximum expiry allowed: <b>30 days</b>
          </div>
        </div>

        <label>Allowed MCC (comma separated)</label>
        <input className="input" value={allowedMcc} onChange={(e) => setAllowedMcc(e.target.value)} />

        <div className="row">
          <div className="col">
            <label>Max per transaction ($)</label>
            <input className="input" type="number" value={maxTransaction} onChange={(e) => setMaxTransaction(e.target.value)} />
          </div>
          <div className="col">
            <label>Daily cap ($)</label>
            <input className="input" type="number" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
          </div>
          <div className="col">
            <label>Capsule limit ($)</label>
            <input className="input" type="number" value={capsuleLimit} onChange={(e) => setCapsuleLimit(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="col">
            <label>⏰ Expiry (days) - Max 30 days</label>
            <input
              className="input"
              type="number"
              min="1"
              max="30"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 7)))}
              style={{ border: expiryDays > 30 ? "2px solid #f44336" : "1px solid #ccc" }}
            />
            {expiryDays > 30 && (
              <div className="small" style={{ color: "#f44336", marginTop: "4px" }}>
                ❌ Expiry cannot exceed 30 days
              </div>
            )}
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
            <div><b>⏰ Expires in:</b> <span style={{ color: (current.expiryDaysLeft || current.expiryDays || 7) < 3 ? "#f44336" : "#4caf50" }}>
              {current.expiryDaysLeft || current.expiryDays || 7} days
            </span></div>

            <div style={{ marginTop: "10px" }}>
              <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                Usage: <b>{usagePercentage.toFixed(1)}%</b> of limit
                {usagePercentage > 70 && <span style={{ color: "#ff9800", marginLeft: "8px" }}>⚠️ Near limit!</span>}
              </div>
              <div style={{ background: "#e0e0e0", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{
                  width: `${Math.min(usagePercentage, 100)}%`,
                  background: usagePercentage > 90 ? "#f44336" : (usagePercentage > 70 ? "#ff9800" : "#4caf50"),
                  height: "8px",
                  borderRadius: "5px"
                }}></div>
              </div>
            </div>

            <div className="small" style={{ marginTop: "8px", color: "#4caf50" }}>
              📈 Remaining: ${(current.capsuleLimit - (current.spentTotal || 0)).toFixed(2)}
            </div>

            <div style={{ marginTop: "15px" }}>
              <button
                onClick={async () => {
                  setMsg("⏳ Processing repayment...");
                  try {
                    const res = await api.post("/api/capsule/repay", { amount: current.spentTotal });
                    setMsg(`✅ Repaid $${current.spentTotal}. Capsule closed.`);
                    const cap = await api.get("/api/capsule");
                    setCurrent(cap.data.capsule);
                  } catch (e) {
                    setMsg("❌ Repayment failed: " + (e?.response?.data?.error || "Unknown error"));
                  }
                }}
                style={{
                  background: "linear-gradient(135deg, #4caf50, #45a049)",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  width: "100%"
                }}
              >
                💰 Repay Full Amount (${(current.spentTotal || 0).toFixed(2)})
              </button>
              <div className="small" style={{ marginTop: "8px", textAlign: "center", color: "#666" }}>
                Note: If bank balance is $0, repayment will fail. Please ensure sufficient funds.
              </div>
            </div>
          </>
        )}
      </div>

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
        .warning-card {
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
}