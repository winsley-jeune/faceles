import { useState, useEffect } from 'react';
import { Eye, ThumbsUp, MessageCircle, ExternalLink } from 'lucide-react';
import api from '../api';

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const data = await api.getAnalytics();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">My Videos</h1>
          <p className="page-subtitle">All your generated viral shorts</p>
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
        <h1 className="page-title">My Videos</h1>
        <p className="page-subtitle">All your generated viral shorts</p>
      </header>

      <div className="page-content">
        {videos.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>No videos yet</p>
            <a href="/create" className="btn btn-primary">Create Your First Video</a>
          </div>
        ) : (
          <div className="grid-3">
            {videos.map((video) => (
              <div key={video.videoId} className="video-card">
                <img
                  src={video.thumbnail}
                  alt=""
                  className="video-thumbnail"
                />
                <div className="video-info">
                  <h3 className="video-title">{video.title}</h3>
                  <div className="video-stats">
                    <span><Eye size={14} /> {formatNumber(video.stats?.views || 0)}</span>
                    <span><ThumbsUp size={14} /> {formatNumber(video.stats?.likes || 0)}</span>
                    <span><MessageCircle size={14} /> {video.stats?.comments || 0}</span>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <a
                      href={`https://youtube.com/shorts/${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <ExternalLink size={14} /> View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
