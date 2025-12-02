import { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, RefreshCw, Loader2, Video, Clock } from 'lucide-react';
import api from '../api';

export default function Publish() {
  const [platforms, setPlatforms] = useState({
    youtube: { authorized: false, loading: true },
    tiktok: { authorized: false, loading: true },
    facebook: { authorized: false, loading: true },
    instagram: { authorized: false, loading: true },
  });
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [postingVideo, setPostingVideo] = useState(null);
  const [postResults, setPostResults] = useState({});

  useEffect(() => {
    checkAllPlatforms();
    fetchVideos();
  }, []);

  const checkAllPlatforms = async () => {
    const checks = await Promise.all([
      api.checkYouTubeStatus().catch(() => ({ authorized: false })),
      api.checkTikTokStatus().catch(() => ({ authorized: false })),
      api.checkFacebookStatus().catch(() => ({ authorized: false })),
      api.checkInstagramStatus().catch(() => ({ authorized: false })),
    ]);

    setPlatforms({
      youtube: { ...checks[0], loading: false },
      tiktok: { ...checks[1], loading: false },
      facebook: { ...checks[2], loading: false },
      instagram: { ...checks[3], loading: false },
    });
  };

  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const data = await api.getLocalVideos();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handlePostToAll = async (video) => {
    setPostingVideo(video.path);
    setPostResults(prev => ({ ...prev, [video.path]: null }));

    try {
      const result = await api.postToAll(video.path, video.topic);
      setPostResults(prev => ({ ...prev, [video.path]: result }));
      // Refresh videos list to update posting status
      fetchVideos();
    } catch (err) {
      setPostResults(prev => ({
        ...prev,
        [video.path]: { error: err.message }
      }));
    } finally {
      setPostingVideo(null);
    }
  };

  const getAuthUrl = async (platform) => {
    try {
      let data;
      switch (platform) {
        case 'youtube':
          data = await api.getYouTubeAuthUrl();
          break;
        case 'tiktok':
          data = await api.getTikTokAuthUrl();
          break;
        case 'facebook':
          data = await api.getFacebookAuthUrl();
          break;
      }
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank');
      }
    } catch (err) {
      alert('Failed to get auth URL: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatSize = (bytes) => {
    if (bytes > 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const unpostedVideos = videos.filter(v => !v.allPosted);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Post & Schedule</h1>
        <p className="page-subtitle">Publish videos to your social platforms</p>
      </header>

      <div className="page-content">
        {/* Platform Status */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">Connected Platforms</h3>
            <button className="btn btn-secondary" onClick={checkAllPlatforms}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {/* YouTube */}
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div className="platform-icon platform-youtube">YT</div>
                <span style={{ fontWeight: 500 }}>YouTube</span>
              </div>
              {platforms.youtube.loading ? (
                <span className="badge badge-warning">Checking...</span>
              ) : platforms.youtube.authorized ? (
                <>
                  <span className="badge badge-success"><CheckCircle size={12} /> Connected</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {platforms.youtube.channel?.title}
                  </p>
                </>
              ) : (
                <>
                  <span className="badge badge-error"><XCircle size={12} /> Not Connected</span>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '8px', fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => getAuthUrl('youtube')}
                  >
                    Connect
                  </button>
                </>
              )}
            </div>

            {/* TikTok */}
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div className="platform-icon platform-tiktok">TT</div>
                <span style={{ fontWeight: 500 }}>TikTok</span>
              </div>
              {platforms.tiktok.loading ? (
                <span className="badge badge-warning">Checking...</span>
              ) : platforms.tiktok.authorized ? (
                <span className="badge badge-success"><CheckCircle size={12} /> Connected</span>
              ) : (
                <>
                  <span className="badge badge-error"><XCircle size={12} /> Not Connected</span>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '8px', fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => getAuthUrl('tiktok')}
                  >
                    Connect
                  </button>
                </>
              )}
            </div>

            {/* Facebook */}
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div className="platform-icon platform-facebook">FB</div>
                <span style={{ fontWeight: 500 }}>Facebook</span>
              </div>
              {platforms.facebook.loading ? (
                <span className="badge badge-warning">Checking...</span>
              ) : platforms.facebook.authorized ? (
                <>
                  <span className="badge badge-success"><CheckCircle size={12} /> Connected</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {platforms.facebook.page?.name}
                  </p>
                </>
              ) : (
                <>
                  <span className="badge badge-error"><XCircle size={12} /> Not Connected</span>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '8px', fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => getAuthUrl('facebook')}
                  >
                    Connect
                  </button>
                </>
              )}
            </div>

            {/* Instagram */}
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div className="platform-icon platform-instagram">IG</div>
                <span style={{ fontWeight: 500 }}>Instagram</span>
              </div>
              {platforms.instagram.loading ? (
                <span className="badge badge-warning">Checking...</span>
              ) : platforms.instagram.authorized ? (
                <>
                  <span className="badge badge-success"><CheckCircle size={12} /> Connected</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    @{platforms.instagram.instagram?.username}
                  </p>
                </>
              ) : (
                <span className="badge badge-error"><XCircle size={12} /> Not Connected</span>
              )}
            </div>
          </div>
        </div>

        {/* Unposted Videos */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">
              <Video size={20} style={{ marginRight: '8px' }} />
              Videos Ready to Post
              {unpostedVideos.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: '12px' }}>
                  {unpostedVideos.length} unposted
                </span>
              )}
            </h3>
            <button className="btn btn-secondary" onClick={fetchVideos} disabled={loadingVideos}>
              <RefreshCw size={16} className={loadingVideos ? 'spinning' : ''} /> Refresh
            </button>
          </div>

          {loadingVideos ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Loading videos...</p>
            </div>
          ) : videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Video size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p>No videos found</p>
              <p style={{ fontSize: '14px' }}>Create a video first to post it here</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {videos.map((video) => (
                <div
                  key={video.path}
                  style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: video.allPosted ? '1px solid var(--border-color)' : '1px solid var(--primary)',
                    opacity: video.allPosted ? 0.7 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                    {/* Video Info */}
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: 600, marginBottom: '8px', textTransform: 'capitalize' }}>
                        {video.topic}
                      </h4>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        <span><Clock size={14} style={{ marginRight: '4px' }} />{formatDate(video.createdAt)}</span>
                        <span>{formatSize(video.size)}</span>
                        <span className="badge" style={{ background: 'var(--bg-primary)', padding: '2px 8px' }}>
                          {video.niche}
                        </span>
                      </div>

                      {/* Platform Status */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`badge ${video.posted.youtube ? 'badge-success' : 'badge-error'}`}>
                          {video.posted.youtube ? <CheckCircle size={12} /> : <XCircle size={12} />} YouTube
                        </span>
                        <span className={`badge ${video.posted.tiktok ? 'badge-success' : 'badge-error'}`}>
                          {video.posted.tiktok ? <CheckCircle size={12} /> : <XCircle size={12} />} TikTok
                        </span>
                        <span className={`badge ${video.posted.facebook ? 'badge-success' : 'badge-error'}`}>
                          {video.posted.facebook ? <CheckCircle size={12} /> : <XCircle size={12} />} Facebook
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div style={{ flexShrink: 0 }}>
                      {video.allPosted ? (
                        <span className="badge badge-success" style={{ padding: '8px 16px' }}>
                          <CheckCircle size={14} /> All Posted
                        </span>
                      ) : postingVideo === video.path ? (
                        <button className="btn btn-primary" disabled style={{ minWidth: '180px' }}>
                          <Loader2 size={16} className="spinning" /> Posting...
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => handlePostToAll(video)}
                          style={{ minWidth: '180px' }}
                        >
                          <Upload size={16} /> Post to All Platforms
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Post Results */}
                  {postResults[video.path] && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: 'var(--bg-primary)',
                      borderRadius: '8px'
                    }}>
                      {postResults[video.path].error ? (
                        <p style={{ color: 'var(--error)' }}>
                          <XCircle size={14} style={{ marginRight: '8px' }} />
                          {postResults[video.path].error}
                        </p>
                      ) : (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {postResults[video.path].youtube?.success && (
                            <span className="badge badge-success">YouTube Posted</span>
                          )}
                          {postResults[video.path].youtube?.error && (
                            <span className="badge badge-error">YouTube: {postResults[video.path].youtube.error}</span>
                          )}
                          {postResults[video.path].tiktok?.success && (
                            <span className="badge badge-success">TikTok Posted</span>
                          )}
                          {postResults[video.path].tiktok?.error && (
                            <span className="badge badge-error">TikTok: {postResults[video.path].tiktok.error}</span>
                          )}
                          {postResults[video.path].facebook?.success && (
                            <span className="badge badge-success">Facebook Posted</span>
                          )}
                          {postResults[video.path].facebook?.error && (
                            <span className="badge badge-error">Facebook: {postResults[video.path].facebook.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
