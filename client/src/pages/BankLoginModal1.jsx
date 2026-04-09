import React, { useState } from 'react';
import { api } from '../lib/api.js';

const BankLoginModal = ({ isOpen, onClose, onSuccess }) => {
    console.log("BankLoginModal is rendering!"); // Add this line
  const [formData, setFormData] = useState({
    bankName: 'Maybank',
    username: '',
    password: '',
    accountType: 'savings'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const banks = ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank', 'Bank Islam', 'AmBank'];

  const generateFakeBankData = (data) => {
    // ... your existing generateFakeBankData function
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const transactions = [];
    
    let baseIncome = 3000;
    if (data.accountType === 'current') baseIncome = 5000;
    if (data.bankName.includes('Public')) baseIncome = 3500;
    
    months.forEach((month) => {
      const monthlyIncome = baseIncome + (Math.random() - 0.5) * 1000;
      const monthlyExpenses = monthlyIncome * (0.6 + Math.random() * 0.3);
      
      transactions.push({
        month,
        income: Math.round(monthlyIncome),
        expenses: Math.round(monthlyExpenses),
        savings: Math.round(monthlyIncome - monthlyExpenses),
      });
    });
    
    const calculateVolatility = (values) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      return Math.sqrt(variance) / mean;
    };
    
    return {
      accountNumber: `XXXX-XXXX-${Math.floor(Math.random() * 10000)}`,
      accountHolder: data.username,
      linkedDate: new Date().toISOString(),
      monthlyTransactions: transactions,
      averageMonthlyIncome: Math.round(transactions.reduce((sum, t) => sum + t.income, 0) / transactions.length),
      averageMonthlyExpenses: Math.round(transactions.reduce((sum, t) => sum + t.expenses, 0) / transactions.length),
      incomeVolatility: calculateVolatility(transactions.map(t => t.income)),
      expenseVolatility: calculateVolatility(transactions.map(t => t.expenses))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login first');
        setLoading(false);
        return;
      }

      const transactionData = generateFakeBankData(formData);
      
      const response = await api.post('/api/auth/link-bank', {
        bankName: formData.bankName,
        accountType: formData.accountType,
        transactionData: transactionData
      });

      if (response.data.success) {
        // Update user in localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.bankLinked = true;
          user.bankName = formData.bankName;
          localStorage.setItem('user', JSON.stringify(user));
        }
        
        onSuccess && onSuccess();
        onClose();
      } else {
        setError(response.data.error || 'Failed to link bank account');
      }
    } catch (err) {
      console.error('Bank linking error:', err);
      setError(err.response?.data?.error || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Link Bank Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Institution
              </label>
              <select
                name="bankName"
                value={formData.bankName}
                onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
              >
                {banks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Username / Email
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                required
              />
              <p className="text-xs text-slate-400 mt-1">Demo: Any credentials work</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all shadow-md disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Confirm Integration'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BankLoginModal;