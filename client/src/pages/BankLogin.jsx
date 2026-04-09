import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const BankLogin = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false); // Add this state
  const [formData, setFormData] = useState({
    bankName: 'Maybank',
    username: '',
    password: '',
    accountType: 'savings'
  });
  const [credentials, setCredentials] = useState({
    bankUsername: '',
    bankPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const banks = [
    'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank',
    'Hong Leong Bank', 'Bank Islam', 'AmBank'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCredentialChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const generateFakeBankData = (data) => {
    // ... (keep your existing generateFakeBankData function)
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
        categories: {
          groceries: Math.round(monthlyExpenses * 0.3),
          transport: Math.round(monthlyExpenses * 0.15),
          bills: Math.round(monthlyExpenses * 0.2),
          entertainment: Math.round(monthlyExpenses * 0.1),
          others: Math.round(monthlyExpenses * 0.25)
        }
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

  // Modified handleSubmit - now shows modal instead of submitting
  // Replace your current handleSubmit with this:
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Store form data in localStorage or sessionStorage to pass to new page
    sessionStorage.setItem('bankSelection', JSON.stringify({
      bankName: formData.bankName,
      username: formData.username,
      accountType: formData.accountType
    }));
    
    // Open new window/tab for credentials
    window.open('/bank-login-modal', '_blank');
  };

  // New function to handle credential submission
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Simulate validation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (!credentials.bankUsername || !credentials.bankPassword) {
        throw new Error('Please enter both username and password');
      }
      
      const bankData = generateFakeBankData(formData);
      
      const response = await api.post('/api/auth/link-bank', {
        bankName: formData.bankName,
        transactionData: bankData
      });

      if (response.data.success) {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        const updatedUser = { ...storedUser, bankLinked: true, bankName: formData.bankName };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Failed to securely connect to bank. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setCredentials({ bankUsername: '', bankPassword: '' });
    setError('');
  };

  return (
    <>
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center py-12 px-6">
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-slate-900">Secure Financial Link</h2>
            <p className="text-sm text-slate-500 mt-1">Authorized data sharing for credit assessment</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Select Institution
                </label>
                <select 
                  name="bankName"
                  className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.bankName}
                  onChange={handleChange}
                >
                  {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  name="username"
                  required
                  className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Full name as per bank account"
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Account Type
                </label>
                <select
                  name="accountType"
                  className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.accountType}
                  onChange={handleChange}
                >
                  <option value="savings">Savings Account</option>
                  <option value="current">Current Account</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all shadow-md"
              >
                Confirm Integration
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Credentials Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-75" onClick={closeModal}></div>

            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-start">
                  <div className="ml-4">
                    <h3 className="text-lg font-bold text-slate-900">
                      Bank Authentication Required
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Please enter your {formData.bankName} online banking credentials
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <form onSubmit={handleCredentialSubmit} className="mt-6 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Online Banking Username
                    </label>
                    <input
                      type="text"
                      name="bankUsername"
                      required
                      className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={credentials.bankUsername}
                      onChange={handleCredentialChange}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Online Banking Password
                    </label>
                    <input
                      type="password"
                      name="bankPassword"
                      required
                      className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={credentials.bankPassword}
                      onChange={handleCredentialChange}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Authenticating...' : 'Verify & Link'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BankLogin;