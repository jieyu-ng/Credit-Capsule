import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { setAuthToken } from "./lib/api.js";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RiskSim from "./pages/RiskSim.jsx";
import CapsuleSetup from "./pages/CapsuleSetup.jsx";
import TxnTest from "./pages/TxnTest.jsx";
import AuditLog from "./pages/AuditLog.jsx";

export default function App() {
  const nav = useNavigate();
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

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

  return (
    <div className="container">
      <h2>Risk-Aware Capsule Credit</h2>
      <div className="small">Monte Carlo PD • Risk-tiered step-up auth • Blockchain audit trail</div>

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
      </Routes>
    </div>
  );
}