import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { setAuthToken } from "./lib/api.js";

import BankLogin from "./pages/BankLogin1";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RiskSim from "./pages/RiskSim.jsx";
import CapsuleSetup from "./pages/CapsuleSetup.jsx";
import TxnTest from "./pages/TxnTest.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import BankLoginModal from "./components/BankLoginModal1.jsx";

export default function App() {
  const nav = useNavigate();
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [showBankModal, setShowBankModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setAuthToken(token);
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    setUser(null);
    nav("/");
  }

  const hasBankLinked = user?.bankLinked === true;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Risk-Aware Capsule Credit</h2>
          <div className="small">Monte Carlo PD • Risk-tiered step-up auth • Blockchain audit trail</div>
        </div>

        {/* Bank Link Button - only show when user is logged in AND bank not linked */}
        {user && !hasBankLinked && (
          <button
            onClick={() => setShowBankModal(true)}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              padding: "8px 20px",
              borderRadius: "25px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "all 0.2s ease"
            }}
          >
            🏦 Link Bank Account
          </button>
        )}

        {user && hasBankLinked && (
          <div style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            padding: "6px 16px",
            borderRadius: "25px",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>✅</span>
            <span>Bank Linked: {user.bankName || "Linked"}</span>
          </div>
        )}
      </div>

      <div className="nav">
        <Link className="badge" to="/">Login</Link>
        <Link className="badge" to="/dashboard">Dashboard</Link>
        <Link className="badge" to="/risk">Risk Simulation</Link>
        <Link className="badge" to="/capsule">Capsule Setup</Link>
        <Link className="badge" to="/txn">Transaction Test</Link>
        <Link className="badge" to="/audit">Audit Log</Link>
        {user && <button className="badge" onClick={logout}>Logout</button>}
      </div>

      <Routes>
        <Route path="/" element={<Login onAuthed={(u) => setUser(u)} />} />
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/risk" element={<RiskSim user={user} />} />
        <Route path="/capsule" element={<CapsuleSetup user={user} />} />
        <Route path="/txn" element={<TxnTest user={user} />} />
        <Route path="/audit" element={<AuditLog user={user} />} />
        <Route path="/bank-login" element={<BankLogin />} />
        <Route path="/bank-login-modal" element={<BankLoginModal />} />
      </Routes>

      {/* Bank Login Modal - only renders when showBankModal is true */}
      <BankLoginModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSuccess={() => {
          const updatedUser = JSON.parse(localStorage.getItem('user'));
          setUser(updatedUser);
          setShowBankModal(false);
        }}
      />
    </div>
  );
}
