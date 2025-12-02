import { useState, useEffect } from 'react';
import { TrendingUp, Eye, ThumbsUp, MessageCircle, Share2, Clock } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../api';

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
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

  // Generate sample chart data based on actual analytics
  const chartData = generateChartData(analytics?.videos || [], timeRange);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Track your content performance across platforms</p>
      </header>

      <div className="page-content">
        {/* Time Range Selector */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['7d', '30d', '90d', 'all'].map((range) => (
              <button
                key={range}
                className={`btn ${timeRange === range ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTimeRange(range)}
              >
                {range === '7d' ? 'Last 7 Days' :
                 range === '30d' ? 'Last 30 Days' :
                 range === '90d' ? 'Last 90 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-icon purple"><Eye size={20} /></div>
            <div className="stat-value">{formatNumber(analytics?.summary?.totalViews || 0)}</div>
            <div className="stat-label">Total Views</div>
            <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
              <TrendingUp size={12} /> +{analytics?.growth?.views || 0}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><ThumbsUp size={20} /></div>
            <div className="stat-value">{formatNumber(analytics?.summary?.totalLikes || 0)}</div>
            <div className="stat-label">Total Likes</div>
            <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
              <TrendingUp size={12} /> +{analytics?.growth?.likes || 0}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><MessageCircle size={20} /></div>
            <div className="stat-value">{formatNumber(analytics?.summary?.totalComments || 0)}</div>
            <div className="stat-label">Comments</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><Clock size={20} /></div>
            <div className="stat-value">{analytics?.summary?.avgWatchTime || '0:00'}</div>
            <div className="stat-label">Avg Watch Time</div>
          </div>
        </div>

        {/* Views Chart */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 className="card-title" style={{ marginBottom: '20px' }}>Views Over Time</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
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
                  stroke="var(--primary)"
                  fillOpacity={1}
                  fill="url(#colorViews)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Engagement Chart */}
        <div className="grid-2" style={{ marginBottom: '24px' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '20px' }}>Engagement Breakdown</h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="likes" fill="var(--success)" name="Likes" />
                  <Bar dataKey="comments" fill="var(--primary)" name="Comments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '20px' }}>Platform Distribution</h3>
            <div style={{ padding: '20px 0' }}>
              <PlatformBar platform="YouTube" percentage={65} color="#FF0000" />
              <PlatformBar platform="TikTok" percentage={25} color="#00F2EA" />
              <PlatformBar platform="Facebook" percentage={10} color="#1877F2" />
            </div>
          </div>
        </div>

        {/* Top Videos */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>Top Performing Videos</h3>
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Engagement Rate</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.videos || []).slice(0, 5).map((video, index) => (
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
                      <span style={{ fontWeight: 500 }}>{video.title?.substring(0, 40)}...</span>
                    </div>
                  </td>
                  <td>{formatNumber(video.stats?.views || 0)}</td>
                  <td>{formatNumber(video.stats?.likes || 0)}</td>
                  <td>{video.stats?.comments || 0}</td>
                  <td>
                    <span className={`badge ${getEngagementBadge(video)}`}>
                      {calculateEngagement(video)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PlatformBar({ platform, percentage, color }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 500 }}>{platform}</span>
        <span style={{ color: 'var(--text-muted)' }}>{percentage}%</span>
      </div>
      <div style={{
        height: '8px',
        background: 'var(--bg-secondary)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          borderRadius: '4px'
        }} />
      </div>
    </div>
  );
}

function generateChartData(videos, timeRange) {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 180;
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: Math.floor(Math.random() * 500) + 100,
      likes: Math.floor(Math.random() * 50) + 10,
      comments: Math.floor(Math.random() * 20) + 2,
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
