import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ThumbsUp, Video, TrendingUp, Youtube, Facebook, Instagram, RefreshCw, Loader2, Brain, Target, BarChart3, Zap, ExternalLink, Layers, Play, Pause, Clock, Flame, AlertTriangle, CheckCircle, List } from 'lucide-react';
import api from '../api';

// TikTok icon
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const PLATFORMS = [
  { id: 'all', name: 'All Platforms', icon: Layers, color: 'var(--primary)' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000' },
  { id: 'tiktok', name: 'TikTok', icon: TikTokIcon, color: '#00F2EA' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F' },
];

export default function Dashboard() {
  const [activePlatform, setActivePlatform] = useState('all');
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [platformStats, setPlatformStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [pullingAnalytics, setPullingAnalytics] = useState(false);

  // Batch system state
  const [batchQueue, setBatchQueue] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [processingNext, setProcessingNext] = useState(false);

  useEffect(() => {
    fetchData();
    fetchBatchQueue();
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

      // Calculate per-platform stats (simulated - will be real when all platforms have analytics)
      const platformData = calculatePlatformStats(analyticsData.videos || []);
      setPlatformStats(platformData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlatformStats = (videos) => {
    // Initialize platform stats with ONLY metrics actually available from each API
    // YouTube: views, likes, comments, watchTime, avgViewDuration, avgViewPercentage, subscribersGained (2-3 day delay)
    // TikTok: views, likes, comments, shares (limited in sandbox mode)
    // Facebook: reactions, comments, shares (views often return 0 for Reels)
    // Instagram: plays, likes, comments, saves, shares (saves/reach require Business account)
    const platforms = {
      youtube: {
        views: 0, likes: 0, comments: 0, videos: 0,
        watchTime: 0, avgViewDuration: 0, avgViewPercentage: 0, subscribersGained: 0,
        // API provides these metrics with 2-3 day delay
        dataDelay: '2-3 days'
      },
      tiktok: {
        views: 0, likes: 0, comments: 0, videos: 0,
        shares: 0, viralRate: 0,
        // API limitations
        limitedApi: true,
        apiNote: 'Full analytics require approved production app'
      },
      facebook: {
        // Views often return 0, so we use weighted engagement
        views: 0, likes: 0, comments: 0, videos: 0,
        shares: 0, reactions: 0, weightedEngagement: 0,
        viewsUnreliable: true,
        apiNote: 'Views often unavailable for Reels'
      },
      instagram: {
        views: 0, likes: 0, comments: 0, videos: 0,
        saves: 0, shares: 0,
        // These require Business account
        profileVisits: null, followerReach: null, nonFollowerReach: null,
        requiresBusinessAccount: true,
        apiNote: 'Saves & reach require Business account'
      }
    };

    // Aggregate stats by platform
    videos.forEach(video => {
      const platform = video.platform || 'youtube';
      if (!platforms[platform]) return;

      const stats = video.stats || {};
      platforms[platform].videos += 1;
      platforms[platform].views += stats.views || 0;
      platforms[platform].likes += stats.likes || 0;
      platforms[platform].comments += stats.comments || 0;

      // Platform-specific metrics (only what API actually provides)
      if (platform === 'youtube') {
        platforms.youtube.watchTime += stats.watchTime || 0;
        platforms.youtube.avgViewDuration += stats.avgViewDuration || 0;
        platforms.youtube.avgViewPercentage += stats.avgViewPercentage || 0;
        platforms.youtube.subscribersGained += stats.subscribersGained || 0;
      } else if (platform === 'tiktok') {
        platforms.tiktok.shares += stats.shares || 0;
      } else if (platform === 'facebook') {
        platforms.facebook.shares += stats.shares || 0;
        platforms.facebook.reactions += stats.reactions || 0;
        // Calculate weighted engagement (more reliable than views)
        platforms.facebook.weightedEngagement +=
          (stats.shares || 0) * 5 + (stats.comments || 0) * 3 + (stats.reactions || 0);
      } else if (platform === 'instagram') {
        platforms.instagram.saves += stats.saves || 0;
        platforms.instagram.shares += stats.shares || 0;
        // Only set if available (Business account)
        if (stats.profileVisits !== undefined) {
          platforms.instagram.profileVisits = (platforms.instagram.profileVisits || 0) + stats.profileVisits;
        }
        if (stats.followerReach !== undefined) {
          platforms.instagram.followerReach = (platforms.instagram.followerReach || 0) + stats.followerReach;
        }
      }
    });

    // Calculate averages for YouTube
    if (platforms.youtube.videos > 0) {
      platforms.youtube.avgViewDuration = Math.round(
        platforms.youtube.avgViewDuration / platforms.youtube.videos
      );
      platforms.youtube.avgViewPercentage = Math.round(
        platforms.youtube.avgViewPercentage / platforms.youtube.videos
      );
    }

    // Calculate viral rate for TikTok (videos > 10,000 views)
    const tiktokVideos = videos.filter(v => v.platform === 'tiktok');
    if (tiktokVideos.length > 0) {
      const viralCount = tiktokVideos.filter(v => (v.stats?.views || 0) >= 10000).length;
      platforms.tiktok.viralRate = Math.round((viralCount / tiktokVideos.length) * 100);
    }

    // Calculate totals for 'all'
    const all = {
      views: Object.values(platforms).reduce((sum, p) => sum + (p.views || 0), 0),
      likes: Object.values(platforms).reduce((sum, p) => sum + (p.likes || 0), 0),
      comments: Object.values(platforms).reduce((sum, p) => sum + (p.comments || 0), 0),
      videos: Object.values(platforms).reduce((sum, p) => sum + (p.videos || 0), 0),
    };

    return { ...platforms, all };
  };

  const pullAnalytics = async () => {
    setPullingAnalytics(true);
    try {
      // Pull analytics from all platforms in parallel
      await Promise.allSettled([
        api.pullYouTubeAnalytics().catch(() => null),
        api.pullTikTokAnalytics().catch(() => null),
        api.pullFacebookAnalytics().catch(() => null),
        api.pullInstagramAnalytics().catch(() => null),
      ]);
      await fetchData();
    } catch (err) {
      console.error('Failed to pull analytics:', err);
    } finally {
      setPullingAnalytics(false);
    }
  };

  // Batch system functions
  const fetchBatchQueue = async () => {
    try {
      setBatchLoading(true);
      const data = await api.getBatchQueue();
      setBatchQueue(data);
    } catch (err) {
      console.error('Failed to fetch batch queue:', err);
    } finally {
      setBatchLoading(false);
    }
  };

  const generateBatch = async () => {
    setGeneratingBatch(true);
    try {
      await api.generateBatch('general');
      await fetchBatchQueue();
    } catch (err) {
      console.error('Failed to generate batch:', err);
    } finally {
      setGeneratingBatch(false);
    }
  };

  const processNextVariation = async () => {
    setProcessingNext(true);
    try {
      await api.processNextBatch(true, 'youtube');
      await fetchBatchQueue();
    } catch (err) {
      console.error('Failed to process next:', err);
    } finally {
      setProcessingNext(false);
    }
  };

  const toggleAutoScheduler = async () => {
    try {
      const newEnabled = !batchQueue?.schedule?.enabled;
      await api.updateBatchSchedule({ enabled: newEnabled });
      await fetchBatchQueue();
    } catch (err) {
      console.error('Failed to toggle scheduler:', err);
    }
  };

  const currentStats = platformStats[activePlatform] || { views: 0, likes: 0, videos: 0 };
  const currentPlatform = PLATFORMS.find(p => p.id === activePlatform);

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your content performance</p>
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
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your content performance across all platforms</p>
      </header>

      <div className="page-content">
        {/* Platform Tabs */}
        <div className="platform-tabs">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            const isActive = activePlatform === platform.id;
            const pStats = platformStats[platform.id] || {};

            return (
              <button
                key={platform.id}
                className={`platform-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActivePlatform(platform.id)}
                style={{ '--platform-color': platform.color }}
              >
                <Icon size={18} />
                <span className="platform-tab-name">{platform.name}</span>
                {platform.id !== 'all' && pStats.videos > 0 && (
                  <span className="platform-tab-count">{pStats.videos}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: `${currentPlatform?.color}20`, color: currentPlatform?.color }}>
              <Eye size={20} />
            </div>
            <div className="stat-value">{formatNumber(currentStats.views)}</div>
            <div className="stat-label">Total Views</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><ThumbsUp size={20} /></div>
            <div className="stat-value">{formatNumber(currentStats.likes)}</div>
            <div className="stat-label">Total Likes</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><Video size={20} /></div>
            <div className="stat-value">{currentStats.videos}</div>
            <div className="stat-label">Videos</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><TrendingUp size={20} /></div>
            <div className="stat-value">
              {currentStats.videos > 0 ? formatNumber(Math.round(currentStats.views / currentStats.videos)) : 0}
            </div>
            <div className="stat-label">Avg Views/Video</div>
          </div>
        </div>

        {/* Platform Comparison (only show on "All" tab) */}
        {activePlatform === 'all' && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              <BarChart3 size={20} style={{ marginRight: '8px' }} />
              Platform Comparison
            </h3>
            <div className="platform-comparison">
              {PLATFORMS.filter(p => p.id !== 'all').map((platform) => {
                const Icon = platform.icon;
                const pStats = platformStats[platform.id] || {};
                const totalViews = platformStats.all?.views || 1;
                const percentage = totalViews > 0 ? Math.round((pStats.views / totalViews) * 100) : 0;

                return (
                  <div key={platform.id} className="platform-comparison-item">
                    <div className="platform-comparison-header">
                      <div className="platform-comparison-name">
                        <Icon size={16} style={{ color: platform.color }} />
                        <span>{platform.name}</span>
                      </div>
                      <span className="platform-comparison-views">
                        {formatNumber(pStats.views || 0)} views
                      </span>
                    </div>
                    <div className="platform-comparison-bar">
                      <div
                        className="platform-comparison-fill"
                        style={{
                          width: `${percentage}%`,
                          background: platform.color
                        }}
                      />
                    </div>
                    <div className="platform-comparison-stats">
                      <span>{pStats.videos || 0} videos</span>
                      <span>{formatNumber(pStats.likes || 0)} likes</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                {pullingAnalytics ? 'Updating...' : 'Refresh'}
              </button>
            </div>

            <div className="grid-2">
              {/* Top Hooks */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={14} /> BEST PERFORMING HOOKS
                </p>
                {patterns.hooks?.slice(0, 3).map((hook, i) => (
                  <div key={i} className={`pattern-item ${i === 0 ? 'top' : ''}`}>
                    <div className="pattern-item-name">
                      {i === 0 && <span className="trophy">🏆</span>}
                      <span>{hook.name?.replace(/-/g, ' ')}</span>
                    </div>
                    <div className="pattern-item-stat">
                      <span className="views">{hook.avgViews?.toLocaleString()}</span>
                      <span className="label">avg views</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Structures */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={14} /> BEST STORY STRUCTURES
                </p>
                {patterns.structures?.slice(0, 3).map((structure, i) => (
                  <div key={i} className={`pattern-item ${i === 0 ? 'top' : ''}`}>
                    <div className="pattern-item-name">
                      {i === 0 && <span className="trophy">⭐</span>}
                      <span>{structure.name?.replace(/-/g, ' ')}</span>
                    </div>
                    <div className="pattern-item-stat">
                      <span className="views">{structure.avgViews?.toLocaleString()}</span>
                      <span className="label">avg views</span>
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
              Recent Videos
              {activePlatform !== 'all' && (
                <span style={{ marginLeft: '8px', fontSize: '14px', color: currentPlatform?.color }}>
                  ({currentPlatform?.name})
                </span>
              )}
            </h2>
          </div>
          {videos.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Platform</th>
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
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>{video.title?.substring(0, 40)}...</span>
                          {video.videoId && (
                            <a
                              href={`https://youtube.com/shorts/${video.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}
                            >
                              View <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="platform-badge-small youtube">
                        <Youtube size={12} /> YouTube
                      </span>
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
              <Video size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p>No videos found. Create your first video to see analytics here.</p>
            </div>
          )}
        </div>

        {/* Batch Variation Engine Control Panel */}
        <div className="card batch-control-panel" style={{ marginBottom: '24px' }}>
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h2 className="card-title">
              <Flame size={20} style={{ marginRight: '8px', color: '#f97316' }} />
              Auto-Scaling Engine
            </h2>
            <button
              className={`scheduler-toggle ${batchQueue?.schedule?.enabled ? 'active' : ''}`}
              onClick={toggleAutoScheduler}
            >
              {batchQueue?.schedule?.enabled ? <Pause size={14} /> : <Play size={14} />}
              {batchQueue?.schedule?.enabled ? 'Pause' : 'Start'}
            </button>
          </div>

          {/* Stats Row */}
          <div className="batch-stats-row">
            <div className="batch-stat">
              <div className="batch-stat-value">{batchQueue?.stats?.pending || 0}</div>
              <div className="batch-stat-label">Pending</div>
            </div>
            <div className="batch-stat">
              <div className="batch-stat-value">{batchQueue?.stats?.posted || 0}</div>
              <div className="batch-stat-label">Posted</div>
            </div>
            <div className="batch-stat">
              <div className="batch-stat-value">{batchQueue?.schedule?.postsToday || 0}/{batchQueue?.schedule?.maxPostsPerDay || 8}</div>
              <div className="batch-stat-label">Today</div>
            </div>
            <div className="batch-stat">
              <div className="batch-stat-value">{batchQueue?.schedule?.intervalHours || 3}h</div>
              <div className="batch-stat-label">Interval</div>
            </div>
          </div>

          {/* Tone Distribution */}
          {batchQueue?.toneDistribution && (
            <div className="tone-distribution">
              <div className="tone-bar">
                <div
                  className="tone-segment safe"
                  style={{ width: `${(batchQueue.toneDistribution.safe / (batchQueue.stats?.total || 1)) * 100}%` }}
                  title={`Safe: ${batchQueue.toneDistribution.safe}`}
                />
                <div
                  className="tone-segment edgy"
                  style={{ width: `${(batchQueue.toneDistribution.edgy / (batchQueue.stats?.total || 1)) * 100}%` }}
                  title={`Edgy: ${batchQueue.toneDistribution.edgy}`}
                />
                <div
                  className="tone-segment controversial"
                  style={{ width: `${(batchQueue.toneDistribution.controversial / (batchQueue.stats?.total || 1)) * 100}%` }}
                  title={`Controversial: ${batchQueue.toneDistribution.controversial}`}
                />
              </div>
              <div className="tone-legend">
                <span className="tone-label safe">Safe ({batchQueue.toneDistribution.safe})</span>
                <span className="tone-label edgy">Edgy ({batchQueue.toneDistribution.edgy})</span>
                <span className="tone-label controversial">Controversial ({batchQueue.toneDistribution.controversial})</span>
              </div>
            </div>
          )}

          {/* Next Variation Preview */}
          {batchQueue?.nextVariation && (
            <div className="next-variation">
              <div className="next-variation-header">
                <Clock size={14} /> Next Up
              </div>
              <div className="next-variation-title">
                "{batchQueue.nextVariation.title}"
              </div>
              <div className="next-variation-meta">
                <span className={`tone-badge ${batchQueue.nextVariation.tone}`}>
                  {batchQueue.nextVariation.tone}
                </span>
                <span className="emotion-badge">
                  {batchQueue.nextVariation.emotion}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="batch-actions">
            <button
              className="btn btn-primary"
              onClick={generateBatch}
              disabled={generatingBatch}
            >
              {generatingBatch ? <Loader2 size={16} className="spinning" /> : <Flame size={16} />}
              {generatingBatch ? 'Generating...' : 'Generate 15 Topics'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={processNextVariation}
              disabled={processingNext || !batchQueue?.nextVariation}
            >
              {processingNext ? <Loader2 size={16} className="spinning" /> : <Play size={16} />}
              {processingNext ? 'Processing...' : 'Process Next'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={fetchBatchQueue}
              disabled={batchLoading}
            >
              {batchLoading ? <Loader2 size={16} className="spinning" /> : <RefreshCw size={16} />}
            </button>
          </div>

          {/* Schedule Info */}
          {batchQueue?.schedule?.enabled && (
            <div className="schedule-info">
              <CheckCircle size={14} style={{ color: 'var(--success)' }} />
              <span>
                Auto-posting every {batchQueue.schedule.intervalHours} hours
                {batchQueue.schedule.nextPost && (
                  <> • Next: {new Date(batchQueue.schedule.nextPost).toLocaleTimeString()}</>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid-2" style={{ marginTop: '24px' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/create" className="btn btn-primary">
                <Zap size={16} /> Create Video
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
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Batch Control Panel */
        .batch-control-panel {
          background: linear-gradient(135deg, var(--bg-primary) 0%, rgba(249, 115, 22, 0.05) 100%);
          border: 1px solid rgba(249, 115, 22, 0.2);
        }

        .scheduler-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .scheduler-toggle:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .scheduler-toggle.active {
          background: var(--success);
          border-color: var(--success);
          color: white;
        }

        .batch-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .batch-stat {
          text-align: center;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .batch-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .batch-stat-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .tone-distribution {
          margin-bottom: 20px;
        }

        .tone-bar {
          display: flex;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          background: var(--bg-secondary);
        }

        .tone-segment {
          height: 100%;
          transition: width 0.3s;
        }

        .tone-segment.safe { background: #22c55e; }
        .tone-segment.edgy { background: #f97316; }
        .tone-segment.controversial { background: #ef4444; }

        .tone-legend {
          display: flex;
          gap: 16px;
          margin-top: 8px;
          font-size: 12px;
        }

        .tone-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tone-label::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .tone-label.safe::before { background: #22c55e; }
        .tone-label.edgy::before { background: #f97316; }
        .tone-label.controversial::before { background: #ef4444; }

        .next-variation {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .next-variation-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .next-variation-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .next-variation-meta {
          display: flex;
          gap: 8px;
        }

        .tone-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .tone-badge.safe {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .tone-badge.edgy {
          background: rgba(249, 115, 22, 0.15);
          color: #f97316;
        }

        .tone-badge.controversial {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .emotion-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          background: rgba(139, 92, 246, 0.15);
          color: #8b5cf6;
        }

        .batch-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .schedule-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        /* Platform Tabs */
        .platform-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          padding: 4px;
          background: var(--bg-secondary);
          border-radius: 12px;
          overflow-x: auto;
        }

        .platform-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .platform-tab:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .platform-tab.active {
          background: var(--bg-primary);
          color: var(--platform-color);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .platform-tab-count {
          background: var(--platform-color);
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }

        /* Platform Comparison */
        .platform-comparison {
          display: grid;
          gap: 16px;
        }

        .platform-comparison-item {
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }

        .platform-comparison-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .platform-comparison-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .platform-comparison-views {
          font-weight: 600;
          color: var(--text-secondary);
        }

        .platform-comparison-bar {
          height: 8px;
          background: var(--bg-primary);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .platform-comparison-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .platform-comparison-stats {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* Pattern Items */
        .pattern-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-radius: 10px;
          margin-bottom: 8px;
        }

        .pattern-item.top {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .pattern-item-name {
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: capitalize;
          font-weight: 500;
        }

        .pattern-item-stat {
          text-align: right;
        }

        .pattern-item-stat .views {
          font-weight: 600;
          color: var(--primary);
        }

        .pattern-item-stat .label {
          font-size: 12px;
          color: var(--text-muted);
          margin-left: 4px;
        }

        .trophy {
          font-size: 16px;
        }

        /* Platform Badge Small */
        .platform-badge-small {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .platform-badge-small.youtube {
          background: rgba(255, 0, 0, 0.1);
          color: #ff0000;
        }

        .platform-badge-small.tiktok {
          background: rgba(0, 0, 0, 0.1);
          color: #000;
        }

        .platform-badge-small.facebook {
          background: rgba(24, 119, 242, 0.1);
          color: #1877f2;
        }

        .platform-badge-small.instagram {
          background: rgba(228, 64, 95, 0.1);
          color: #e4405f;
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
