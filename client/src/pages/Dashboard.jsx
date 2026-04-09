import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

// BankLinkingStatus component
const BankLinkingStatus = ({ isLinked, bankName, onLinkClick }) => {
  return (
    <div className={`rounded-xl p-5 mb-8 transition-all ${
      isLinked 
        ? 'bg-white border border-slate-200 shadow-sm' 
        : 'bg-indigo-50 border border-indigo-100'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {isLinked ? 'Financial Data Connected' : 'Connect Bank Account'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLinked 
                ? `Secured via ${bankName} API` 
                : 'Link your bank to unlock risk-aware credit limits.'}
            </p>
          </div>
        </div>
        {!isLinked && (
          <button 
            onClick={onLinkClick}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
          >
            Link Now →
          </button>
        )}
      </div>
    </div>
  );
};

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [capsule, setCapsule] = useState(null);
  const [txns, setTxns] = useState([]);
  const [bankLinked, setBankLinked] = useState(false);
  const [bankName, setBankName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
        try {
          setLoading(true);
          
          // 1. Fetch capsule data
          const cap = await api.get("/api/capsule");
          setCapsule(cap.data.capsule);
          
          // 2. Fetch transactions (pointing to the correct endpoint in capsule.js)
          const t = await api.get("/api/capsule/transactions");
          setTxns(t.data.transactions || []);
          
          // 3. UPDATED: Fetch bank data using the central api instance
          // Points to the endpoint we added in auth.js
          const bankRes = await api.get('/api/auth/bank-data');
          
          setBankLinked(bankRes.data.linked);
          if (bankRes.data.linked) {
            setBankName(bankRes.data.bankName);
          }
          
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        } finally {
          setLoading(false);
        }
      };
    
    fetchData();
  }, [user]);

  const handleLinkBank = () => {
    navigate('/bank-login');
  };

  if (!user) {
    return (
      <div className="card">
        <p>Please login first.</p>
        <button onClick={() => navigate('/login')} className="btn-primary mt-4">
          Go to Login
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bank Linking Status */}
      <BankLinkingStatus 
        isLinked={bankLinked}
        bankName={bankName}
        onLinkClick={handleLinkBank}
      />

      {/* Profile Section */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">Profile</h3>
        <div className="space-y-2">
          <div>
            <span className="text-gray-600">Email:</span>{" "}
            <b>{user.email}</b>
          </div>
          <div>
            <span className="text-gray-600">Approved limit:</span>{" "}
            <b>RM {user.approvedLimit}</b>
          </div>
          <div className="text-xs text-gray-500">
            User Address (demo): {user.userAddress}
          </div>
          {bankLinked && (
            <div className="text-sm text-green-600 mt-2">
              ✓ Bank account linked - Using real income data for risk assessment
            </div>
          )}
        </div>
      </div>

      {/* Capsule Summary Section */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">Capsule Summary</h3>
        {!capsule ? (
          <div>
            <p className="text-gray-600">No capsule yet.</p>
            <button 
              onClick={() => navigate('/capsule')}
              className="btn-primary mt-3"
            >
              Create Your First Capsule
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Capsule limit:</span>{" "}
              <b>RM {capsule.capsuleLimit}</b>
            </div>
            <div>
              <span className="text-gray-600">Spent today:</span>{" "}
              <b>RM {capsule.spentToday}</b> / daily cap{" "}
              <b>RM {capsule.rules?.dailyCap || 0}</b>
            </div>
            <div>
              <span className="text-gray-600">Spent total:</span>{" "}
              <b>RM {capsule.spentTotal}</b>
            </div>
            <div className="text-sm text-gray-500">
              Allowed MCC: {capsule.rules?.allowedMcc?.join(", ") || "None"}
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions Section */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">Recent Decisions (off-chain)</h3>
        {txns.length === 0 ? (
          <p className="text-gray-600">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {txns.slice(0, 8).map((t, i) => (
              <div key={i} className="text-sm p-2 border-b border-gray-100">
                <span className={`font-semibold ${t.approved ? 'text-green-600' : 'text-red-600'}`}>
                  {t.approved ? "✓ APPROVED" : "✗ DENIED"}
                </span>
                {" • "}
                <span className="text-gray-700">{t.merchant}</span>
                {" • "}
                <span className="text-gray-500">{t.mcc}</span>
                {" • "}
                <span className="font-medium">RM {t.amount}</span>
                {" • "}
                <span className="text-xs text-gray-400">tier={t.riskTier}</span>
                {t.reason && (
                  <div className="text-xs text-gray-500 mt-1">{t.reason}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => navigate('/capsule')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          + Create New Capsule
        </button>
        <button 
          onClick={() => navigate('/risk')}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
        >
          📊 Run Risk Simulation
        </button>
      </div>
    </div>
  );
}
