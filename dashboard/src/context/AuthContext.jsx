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

/**
 * Development mode DISABLED
 * Real authentication is ALWAYS required
 */
const isDevModeEnabled = () => {
  // Dev mode is permanently disabled - real auth required
  return false;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const userData = await api.getCurrentUser();
        // Backend returns { authenticated: true, user: {...} }
        if (userData && userData.authenticated && userData.user && userData.user.id) {
          setUser(userData.user);
        } else {
          // Invalid response - clear token
          console.warn('Auth check returned invalid user data');
          localStorage.removeItem('auth_token');
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('auth_token');
      setUser(null);
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

  const handleOAuthCallback = async (provider, code, state) => {
    try {
      const result = await api.handleOAuthCallback(provider, code, state);
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
