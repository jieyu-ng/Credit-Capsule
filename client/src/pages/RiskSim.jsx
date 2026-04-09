import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function RiskSim({ user }) {
  const navigate = useNavigate();
  const [requestedAmount, setRequestedAmount] = useState(2000);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [bankData, setBankData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBankData = async () => {
      try {
        const res = await api.get('/api/auth/bank-data');
        setBankData(res.data);
      } catch (e) {
        // ignore errors
      }
    };
    fetchBankData();
  }, []);

  if (!user) return <div className="card">Please login first.</div>;

  async function runAssessment() {
    setMsg("");
    setLoading(true);
    try {
      const r = await api.post("/api/capsule/assess-risk", {
        requestedAmount: Number(requestedAmount),
        capsuleType: "credit",
        duration: 6
      });
      setResult(r.data);
    } catch (e) {
      setMsg(e?.response?.data?.error ? e.response.data.error : "Assessment failed");
    } finally {
      setLoading(false);
    }
  }

  const getRiskColor = (level) => {
    switch (level) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-orange-600';
      case 'VERY_HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskBg = (level) => {
    switch (level) {
      case 'LOW': return 'bg-green-50 border-green-200';
      case 'MEDIUM': return 'bg-yellow-50 border-yellow-200';
      case 'HIGH': return 'bg-orange-50 border-orange-200';
      case 'VERY_HIGH': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Bank Linking Status Banner */}
      {!bankData?.linked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Bank Account Required</h3>
              <p className="text-xs text-amber-700 mt-1">
                Link your bank account for accurate risk assessment using real transaction data.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-amber-700"
            >
              Fetch Banking Data →
            </button>
          </div>
        </div>
      )}

      {bankData?.linked && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center">
            <div className="text-green-600 mr-2">✓</div>
            <div>
              <h3 className="text-sm font-semibold text-green-800">Bank Account Connected</h3>
              <p className="text-xs text-green-700">
                Using transaction data from {bankData.bankName} for Monte Carlo risk assessment.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Monte Carlo Risk Assessment</h3>
        <p className="text-sm text-gray-600 mb-4">
          Simulate credit risk using your bank transaction data and Monte Carlo methods.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested Credit Amount (RM)
            </label>
            <input
              className="input"
              type="number"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              min="100"
              max="10000"
              placeholder="Enter amount"
            />
          </div>

          <button
            className="btn w-full"
            onClick={runAssessment}
            disabled={loading || !bankData?.linked}
          >
            {loading ? 'Running Assessment...' : 'Run Risk Assessment'}
          </button>

          {!bankData?.linked && (
            <p className="text-xs text-gray-500 text-center">
              Bank account linking required for risk assessment
            </p>
          )}
        </div>

        {msg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {msg}
          </div>
        )}

        {result && (
          <div className={`mt-6 p-4 rounded-xl border ${getRiskBg(result.riskLevel)}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Risk Assessment Results</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(result.riskLevel)} bg-white`}>
                {result.riskLevel} RISK
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-600">Probability of Default</div>
                <div className="text-2xl font-bold text-gray-900">
                  {(result.pd * 100).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Recommended Limit</div>
                <div className="text-2xl font-bold text-gray-900">
                  RM {result.recommendedCapsuleLimit?.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Assessment Confidence</div>
              <div className="text-sm font-medium">
                {result.confidence === 'HIGH' ? 'High confidence based on bank data' : 'Low confidence - link bank for better assessment'}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Recommendation</div>
              <div className="text-sm">{result.recommendation}</div>
            </div>

            <div className="border-t pt-4">
              <h5 className="text-sm font-semibold mb-3">Risk Factors Analysis</h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Income Stability</span>
                  <span className="text-sm font-medium">
                    {((result.factors?.incomeStability || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Savings Rate</span>
                  <span className="text-sm font-medium">
                    {((result.factors?.savingsRate || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Income Volatility</span>
                  <span className="text-sm font-medium">
                    {((result.factors?.volatility || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h5 className="text-sm font-semibold mb-3">Simulation Details</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Simulations:</span>
                  <span className="ml-2 font-medium">{result.simulationDetails?.simulations?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Months:</span>
                  <span className="ml-2 font-medium">{result.simulationDetails?.months}</span>
                </div>
                <div>
                  <span className="text-gray-600">Defaults:</span>
                  <span className="ml-2 font-medium">{result.simulationDetails?.defaults}</span>
                </div>
                <div>
                  <span className="text-gray-600">Default Rate:</span>
                  <span className="ml-2 font-medium">{result.simulationDetails?.defaultRate}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}