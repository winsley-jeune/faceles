import { useState, useEffect } from 'react';
import {
  Link2, Unlink, RefreshCw, CheckCircle, AlertCircle,
  ExternalLink, Clock, Shield, Youtube, Facebook, Instagram
} from 'lucide-react';
import api from '../api';

// TikTok icon component
const TikTokIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const platforms = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.1)',
    description: 'Upload YouTube Shorts to your channel',
    scopes: ['Upload videos', 'Manage channel'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: TikTokIcon,
    color: '#000000',
    bgColor: 'rgba(0, 0, 0, 0.1)',
    description: 'Post videos directly to TikTok',
    scopes: ['Upload videos', 'View profile'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    bgColor: 'rgba(24, 119, 242, 0.1)',
    description: 'Share Reels to your Facebook Page',
    scopes: ['Manage pages', 'Publish videos'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: '#E4405F',
    bgColor: 'rgba(228, 64, 95, 0.1)',
    description: 'Post Reels via your linked Facebook Page',
    scopes: ['Business account', 'Content publish'],
    requiresFacebook: true,
  },
];

export default function SocialConnections() {
  const [connectionStatus, setConnectionStatus] = useState({});
  const [loading, setLoading] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllStatuses();
  }, []);

  const fetchAllStatuses = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const [youtube, tiktok, facebook, instagram] = await Promise.allSettled([
        api.checkYouTubeStatus(),
        api.checkTikTokStatus(),
        api.checkFacebookStatus(),
        api.checkInstagramStatus(),
      ]);

      setConnectionStatus({
        youtube: youtube.status === 'fulfilled' ? youtube.value : { connected: false, error: youtube.reason?.message },
        tiktok: tiktok.status === 'fulfilled' ? tiktok.value : { connected: false, error: tiktok.reason?.message },
        facebook: facebook.status === 'fulfilled' ? facebook.value : { connected: false, error: facebook.reason?.message },
        instagram: instagram.status === 'fulfilled' ? instagram.value : { connected: false, error: instagram.reason?.message },
      });
    } catch (err) {
      setError('Failed to fetch connection statuses');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnect = async (platformId) => {
    setLoading(prev => ({ ...prev, [platformId]: true }));
    setError(null);

    try {
      let authUrl;

      switch (platformId) {
        case 'youtube':
          const ytRes = await api.getYouTubeAuthUrl();
          authUrl = ytRes.authUrl;
          break;
        case 'tiktok':
          const ttRes = await api.getTikTokAuthUrl();
          authUrl = ttRes.authUrl;
          break;
        case 'facebook':
        case 'instagram':
          const fbRes = await api.getFacebookAuthUrl();
          authUrl = fbRes.authUrl;
          break;
        default:
          throw new Error('Unknown platform');
      }

      if (authUrl) {
        // Open auth URL in new window
        const authWindow = window.open(authUrl, '_blank', 'width=600,height=700');

        // Poll for completion
        const pollInterval = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(pollInterval);
            // Refresh status after window closes
            setTimeout(() => {
              fetchAllStatuses();
              setLoading(prev => ({ ...prev, [platformId]: false }));
            }, 1000);
          }
        }, 500);
      }
    } catch (err) {
      setError(`Failed to connect ${platformId}: ${err.message}`);
      setLoading(prev => ({ ...prev, [platformId]: false }));
    }
  };

  const handleDisconnect = async (platformId) => {
    if (!confirm(`Are you sure you want to disconnect ${platformId}? You'll need to re-authorize to upload videos.`)) {
      return;
    }

    setLoading(prev => ({ ...prev, [platformId]: true }));

    try {
      await api.disconnectPlatform(platformId);
      setConnectionStatus(prev => ({
        ...prev,
        [platformId]: { connected: false },
      }));
    } catch (err) {
      setError(`Failed to disconnect ${platformId}`);
    } finally {
      setLoading(prev => ({ ...prev, [platformId]: false }));
    }
  };

  const formatExpiry = (expiresAt) => {
    if (!expiresAt) return null;

    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Expired', status: 'error' };
    if (diffDays < 7) return { text: `Expires in ${diffDays} days`, status: 'warning' };
    if (diffDays < 30) return { text: `Expires in ${diffDays} days`, status: 'ok' };
    return { text: `Valid until ${expiry.toLocaleDateString()}`, status: 'ok' };
  };

  const getStatusBadge = (status) => {
    if (!status || !status.connected) {
      return <span className="badge badge-neutral">Not Connected</span>;
    }

    const expiry = formatExpiry(status.expiresAt);
    if (expiry?.status === 'error') {
      return <span className="badge badge-error">Token Expired</span>;
    }
    if (expiry?.status === 'warning') {
      return <span className="badge badge-warning">Expiring Soon</span>;
    }
    return <span className="badge badge-success">Connected</span>;
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Social Connections</h1>
            <p className="page-subtitle">Connect your social media accounts to enable video posting</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchAllStatuses}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            Refresh Status
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '24px' }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <div className="connections-grid">
          {platforms.map((platform) => {
            const status = connectionStatus[platform.id] || {};
            const isLoading = loading[platform.id];
            const isConnected = status.connected;
            const expiry = formatExpiry(status.expiresAt);
            const Icon = platform.icon;

            return (
              <div key={platform.id} className="connection-card">
                <div className="connection-header">
                  <div
                    className="platform-icon"
                    style={{
                      background: platform.bgColor,
                      color: platform.color,
                    }}
                  >
                    <Icon size={28} />
                  </div>
                  {getStatusBadge(status)}
                </div>

                <h3 className="platform-name">{platform.name}</h3>
                <p className="platform-description">{platform.description}</p>

                {platform.requiresFacebook && !connectionStatus.facebook?.connected && (
                  <div className="dependency-notice">
                    <AlertCircle size={14} />
                    Requires Facebook connection first
                  </div>
                )}

                {isConnected && (
                  <div className="connection-details">
                    {status.channelName && (
                      <div className="detail-row">
                        <span className="detail-label">Channel</span>
                        <span className="detail-value">{status.channelName}</span>
                      </div>
                    )}
                    {status.pageName && (
                      <div className="detail-row">
                        <span className="detail-label">Page</span>
                        <span className="detail-value">{status.pageName}</span>
                      </div>
                    )}
                    {status.username && (
                      <div className="detail-row">
                        <span className="detail-label">Account</span>
                        <span className="detail-value">@{status.username}</span>
                      </div>
                    )}
                    {status.instagramUsername && (
                      <div className="detail-row">
                        <span className="detail-label">Instagram</span>
                        <span className="detail-value">@{status.instagramUsername}</span>
                      </div>
                    )}
                    {expiry && (
                      <div className="detail-row">
                        <Clock size={14} />
                        <span className={`expiry-text expiry-${expiry.status}`}>
                          {expiry.text}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="connection-scopes">
                  <span className="scopes-label">
                    <Shield size={14} /> Permissions:
                  </span>
                  {platform.scopes.map((scope) => (
                    <span key={scope} className="scope-tag">{scope}</span>
                  ))}
                </div>

                <div className="connection-actions">
                  {isConnected ? (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleConnect(platform.id)}
                        disabled={isLoading}
                      >
                        <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                        Reconnect
                      </button>
                      <button
                        className="btn btn-danger-outline"
                        onClick={() => handleDisconnect(platform.id)}
                        disabled={isLoading}
                      >
                        <Unlink size={16} />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleConnect(platform.id)}
                      disabled={isLoading || (platform.requiresFacebook && !connectionStatus.facebook?.connected)}
                      style={{
                        background: platform.color,
                        borderColor: platform.color,
                      }}
                    >
                      {isLoading ? (
                        <RefreshCw size={16} className="spinning" />
                      ) : (
                        <Link2 size={16} />
                      )}
                      Connect {platform.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Connection Tips */}
        <div className="tips-section">
          <h3 className="tips-title">Connection Tips</h3>
          <div className="tips-grid">
            <div className="tip-card">
              <CheckCircle size={20} className="tip-icon" />
              <div>
                <strong>YouTube</strong>
                <p>Make sure you have a YouTube channel created and are logged into the correct Google account.</p>
              </div>
            </div>
            <div className="tip-card">
              <CheckCircle size={20} className="tip-icon" />
              <div>
                <strong>TikTok</strong>
                <p>Your TikTok account must be a Creator or Business account to upload via API.</p>
              </div>
            </div>
            <div className="tip-card">
              <CheckCircle size={20} className="tip-icon" />
              <div>
                <strong>Facebook & Instagram</strong>
                <p>You need a Facebook Page to post Reels. Instagram posting requires a linked Instagram Business account.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .connections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .connection-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          transition: all 0.2s ease;
        }

        .connection-card:hover {
          border-color: var(--primary);
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.1);
        }

        .connection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .platform-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .platform-name {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .platform-description {
          color: var(--text-muted);
          font-size: 14px;
          margin-bottom: 16px;
        }

        .dependency-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 8px;
          color: #fbbf24;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .connection-details {
          background: var(--bg-tertiary);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-size: 13px;
        }

        .detail-row:not(:last-child) {
          border-bottom: 1px solid var(--border-color);
        }

        .detail-label {
          color: var(--text-muted);
          min-width: 70px;
        }

        .detail-value {
          color: var(--text-primary);
          font-weight: 500;
        }

        .expiry-text {
          font-size: 12px;
        }

        .expiry-ok { color: var(--success); }
        .expiry-warning { color: #fbbf24; }
        .expiry-error { color: var(--error); }

        .connection-scopes {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .scopes-label {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--text-muted);
          font-size: 12px;
        }

        .scope-tag {
          background: var(--bg-tertiary);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .connection-actions {
          display: flex;
          gap: 12px;
        }

        .connection-actions .btn {
          flex: 1;
        }

        .btn-danger-outline {
          background: transparent;
          border: 1px solid var(--error);
          color: var(--error);
        }

        .btn-danger-outline:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .tips-section {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
        }

        .tips-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .tips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .tip-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--bg-tertiary);
          border-radius: 10px;
        }

        .tip-icon {
          color: var(--success);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .tip-card strong {
          display: block;
          margin-bottom: 4px;
        }

        .tip-card p {
          color: var(--text-muted);
          font-size: 13px;
          margin: 0;
          line-height: 1.5;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 10px;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--error);
        }

        .badge-neutral {
          background: var(--bg-tertiary);
          color: var(--text-muted);
        }

        .badge-warning {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
        }

        .badge-error {
          background: rgba(239, 68, 68, 0.15);
          color: var(--error);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
