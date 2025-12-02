import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// DEV MODE: Set to true to bypass login for testing
const DEV_BYPASS_LOGIN = import.meta.env.DEV; // Auto-enabled in development

const DEV_USER = {
  id: 'dev-user-123',
  email: 'dev@viralshorts.test',
  name: 'Dev User',
  avatar: null,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // DEV BYPASS: Auto-login in development mode
    if (DEV_BYPASS_LOGIN) {
      console.log('🔓 DEV MODE: Auto-login enabled');
      setUser(DEV_USER);
      localStorage.setItem('onboarding_complete', 'true'); // Skip onboarding too
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const userData = await api.getCurrentUser();
        setUser(userData);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { authUrl } = await api.getGoogleLoginUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Google login failed:', err);
      throw err;
    }
  };

  const loginWithFacebook = async () => {
    try {
      const { authUrl } = await api.getFacebookLoginUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Facebook login failed:', err);
      throw err;
    }
  };

  const loginWithTikTok = async () => {
    try {
      const { authUrl } = await api.getTikTokLoginUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('TikTok login failed:', err);
      throw err;
    }
  };

  const handleOAuthCallback = async (provider, code) => {
    try {
      const result = await api.handleOAuthCallback(provider, code);
      if (result.token) {
        localStorage.setItem('auth_token', result.token);
        setUser(result.user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('OAuth callback failed:', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  // Helper to require auth before performing an action
  // Returns true if authenticated, false if redirected to login
  const requireAuth = useCallback((returnPath = window.location.pathname) => {
    if (!user) {
      // Store the return path so we can redirect back after login
      sessionStorage.setItem('auth_return_path', returnPath);
      return false;
    }
    return true;
  }, [user]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    loginWithGoogle,
    loginWithFacebook,
    loginWithTikTok,
    handleOAuthCallback,
    logout,
    checkAuth,
    requireAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
