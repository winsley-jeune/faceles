import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ThumbsUp, Video, TrendingUp, Play, Youtube, RefreshCw, Loader2, Brain, Target, BarChart3, Zap, ExternalLink } from 'lucide-react';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pullingAnalytics, setPullingAnalytics] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsData, patternsData] = await Promise.all([
        api.getAnalytics().catch(() => ({ summary: null, videos: [] })),
        api.getSmartPatterns().catch(() => ({ patterns: null })),
      ]);

      setStats(analyticsData.summary);
      setVideos(analyticsData.videos || []);
      if (patternsData.success) {
        setPatterns(patternsData.patterns);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const pullAnalytics = async () => {
    setPullingAnalytics(true);
    try {
      await api.pullYouTubeAnalytics();
      await fetchData();
    } catch (err) {
      console.error('Failed to pull analytics:', err);
    } finally {
      setPullingAnalytics(false);
    }
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">
            <Youtube size={28} style={{ marginRight: '12px', color: '#ff0000' }} />
            YouTube Dashboard
          </h1>
          <p className="page-subtitle">Overview of your YouTube Shorts performance</p>
        </header>
        <div className="page-content">
          <div className="loading-spinner"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          <Youtube size={28} style={{ marginRight: '12px', color: '#ff0000' }} />
          YouTube Dashboard
        </h1>
        <p className="page-subtitle">Overview of your YouTube Shorts performance</p>
      </header>

      <div className="page-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(255, 0, 0, 0.1)', color: '#ff0000' }}><Eye size={20} /></div>
            <div className="stat-value">{formatNumber(stats?.totalViews || 0)}</div>
            <div className="stat-label">Total Views</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><ThumbsUp size={20} /></div>
            <div className="stat-value">{formatNumber(stats?.totalLikes || 0)}</div>
            <div className="stat-label">Total Likes</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><Video size={20} /></div>
            <div className="stat-value">{stats?.totalVideos || 0}</div>
            <div className="stat-label">Videos Created</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><TrendingUp size={20} /></div>
            <div className="stat-value">{formatNumber(stats?.avgViewsPerVideo || 0)}</div>
            <div className="stat-label">Avg Views/Video</div>
          </div>
        </div>

        {/* Winning Patterns Section */}
        {patterns && (patterns.hooks?.length > 0 || patterns.structures?.length > 0) && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <h2 className="card-title">
                <Brain size={20} style={{ marginRight: '8px', color: 'var(--primary)' }} />
                Your Winning Patterns
              </h2>
              <button
                className="btn btn-secondary"
                onClick={pullAnalytics}
                disabled={pullingAnalytics}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {pullingAnalytics ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}
                {pullingAnalytics ? 'Updating...' : 'Refresh Analytics'}
              </button>
            </div>

            <div className="grid-2">
              {/* Top Hooks */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={14} /> BEST PERFORMING HOOK STYLES
                </p>
                {patterns.hooks?.slice(0, 4).map((hook, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: i === 0 ? 'linear-gradient(135deg, rgba(255, 0, 0, 0.1) 0%, rgba(255, 0, 0, 0.05) 100%)' : 'var(--bg-secondary)',
                    border: i === 0 ? '1px solid rgba(255, 0, 0, 0.2)' : 'none',
                    borderRadius: '10px',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {i === 0 && <span style={{ fontSize: '16px' }}>🏆</span>}
                      <span style={{ textTransform: 'capitalize', fontWeight: i === 0 ? 600 : 500 }}>
                        {hook.name?.replace(/-/g, ' ')}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#ff0000', fontWeight: 600, fontSize: '14px' }}>
                        {hook.avgViews?.toLocaleString()}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }}>avg views</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Structures */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={14} /> BEST STORY STRUCTURES
                </p>
                {patterns.structures?.slice(0, 4).map((structure, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: i === 0 ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)' : 'var(--bg-secondary)',
                    border: i === 0 ? '1px solid rgba(139, 92, 246, 0.2)' : 'none',
                    borderRadius: '10px',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {i === 0 && <span style={{ fontSize: '16px' }}>⭐</span>}
                      <span style={{ textTransform: 'capitalize', fontWeight: i === 0 ? 600 : 500 }}>
                        {structure.name?.replace(/-/g, ' ')}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px' }}>
                        {structure.avgViews?.toLocaleString()}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }}>avg views</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Videos */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Youtube size={20} style={{ marginRight: '8px', color: '#ff0000' }} />
              Recent YouTube Shorts
            </h2>
          </div>
          {videos.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Published</th>
                </tr>
              </thead>
              <tbody>
                {videos.slice(0, 5).map((video) => (
                  <tr key={video.videoId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                          <img
                            src={video.thumbnail}
                            alt=""
                            style={{ width: '80px', height: '45px', borderRadius: '6px', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            background: '#ff0000',
                            borderRadius: '3px',
                            padding: '1px 4px',
                            fontSize: '10px',
                          }}>
                            <Youtube size={10} />
                          </div>
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>{video.title?.substring(0, 45)}...</span>
                          {video.videoId && (
                            <a
                              href={`https://youtube.com/shorts/${video.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}
                            >
                              View on YouTube <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: video.stats?.views > (stats?.avgViewsPerVideo || 0) ? 'var(--success)' : 'inherit' }}>
                        {formatNumber(video.stats?.views || 0)}
                      </span>
                    </td>
                    <td>{formatNumber(video.stats?.likes || 0)}</td>
                    <td>{formatDate(video.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Youtube size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p>No videos found. Create your first video to see analytics here.</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid-2" style={{ marginTop: '24px' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/create" className="btn btn-youtube">
                <Zap size={16} /> Smart Video Generator
              </Link>
              <button
                className="btn btn-secondary"
                onClick={pullAnalytics}
                disabled={pullingAnalytics}
              >
                {pullingAnalytics ? <Loader2 size={16} className="spinning" /> : <RefreshCw size={16} />}
                Pull Analytics
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              🏆 Top Performer
            </h3>
            {stats?.topPerformer ? (
              <div>
                <p style={{ fontWeight: 500, marginBottom: '8px' }}>
                  {stats.topPerformer.title}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
                  {formatNumber(stats.topPerformer.stats?.views || 0)} views • {formatNumber(stats.topPerformer.stats?.likes || 0)} likes
                </p>
                {stats.topPerformer.videoId && (
                  <a
                    href={`https://youtube.com/shorts/${stats.topPerformer.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    <Youtube size={14} /> Watch <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                No top performer yet. Create more videos to see insights.
              </p>
            )}
          </div>
        </div>

        {/* How Smart Generation Works - Promo */}
        <div className="card" style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(255, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Brain size={20} style={{ color: 'var(--primary)' }} />
                Smart Video Generation
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '500px' }}>
                Our AI analyzes your top performing videos, extracts winning patterns,
                and generates NEW unique content that's likely to go viral.
              </p>
            </div>
            <Link to="/create" className="btn btn-youtube btn-lg">
              <Zap size={18} /> Create Smart Video
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-youtube {
          background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%) !important;
          color: white !important;
          border: none !important;
        }

        .btn-youtube:hover {
          background: linear-gradient(135deg, #cc0000 0%, #990000 100%) !important;
        }
      `}</style>
    </>
  );
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
