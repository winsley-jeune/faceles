import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const provider = searchParams.get('provider') ||
        window.location.pathname.split('/').pop();
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError(searchParams.get('error_description') || 'Authentication was cancelled');
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      try {
        const success = await handleOAuthCallback(provider, code);
        if (success) {
          setStatus('success');

          // Check if onboarding is complete
          const onboardingComplete = localStorage.getItem('onboarding_complete');

          if (!onboardingComplete) {
            // New user - go to onboarding
            setTimeout(() => navigate('/onboarding'), 1500);
          } else {
            // Returning user - go to return path or dashboard
            const returnPath = sessionStorage.getItem('auth_return_path') || '/dashboard';
            sessionStorage.removeItem('auth_return_path');
            setTimeout(() => navigate(returnPath), 1500);
          }
        } else {
          setStatus('error');
          setError('Failed to complete authentication');
        }
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Authentication failed');
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, navigate]);

  return (
    <div className="auth-callback-container">
      <div className="auth-callback-card">
        {status === 'processing' && (
          <>
            <Loader2 size={48} className="spinning" style={{ color: 'var(--primary)' }} />
            <h2>Authenticating...</h2>
            <p>Please wait while we complete your login</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} style={{ color: 'var(--success)' }} />
            <h2>Login Successful!</h2>
            <p>Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} style={{ color: 'var(--error)' }} />
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/login')}
              style={{ marginTop: '20px' }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>

      <style>{`
        .auth-callback-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
        }

        .auth-callback-card {
          background: rgba(30, 30, 40, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 48px;
          text-align: center;
          max-width: 400px;
          width: 100%;
        }

        .auth-callback-card h2 {
          margin: 20px 0 8px;
          color: white;
        }

        .auth-callback-card p {
          color: var(--text-muted);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
