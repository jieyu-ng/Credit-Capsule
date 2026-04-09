import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Dashboard({ user }) {
  const [capsule, setCapsule] = useState(null);
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cap = await api.get("/api/capsule");
      setCapsule(cap.data.capsule);
      const t = await api.get("/api/audit/txns");
      setTxns(t.data.txns);
    })();
  }, [user]);

  if (!user) return <div className="card">Please login first.</div>;

  return (
    <div>
      <div className="card">
        <h3>Profile</h3>
        <div>Email: <b>{user.email}</b></div>
        <div>Approved limit: <b>{user.approvedLimit}</b></div>
        <div className="small">UserAddress (demo): {user.userAddress}</div>
      </div>

      <div className="card">
        <h3>Capsule Summary</h3>
        {!capsule ? (
          <div className="small">No capsule yet. Go to Capsule Setup.</div>
        ) : (
          <>
            <div>Capsule limit: <b>{capsule.capsuleLimit}</b></div>
            <div>Spent today: <b>{capsule.spentToday}</b> / daily cap <b>{capsule.rules.dailyCap}</b></div>
            <div>Spent total: <b>{capsule.spentTotal}</b></div>
            <div className="small">Allowed MCC: {capsule.rules.allowedMcc.join(", ")}</div>
          </>
        )}
      </div>

      <div className="card">
        <h3>Recent Decisions (off-chain)</h3>
        {txns.length === 0 ? (
          <div className="small">No transactions yet.</div>
        ) : (
          txns.slice(0, 8).map((t, i) => (
            <div key={i} className="small" style={{ marginBottom: 8 }}>
              <b>{t.approved ? "APPROVED" : "DENIED"}</b> • {t.merchant} • {t.mcc} • {t.amount} • tier={t.riskTier} • {t.reason}
            </div>
          ))
        )}
      </div>
    </div>
  );
}