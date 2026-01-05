import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Eye, ThumbsUp, MessageCircle, Share2, Clock,
  Youtube, Facebook, Instagram, Layers, BarChart3, PieChart, Activity,
  ArrowUp, ArrowDown, Minus, RefreshCw, Zap, Target, AlertTriangle, Award,
  Globe, Timer, PlayCircle
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart as RechartsPie, Pie, Cell
} from 'recharts';
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

const PIE_COLORS = ['#FF0000', '#00F2EA', '#1877F2', '#E4405F'];

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [youtubeData, setYoutubeData] = useState(null);
  const [facebookData, setFacebookData] = useState(null);
  const [tiktokData, setTiktokData] = useState(null);
  const [instagramData, setInstagramData] = useState(null);
  const [viralIntelligence, setViralIntelligence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [previousStats, setPreviousStats] = useState(null);
  const [crossPlatformData, setCrossPlatformData] = useState(null);
  const [retentionData, setRetentionData] = useState(null);

  useEffect(() => {
    fetchAllAnalytics();
  }, []);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      // Store previous stats for growth calculation
      const currentStats = getStats();
      if (currentStats && currentStats.views > 0) {
        setPreviousStats(currentStats);
      }

      // Fetch all platform analytics AND Viral Intelligence in parallel
      const [youtubeRes, facebookRes, tiktokRes, instagramRes, viralRes, crossPlatformRes, retentionRes] = await Promise.allSettled([
        api.pullYouTubeAnalytics(),
        api.pullFacebookAnalytics(),
        api.pullTikTokAnalytics(),
        api.pullInstagramAnalytics(),
        api.getViralIntelligence(),
        api.getCrossPlatformSummary(),
        api.getRetentionSummary()
      ]);

      if (youtubeRes.status === 'fulfilled') {
        setYoutubeData(youtubeRes.value);
      }

      if (facebookRes.status === 'fulfilled') {
        setFacebookData(facebookRes.value);
      }

      if (tiktokRes.status === 'fulfilled') {
        setTiktokData(tiktokRes.value);
      }

      if (instagramRes.status === 'fulfilled') {
        setInstagramData(instagramRes.value);
      }

      if (viralRes.status === 'fulfilled') {
        setViralIntelligence(viralRes.value);
      }

      if (crossPlatformRes.status === 'fulfilled') {
        setCrossPlatformData(crossPlatformRes.value);
      }

      if (retentionRes.status === 'fulfilled') {
        setRetentionData(retentionRes.value);
      }

      // Also fetch general analytics
      const generalData = await api.getAnalytics();
      setAnalytics(generalData);

      // Update last fetched timestamp
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAllAnalytics();
    } catch (err) {
      console.error('Failed to refresh analytics:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Helper to calculate growth percentage
  const calculateGrowth = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Helper to determine data freshness
  const getDataFreshness = (timestamp) => {
    if (!timestamp) return { label: 'Unknown', color: 'var(--text-muted)' };

    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 5) {
      return { label: 'Just now', color: 'var(--success)' };
    } else if (minutes < 30) {
      return { label: `${minutes}m ago`, color: 'var(--success)' };
    } else if (hours < 1) {
      return { label: `${minutes}m ago`, color: 'var(--primary)' };
    } else if (hours < 24) {
      return { label: `${hours}h ago`, color: 'var(--warning)' };
    } else {
      const days = Math.floor(hours / 24);
      return { label: `${days}d ago`, color: 'var(--error)' };
    }
  };

  // Calculate stats based on selected platform - using REAL data
  // API Data Availability:
  // - YouTube: views, likes, comments, watchTime, avgViewDuration, avgViewPercentage, subscribersGained (2-3 day delay)
  // - TikTok: views, likes, comments, shares (limited in sandbox, full analytics need production app)
  // - Facebook: reactions, comments, shares (views often return 0 for Reels - use weighted engagement)
  // - Instagram: plays, likes, comments, saves, shares (reach/profileVisits require Business account)
  const getStats = () => {
    // YouTube stats - Focus on watch time & completion (MINIMAX strategy)
    // API provides: views, likes, comments, watchTime, avgViewDuration, avgViewPercentage, subscribersGained
    // Note: Data has 2-3 day delay
    if (selectedPlatform === 'youtube' && youtubeData) {
      const videos = youtubeData.videos || [];
      const totalViews = videos.reduce((sum, v) => sum + (v.stats?.views || 0), 0);
      const totalLikes = videos.reduce((sum, v) => sum + (v.stats?.likes || 0), 0);
      const totalComments = videos.reduce((sum, v) => sum + (v.stats?.comments || 0), 0);

      // Calculate average completion rate from video analytics
      const videosWithAnalytics = videos.filter(v => v.analytics?.avgViewPercentage);
      const avgCompletionRate = videosWithAnalytics.length > 0
        ? Math.round(videosWithAnalytics.reduce((sum, v) => sum + (v.analytics?.avgViewPercentage || 0), 0) / videosWithAnalytics.length)
        : null; // null = not available yet (needs 2-3 days)

      return {
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        shares: null, // YouTube API doesn't expose shares
        sharesNote: 'Not available via API',
        watchTime: youtubeData.summary?.avgWatchTime || null,
        completionRate: avgCompletionRate,
        videos: videos.length,
        dataDelay: '2-3 days',
        growth: {
          views: calculateGrowth(totalViews, previousStats?.views),
          likes: calculateGrowth(totalLikes, previousStats?.likes)
        },
        avgScore: youtubeData.averageScore || 0,
        viralCount: youtubeData.viralCount || 0,
        goodCount: youtubeData.goodCount || 0
      };
    }

    // TikTok stats - EXPECTED VALUE strategy (viral lottery)
    // API provides: views, likes, comments, shares
    // Note: Full analytics require approved production app (sandbox is limited)
    if (selectedPlatform === 'tiktok' && tiktokData) {
      const videos = tiktokData.videos || [];
      const totalViews = videos.reduce((sum, v) => sum + (v.stats?.views || v.views || 0), 0);
      const totalLikes = videos.reduce((sum, v) => sum + (v.stats?.likes || v.likes || 0), 0);
      const totalComments = videos.reduce((sum, v) => sum + (v.stats?.comments || v.comments || 0), 0);
      const totalShares = videos.reduce((sum, v) => sum + (v.stats?.shares || v.shares || 0), 0);

      return {
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        watchTime: null, // TikTok API doesn't provide watch time
        watchTimeNote: 'Not available via API',
        videos: videos.length,
        limitedApi: true,
        apiNote: 'Full analytics require production app approval',
        growth: {
          views: calculateGrowth(totalViews, previousStats?.views),
          likes: calculateGrowth(totalLikes, previousStats?.likes)
        },
        viralRate: tiktokData.viralRate || 0,
        avgScore: tiktokData.averageScore || 0,
        viralCount: tiktokData.viralCount || 0,
        goodCount: tiktokData.goodCount || 0
      };
    }

    // Facebook stats - REPEATED GAME strategy (consistency/trust)
    // API provides: reactions, comments, shares
    // Note: Views often return 0 for Reels - use weighted engagement instead
    if (selectedPlatform === 'facebook' && facebookData) {
      const videos = facebookData.videos || [];
      const totalReactions = videos.reduce((sum, v) => sum + (v.reactions || 0), 0);
      const totalComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);
      const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);
      const totalEngagement = videos.reduce((sum, v) => sum + (v.analysis?.metrics?.weightedEngagement || 0), 0);

      return {
        views: null, // Facebook often returns 0 for Reel views
        viewsNote: 'Views unavailable for Reels',
        weightedEngagement: totalEngagement, // Alternative metric
        likes: totalReactions,
        likesLabel: 'Reactions', // Facebook uses reactions not likes
        comments: totalComments,
        shares: totalShares,
        watchTime: null,
        watchTimeNote: 'Not available via API',
        videos: videos.length,
        viewsUnreliable: true,
        growth: {
          views: calculateGrowth(totalEngagement, previousStats?.views),
          likes: calculateGrowth(totalReactions, previousStats?.likes)
        },
        trustScore: facebookData.trustScore || 0,
        avgScore: facebookData.averageScore || 0,
        viralCount: facebookData.viralCount || 0,
        goodCount: facebookData.goodCount || 0
      };
    }

    // Instagram stats - NASH EQUILIBRIUM strategy (balance follower/reach content)
    // API provides: plays, likes, comments, saves, shares
    // Note: reach, profileVisits require Instagram Business/Creator account
    if (selectedPlatform === 'instagram' && instagramData) {
      const videos = instagramData.videos || [];
      const totalViews = videos.reduce((sum, v) => sum + (v.stats?.plays || v.plays || v.views || 0), 0);
      const totalLikes = videos.reduce((sum, v) => sum + (v.stats?.likes || v.likes || 0), 0);
      const totalComments = videos.reduce((sum, v) => sum + (v.stats?.comments || v.comments || 0), 0);
      const totalSaves = videos.reduce((sum, v) => sum + (v.stats?.saves || v.saves || 0), 0);
      const totalShares = videos.reduce((sum, v) => sum + (v.stats?.shares || v.shares || 0), 0);

      // These require Business account - check if data exists
      const hasBusinessInsights = videos.some(v => v.stats?.profileVisits !== undefined || v.profileVisits !== undefined);
      const totalProfileVisits = hasBusinessInsights
        ? videos.reduce((sum, v) => sum + (v.stats?.profileVisits || v.profileVisits || 0), 0)
        : null;
      const totalFollowerReach = hasBusinessInsights
        ? videos.reduce((sum, v) => sum + (v.stats?.followerReach || v.followerReach || 0), 0)
        : null;
      const totalNonFollowerReach = hasBusinessInsights
        ? videos.reduce((sum, v) => sum + (v.stats?.nonFollowerReach || v.nonFollowerReach || 0), 0)
        : null;

      // Calculate rates (only if views > 0)
      const saveRate = totalViews > 0 ? ((totalSaves / totalViews) * 100).toFixed(1) : null;
      const shareRate = totalViews > 0 ? ((totalShares / totalViews) * 100).toFixed(1) : null;

      // Follower ratio only if we have Business insights
      const totalReach = (totalFollowerReach || 0) + (totalNonFollowerReach || 0);
      const followerRatio = totalReach > 0 ? Math.round((totalFollowerReach / totalReach) * 100) : null;

      return {
        views: totalViews,
        viewsLabel: 'Plays', // Instagram calls them plays
        likes: totalLikes,
        comments: totalComments,
        saves: totalSaves,
        shares: totalShares,
        profileVisits: totalProfileVisits,
        profileVisitsNote: !hasBusinessInsights ? 'Requires Business account' : null,
        saveRate,
        shareRate,
        followerRatio,
        followerRatioNote: !hasBusinessInsights ? 'Requires Business account' : null,
        followerReach: totalFollowerReach,
        nonFollowerReach: totalNonFollowerReach,
        videos: videos.length,
        requiresBusinessAccount: !hasBusinessInsights,
        growth: {
          views: calculateGrowth(totalViews, previousStats?.views),
          likes: calculateGrowth(totalLikes, previousStats?.likes)
        },
        avgScore: instagramData.averageScore || 0,
        viralCount: instagramData.viralCount || 0,
        goodCount: instagramData.goodCount || 0
      };
    }

    // All platforms combined
    if (selectedPlatform === 'all') {
      const ytVideos = youtubeData?.videos || [];
      const fbVideos = facebookData?.videos || [];
      const ttVideos = tiktokData?.videos || [];
      const igVideos = instagramData?.videos || [];

      const ytViews = ytVideos.reduce((sum, v) => sum + (v.stats?.views || 0), 0);
      const ytLikes = ytVideos.reduce((sum, v) => sum + (v.stats?.likes || 0), 0);
      const ytComments = ytVideos.reduce((sum, v) => sum + (v.stats?.comments || 0), 0);

      const fbReactions = fbVideos.reduce((sum, v) => sum + (v.reactions || 0), 0);
      const fbComments = fbVideos.reduce((sum, v) => sum + (v.comments || 0), 0);
      const fbShares = fbVideos.reduce((sum, v) => sum + (v.shares || 0), 0);

      const ttViews = ttVideos.reduce((sum, v) => sum + (v.stats?.views || v.views || 0), 0);
      const ttLikes = ttVideos.reduce((sum, v) => sum + (v.stats?.likes || v.likes || 0), 0);
      const ttComments = ttVideos.reduce((sum, v) => sum + (v.stats?.comments || v.comments || 0), 0);
      const ttShares = ttVideos.reduce((sum, v) => sum + (v.stats?.shares || v.shares || 0), 0);

      const igViews = igVideos.reduce((sum, v) => sum + (v.stats?.plays || v.plays || v.views || 0), 0);
      const igLikes = igVideos.reduce((sum, v) => sum + (v.stats?.likes || v.likes || 0), 0);
      const igComments = igVideos.reduce((sum, v) => sum + (v.stats?.comments || v.comments || 0), 0);
      const igShares = igVideos.reduce((sum, v) => sum + (v.stats?.shares || v.shares || 0), 0);

      const totalViews = ytViews + ttViews + igViews;
      const totalLikes = ytLikes + fbReactions + ttLikes + igLikes;

      return {
        views: totalViews,
        likes: totalLikes,
        comments: ytComments + fbComments + ttComments + igComments,
        shares: fbShares + ttShares + igShares,
        watchTime: youtubeData?.summary?.avgWatchTime || '0:00',
        videos: ytVideos.length + fbVideos.length + ttVideos.length + igVideos.length,
        growth: {
          views: calculateGrowth(totalViews, previousStats?.views),
          likes: calculateGrowth(totalLikes, previousStats?.likes)
        }
      };
    }

    return { views: 0, likes: 0, comments: 0, shares: 0, watchTime: '0:00', videos: 0, growth: { views: 0, likes: 0 } };
  };

  const stats = getStats();

  // Generate chart data
  const chartData = generateChartData(analytics?.videos || [], timeRange, selectedPlatform);

  // Platform distribution data for pie chart - CALCULATED FROM REAL DATA
  const getPlatformDistribution = () => {
    const ytVideos = youtubeData?.videos || [];
    const fbVideos = facebookData?.videos || [];
    const ttVideos = tiktokData?.videos || [];
    const igVideos = instagramData?.videos || [];

    const ytViews = ytVideos.reduce((sum, v) => sum + (v.stats?.views || 0), 0);
    const ttViews = ttVideos.reduce((sum, v) => sum + (v.stats?.views || v.views || 0), 0);
    // Facebook uses weighted engagement since views aren't available
    const fbEngagement = fbVideos.reduce((sum, v) => sum + (v.analysis?.metrics?.weightedEngagement || 0), 0);
    const igViews = igVideos.reduce((sum, v) => sum + (v.stats?.plays || v.plays || v.views || 0), 0);

    const total = ytViews + ttViews + fbEngagement + igViews;

    if (total === 0) {
      // If no data, show placeholder based on video counts
      const totalVideos = ytVideos.length + fbVideos.length + ttVideos.length + igVideos.length;
      if (totalVideos === 0) {
        return [
          { name: 'YouTube', value: 0, color: '#FF0000' },
          { name: 'TikTok', value: 0, color: '#00F2EA' },
          { name: 'Facebook', value: 0, color: '#1877F2' },
          { name: 'Instagram', value: 0, color: '#E4405F' },
        ];
      }
      return [
        { name: 'YouTube', value: Math.round((ytVideos.length / totalVideos) * 100), color: '#FF0000' },
        { name: 'TikTok', value: Math.round((ttVideos.length / totalVideos) * 100), color: '#00F2EA' },
        { name: 'Facebook', value: Math.round((fbVideos.length / totalVideos) * 100), color: '#1877F2' },
        { name: 'Instagram', value: Math.round((igVideos.length / totalVideos) * 100), color: '#E4405F' },
      ];
    }

    return [
      { name: 'YouTube', value: Math.round((ytViews / total) * 100), color: '#FF0000' },
      { name: 'TikTok', value: Math.round((ttViews / total) * 100), color: '#00F2EA' },
      { name: 'Facebook', value: Math.round((fbEngagement / total) * 100), color: '#1877F2' },
      { name: 'Instagram', value: Math.round((igViews / total) * 100), color: '#E4405F' },
    ];
  };

  const platformDistribution = getPlatformDistribution();

  // Get filtered videos based on platform - using REAL data
  const getFilteredVideos = () => {
    if (selectedPlatform === 'youtube') {
      return (youtubeData?.videos || []).map(v => ({
        ...v,
        platform: 'youtube',
        title: v.title,
        stats: v.stats
      }));
    }

    if (selectedPlatform === 'tiktok') {
      return (tiktokData?.videos || []).map(v => ({
        ...v,
        platform: 'tiktok',
        title: v.caption || v.title || 'Untitled',
        stats: {
          views: v.stats?.views || v.views || 0,
          likes: v.stats?.likes || v.likes || 0,
          comments: v.stats?.comments || v.comments || 0,
          shares: v.stats?.shares || v.shares || 0
        },
        analysis: v.analysis
      }));
    }

    if (selectedPlatform === 'facebook') {
      return (facebookData?.videos || []).map(v => ({
        ...v,
        platform: 'facebook',
        title: v.title || v.description?.slice(0, 50) || 'Untitled',
        stats: {
          views: v.analysis?.metrics?.weightedEngagement || 0,
          likes: v.reactions || 0,
          comments: v.comments || 0,
          shares: v.shares || 0
        },
        analysis: v.analysis
      }));
    }

    if (selectedPlatform === 'instagram') {
      return (instagramData?.videos || []).map(v => ({
        ...v,
        platform: 'instagram',
        title: v.caption || v.title || 'Untitled',
        stats: {
          views: v.stats?.plays || v.plays || v.views || 0,
          likes: v.stats?.likes || v.likes || 0,
          comments: v.stats?.comments || v.comments || 0,
          saves: v.stats?.saves || v.saves || 0,
          shares: v.stats?.shares || v.shares || 0
        },
        analysis: v.analysis
      }));
    }

    // All platforms
    const ytVideos = (youtubeData?.videos || []).map(v => ({ ...v, platform: 'youtube' }));
    const ttVideos = (tiktokData?.videos || []).map(v => ({
      ...v,
      platform: 'tiktok',
      title: v.caption || v.title || 'Untitled',
      stats: {
        views: v.stats?.views || v.views || 0,
        likes: v.stats?.likes || v.likes || 0,
        comments: v.stats?.comments || v.comments || 0,
        shares: v.stats?.shares || v.shares || 0
      }
    }));
    const fbVideos = (facebookData?.videos || []).map(v => ({
      ...v,
      platform: 'facebook',
      title: v.title || v.description?.slice(0, 50) || 'Untitled',
      stats: {
        views: v.analysis?.metrics?.weightedEngagement || 0,
        likes: v.reactions || 0,
        comments: v.comments || 0
      }
    }));
    const igVideos = (instagramData?.videos || []).map(v => ({
      ...v,
      platform: 'instagram',
      title: v.caption || v.title || 'Untitled',
      stats: {
        views: v.stats?.plays || v.plays || v.views || 0,
        likes: v.stats?.likes || v.likes || 0,
        comments: v.stats?.comments || v.comments || 0,
        saves: v.stats?.saves || v.saves || 0,
        shares: v.stats?.shares || v.shares || 0
      }
    }));

    return [...ytVideos, ...ttVideos, ...fbVideos, ...igVideos];
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Track your content performance</p>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Track performance across all platforms</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* Platform Tabs */}
        <div className="platform-tabs" style={{ marginBottom: '24px' }}>
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            return (
              <button
                key={platform.id}
                className={`platform-tab ${selectedPlatform === platform.id ? 'active' : ''}`}
                onClick={() => setSelectedPlatform(platform.id)}
                style={{
                  '--platform-color': platform.color
                }}
              >
                <Icon size={18} />
                <span>{platform.name}</span>
              </button>
            );
          })}
        </div>

        {/* Time Range Selector */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['7d', '30d', '90d', 'all'].map((range) => (
                <button
                  key={range}
                  className={`btn btn-sm ${timeRange === range ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTimeRange(range)}
                >
                  {range === '7d' ? '7 Days' :
                   range === '30d' ? '30 Days' :
                   range === '90d' ? '90 Days' : 'All Time'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} />
              Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Never'}
              {lastUpdated && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: getDataFreshness(lastUpdated).color + '20',
                  color: getDataFreshness(lastUpdated).color
                }}>
                  {getDataFreshness(lastUpdated).label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary Stats - Platform Specific */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          {/* YOUTUBE: Views, Likes, Watch Time, Completion Rate */}
          {selectedPlatform === 'youtube' && (
            <>
              <div className="stat-card">
                <div className="stat-icon purple"><Eye size={20} /></div>
                <div className="stat-value">{formatNumber(stats.views)}</div>
                <div className="stat-label">Total Views</div>
                <GrowthIndicator value={stats.growth?.views || 0} />
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><ThumbsUp size={20} /></div>
                <div className="stat-value">{formatNumber(stats.likes)}</div>
                <div className="stat-label">Likes</div>
                <GrowthIndicator value={stats.growth?.likes || 0} />
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Clock size={20} /></div>
                <div className="stat-value">{stats.watchTime || 'N/A'}</div>
                <div className="stat-label">Avg Watch Time</div>
                <div className="stat-hint">{stats.dataDelay ? `Data delayed ${stats.dataDelay}` : 'Key metric for YouTube'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><Activity size={20} /></div>
                <div className="stat-value">{stats.completionRate !== null ? `${stats.completionRate}%` : 'N/A'}</div>
                <div className="stat-label">Completion Rate</div>
                <div className="stat-hint">{stats.completionRate === null ? 'Needs 2-3 days' : '% of video watched'}</div>
              </div>
            </>
          )}

          {/* TIKTOK: Views, Likes, Shares, Viral Rate */}
          {selectedPlatform === 'tiktok' && (
            <>
              <div className="stat-card">
                <div className="stat-icon purple"><Eye size={20} /></div>
                <div className="stat-value">{formatNumber(stats.views)}</div>
                <div className="stat-label">Total Views</div>
                <GrowthIndicator value={stats.growth?.views || 0} />
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><ThumbsUp size={20} /></div>
                <div className="stat-value">{formatNumber(stats.likes)}</div>
                <div className="stat-label">Likes</div>
                <GrowthIndicator value={stats.growth?.likes || 0} />
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Share2 size={20} /></div>
                <div className="stat-value">{formatNumber(stats.shares || 0)}</div>
                <div className="stat-label">Shares</div>
                <div className="stat-hint">Key metric for TikTok</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><TrendingUp size={20} /></div>
                <div className="stat-value">{stats.viralRate || 0}%</div>
                <div className="stat-label">Viral Rate</div>
                <div className="stat-hint">{stats.limitedApi ? 'Limited in sandbox' : '% videos going viral'}</div>
              </div>
            </>
          )}

          {/* FACEBOOK: Weighted Engagement, Reactions, Shares, Trust Score */}
          {/* Note: Views unavailable for Reels, using weighted engagement instead */}
          {selectedPlatform === 'facebook' && (
            <>
              <div className="stat-card">
                <div className="stat-icon purple"><BarChart3 size={20} /></div>
                <div className="stat-value">{formatNumber(stats.weightedEngagement || 0)}</div>
                <div className="stat-label">Weighted Engagement</div>
                <div className="stat-hint">Shares×5 + Comments×3 + Reactions</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><ThumbsUp size={20} /></div>
                <div className="stat-value">{formatNumber(stats.likes)}</div>
                <div className="stat-label">{stats.likesLabel || 'Reactions'}</div>
                <GrowthIndicator value={stats.growth?.likes || 0} />
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Share2 size={20} /></div>
                <div className="stat-value">{formatNumber(stats.shares || 0)}</div>
                <div className="stat-label">Shares</div>
                <div className="stat-hint">Key metric for Facebook</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><Activity size={20} /></div>
                <div className="stat-value">{stats.trustScore || 0}</div>
                <div className="stat-label">Trust Score</div>
                <div className="stat-hint">Algorithm trust (0-100)</div>
              </div>
            </>
          )}

          {/* INSTAGRAM: Nash Equilibrium Strategy - Balance follower/reach content */}
          {/* Basic metrics always available; reach/profileVisits require Business account */}
          {selectedPlatform === 'instagram' && (
            <>
              <div className="stat-card">
                <div className="stat-icon purple"><PlayCircle size={20} /></div>
                <div className="stat-value">{formatNumber(stats.views || 0)}</div>
                <div className="stat-label">{stats.viewsLabel || 'Plays'}</div>
                <div className="stat-hint">
                  {stats.growth?.views > 0 ? (
                    <span className="growth-positive"><ArrowUp size={12} /> {stats.growth.views}%</span>
                  ) : stats.growth?.views < 0 ? (
                    <span className="growth-negative"><ArrowDown size={12} /> {Math.abs(stats.growth.views)}%</span>
                  ) : 'Reel views'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><ThumbsUp size={20} /></div>
                <div className="stat-value">{formatNumber(stats.likes || 0)}</div>
                <div className="stat-label">Likes</div>
                <div className="stat-hint">
                  {stats.growth?.likes > 0 ? (
                    <span className="growth-positive"><ArrowUp size={12} /> {stats.growth.likes}%</span>
                  ) : stats.growth?.likes < 0 ? (
                    <span className="growth-negative"><ArrowDown size={12} /> {Math.abs(stats.growth.likes)}%</span>
                  ) : 'Total likes'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Award size={20} /></div>
                <div className="stat-value">{formatNumber(stats.saves || 0)}</div>
                <div className="stat-label">Saves</div>
                <div className="stat-hint">
                  {stats.saveRate ? `${stats.saveRate}% save rate` : 'Key metric for reach'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><Share2 size={20} /></div>
                <div className="stat-value">{formatNumber(stats.shares || 0)}</div>
                <div className="stat-label">Shares</div>
                <div className="stat-hint">
                  {stats.shareRate ? `${stats.shareRate}% share rate` : 'Viral indicator'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon cyan"><Globe size={20} /></div>
                <div className="stat-value">{stats.followerRatio !== null ? `${stats.followerRatio}%` : 'N/A'}</div>
                <div className="stat-label">Follower Reach</div>
                <div className="stat-hint">{stats.followerRatioNote || 'Target: 70% follower / 30% explore'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon yellow"><Target size={20} /></div>
                <div className="stat-value">{stats.profileVisits !== null ? formatNumber(stats.profileVisits) : 'N/A'}</div>
                <div className="stat-label">Profile Visits</div>
                <div className="stat-hint">{stats.profileVisitsNote || 'Conversion to profile'}</div>
              </div>
            </>
          )}

          {/* ALL PLATFORMS: Combined overview */}
          {selectedPlatform === 'all' && (
            <>
              <div className="stat-card">
                <div className="stat-icon purple"><Eye size={20} /></div>
                <div className="stat-value">{formatNumber(stats.views)}</div>
                <div className="stat-label">Total Views</div>
                <div className="stat-hint">YouTube + TikTok</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><ThumbsUp size={20} /></div>
                <div className="stat-value">{formatNumber(stats.likes)}</div>
                <div className="stat-label">Total Engagement</div>
                <div className="stat-hint">Likes + Reactions</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><MessageCircle size={20} /></div>
                <div className="stat-value">{formatNumber(stats.comments)}</div>
                <div className="stat-label">Comments</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><Layers size={20} /></div>
                <div className="stat-value">{stats.videos}</div>
                <div className="stat-label">Total Videos</div>
                <div className="stat-hint">Across all platforms</div>
              </div>
            </>
          )}
        </div>

        {/* YouTube Analytics Insights */}
        {selectedPlatform === 'youtube' && youtubeData && (
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(255,0,0,0.05) 0%, transparent 100%)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Youtube size={20} style={{ color: '#FF0000' }} />
              YouTube Analytics
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                MINIMAX Strategy
              </span>
            </h3>

            {/* Strategy explanation */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,0,0,0.05)', borderRadius: '8px', borderLeft: '3px solid #FF0000' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>YouTube Algorithm Focus</div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong>Watch Time</strong> and <strong>Completion Rate</strong> are the key metrics.
                YouTube rewards videos that keep viewers watching longer and through to the end.
              </div>
            </div>

            {/* Key YouTube Metrics */}
            <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <Clock size={24} style={{ color: '#FF0000', marginBottom: '8px' }} />
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{youtubeData.summary?.avgWatchTime || '0:00'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Watch Time</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Primary ranking factor</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <Activity size={24} style={{ color: '#FF0000', marginBottom: '8px' }} />
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{youtubeData.summary?.avgCompletionRate || stats.completionRate || 0}%</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completion Rate</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>% of video watched</div>
              </div>
            </div>

            <div className="grid-4" style={{ gap: '16px' }}>
              <div className="insight-box">
                <div className="insight-value">{youtubeData.totalVideos || 0}</div>
                <div className="insight-label">Videos Analyzed</div>
              </div>
              <div className="insight-box">
                <div className="insight-value" style={{ color: 'var(--success)' }}>{youtubeData.viralCount || 0}</div>
                <div className="insight-label">Viral (1K+ views)</div>
              </div>
              <div className="insight-box">
                <div className="insight-value" style={{ color: 'var(--primary)' }}>{youtubeData.goodCount || 0}</div>
                <div className="insight-label">Good (500+ views)</div>
              </div>
              <div className="insight-box">
                <div className="insight-value">{(youtubeData.averageScore || 0).toFixed(1)}</div>
                <div className="insight-label">Avg Score (-2 to +2)</div>
              </div>
            </div>

            {/* Performance Progress */}
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Performance Level</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {(youtubeData.averageScore || 0) < -0.5 ? 'Needs Work' : (youtubeData.averageScore || 0) < 0.5 ? 'Average' : (youtubeData.averageScore || 0) < 1.5 ? 'Good' : 'Excellent'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, Math.min(100, ((youtubeData.averageScore || 0) + 2) / 4 * 100))}%`,
                  height: '100%',
                  background: (youtubeData.averageScore || 0) < -0.5 ? 'var(--error)' : (youtubeData.averageScore || 0) < 0.5 ? 'var(--warning)' : (youtubeData.averageScore || 0) < 1.5 ? 'var(--primary)' : 'var(--success)',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>

            {/* What YouTube DOESN'T provide */}
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong>Note:</strong> YouTube API doesn't provide share counts. Analytics data has a 2-3 day delay for watch time metrics.
            </div>
          </div>
        )}

        {/* VIRAL INTELLIGENCE SECTION */}
        {selectedPlatform === 'youtube' && viralIntelligence && (
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(236,72,153,0.05) 100%)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} style={{ color: '#8B5CF6' }} />
              Viral Intelligence
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                AI-Powered Analysis
              </span>
            </h3>

            {/* Strategy explanation */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(139,92,246,0.1)', borderRadius: '8px', borderLeft: '3px solid #8B5CF6' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Smart Content Strategy</div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong>Velocity</strong> (views/hour), <strong>Outlier Detection</strong> (3x+ above avg), and <strong>Pattern Cloning</strong> from winners.
                Auto-kills failing patterns after 5 attempts with 0 winners.
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid-4" style={{ gap: '16px', marginBottom: '16px' }}>
              <div className="insight-box" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <div className="insight-value">{viralIntelligence.avgViews || 0}</div>
                <div className="insight-label">Avg Views</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <div className="insight-value" style={{ color: 'var(--success)' }}>{viralIntelligence.outlierCount || 0}</div>
                <div className="insight-label">Outliers (3x+)</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(236,72,153,0.1)' }}>
                <div className="insight-value" style={{ color: '#EC4899' }}>{viralIntelligence.winningPatterns?.length || 0}</div>
                <div className="insight-label">Winning Patterns</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <div className="insight-value" style={{ color: '#3B82F6' }}>{viralIntelligence.totalVideos || 0}</div>
                <div className="insight-label">Videos Analyzed</div>
              </div>
            </div>

            {/* Recommended Pattern */}
            {viralIntelligence.recommendation && (
              <div style={{ marginBottom: '16px', padding: '16px', background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Target size={18} style={{ color: 'var(--success)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>Recommended Pattern</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.2)', borderRadius: '20px', fontSize: '13px', fontWeight: 500 }}>
                    Hook: {viralIntelligence.recommendation.hookType}
                  </span>
                  <span style={{ padding: '6px 12px', background: 'rgba(236,72,153,0.2)', borderRadius: '20px', fontSize: '13px', fontWeight: 500 }}>
                    Emotion: {viralIntelligence.recommendation.emotion}
                  </span>
                  <span style={{ padding: '6px 12px', background: 'rgba(59,130,246,0.2)', borderRadius: '20px', fontSize: '13px', fontWeight: 500 }}>
                    Structure: {viralIntelligence.recommendation.structure}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {viralIntelligence.recommendation.reason}
                </div>
              </div>
            )}

            {/* Outlier Videos */}
            {viralIntelligence.outliers && viralIntelligence.outliers.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Award size={18} style={{ color: '#F59E0B' }} />
                  <span style={{ fontWeight: 600 }}>Top Outliers (3x+ above average)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viralIntelligence.outliers.slice(0, 5).map((video, idx) => (
                    <div key={video.videoId || idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px'
                    }}>
                      <span style={{
                        width: '28px',
                        height: '28px',
                        background: idx === 0 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'var(--bg-primary)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: idx === 0 ? 'white' : 'var(--text-primary)'
                      }}>
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {video.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '4px' }}>
                          <span>{video.pattern?.hookType}</span>
                          <span>{video.pattern?.emotion}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{formatNumber(video.stats?.views || 0)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>views</div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        background: video.viral?.label === 'VIRAL' ? 'rgba(239,68,68,0.2)' : video.viral?.label === 'HOT' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                        color: video.viral?.label === 'VIRAL' ? '#EF4444' : video.viral?.label === 'HOT' ? '#F59E0B' : 'var(--success)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {video.viral?.label} ({video.viral?.viralScore})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Winning Patterns */}
            {viralIntelligence.winningPatterns && viralIntelligence.winningPatterns.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <TrendingUp size={18} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontWeight: 600 }}>Winning Patterns</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {viralIntelligence.winningPatterns.slice(0, 4).map((pattern, idx) => (
                    <div key={pattern.key || idx} style={{
                      flex: '1 1 calc(50% - 6px)',
                      minWidth: '200px',
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${idx === 0 ? '#8B5CF6' : idx === 1 ? '#EC4899' : idx === 2 ? '#3B82F6' : '#10B981'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{pattern.hookType} + {pattern.emotion}</span>
                        <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>{pattern.avgViralScore} score</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {pattern.count} video{pattern.count !== 1 ? 's' : ''} &bull; {formatNumber(pattern.totalViews)} total views
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Facebook Insights */}
        {selectedPlatform === 'facebook' && facebookData && (
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(24,119,242,0.05) 0%, transparent 100%)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Facebook size={20} style={{ color: '#1877F2' }} />
              Facebook Analytics
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Repeated Game Strategy
              </span>
            </h3>

            {/* Strategy explanation */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(24,119,242,0.05)', borderRadius: '8px', borderLeft: '3px solid #1877F2' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Facebook Algorithm Focus</div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong>Shares</strong> and <strong>Trust Score</strong> are the key metrics.
                Facebook rewards consistent posters and content that gets shared (endorsements).
              </div>
            </div>

            <div className="grid-4" style={{ gap: '16px' }}>
              <div className="insight-box">
                <div className="insight-value">{facebookData.totalVideos || 0}</div>
                <div className="insight-label">Posts Analyzed</div>
              </div>
              <div className="insight-box">
                <div className="insight-value" style={{ color: '#1877F2' }}>{facebookData.trustScore || 0}</div>
                <div className="insight-label">Trust Score (0-100)</div>
              </div>
              <div className="insight-box">
                <div className="insight-value" style={{ color: 'var(--success)' }}>{facebookData.viralCount || 0}</div>
                <div className="insight-label">Viral (500+ views)</div>
              </div>
              <div className="insight-box">
                <div className="insight-value" style={{ color: 'var(--primary)' }}>{facebookData.goodCount || 0}</div>
                <div className="insight-label">Good (200+ views)</div>
              </div>
            </div>

            {/* Trust Score Progress */}
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Trust Level</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {facebookData.trustScore < 30 ? 'Building' : facebookData.trustScore < 60 ? 'Growing' : 'Established'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${facebookData.trustScore || 0}%`,
                  height: '100%',
                  background: facebookData.trustScore < 30 ? 'var(--warning)' : facebookData.trustScore < 60 ? 'var(--primary)' : 'var(--success)',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {facebookData.trustScore < 30 ? (
                  'Keep posting consistently to build algorithm trust'
                ) : facebookData.trustScore < 60 ? (
                  'Good progress! Maintain posting frequency'
                ) : (
                  'Algorithm is boosting your content!'
                )}
              </div>
            </div>

            {/* What Facebook DOESN'T provide */}
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong>Note:</strong> Facebook API doesn't return view counts for Reels. Using <strong>Weighted Engagement</strong> (Shares×5 + Comments×3 + Reactions×1) instead.
            </div>
          </div>
        )}

        {/* TikTok Insights */}
        {selectedPlatform === 'tiktok' && (
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(0,242,234,0.05) 0%, transparent 100%)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TikTokIcon size={20} />
              <span style={{ color: '#00F2EA' }}>TikTok Analytics</span>
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Expected Value Strategy
              </span>
            </h3>

            {/* Strategy explanation */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,242,234,0.05)', borderRadius: '8px', borderLeft: '3px solid #00F2EA' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>TikTok Algorithm Focus</div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong>Shares</strong> and <strong>First-Hour Velocity</strong> are the key metrics.
                TikTok is a viral lottery - most videos flop, but occasional hits go massive. Optimize for share potential.
              </div>
            </div>

            {tiktokData && tiktokData.videos?.length > 0 ? (
              <>
                <div className="grid-4" style={{ gap: '16px' }}>
                  <div className="insight-box">
                    <div className="insight-value">{tiktokData.totalVideos || 0}</div>
                    <div className="insight-label">Videos Analyzed</div>
                  </div>
                  <div className="insight-box">
                    <div className="insight-value" style={{ color: 'var(--success)' }}>{tiktokData.viralCount || 0}</div>
                    <div className="insight-label">Viral (10K+ views)</div>
                  </div>
                  <div className="insight-box">
                    <div className="insight-value" style={{ color: 'var(--primary)' }}>{tiktokData.goodCount || 0}</div>
                    <div className="insight-label">Good (2K+ views)</div>
                  </div>
                  <div className="insight-box">
                    <div className="insight-value" style={{ color: '#00F2EA' }}>{tiktokData.viralRate || 0}%</div>
                    <div className="insight-label">Viral Rate</div>
                  </div>
                </div>

                {/* Viral Rate Visual */}
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Viral Hit Rate</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{tiktokData.viralRate || 0}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[...Array(20)].map((_, i) => (
                      <div key={i} style={{
                        flex: 1,
                        height: '8px',
                        borderRadius: '2px',
                        background: i < Math.round((tiktokData.viralRate || 0) / 5) ? '#00F2EA' : 'var(--bg-primary)'
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {(tiktokData.viralRate || 0) < 5 ? (
                      'Low viral rate is normal. Focus on high volume and trending sounds.'
                    ) : (tiktokData.viralRate || 0) < 15 ? (
                      'Good viral rate! Your content strategy is working.'
                    ) : (
                      'Excellent! Your content is optimized for TikTok\'s algorithm.'
                    )}
                  </div>
                </div>

                {/* What TikTok DOESN'T provide */}
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <strong>Note:</strong> TikTok API doesn't provide watch time or completion rate. Focus on engagement metrics and share rate.
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <TikTokIcon size={48} />
                <p style={{ marginTop: '16px', fontSize: '14px' }}>No TikTok data available</p>
                <p style={{ fontSize: '12px' }}>Connect your TikTok account to see analytics</p>
                <p style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7 }}>TikTok API requires Business/Creator account approval</p>
              </div>
            )}
          </div>
        )}

        {/* Views Over Time Chart */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} />
            Views Over Time
            {selectedPlatform !== 'all' && (
              <span className="platform-badge" style={{
                background: PLATFORMS.find(p => p.id === selectedPlatform)?.color + '20',
                color: PLATFORMS.find(p => p.id === selectedPlatform)?.color,
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500
              }}>
                {PLATFORMS.find(p => p.id === selectedPlatform)?.name}
              </span>
            )}
          </h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={selectedPlatform === 'all' ? 'var(--primary)' : PLATFORMS.find(p => p.id === selectedPlatform)?.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={selectedPlatform === 'all' ? 'var(--primary)' : PLATFORMS.find(p => p.id === selectedPlatform)?.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={selectedPlatform === 'all' ? 'var(--primary)' : PLATFORMS.find(p => p.id === selectedPlatform)?.color}
                  fillOpacity={1}
                  fill="url(#colorViews)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Two-Column Charts */}
        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Engagement Chart */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} />
              Engagement Breakdown
            </h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="likes" fill="var(--success)" name="Likes" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comments" fill="var(--primary)" name="Comments" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Platform Distribution (only show on "All" tab) */}
          {selectedPlatform === 'all' ? (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={18} />
                Platform Distribution
              </h3>
              <div style={{ height: '250px', display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="60%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={platformDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {platformDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {platformDistribution.map((platform) => (
                    <div key={platform.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      fontSize: '13px'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '3px',
                        background: platform.color
                      }} />
                      <span style={{ flex: 1 }}>{platform.name}</span>
                      <span style={{ fontWeight: 600 }}>{platform.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '20px' }}>Platform Metrics</h3>
              <div style={{ padding: '20px 0' }}>
                <MetricRow label="Engagement Rate" value="4.2%" trend="up" />
                <MetricRow label="Avg. Watch Duration" value="45s" trend="up" />
                <MetricRow label="Completion Rate" value="68%" trend="neutral" />
                <MetricRow label="Share Rate" value="1.8%" trend="down" />
              </div>
            </div>
          )}
        </div>

        {/* Platform Comparison (only show on "All" tab) */}
        {selectedPlatform === 'all' && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '20px' }}>Platform Comparison</h3>
            <div className="platform-comparison-grid">
              {PLATFORMS.filter(p => p.id !== 'all').map((platform) => {
                const Icon = platform.icon;
                // REAL data per platform
                const ytVideos = youtubeData?.videos || [];
                const fbVideos = facebookData?.videos || [];
                const ttVideos = tiktokData?.videos || [];

                const ytViews = ytVideos.reduce((sum, v) => sum + (v.stats?.views || 0), 0);
                const ytLikes = ytVideos.reduce((sum, v) => sum + (v.stats?.likes || 0), 0);
                const ytEngagement = ytViews > 0 ? ((ytLikes / ytViews) * 100).toFixed(1) : '0';

                const fbReactions = fbVideos.reduce((sum, v) => sum + (v.reactions || 0), 0);
                const fbComments = fbVideos.reduce((sum, v) => sum + (v.comments || 0), 0);
                const fbShares = fbVideos.reduce((sum, v) => sum + (v.shares || 0), 0);
                const fbEngagement = fbVideos.length > 0 ? ((fbReactions + fbComments + fbShares) / fbVideos.length).toFixed(1) : '0';

                const ttViews = ttVideos.reduce((sum, v) => sum + (v.stats?.views || v.views || 0), 0);
                const ttLikes = ttVideos.reduce((sum, v) => sum + (v.stats?.likes || v.likes || 0), 0);
                const ttEngagement = ttViews > 0 ? ((ttLikes / ttViews) * 100).toFixed(1) : '0';

                const platformStats = {
                  youtube: { views: ytViews, likes: ytLikes, engagement: `${ytEngagement}%`, videos: ytVideos.length },
                  tiktok: { views: ttViews, likes: ttLikes, engagement: `${ttEngagement}%`, videos: ttVideos.length },
                  facebook: { views: fbReactions + fbComments + fbShares, likes: fbReactions, engagement: `${fbEngagement}`, videos: fbVideos.length },
                  instagram: { views: 0, likes: 0, engagement: '0%', videos: 0 },
                }[platform.id] || { views: 0, likes: 0, engagement: '0%', videos: 0 };

                return (
                  <div
                    key={platform.id}
                    className="platform-comparison-card"
                    onClick={() => setSelectedPlatform(platform.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="platform-comparison-header" style={{ color: platform.color }}>
                      <Icon size={20} />
                      <span>{platform.name}</span>
                    </div>
                    <div className="platform-comparison-stats">
                      <div className="comparison-stat">
                        <span className="comparison-value">{formatNumber(platformStats.views)}</span>
                        <span className="comparison-label">Views</span>
                      </div>
                      <div className="comparison-stat">
                        <span className="comparison-value">{formatNumber(platformStats.likes)}</span>
                        <span className="comparison-label">Likes</span>
                      </div>
                      <div className="comparison-stat">
                        <span className="comparison-value">{platformStats.engagement}</span>
                        <span className="comparison-label">Engagement</span>
                      </div>
                      <div className="comparison-stat">
                        <span className="comparison-value">{platformStats.videos}</span>
                        <span className="comparison-label">Videos</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Videos */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>
            Top Performing Videos
            {selectedPlatform !== 'all' && (
              <span style={{
                marginLeft: '10px',
                fontSize: '13px',
                fontWeight: 'normal',
                color: 'var(--text-muted)'
              }}>
                on {PLATFORMS.find(p => p.id === selectedPlatform)?.name}
              </span>
            )}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Video</th>
                {selectedPlatform === 'all' && <th>Platform</th>}
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredVideos().slice(0, 5).map((video, index) => {
                const platform = PLATFORMS.find(p => p.id === (video.platform || 'youtube'));
                const PlatformIcon = platform?.icon || Youtube;
                return (
                  <tr key={video.videoId || index}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '24px',
                          height: '24px',
                          background: index === 0 ? 'var(--primary)' : 'var(--bg-secondary)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontWeight: 500 }}>{video.title?.substring(0, 35)}...</span>
                      </div>
                    </td>
                    {selectedPlatform === 'all' && (
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: platform?.color + '15',
                          color: platform?.color,
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          <PlatformIcon size={12} />
                          {platform?.name}
                        </span>
                      </td>
                    )}
                    <td>{formatNumber(video.stats?.views || 0)}</td>
                    <td>{formatNumber(video.stats?.likes || 0)}</td>
                    <td>{video.stats?.comments || 0}</td>
                    <td>
                      <span className={`badge ${getEngagementBadge(video)}`}>
                        {calculateEngagement(video)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {getFilteredVideos().length === 0 && (
                <tr>
                  <td colSpan={selectedPlatform === 'all' ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No videos found for this platform
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cross-Platform Intelligence Section */}
        {selectedPlatform === 'all' && crossPlatformData && (
          <div className="card" style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.05) 100%)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={20} style={{ color: '#3B82F6' }} />
              Cross-Platform Intelligence
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Unified Insights
              </span>
            </h3>

            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', borderLeft: '3px solid #3B82F6' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Multi-Platform Strategy</div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                Aggregate performance data across all platforms to identify <strong>universal winners</strong> and <strong>platform-specific optimizations</strong>.
              </div>
            </div>

            <div className="grid-4" style={{ gap: '16px', marginBottom: '16px' }}>
              <div className="insight-box" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <div className="insight-value">{crossPlatformData.totalVideos || 0}</div>
                <div className="insight-label">Total Videos</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <div className="insight-value" style={{ color: 'var(--success)' }}>{crossPlatformData.universalWinners || 0}</div>
                <div className="insight-label">Universal Winners</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <div className="insight-value" style={{ color: '#8B5CF6' }}>{crossPlatformData.platformsActive || 0}</div>
                <div className="insight-label">Active Platforms</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(236,72,153,0.1)' }}>
                <div className="insight-value" style={{ color: '#EC4899' }}>{(crossPlatformData.avgUnifiedScore || 0).toFixed(1)}</div>
                <div className="insight-label">Avg Unified Score</div>
              </div>
            </div>

            {/* Best Posting Times */}
            {crossPlatformData.bestPostingTimes && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Clock size={16} style={{ color: '#3B82F6' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Best Posting Times</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {Object.entries(crossPlatformData.bestPostingTimes || {}).map(([platform, time]) => (
                    <div key={platform} style={{
                      padding: '10px 16px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '13px' }}>{platform}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{time || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Universal Winners */}
            {crossPlatformData.topPatterns && crossPlatformData.topPatterns.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Award size={16} style={{ color: '#F59E0B' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Top Patterns Across All Platforms</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {crossPlatformData.topPatterns.slice(0, 4).map((pattern, idx) => (
                    <div key={idx} style={{
                      flex: '1 1 calc(50% - 6px)',
                      minWidth: '200px',
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${idx === 0 ? '#F59E0B' : idx === 1 ? '#3B82F6' : idx === 2 ? '#8B5CF6' : '#10B981'}`
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{pattern.name || pattern.hook}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Score: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{(pattern.score || 0).toFixed(1)}</span>
                        {pattern.platforms && ` • ${pattern.platforms.length} platforms`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Retention Optimizer Section */}
        {retentionData && (
          <div className="card" style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(139,92,246,0.05) 100%)', border: '1px solid rgba(236,72,153,0.3)' }}>
            <h3 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Timer size={20} style={{ color: '#EC4899' }} />
              Retention Optimizer
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Watch Time Analysis
              </span>
            </h3>

            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(236,72,153,0.1)', borderRadius: '8px', borderLeft: '3px solid #EC4899' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Retention Strategy</div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                Analyze <strong>watch time patterns</strong>, <strong>drop-off points</strong>, and <strong>optimal video lengths</strong> to maximize viewer retention.
              </div>
            </div>

            <div className="grid-4" style={{ gap: '16px', marginBottom: '16px' }}>
              <div className="insight-box" style={{ background: 'rgba(236,72,153,0.1)' }}>
                <div className="insight-value">{retentionData.avgRetention || 0}%</div>
                <div className="insight-label">Avg Retention</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <div className="insight-value" style={{ color: '#3B82F6' }}>{retentionData.optimalDuration || 45}s</div>
                <div className="insight-label">Optimal Duration</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <div className="insight-value" style={{ color: 'var(--success)' }}>{retentionData.bestHookRetention || 0}%</div>
                <div className="insight-label">Best Hook Retention</div>
              </div>
              <div className="insight-box" style={{ background: 'rgba(251,191,36,0.1)' }}>
                <div className="insight-value" style={{ color: '#F59E0B' }}>{retentionData.dropOffPoint || 15}s</div>
                <div className="insight-label">Common Drop-Off</div>
              </div>
            </div>

            {/* Best Hooks by Retention */}
            {retentionData.bestHooks && retentionData.bestHooks.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <PlayCircle size={16} style={{ color: '#EC4899' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Best Performing Hooks (by Retention)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {retentionData.bestHooks.slice(0, 5).map((hook, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px'
                    }}>
                      <span style={{
                        width: '28px',
                        height: '28px',
                        background: idx === 0 ? 'linear-gradient(135deg, #EC4899, #8B5CF6)' : 'var(--bg-primary)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: idx === 0 ? 'white' : 'var(--text-primary)'
                      }}>
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{hook.type || hook.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hook.count || 0} videos</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--success)' }}>{(hook.avgRetention || 0).toFixed(1)}%</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>retention</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimal Durations by Platform */}
            {retentionData.durationsByPlatform && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Clock size={16} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Optimal Duration by Platform</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  {Object.entries(retentionData.durationsByPlatform || {}).map(([platform, duration]) => {
                    const platformInfo = PLATFORMS.find(p => p.id === platform) || { name: platform, color: '#6B7280' };
                    return (
                      <div key={platform} style={{
                        padding: '16px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        textAlign: 'center',
                        borderTop: `3px solid ${platformInfo.color}`
                      }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: platformInfo.color }}>{duration}s</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{platformInfo.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .platform-tabs {
          display: flex;
          gap: 8px;
          background: var(--bg-secondary);
          padding: 8px;
          border-radius: 12px;
          overflow-x: auto;
        }

        .platform-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .platform-tab:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .platform-tab.active {
          background: var(--platform-color);
          color: white;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .insight-box {
          text-align: center;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 8px;
        }

        .insight-value {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .insight-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .platform-comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .platform-comparison-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
        }

        .platform-comparison-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .platform-comparison-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .platform-comparison-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .comparison-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .comparison-value {
          font-size: 16px;
          font-weight: 600;
        }

        .comparison-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .metric-row:last-child {
          border-bottom: none;
        }

        .metric-value {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        }

        .trend-up { color: var(--success); }
        .trend-down { color: var(--error); }
        .trend-neutral { color: var(--text-muted); }

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

function GrowthIndicator({ value }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <div style={{
      fontSize: '12px',
      color: isPositive ? 'var(--success)' : 'var(--error)',
      marginTop: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? '+' : ''}{value}%
    </div>
  );
}

function MetricRow({ label, value, trend }) {
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  return (
    <div className="metric-row">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`metric-value trend-${trend}`}>
        {value}
        <TrendIcon size={14} />
      </span>
    </div>
  );
}

function generateChartData(videos, timeRange, platform) {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 180;
  const data = [];

  // Filter videos by platform if needed
  const filteredVideos = platform === 'all'
    ? videos
    : videos.filter(v => (v.platform || 'youtube') === platform);

  // Helper to check if a date matches a video's publish date
  const sameDay = (videoDate, targetDate) => {
    if (!videoDate) return false;
    const vd = new Date(videoDate);
    return vd.getFullYear() === targetDate.getFullYear() &&
           vd.getMonth() === targetDate.getMonth() &&
           vd.getDate() === targetDate.getDate();
  };

  // Generate data for each day
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Find videos published on this day and aggregate their stats
    const dayVideos = filteredVideos.filter(v =>
      sameDay(v.publishedAt || v.createdAt || v.created_at, date)
    );

    // Aggregate stats from videos on this day
    const dayStats = dayVideos.reduce((acc, v) => {
      const stats = v.stats || {};
      acc.views += stats.views || v.views || 0;
      acc.likes += stats.likes || v.likes || v.reactions || 0;
      acc.comments += stats.comments || v.comments || 0;
      acc.shares += stats.shares || v.shares || 0;
      return acc;
    }, { views: 0, likes: 0, comments: 0, shares: 0 });

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: dayStats.views,
      likes: dayStats.likes,
      comments: dayStats.comments,
      shares: dayStats.shares,
      videoCount: dayVideos.length
    });
  }

  return data;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function calculateEngagement(video) {
  const views = video.stats?.views || 1;
  const engagement = ((video.stats?.likes || 0) + (video.stats?.comments || 0)) / views * 100;
  return engagement.toFixed(1);
}

function getEngagementBadge(video) {
  const rate = parseFloat(calculateEngagement(video));
  if (rate >= 10) return 'badge-success';
  if (rate >= 5) return 'badge-warning';
  return 'badge-error';
}
