import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Home, Video, Upload, BarChart3, Settings,
  Zap, LogOut, Link2, LogIn, Youtube, Facebook, Instagram,
  CheckCircle, AlertCircle, Loader2, Building2
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { usePlatformStatus } from './hooks/usePlatformStatus';
import HomePageComponent from './pages/Home';
import Dashboard from './pages/Dashboard';
import CreateVideo from './pages/CreateVideo';
import Videos from './pages/Videos';
import Publish from './pages/Publish';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import SocialConnections from './pages/SocialConnections';
import Onboarding from './pages/Onboarding';
import BrandSettings from './pages/BrandSettings';

// TikTok icon
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Protected Route wrapper - redirects to login if not authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      sessionStorage.setItem('auth_return_path', window.location.pathname);
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}

// Onboarding check wrapper - redirects new users to onboarding (except on public pages)
function OnboardingCheck({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect to onboarding on protected pages, not on home
    const publicPaths = ['/', '/login'];
    const isPublicPage = publicPaths.includes(window.location.pathname);

    if (!loading && isAuthenticated && !isPublicPage) {
      const onboardingComplete = localStorage.getItem('onboarding_complete');
      if (!onboardingComplete && window.location.pathname !== '/onboarding') {
        navigate('/onboarding');
      }
    }
  }, [isAuthenticated, loading, navigate]);

  return children;
}

// Main App Layout (with sidebar)
function AppLayout({ children }) {
  return (
    <OnboardingCheck>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </OnboardingCheck>
  );
}

function Sidebar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { status, loading: platformLoading, connectedCount } = usePlatformStatus();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">&#9889;</div>
          <span className="logo-text">Viral Shorts</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Main</div>
          <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Home size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/create" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Zap size={20} />
            Create Video
          </NavLink>
          <NavLink to="/videos" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Video size={20} />
            My Videos
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Publish</div>
          <NavLink to="/publish" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Upload size={20} />
            Post & Schedule
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Insights</div>
          <NavLink to="/analytics" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 size={20} />
            Analytics
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">System</div>
          <NavLink to="/brand" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Building2 size={20} />
            Brand Settings
          </NavLink>
          <NavLink to="/connections" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Link2 size={20} />
            Connections
            {isAuthenticated && !platformLoading && (
              <span className={`connection-count ${connectedCount > 0 ? 'has-connections' : 'no-connections'}`}>
                {connectedCount}/4
              </span>
            )}
          </NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            Settings
          </NavLink>
        </div>
      </nav>

      {/* Platform Status (only when logged in) */}
      {isAuthenticated && (
        <div className="platform-status-section">
          <div className="platform-status-title">Platforms</div>
          {platformLoading ? (
            <div className="platform-status-loading">
              <Loader2 size={14} className="spinning" />
            </div>
          ) : (
            <div className="platform-status-grid">
              <PlatformBadge
                name="YT"
                icon={<Youtube size={12} />}
                connected={status.youtube?.connected}
                color="#FF0000"
              />
              <PlatformBadge
                name="TT"
                icon={<TikTokIcon size={12} />}
                connected={status.tiktok?.connected}
                color="#000000"
              />
              <PlatformBadge
                name="FB"
                icon={<Facebook size={12} />}
                connected={status.facebook?.connected}
                color="#1877F2"
              />
              <PlatformBadge
                name="IG"
                icon={<Instagram size={12} />}
                connected={status.instagram?.connected}
                color="#E4405F"
              />
            </div>
          )}
          {!platformLoading && connectedCount === 0 && (
            <NavLink to="/connections" className="connect-prompt">
              <AlertCircle size={12} />
              Connect platforms to post
            </NavLink>
          )}
        </div>
      )}

      {/* User Profile Section */}
      <div className="sidebar-footer">
        {user ? (
          <div className="user-profile">
            <div className="user-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{user.name?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name || 'User'}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <button className="logout-btn" onClick={logout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <NavLink to="/login" className="login-btn">
            <LogIn size={18} />
            Sign In
          </NavLink>
        )}
      </div>

      <style>{`
        .sidebar-footer {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-info {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          display: block;
          font-weight: 500;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-email {
          display: block;
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .logout-btn {
          padding: 8px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: var(--bg-secondary);
          color: var(--error);
        }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .loading-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          color: var(--text-muted);
        }

        .loading-screen p {
          margin-top: 16px;
        }

        /* Connection count badge */
        .connection-count {
          margin-left: auto;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
        }

        .connection-count.has-connections {
          background: rgba(34, 197, 94, 0.15);
          color: var(--success);
        }

        .connection-count.no-connections {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
        }

        /* Platform Status Section */
        .platform-status-section {
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }

        .platform-status-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .platform-status-loading {
          display: flex;
          justify-content: center;
          padding: 8px;
        }

        .platform-status-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .platform-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          transition: all 0.2s;
          position: relative;
        }

        .platform-badge.connected {
          opacity: 1;
        }

        .platform-badge.disconnected {
          opacity: 0.4;
          filter: grayscale(100%);
        }

        .platform-badge .status-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }

        .platform-badge.connected .status-dot {
          background: var(--success);
        }

        .platform-badge.disconnected .status-dot {
          background: var(--text-muted);
        }

        .connect-prompt {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 8px 12px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: 8px;
          font-size: 11px;
          color: #fbbf24;
          text-decoration: none;
          transition: all 0.2s;
        }

        .connect-prompt:hover {
          background: rgba(251, 191, 36, 0.15);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  );
}

function PlatformBadge({ name, icon, connected, color }) {
  return (
    <div
      className={`platform-badge ${connected ? 'connected' : 'disconnected'}`}
      style={{ background: `${color}20`, color: color }}
      title={`${name}: ${connected ? 'Connected' : 'Not connected'}`}
    >
      {icon}
      <div className="status-dot" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<HomePageComponent />} />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback/:provider" element={<AuthCallback />} />

          {/* Onboarding (protected but separate from main layout) */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />

          {/* Protected routes - require login */}
          <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><AppLayout><CreateVideo /></AppLayout></ProtectedRoute>} />
          <Route path="/videos" element={<ProtectedRoute><AppLayout><Videos /></AppLayout></ProtectedRoute>} />
          <Route path="/publish" element={<ProtectedRoute><AppLayout><Publish /></AppLayout></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
          <Route path="/connections" element={<ProtectedRoute><AppLayout><SocialConnections /></AppLayout></ProtectedRoute>} />
          <Route path="/brand" element={<ProtectedRoute><AppLayout><BrandSettings /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
