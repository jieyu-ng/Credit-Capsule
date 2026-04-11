import React, { useState } from 'react';
import { api } from '../lib/api.js';

const BankLoginModal = ({ isOpen, onClose, onSuccess }) => {
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

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Link Bank Account</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ padding: '20px' }}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                Select Institution
              </label>
              <select
                value={formData.bankName}
                onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#f8fafc'
                }}
              >
                {banks.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                Username / Email
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                required
              />
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Demo: Any credentials work
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                color: 'white',
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
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