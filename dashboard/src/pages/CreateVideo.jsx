import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Loader2, CheckCircle, AlertCircle, RefreshCw, TrendingUp, Wand2, Image, Mic, Film, Upload, Coffee, LogIn, Link2, Youtube, Facebook, Instagram, Brain, BarChart3, Target, Ban, ExternalLink, Check } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { usePlatformStatus } from '../hooks/usePlatformStatus';

// TikTok icon
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000', available: true },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2', available: true },
  { id: 'tiktok', name: 'TikTok', icon: TikTokIcon, color: '#00F2EA', available: true },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F', available: true },
];

const GENERATION_STEPS = [
  { id: 'topic', icon: Brain, label: 'Analyzing winning patterns...', funFact: 'Finding what makes your best videos succeed' },
  { id: 'script', icon: Wand2, label: 'Writing viral script...', funFact: 'AI is crafting hooks that stop the scroll' },
  { id: 'images', icon: Image, label: 'Generating stunning visuals...', funFact: 'Creating eye-catching scenes with AI art' },
  { id: 'voice', icon: Mic, label: 'Recording voiceover...', funFact: 'Adding that perfect narrator voice' },
  { id: 'video', icon: Film, label: 'Composing video magic...', funFact: 'Syncing audio, adding captions & effects' },
  { id: 'upload', icon: Upload, label: 'Uploading to platforms...', funFact: 'Publishing your new viral short' },
];

const FUN_MESSAGES = [
  "Making your competitors jealous...",
  "Sprinkling viral magic dust...",
  "Teaching AI to be creative...",
  "Brewing engagement potion...",
  "Making the algorithm happy...",
  "Crafting scroll-stopping content...",
  "Summoning the views...",
  "Converting coffee into content...",
  "Learning from your best performers...",
  "Applying winning patterns...",
];

// No predefined niches - AI learns patterns dynamically from viral videos
const DEFAULT_NICHES = [
  { id: 'auto', name: '🎯 Auto', description: 'AI learns from your viral videos', avgViews: null, isAuto: true },
];

