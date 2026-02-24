import React, { useState } from "react";
import { api, setAuthToken } from "../lib/api.js";

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState("login");
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

  return (
    <div className="card">
      <div className="row">
        <button className={`btn ${mode==="login"?"":"secondary"}`} onClick={()=>setMode("login")}>Login</button>
        <button className={`btn ${mode==="register"?"":"secondary"}`} onClick={()=>setMode("register")}>Register</button>
      </div>

      <hr />

      <label>Email</label>
      <input className="input" value={email} onChange={(e)=>setEmail(e.target.value)} />

      <label>Password</label>
      <input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />

      {mode === "register" && (
        <>
          <label>Approved Limit (demo)</label>
          <input className="input" type="number" value={approvedLimit} onChange={(e)=>setApprovedLimit(e.target.value)} />
        </>
      )}

      <div style={{ marginTop: 12 }}>
        {mode === "register"
          ? <button className="btn" onClick={register}>Create account</button>
          : <button className="btn" onClick={login}>Login</button>
        }
      </div>

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
      <div className="small" style={{ marginTop: 10 }}>
        Demo tip: register once, then login. Approved limit controls max capsule.
      </div>
    </div>
  );
}