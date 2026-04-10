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
  const [showPassword, setShowPassword] = useState(false);

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        width: '480px',
        maxWidth: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        {/* Maybank Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1a472a 0%, #0d2818 100%)',
          padding: '25px 30px',
          textAlign: 'center',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '20px',
              top: '20px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
          >
            ×
          </button>
          
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#ffd700',
            marginBottom: '8px',
            letterSpacing: '2px'
          }}>
            MAYBANK
          </div>
          <div style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: '1px'
          }}>
            Secure Online Banking
          </div>
        </div>

        {/* Login Form */}
        <div style={{ padding: '30px' }}>
          {/* Bank Selector */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Select Bank
            </label>
            <select
              value={formData.bankName}
              onChange={(e) => setFormData({...formData, bankName: e.target.value})}
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                height: '48px',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a472a'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            >
              {banks.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          {/* Username/Email Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Access Number / Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="Enter your access number"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                transition: 'border-color 0.2s',
                outline: 'none',
                height: '48px',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a472a'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              required
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '14px',
                  paddingRight: '45px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                  height: '48px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1a472a'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666'
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#999',
              marginTop: '8px',
              textAlign: 'right'
            }}>
              <a href="#" style={{ color: '#1a472a', textDecoration: 'none' }}>Forgot Password?</a>
            </div>
          </div>

          {/* Account Type Selector */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Account Type
            </label>
            <div style={{
              display: 'flex',
              gap: '15px',
              padding: '8px 0'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  value="savings"
                  checked={formData.accountType === 'savings'}
                  onChange={(e) => setFormData({...formData, accountType: e.target.value})}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                Savings Account
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="radio"
                  value="current"
                  checked={formData.accountType === 'current'}
                  onChange={(e) => setFormData({...formData, accountType: e.target.value})}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                Current Account
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              textAlign: 'center'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Demo Notice */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            color: '#92400e',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            🔐 Demo Mode: Any credentials work
          </div>

          {/* Login Button */}
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#1a472a',
              color: 'white',
              padding: '14px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              marginBottom: '15px'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.backgroundColor = '#0d2818';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.backgroundColor = '#1a472a';
            }}
          >
            {loading ? (
              <span>⏳ Processing...</span>
            ) : (
              <span>🔒 Login & Link Account</span>
            )}
          </button>

          {/* Security Notice */}
          <div style={{
            fontSize: '11px',
            color: '#999',
            textAlign: 'center',
            borderTop: '1px solid #e0e0e0',
            paddingTop: '20px',
            marginTop: '10px'
          }}>
            <div>🔒 128-bit SSL Encryption</div>
            <div style={{ marginTop: '5px' }}>
              By continuing, you agree to our Terms & Conditions
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '15px',
          textAlign: 'center',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          fontSize: '11px',
          color: '#666'
        }}>
          © 2024 Maybank. All rights reserved. | <a href="#" style={{ color: '#1a472a', textDecoration: 'none' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default BankLoginModal;