export default function CreateVideo() {
  const { isAuthenticated, requireAuth } = useAuth();
  const { status: platformStatus, loading: platformLoading } = usePlatformStatus();
  const navigate = useNavigate();

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState(['youtube']);

  // Smart topic state
  const [smartTopic, setSmartTopic] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState('auto');
  const [niches, setNiches] = useState(DEFAULT_NICHES);
  const [loadingNiches, setLoadingNiches] = useState(true);
  const [bestNicheData, setBestNicheData] = useState(null);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [funMessage, setFunMessage] = useState('');
  const [pullingAnalytics, setPullingAnalytics] = useState(false);

  // Topic mode: false = optimize per platform (recommended), true = same topic for all
  const [useSameTopic, setUseSameTopic] = useState(false);

  const stepIntervalRef = useRef(null);
  const funMessageIntervalRef = useRef(null);

  useEffect(() => {
    fetchBestNiches();
  }, []);

  useEffect(() => {
    fetchSmartTopic();
    fetchPatterns();
  }, [selectedNiche]);

  const fetchBestNiches = async () => {
    setLoadingNiches(true);
    try {
      const data = await api.getBestNiche();
      setBestNicheData(data);
      // No longer building niche categories - AI learns patterns directly from viral videos
    } catch (err) {
      console.error('Failed to fetch best niches:', err);
    } finally {
      setLoadingNiches(false);
    }
  };

  const fetchSmartTopic = async () => {
    setLoadingTopic(true);
    try {
      const data = await api.getSmartTopic(selectedNiche);
      if (data.success) {
        setSmartTopic(data);
      }
    } catch (err) {
      console.error('Failed to fetch smart topic:', err);
      setSmartTopic(null);
    } finally {
      setLoadingTopic(false);
    }
  };

  const fetchPatterns = async () => {
    try {
      const data = await api.getSmartPatterns();
      if (data.success) {
        setPatterns(data.patterns);
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
    }
  };

  const pullAnalytics = async () => {
    setPullingAnalytics(true);
    try {
      // Pull analytics from YouTube, Facebook, and Instagram
      const results = await Promise.allSettled([
        api.pullYouTubeAnalytics(),
        api.pullFacebookAnalytics(),
        api.pullInstagramAnalytics()
      ]);

      // Log results
      if (results[0].status === 'fulfilled') {
        console.log('YouTube analytics pulled:', results[0].value);
      }
      if (results[1].status === 'fulfilled') {
        console.log('Facebook analytics pulled:', results[1].value);
      }
      if (results[2].status === 'fulfilled') {
        console.log('Instagram analytics pulled:', results[2].value);
      }

      await fetchBestNiches();
      await fetchPatterns();
      await fetchSmartTopic();
    } catch (err) {
      alert('Failed to pull analytics: ' + err.message);
    } finally {
      setPullingAnalytics(false);
    }
  };

  const togglePlatform = (platformId) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform?.available) return;

    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        // Don't allow deselecting all platforms
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  };

  const startProgressAnimation = () => {
    setCurrentStep(0);
    setFunMessage(FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]);

    stepIntervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < GENERATION_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 40000);

    funMessageIntervalRef.current = setInterval(() => {
      setFunMessage(FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]);
    }, 8000);
  };

  const stopProgressAnimation = () => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
    if (funMessageIntervalRef.current) {
      clearInterval(funMessageIntervalRef.current);
      funMessageIntervalRef.current = null;
    }
  };

  const handleGenerate = async () => {
    if (!requireAuth('/create')) {
      navigate('/login');
      return;
    }

    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform');
      return;
    }

    setLoading(true);
    setStatus('generating');
    setResult(null);

    try {
      // NEW: Create job instead of blocking
      // User can navigate away and progress is preserved in database
      const topicToUse = useSameTopic ? smartTopic?.recommendedTopic : null;
      const jobResult = await api.createSmartVideoJob(selectedNiche, selectedPlatforms, topicToUse);

      if (jobResult.success) {
        // Redirect to Jobs page to track progress
        navigate('/jobs', {
          state: {
            newJobId: jobResult.jobId,
            message: `Video generation started! Track progress below.`
          }
        });
      } else {
        throw new Error(jobResult.message || 'Failed to create job');
      }
    } catch (err) {
      setStatus('error');
      setResult({ error: err.message });
      setLoading(false);
    }
  };

  const getConnectedPlatforms = () => {
    return PLATFORMS.filter(p => {
      if (p.id === 'youtube') return platformStatus?.youtube?.connected;
      if (p.id === 'tiktok') return platformStatus?.tiktok?.connected;
      if (p.id === 'facebook') return platformStatus?.facebook?.connected;
      if (p.id === 'instagram') return platformStatus?.instagram?.connected;
      return false;
    });
  };

  const connectedPlatforms = getConnectedPlatforms();
  const hasAnyPlatform = connectedPlatforms.length > 0;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          <Zap size={28} style={{ marginRight: '12px', color: 'var(--primary)' }} />
          Create Video
        </h1>
        <p className="page-subtitle">AI-powered video generation based on your analytics</p>
      </header>

      <div className="page-content">
        {/* Platform Connection Check */}
        {!platformLoading && !hasAnyPlatform && (
          <div className="preflight-warning">
            <div className="warning-icon">
              <AlertCircle size={24} />
            </div>
            <div className="warning-content">
              <h3>No Platforms Connected</h3>
              <p>Connect at least one platform to start creating and posting videos.</p>
            </div>
            <Link to="/connections" className="btn btn-warning">
              <Link2 size={16} /> Connect Platforms
            </Link>
          </div>
        )}

        {/* Platform Selection */}
        {!platformLoading && hasAnyPlatform && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              Post to Platforms
            </h3>
            <div className="platform-selector">
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                const isConnected = platform.id === 'youtube' ? platformStatus?.youtube?.connected :
                                   platform.id === 'tiktok' ? platformStatus?.tiktok?.connected :
                                   platform.id === 'facebook' ? platformStatus?.facebook?.connected :
                                   platformStatus?.instagram?.connected;
                const isSelected = selectedPlatforms.includes(platform.id);
                const isDisabled = !platform.available || !isConnected;

                return (
                  <div
                    key={platform.id}
                    className={`platform-select-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && togglePlatform(platform.id)}
                    style={{ '--platform-color': platform.color }}
                  >
                    <div className="platform-select-check">
                      {isSelected && <Check size={14} />}
                    </div>
                    <Icon size={20} />
                    <span className="platform-select-name">{platform.name}</span>
                    {!isConnected && (
                      <span className="platform-select-status">Not connected</span>
                    )}
                    {isConnected && !platform.available && (
                      <span className="platform-select-status">Coming soon</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
              Select the platforms where you want to post your video
            </p>
          </div>
        )}

        <div className="grid-2">
          {/* Smart Topic Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '20px' }}>
              <h3 className="card-title">
                <Brain size={20} style={{ marginRight: '8px', color: 'var(--primary)' }} />
                Smart Topic Generator
              </h3>
              <button
                className="btn btn-secondary"
                onClick={pullAnalytics}
                disabled={pullingAnalytics}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {pullingAnalytics ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}
                {pullingAnalytics ? 'Pulling...' : 'Refresh'}
              </button>
            </div>

            {/* Top Viral Videos - AI learns patterns from these */}
            {bestNicheData?.winners && bestNicheData.winners.length > 0 && (
              <div className="winners-section" style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  🧠 AI LEARNING FROM YOUR TOP PERFORMERS
                </p>
                <div className="winners-list">
                  {bestNicheData.winners.slice(0, 5).map((winner, i) => {
                    const avgViews = bestNicheData.avgViewsPerVideo || 400;
                    const score = Math.min(10, (winner.views / avgViews) * 3);
                    const isViral = score >= 9;
                    return (
                      <div key={i} className="winner-item">
                        <span className="winner-rank">#{i + 1}</span>
                        <span className="winner-title">{winner.title?.substring(0, 40)}...</span>
                        <span className="winner-views">{winner.views?.toLocaleString()} views</span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isViral ? 'var(--success)' : '#F59E0B',
                          color: 'white',
                          fontWeight: 600
                        }}>
                          {score.toFixed(1)}/10
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  💡 Score 9+ = Viral (3x channel average). AI focuses only on 9+ videos to learn winning patterns.
                </p>
              </div>
            )}

            {loadingTopic ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Analyzing patterns...</p>
              </div>
            ) : smartTopic ? (
              <div>
                {/* Topic */}
                <div className="topic-card">
                  <p className="topic-label">
                    <Zap size={14} /> {useSameTopic ? 'TOPIC TO USE' : 'SAMPLE TOPIC (AI will optimize)'}
                  </p>
                  <h2 className="topic-title">
                    {smartTopic.recommendedTopic}
                  </h2>
                  {!useSameTopic && selectedPlatforms.length >= 1 && (
                    <p style={{ fontSize: '11px', opacity: 0.8, marginTop: '8px', fontStyle: 'italic' }}>
                      AI will generate fresh viral topics for each platform
                    </p>
                  )}
                </div>

                {/* Pattern Info - Now with Viral Intelligence */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Viral Score</p>
                    <p style={{ fontWeight: 600, color: (smartTopic.viralIntelligence?.viralScore || smartTopic.patterns?.viralScore || 0) >= 9 ? 'var(--success)' : '#F59E0B' }}>
                      <Target size={14} style={{ marginRight: '4px' }} />
                      {Number(smartTopic.viralIntelligence?.viralScore || smartTopic.patterns?.viralScore || 0).toFixed(1)}/10
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Viral Threshold</p>
                    <p style={{ fontWeight: 500, color: '#8B5CF6' }}>
                      {(smartTopic.viralIntelligence?.viralThreshold || smartTopic.patterns?.viralThreshold || 0).toLocaleString()}+ views
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Based On</p>
                    <p style={{ fontWeight: 500, color: '#EC4899' }}>
                      <TrendingUp size={14} style={{ marginRight: '4px' }} />
                      {smartTopic.viralIntelligence?.highViralCount || smartTopic.patterns?.basedOnVideos || 0} viral videos
                    </p>
                  </div>
                </div>

                {/* Viral Intelligence - Show what we're cloning */}
                {smartTopic.viralIntelligence && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                    <p style={{ fontSize: '12px', color: '#8B5CF6', marginBottom: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Brain size={14} /> VIRAL INTELLIGENCE
                    </p>

                    {/* Top Winner Being Cloned */}
                    {smartTopic.viralIntelligence.topOutlier && (
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>CLONING #1 WINNER:</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          "{smartTopic.viralIntelligence.topOutlier}"
                        </p>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Avg Views: </span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{smartTopic.viralIntelligence.avgViews?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Outliers: </span>
                        <span style={{ color: '#EC4899', fontWeight: 600 }}>{smartTopic.viralIntelligence.outlierCount} videos</span>
                      </div>
                      {smartTopic.viralIntelligence.recommendation?.examples?.[0]?.viralScore && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Viral Score: </span>
                          <span style={{ color: '#F59E0B', fontWeight: 600 }}>{smartTopic.viralIntelligence.recommendation.examples[0].viralScore}/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Why This Works */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>WHY THIS WILL WORK</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {smartTopic.whyThisWorks}
                  </p>
                </div>

                {/* Performance Prediction & Strategy */}
                {smartTopic.metadata && (
                  <div className="performance-prediction" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* Strategy Indicator */}
                      <div style={{
                        background: smartTopic.metadata.exploration
                          ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1))'
                          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.1))',
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${smartTopic.metadata.exploration ? 'rgba(251, 191, 36, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                      }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>STRATEGY</p>
                        <p style={{
                          fontWeight: 600,
                          color: smartTopic.metadata.exploration ? '#F59E0B' : 'var(--success)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {smartTopic.metadata.exploration ? (
                            <>🔬 EXPLORING</>
                          ) : (
                            <>🎯 EXPLOITING</>
                          )}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {smartTopic.metadata.exploration
                            ? 'Testing new patterns for growth'
                            : 'Using proven winning patterns'
                          }
                        </p>
                      </div>

                      {/* Risk Level */}
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '12px',
                        borderRadius: '8px'
                      }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>RISK LEVEL</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            background: 'var(--bg-primary)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: smartTopic.metadata.exploration ? '70%' : '30%',
                              height: '100%',
                              background: smartTopic.metadata.exploration
                                ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                                : 'linear-gradient(90deg, #22C55E, #3B82F6)',
                              borderRadius: '4px'
                            }} />
                          </div>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {smartTopic.metadata.exploration ? 'Higher variance' : 'Lower variance'}
                        </p>
                      </div>
                    </div>

                    {/* Platform Strategy Info */}
                    {smartTopic.metadata.strategy && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)'
                      }}>
                        <span style={{ color: 'var(--text-muted)' }}>Platform Strategy: </span>
                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                          {smartTopic.metadata.strategy === 'expected_value' && '📊 Expected Value (TikTok)'}
                          {smartTopic.metadata.strategy === 'minimax' && '🎯 Minimax (YouTube)'}
                          {smartTopic.metadata.strategy === 'nash' && '⚖️ Nash Equilibrium (Instagram)'}
                          {smartTopic.metadata.strategy === 'tit_for_tat' && '🤝 Tit-for-Tat (Facebook)'}
                          {!['expected_value', 'minimax', 'nash', 'tit_for_tat'].includes(smartTopic.metadata.strategy) && smartTopic.metadata.strategy}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Avoid Patterns */}
                {smartTopic.avoid && smartTopic.avoid.length > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Ban size={12} /> AVOIDING LOW PERFORMERS
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {smartTopic.avoid[0]?.substring(0, 50)}...
                    </p>
                  </div>
                )}

                {/* Topic Mode Toggle */}
                {selectedPlatforms.length > 1 && (
                  <div className="topic-mode-toggle" style={{ marginBottom: '16px' }}>
                    <div
                      className={`toggle-option ${!useSameTopic ? 'active' : ''}`}
                      onClick={() => setUseSameTopic(false)}
                    >
                      <div className="toggle-radio">{!useSameTopic && <div className="toggle-radio-inner" />}</div>
                      <div className="toggle-content">
                        <p className="toggle-title">Optimize per platform</p>
                        <p className="toggle-desc">Each platform gets its own AI-optimized topic for maximum reach</p>
                      </div>
                    </div>
                    <div
                      className={`toggle-option ${useSameTopic ? 'active' : ''}`}
                      onClick={() => setUseSameTopic(true)}
                    >
                      <div className="toggle-radio">{useSameTopic && <div className="toggle-radio-inner" />}</div>
                      <div className="toggle-content">
                        <p className="toggle-title">Same topic for all</p>
                        <p className="toggle-desc">Use the displayed topic above for all platforms</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleGenerate}
                  disabled={loading || !hasAnyPlatform || selectedPlatforms.length === 0}
                  style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="spinning" /> Generating...
                    </>
                  ) : !isAuthenticated ? (
                    <>
                      <LogIn size={20} /> Sign In to Generate
                    </>
                  ) : !hasAnyPlatform ? (
                    <>
                      <AlertCircle size={20} /> Connect a Platform First
                    </>
                  ) : (
                    <>
                      <Zap size={20} /> Generate & Post ({selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? 's' : ''})
                    </>
                  )}
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={fetchSmartTopic}
                  disabled={loadingTopic}
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  <RefreshCw size={16} /> Get Different Topic
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <AlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No patterns found</p>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Pull your analytics to get AI-powered topic suggestions.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={pullAnalytics}
                  disabled={pullingAnalytics}
                >
                  {pullingAnalytics ? (
                    <>
                      <Loader2 size={16} className="spinning" /> Pulling...
                    </>
                  ) : (
                    <>
                      <BarChart3 size={16} /> Pull Analytics
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Status / Result Card */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '24px' }}>Generation Status</h3>

            {!status && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <Zap size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <p>Click "Generate & Post" to create your next viral short</p>
              </div>
            )}

            {status === 'generating' && (
              <div style={{ padding: '20px 0' }}>
                {/* Progress Steps */}
                <div style={{ marginBottom: '24px' }}>
                  {GENERATION_STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = index === currentStep;
                    const isComplete = index < currentStep;

                    return (
                      <div
                        key={step.id}
                        className={`step-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                      >
                        <div className="step-icon">
                          {isComplete ? (
                            <CheckCircle size={20} />
                          ) : (
                            <StepIcon size={20} className={isActive ? 'pulse-icon' : ''} />
                          )}
                        </div>
                        <div className="step-content">
                          <p className="step-label">
                            {isComplete ? step.label.replace('...', ' - Done!') : step.label}
                          </p>
                          {isActive && (
                            <p className="step-fact">{step.funFact}</p>
                          )}
                        </div>
                        {isActive && <Loader2 size={18} className="spinning" />}
                      </div>
                    );
                  })}
                </div>

                {/* Fun Message */}
                <div className="fun-message">
                  <Coffee size={24} />
                  <p>{funMessage}</p>
                </div>

                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Estimated time: 4-6 minutes. Grab a coffee while we work our magic!
                </p>
              </div>
            )}

            {status === 'success' && result && (
              <div>
                <div className="success-header">
                  <CheckCircle size={24} />
                  <span>Video Posted Successfully!</span>
                </div>

                {/* Per-Platform Topics - Show what AI actually generated */}
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    TOPICS GENERATED BY AI
                  </p>

                  {result.youtube?.smartGeneration?.topic && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.1), rgba(255,0,0,0.05))', padding: '12px', borderRadius: '8px', marginBottom: '8px', borderLeft: '3px solid #FF0000' }}>
                      <p style={{ fontSize: '11px', color: '#FF0000', marginBottom: '4px', fontWeight: 600 }}>YOUTUBE</p>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{result.youtube.smartGeneration.topic}</p>
                    </div>
                  )}

                  {result.facebook?.smartGeneration?.topic && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(24,119,242,0.1), rgba(24,119,242,0.05))', padding: '12px', borderRadius: '8px', marginBottom: '8px', borderLeft: '3px solid #1877F2' }}>
                      <p style={{ fontSize: '11px', color: '#1877F2', marginBottom: '4px', fontWeight: 600 }}>FACEBOOK</p>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{result.facebook.smartGeneration.topic}</p>
                    </div>
                  )}

                  {result.instagram?.smartGeneration?.topic && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(228,64,95,0.1), rgba(228,64,95,0.05))', padding: '12px', borderRadius: '8px', marginBottom: '8px', borderLeft: '3px solid #E4405F' }}>
                      <p style={{ fontSize: '11px', color: '#E4405F', marginBottom: '4px', fontWeight: 600 }}>INSTAGRAM</p>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{result.instagram.smartGeneration.topic}</p>
                    </div>
                  )}

                  {result.tiktok?.smartGeneration?.topic && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(0,242,234,0.1), rgba(255,0,80,0.05))', padding: '12px', borderRadius: '8px', marginBottom: '8px', borderLeft: '3px solid #00F2EA' }}>
                      <p style={{ fontSize: '11px', color: '#00F2EA', marginBottom: '4px', fontWeight: 600 }}>TIKTOK</p>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{result.tiktok.smartGeneration.topic}</p>
                    </div>
                  )}
                </div>

                {/* Pattern Used */}
                {result.smartGeneration?.pattern && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>PATTERN USED</p>
                    <p style={{ fontSize: '14px', color: 'var(--primary)', textTransform: 'capitalize' }}>
                      {result.smartGeneration?.pattern} + {result.smartGeneration?.structure}
                    </p>
                  </div>
                )}

                {/* Platform Results */}
                <div className="platform-results">
                  {result.youtube?.youtube?.videoUrl && (
                    <a
                      href={result.youtube.youtube.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="platform-result-link youtube"
                    >
                      <Youtube size={18} />
                      <span>View on YouTube</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {result.facebook?.facebook?.videoUrl && (
                    <a
                      href={result.facebook.facebook.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="platform-result-link facebook"
                    >
                      <Facebook size={18} />
                      <span>View on Facebook</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {result.facebook?.success && !result.facebook?.facebook?.videoUrl && (
                    <div className="platform-result-success facebook">
                      <Facebook size={18} />
                      <span>Posted to Facebook!</span>
                      <CheckCircle size={14} />
                    </div>
                  )}
                  {result.instagram?.instagram?.reelUrl && (
                    <a
                      href={result.instagram.instagram.reelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="platform-result-link instagram"
                    >
                      <Instagram size={18} />
                      <span>View on Instagram</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {result.instagram?.success && !result.instagram?.instagram?.reelUrl && (
                    <div className="platform-result-success instagram">
                      <Instagram size={18} />
                      <span>Posted to Instagram!</span>
                      <CheckCircle size={14} />
                    </div>
                  )}
                  {result.tiktok?.tiktok?.videoUrl && (
                    <a
                      href={result.tiktok.tiktok.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="platform-result-link tiktok"
                    >
                      <TikTokIcon size={18} />
                      <span>View on TikTok</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {result.tiktok?.success && !result.tiktok?.tiktok?.videoUrl && (
                    <div className="platform-result-success tiktok">
                      <TikTokIcon size={18} />
                      <span>Posted to TikTok (Draft)!</span>
                      <CheckCircle size={14} />
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={() => {
                    setStatus(null);
                    fetchSmartTopic();
                  }}
                >
                  Ready for Next Video
                </button>
              </div>
            )}

            {status === 'error' && (
              <div>
                <div className="error-header">
                  <AlertCircle size={24} />
                  <span>Generation Failed</span>
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>{result?.error}</p>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '20px' }}
                  onClick={() => setStatus(null)}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Winning Patterns Display */}
        {patterns && (patterns.hooks?.length > 0 || patterns.structures?.length > 0) && (
          <div className="card" style={{ marginTop: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>
              <BarChart3 size={20} style={{ marginRight: '8px' }} />
              Your Winning Patterns
            </h3>
            <div className="grid-2">
              {/* Top Hooks */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>TOP HOOK STYLES</p>
                {patterns.hooks?.slice(0, 3).map((hook, i) => (
                  <div key={i} className={`pattern-item ${i === 0 ? 'top' : ''}`}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{hook.name?.replace(/-/g, ' ')}</span>
                    <span style={{ color: 'var(--success)', fontSize: '14px' }}>🔥 {hook.maxViews?.toLocaleString() || hook.avgViews?.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Top Structures */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>TOP STORY STRUCTURES</p>
                {patterns.structures?.slice(0, 3).map((structure, i) => (
                  <div key={i} className={`pattern-item ${i === 0 ? 'top' : ''}`}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{structure.name?.replace(/-/g, ' ')}</span>
                    <span style={{ color: 'var(--success)', fontSize: '14px' }}>🔥 {structure.maxViews?.toLocaleString() || structure.avgViews?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="card" style={{ marginTop: '24px' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>How Smart Generation Works</h3>
          <div className="grid-3">
            <div className="how-it-works-step">
              <div className="step-number">1</div>
              <p className="step-title">Analyzes Your Content</p>
              <p className="step-desc">AI reviews your top performing videos across all connected platforms</p>
            </div>
            <div className="how-it-works-step">
              <div className="step-number">2</div>
              <p className="step-title">Extracts Winning Patterns</p>
              <p className="step-desc">Identifies hook styles, story structures, and emotional triggers that work</p>
            </div>
            <div className="how-it-works-step">
              <div className="step-number">3</div>
              <p className="step-title">Creates Unique Content</p>
              <p className="step-desc">Generates fresh topics using winning patterns - never repeating stories</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pulse-icon { animation: pulseScale 1.5s ease-in-out infinite; }
        @keyframes pulseScale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        .preflight-warning {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 16px;
          margin-bottom: 24px;
        }

        .warning-icon { color: #fbbf24; flex-shrink: 0; }
        .warning-content { flex: 1; }
        .warning-content h3 { font-size: 16px; font-weight: 600; color: #fbbf24; margin-bottom: 4px; }
        .warning-content p { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .btn-warning {
          background: rgba(251, 191, 36, 0.2) !important;
          border: 1px solid #fbbf24 !important;
          color: #fbbf24 !important;
        }

        /* Platform Selector */
        .platform-selector {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 768px) {
          .platform-selector { grid-template-columns: repeat(2, 1fr); }
        }

        .platform-select-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .platform-select-item:hover:not(.disabled) {
          border-color: var(--platform-color);
        }

        .platform-select-item.selected {
          border-color: var(--platform-color);
          background: color-mix(in srgb, var(--platform-color) 10%, transparent);
        }

        .platform-select-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .platform-select-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--platform-color);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .platform-select-item.selected .platform-select-check {
          opacity: 1;
        }

        .platform-select-name {
          font-weight: 500;
          font-size: 14px;
        }

        .platform-select-status {
          font-size: 11px;
          color: var(--text-muted);
        }

        /* Niche Selector */
        .niche-selector {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .niche-option {
          padding: 8px 16px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .niche-option:hover {
          border-color: var(--primary);
        }

        .niche-option.selected {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
          color: var(--primary);
        }

        .niche-option.auto-best {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          border-color: var(--success);
        }

        .niche-option.auto-best.selected {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          border-color: var(--success);
        }

        .niche-views {
          display: block;
          font-size: 10px;
          color: var(--success);
          margin-top: 2px;
        }

        .niche-winners {
          font-size: 10px;
          color: #fbbf24;
          margin-left: 4px;
        }

        /* Winners Section */
        .winners-section {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .winners-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .winner-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-primary);
          border-radius: 8px;
          font-size: 12px;
        }

        .winner-rank {
          font-weight: 700;
          color: #fbbf24;
          min-width: 24px;
        }

        .winner-title {
          flex: 1;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .winner-views {
          font-weight: 600;
          color: var(--success);
          min-width: 50px;
          text-align: right;
        }

        .winner-niche {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.2);
          color: var(--primary);
          text-transform: capitalize;
        }

        .winner-niche.niche-secrets,
        .winner-niche.niche-workplace-secrets {
          background: rgba(34, 197, 94, 0.2);
          color: var(--success);
        }

        .winner-niche.niche-workplace {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }

        .winner-niche.niche-psychology {
          background: rgba(168, 85, 247, 0.2);
          color: #a855f7;
        }

        /* Topic Card */
        .topic-card {
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .topic-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          opacity: 0.8;
          margin-bottom: 8px;
        }

        .topic-title {
          font-size: 18px;
          font-weight: 600;
          line-height: 1.4;
        }

        /* Steps */
        .step-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          margin-bottom: 8px;
          background: var(--bg-secondary);
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .step-item.active {
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
        }

        .step-item.complete {
          opacity: 0.6;
        }

        .step-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .step-item.active .step-icon {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .step-item.complete .step-icon {
          background: var(--success);
          color: white;
        }

        .step-content { flex: 1; }

        .step-label {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 2px;
        }

        .step-item.active .step-label { color: white; }
        .step-item.complete .step-label { color: var(--success); }

        .step-fact {
          font-size: 12px;
          color: rgba(255,255,255,0.7);
        }

        .step-item.active .spinning { color: white; }

        /* Fun Message */
        .fun-message {
          background: var(--bg-secondary);
          padding: 16px;
          border-radius: 12px;
          text-align: center;
          margin-bottom: 16px;
        }

        .fun-message svg { color: var(--primary); margin-bottom: 8px; }
        .fun-message p { color: var(--text-secondary); font-style: italic; font-size: 14px; margin: 0; }

        /* Success / Error Headers */
        .success-header, .error-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          font-weight: 600;
        }

        .success-header { color: var(--success); }
        .error-header { color: var(--error); }

        /* Platform Results */
        .platform-results {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .platform-result-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }

        .platform-result-link.youtube {
          background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);
          color: white;
        }

        .platform-result-link.youtube:hover {
          background: linear-gradient(135deg, #cc0000 0%, #990000 100%);
        }

        .platform-result-link.facebook,
        .platform-result-success.facebook {
          background: linear-gradient(135deg, #1877F2 0%, #0d65d9 100%);
          color: white;
        }

        .platform-result-link.facebook:hover {
          background: linear-gradient(135deg, #0d65d9 0%, #0a4fa8 100%);
        }

        .platform-result-link.instagram,
        .platform-result-success.instagram {
          background: linear-gradient(135deg, #E4405F 0%, #C13584 50%, #833AB4 100%);
          color: white;
        }

        .platform-result-link.instagram:hover {
          background: linear-gradient(135deg, #C13584 0%, #833AB4 50%, #5851DB 100%);
        }

        .platform-result-link.tiktok,
        .platform-result-success.tiktok {
          background: linear-gradient(135deg, #00F2EA 0%, #FF0050 100%);
          color: white;
        }

        .platform-result-link.tiktok:hover {
          background: linear-gradient(135deg, #00D4CE 0%, #E00046 100%);
        }

        .platform-result-success {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          font-weight: 500;
        }

        /* Pattern Item */
        .pattern-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .pattern-item.top {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        /* How it Works */
        .how-it-works-step {
          text-align: center;
        }

        .step-number {
          width: 40px;
          height: 40px;
          background: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          font-weight: 600;
        }

        .step-title {
          font-weight: 500;
          margin-bottom: 8px;
        }

        .step-desc {
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Topic Mode Toggle */
        .topic-mode-toggle {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .toggle-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .toggle-option:hover {
          background: var(--bg-primary);
        }

        .toggle-option.active {
          background: rgba(139, 92, 246, 0.1);
          border-color: var(--primary);
        }

        .toggle-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .toggle-option.active .toggle-radio {
          border-color: var(--primary);
        }

        .toggle-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--primary);
        }

        .toggle-content {
          flex: 1;
        }

        .toggle-title {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .toggle-option.active .toggle-title {
          color: var(--primary);
        }

        .toggle-desc {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
        }
      `}</style>
    </>
  );
}
