import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function AuthDebug() {
  const { user, isAuthenticated } = useAuth();
  const [tokenInfo, setTokenInfo] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = () => {
    const token = localStorage.getItem('auth_token');
    const allKeys = Object.keys(localStorage);

    setTokenInfo({
      exists: !!token,
      value: token ? token.substring(0, 50) + '...' : 'NULL',
      allStorageKeys: allKeys,
      tokenLength: token ? token.length : 0
    });
  };

  const testAuth = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:3000/youtube-api/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({ error: 'Invalid JSON' }));

      setTestResult({
        success: response.ok,
        status: response.status,
        data: data
      });
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const clearAndRefresh = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h1 style={{ color: 'white' }}>🔍 Authentication Debug</h1>

      <div style={{ background: '#1e1e28', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ color: '#8b5cf6' }}>Auth Context Status</h2>
        <pre style={{ color: '#fff', background: '#0a0a0f', padding: '15px', borderRadius: '4px', overflow: 'auto' }}>
          {JSON.stringify({
            isAuthenticated,
            user: user || null
          }, null, 2)}
        </pre>
      </div>

      <div style={{ background: '#1e1e28', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ color: '#8b5cf6' }}>LocalStorage Token</h2>
        {tokenInfo && (
          <pre style={{ color: '#fff', background: '#0a0a0f', padding: '15px', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(tokenInfo, null, 2)}
          </pre>
        )}
        <button
          onClick={checkToken}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Token Info
        </button>
      </div>

      <div style={{ background: '#1e1e28', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ color: '#8b5cf6' }}>Test Platform API Call</h2>
        <button
          onClick={testAuth}
          disabled={testing}
          style={{
            padding: '10px 20px',
            background: testing ? '#666' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: testing ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {testing ? 'Testing...' : 'Test YouTube Status Endpoint'}
        </button>

        {testResult && (
          <pre style={{
            color: testResult.success ? '#10b981' : '#ef4444',
            background: '#0a0a0f',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ background: '#1e1e28', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#ef4444' }}>Actions</h2>
        <button
          onClick={clearAndRefresh}
          style={{
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear All & Go to Login
        </button>
        <p style={{ color: '#999', fontSize: '13px', marginTop: '10px' }}>
          This will clear all localStorage/sessionStorage and redirect you to login
        </p>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        <h3 style={{ color: '#8b5cf6', marginTop: 0 }}>How to Fix 401 Errors:</h3>
        <ol style={{ color: '#ccc', lineHeight: '1.8' }}>
          <li>If token is NULL/undefined → Click "Clear All & Go to Login"</li>
          <li>Log in with Google/Facebook/TikTok</li>
          <li>After redirect, check this page again to verify token exists</li>
          <li>Token should be a long string (200+ characters)</li>
          <li>Test API call should return status 200</li>
        </ol>
      </div>
    </div>
  );
}
