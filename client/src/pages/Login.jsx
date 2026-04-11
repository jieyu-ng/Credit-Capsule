import React, { useState } from "react";
import { api, setAuthToken } from "../lib/api.js";
import DashLogin from "../components/DashLogin.jsx";

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login"); // 'login', 'register', 'dash'
  const [email, setEmail] = useState("demo@user.com");
  const [password, setPassword] = useState("password123");
  const [approvedLimit, setApprovedLimit] = useState(5000);
  const [msg, setMsg] = useState("");

  async function register() {
    setMsg("");
    try {
      await api.post("/api/auth/register", { email, password, approvedLimit: Number(approvedLimit) });
      setMsg("Registered! Now login.");
      setMode("login");
    } catch (e) {
      setMsg(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : "Register failed");
    }
  }

  async function login() {
    setMsg("");
    try {
      const r = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("token", r.data.token);
      localStorage.setItem("user", JSON.stringify(r.data.user));
      setAuthToken(r.data.token);
      onAuthed?.(r.data.user);
      setMsg("Logged in!");
    } catch (e) {
      setMsg(e?.response?.data?.error || "Login failed");
    }
  }

  const handleDashSuccess = (user) => {
    onAuthed?.(user);
  };

  if (mode === "dash") {
    return (
      <div className="card">
        <DashLogin
          onSuccess={handleDashSuccess}
          onSwitchToEmail={() => setMode("login")}
        />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row">
        <button className={`btn ${mode === "login" ? "" : "secondary"}`} onClick={() => setMode("login")}>
          Login
        </button>
        <button className={`btn ${mode === "register" ? "" : "secondary"}`} onClick={() => setMode("register")}>
          Register
        </button>
        <button className={`btn ${mode === "dash" ? "" : "secondary"}`} onClick={() => setMode("dash")}>
          Dash Login
        </button>
      </div>

      <hr />

      {mode === "login" && (
        <>
          <label>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={login}>Login</button>
          </div>
        </>
      )}

      {mode === "register" && (
        <>
          <label>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label>Approved Limit (demo)</label>
          <input className="input" type="number" value={approvedLimit} onChange={(e) => setApprovedLimit(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={register}>Create account</button>
          </div>
        </>
      )}

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
      <div className="small" style={{ marginTop: 10 }}>
        {mode === "dash"
          ? "Login with your Dash wallet - no email or password needed!"
          : "Demo tip: register once, then login. Approved limit controls max capsule."}
      </div>
    </div>
  );
}