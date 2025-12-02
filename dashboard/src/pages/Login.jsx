import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { loginWithGoogle, loginWithFacebook, loginWithTikTok } = useAuth();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const handleLogin = async (provider, loginFn) => {
    setLoading(provider);
    setError(null);
    try {
      await loginFn();
    } catch (err) {
      setError(`Failed to login with ${provider}. Please try again.`);
      setLoading(null);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">&#9889;</span>
          </div>
          <h1 className="login-title">Sign In to Dashboard</h1>
          <p className="login-subtitle">Create an account or sign in to start making viral shorts</p>
        </div>

        <div className="login-note">
          <p><strong>Note:</strong> This signs you into the dashboard. You'll connect your posting accounts (YouTube, TikTok, etc.) in the next step.</p>
        </div>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <div className="login-buttons">
          <button
            className="login-btn login-btn-google"
            onClick={() => handleLogin('google', loginWithGoogle)}
            disabled={loading}
          >
            {loading === 'google' ? (
              <Loader2 size={20} className="spinning" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <button
            className="login-btn login-btn-facebook"
            onClick={() => handleLogin('facebook', loginWithFacebook)}
            disabled={loading}
          >
            {loading === 'facebook' ? (
              <Loader2 size={20} className="spinning" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            Continue with Facebook
          </button>

          <button
            className="login-btn login-btn-tiktok"
            onClick={() => handleLogin('tiktok', loginWithTikTok)}
            disabled={loading}
          >
            {loading === 'tiktok' ? (
              <Loader2 size={20} className="spinning" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
            )}
            Continue with TikTok
          </button>
        </div>

        <p className="login-terms">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
          padding: 20px;
        }

        .login-card {
          background: rgba(30, 30, 40, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 48px;
          max-width: 420px;
          width: 100%;
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 32px;
        }

        .login-logo-icon {
          filter: grayscale(1) brightness(10);
        }

        .login-title {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin-bottom: 8px;
        }

        .login-subtitle {
          color: var(--text-muted);
          font-size: 15px;
        }

        .login-note {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          padding: 14px 16px;
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .login-note p {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .login-note strong {
          color: var(--primary);
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-size: 14px;
          text-align: center;
        }

        .login-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          width: 100%;
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-btn-google {
          background: white;
          color: #333;
        }

        .login-btn-google:hover:not(:disabled) {
          background: #f5f5f5;
          transform: translateY(-2px);
        }

        .login-btn-facebook {
          background: #1877F2;
          color: white;
        }

        .login-btn-facebook:hover:not(:disabled) {
          background: #166fe5;
          transform: translateY(-2px);
        }

        .login-btn-tiktok {
          background: #000;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .login-btn-tiktok:hover:not(:disabled) {
          background: #111;
          transform: translateY(-2px);
        }

        .login-terms {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 24px;
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
