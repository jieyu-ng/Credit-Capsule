import React, { useState } from 'react';
import dashWallet from '../services/dashWallet';
import { setAuthToken, api } from '../lib/api';

export default function DashLogin({ onSuccess, onSwitchToEmail }) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('idle');
    const [error, setError] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false); // Add this state

    const API_URL = 'http://localhost:4000';

    // Check if already logged in on component mount
    React.useEffect(() => {
        const user = localStorage.getItem('user');
        const dashSession = localStorage.getItem('dashSession');
        if (user && dashSession) {
            setIsLoggedIn(true);
        }
    }, []);

    const handleDashLogin = async () => {
        setLoading(true);
        setStep('connecting');
        setError('');

        try {
            const identityInfo = await dashWallet.connect();
            if (!identityInfo) {
                throw new Error('No Dash identity found');
            }
            setStep('getting_nonce');

            const nonceRes = await fetch(`${API_URL}/api/dash/nonce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identityId: identityInfo.identityId })
            });

            if (!nonceRes.ok) {
                throw new Error('Failed to get nonce');
            }

            const { nonce, message } = await nonceRes.json();
            setStep('signing');

            const signature = await dashWallet.signMessage(message);
            setStep('verifying');

            const authRes = await fetch(`${API_URL}/api/dash/me`, {
                method: 'GET',
                headers: {
                    'x-dash-identity': identityInfo.identityId,
                    'x-dash-signature': signature,
                    'x-dash-nonce': nonce
                }
            });

            console.log('Auth response status:', authRes.status);

            const responseText = await authRes.text();
            console.log('Auth response text:', responseText);

            let userData;
            try {
                userData = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse JSON:', responseText);
                throw new Error(`Server returned: ${responseText.substring(0, 100)}`);
            }

            if (authRes.ok && userData.authenticated) {
                console.log('Authentication successful!', userData);

                // Use the session token from the backend
                const sessionToken = userData.sessionToken;

                if (!sessionToken) {
                    console.warn('No session token received from backend');
                }

                // Store Dash session - this is critical for the interceptor
                const dashSession = {
                    identityId: identityInfo.identityId,
                    sessionToken: sessionToken,
                    userId: userData.userId,
                    authenticated: true
                };
                localStorage.setItem('dashSession', JSON.stringify(dashSession));

                // Create user object
                const user = {
                    id: userData.userId || 'dash_user',
                    email: userData.email || `dash_${identityInfo.identityId.slice(0, 8)}@dash.local`,
                    approvedLimit: userData.approvedLimit || 5000,
                    userAddress: identityInfo.identityId,
                    authMethod: 'dash',
                    sessionToken: sessionToken
                };
                localStorage.setItem('user', JSON.stringify(user));

                console.log('User saved, redirecting...');
                setStep('done');
                setIsLoggedIn(true); // Set logged in state to true

                // Small delay to show success state, then redirect
                setTimeout(() => {
                    if (onSuccess) {
                        onSuccess(user);
                    } else {
                        window.location.href = '/dashboard';
                    }
                }, 1000);
            } else {
                console.error('Authentication failed:', userData);
                throw new Error(userData.error || 'Authentication failed');
            }

        } catch (err) {
            console.error('Dash login error:', err);
            setError(err.message || 'Failed to authenticate with Dash');
            setStep('idle');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dash-login-container">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🪙</div>
                <h3 style={{ margin: 0, color: '#008de4' }}>Login with Dash</h3>
                <div className="small" style={{ marginTop: '5px' }}>
                    Use your Dash identity for secure, passwordless login
                </div>
            </div>

            {error && (
                <div style={{
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    padding: '10px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    fontSize: '13px',
                    textAlign: 'center'
                }}>
                    ❌ {error}
                </div>
            )}

            <button
                onClick={handleDashLogin}
                disabled={loading || isLoggedIn} // Disable button if already logged in
                style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: isLoggedIn ? '#10b981' : '#008de4', // Change color when logged in
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: (loading || isLoggedIn) ? 'default' : 'pointer',
                    opacity: (loading || isLoggedIn) ? 0.7 : 1,
                    marginBottom: '15px'
                }}
            >
                {loading ? (
                    <span>
                        {step === 'connecting' && '⏳ Connecting...'}
                        {step === 'getting_nonce' && '🔑 Getting nonce...'}
                        {step === 'signing' && '✍️ Signing...'}
                        {step === 'verifying' && '🔍 Verifying...'}
                        {step === 'done' && '✅ Success!'}
                    </span>
                ) : isLoggedIn ? (
                    '✅ Logged In'
                ) : (
                    '🔐 Login with Dash'
                )}
            </button>

            {/* Only show email option if not logged in */}
            {!isLoggedIn && (
                <button
                    onClick={onSwitchToEmail}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'transparent',
                        color: '#666',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer'
                    }}
                >
                    Use Email Instead
                </button>
            )}

            <div className="small" style={{ textAlign: 'center', marginTop: '15px', color: '#888' }}>
                Demo mode: Using server identity for testing
            </div>
        </div>
    );
}