import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Loader2, CheckCircle, AlertCircle, RefreshCw, Sparkles, TrendingUp, Wand2, Image, Mic, Film, Upload, Coffee, LogIn, Link2, Youtube, Brain, BarChart3, Target, Ban, ExternalLink } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { usePlatformStatus } from '../hooks/usePlatformStatus';

const GENERATION_STEPS = [
  { id: 'topic', icon: Brain, label: 'Analyzing winning patterns...', funFact: 'Finding what makes your best videos succeed' },
  { id: 'script', icon: Wand2, label: 'Writing viral script...', funFact: 'AI is crafting hooks that stop the scroll' },
  { id: 'images', icon: Image, label: 'Generating stunning visuals...', funFact: 'Creating eye-catching scenes with AI art' },
  { id: 'voice', icon: Mic, label: 'Recording voiceover...', funFact: 'Adding that perfect narrator voice' },
  { id: 'video', icon: Film, label: 'Composing video magic...', funFact: 'Syncing audio, adding captions & effects' },
  { id: 'upload', icon: Upload, label: 'Uploading to YouTube...', funFact: 'Publishing your new viral short' },
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

const NICHES = [
  { id: 'general', name: 'General', description: 'Broad viral content' },
  { id: 'money', name: 'Money & Finance', description: 'Wealth & investing' },
  { id: 'psychology', name: 'Psychology', description: 'Mind & behavior' },
  { id: 'motivation', name: 'Motivation', description: 'Inspiration & growth' },
  { id: 'facts', name: 'Facts', description: 'Interesting knowledge' },
];

export default function CreateVideo() {
  const { isAuthenticated, requireAuth } = useAuth();
  const { status: platformStatus, loading: platformLoading } = usePlatformStatus();
  const navigate = useNavigate();

  // Smart topic state
  const [smartTopic, setSmartTopic] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState('general');

  // Generation state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [funMessage, setFunMessage] = useState('');
  const [pullingAnalytics, setPullingAnalytics] = useState(false);

  const stepIntervalRef = useRef(null);
  const funMessageIntervalRef = useRef(null);

  useEffect(() => {
    fetchSmartTopic();
    fetchPatterns();
  }, [selectedNiche]);

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
      await api.pullYouTubeAnalytics();
      await fetchPatterns();
      await fetchSmartTopic();
    } catch (err) {
      alert('Failed to pull analytics: ' + err.message);
    } finally {
      setPullingAnalytics(false);
    }
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

    setLoading(true);
    setStatus('generating');
    setResult(null);
    startProgressAnimation();

    try {
      const data = await api.createSmartVideoForYouTube(selectedNiche);
      stopProgressAnimation();
      setResult(data);
      setStatus('success');
      fetchSmartTopic(); // Get next topic
    } catch (err) {
      stopProgressAnimation();
      setStatus('error');
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const youtubeConnected = platformStatus?.youtube?.connected;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          <Youtube size={28} style={{ marginRight: '12px', color: '#ff0000' }} />
          Smart YouTube Video
        </h1>
        <p className="page-subtitle">AI-powered video generation based on your YouTube analytics</p>
      </header>

      <div className="page-content">
        {/* YouTube Connection Check */}
        {!platformLoading && !youtubeConnected && (
          <div className="preflight-warning">
            <div className="warning-icon">
              <AlertCircle size={24} />
            </div>
            <div className="warning-content">
              <h3>YouTube Not Connected</h3>
              <p>Connect your YouTube channel to enable smart video generation.</p>
            </div>
            <Link to="/connections" className="btn btn-warning">
              <Link2 size={16} /> Connect YouTube
            </Link>
          </div>
        )}

        {/* YouTube Connected Banner */}
        {!platformLoading && youtubeConnected && (
          <div className="platform-ready-banner">
            <span className="ready-label">Connected:</span>
            <div className="ready-platforms">
              <span className="ready-badge youtube"><Youtube size={14} /> YouTube</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={pullAnalytics}
              disabled={pullingAnalytics}
              style={{ marginLeft: 'auto', fontSize: '12px', padding: '6px 12px' }}
            >
              {pullingAnalytics ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}
              {pullingAnalytics ? 'Pulling...' : 'Pull Analytics'}
            </button>
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
            </div>

            {/* Niche Selector */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                Content Niche
              </label>
              <div className="niche-selector">
                {NICHES.map((niche) => (
                  <div
                    key={niche.id}
                    className={`niche-option ${selectedNiche === niche.id ? 'selected' : ''}`}
                    onClick={() => setSelectedNiche(niche.id)}
                  >
                    <span className="niche-name">{niche.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {loadingTopic ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Analyzing patterns...</p>
              </div>
            ) : smartTopic ? (
              <div>
                {/* Topic */}
                <div style={{
                  background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>
                    <Youtube size={14} style={{ marginRight: '4px' }} />
                    NEXT YOUTUBE VIDEO
                  </p>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, lineHeight: 1.4 }}>
                    {smartTopic.recommendedTopic}
                  </h2>
                </div>

                {/* Pattern Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Hook Pattern</p>
                    <p style={{ fontWeight: 500, textTransform: 'capitalize', color: 'var(--success)' }}>
                      <Target size={14} style={{ marginRight: '4px' }} />
                      {smartTopic.patterns?.hook || 'N/A'}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Story Structure</p>
                    <p style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                      <TrendingUp size={14} style={{ marginRight: '4px' }} />
                      {smartTopic.patterns?.structure || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Why This Works */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>WHY THIS WILL WORK</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {smartTopic.whyThisWorks}
                  </p>
                </div>

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

                {/* Generate Button */}
                <button
                  className="btn btn-youtube btn-lg"
                  onClick={handleGenerate}
                  disabled={loading || !youtubeConnected}
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
                  ) : !youtubeConnected ? (
                    <>
                      <AlertCircle size={20} /> Connect YouTube First
                    </>
                  ) : (
                    <>
                      <Zap size={20} /> Generate & Post to YouTube
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
                  Pull your YouTube analytics to get AI-powered topic suggestions.
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
                      <BarChart3 size={16} /> Pull YouTube Analytics
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
                <Youtube size={48} style={{ marginBottom: '16px', opacity: 0.3, color: '#ff0000' }} />
                <p>Click "Generate & Post to YouTube" to create your next viral short</p>
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '12px 16px',
                          marginBottom: '8px',
                          background: isActive ? 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)' : 'var(--bg-secondary)',
                          borderRadius: '12px',
                          transition: 'all 0.3s ease',
                          opacity: isComplete ? 0.6 : 1,
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: isActive ? 'rgba(255,255,255,0.2)' : isComplete ? 'var(--success)' : 'var(--bg-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {isComplete ? (
                            <CheckCircle size={20} style={{ color: 'white' }} />
                          ) : isActive ? (
                            <StepIcon size={20} className="pulse-icon" style={{ color: 'white' }} />
                          ) : (
                            <StepIcon size={20} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: isActive ? 'white' : isComplete ? 'var(--success)' : 'var(--text-secondary)',
                            marginBottom: '2px',
                          }}>
                            {isComplete ? step.label.replace('...', ' - Done!') : step.label}
                          </p>
                          {isActive && (
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                              {step.funFact}
                            </p>
                          )}
                        </div>
                        {isActive && (
                          <Loader2 size={18} className="spinning" style={{ color: 'white' }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Fun Message */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  marginBottom: '16px',
                }}>
                  <Coffee size={24} style={{ color: '#ff0000', marginBottom: '8px' }} />
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '14px' }}>
                    {funMessage}
                  </p>
                </div>

                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Estimated time: 4-6 minutes. Grab a coffee while we work our magic!
                </p>
              </div>
            )}

            {status === 'success' && result && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--success)' }}>
                  <CheckCircle size={24} />
                  <span style={{ fontWeight: 600 }}>Video Posted to YouTube!</span>
                </div>

                {/* Video Info */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>TOPIC</p>
                  <p style={{ fontWeight: 500, marginBottom: '12px' }}>
                    {result.smartGeneration?.topic}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>PATTERN USED</p>
                  <p style={{ fontSize: '14px', color: 'var(--primary)', textTransform: 'capitalize' }}>
                    {result.smartGeneration?.pattern} + {result.smartGeneration?.structure}
                  </p>
                </div>

                {/* YouTube Link */}
                {result.youtube?.videoUrl && (
                  <a
                    href={result.youtube.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-youtube"
                    style={{ width: '100%', justifyContent: 'center', marginBottom: '16px' }}
                  >
                    <Youtube size={18} /> View on YouTube <ExternalLink size={14} />
                  </a>
                )}

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--error)' }}>
                  <AlertCircle size={24} />
                  <span style={{ fontWeight: 600 }}>Generation Failed</span>
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
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{hook.name?.replace(/-/g, ' ')}</span>
                    <span style={{ color: 'var(--success)', fontSize: '14px' }}>{hook.avgViews?.toLocaleString()} avg views</span>
                  </div>
                ))}
              </div>

              {/* Top Structures */}
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>TOP STORY STRUCTURES</p>
                {patterns.structures?.slice(0, 3).map((structure, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{structure.name?.replace(/-/g, ' ')}</span>
                    <span style={{ color: 'var(--success)', fontSize: '14px' }}>{structure.avgViews?.toLocaleString()} avg views</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Patterns to Avoid */}
            {patterns.avoid?.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Ban size={14} /> PATTERNS TO AVOID
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {patterns.avoid.slice(0, 3).map((pattern, i) => (
                    <span key={i} style={{
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '20px',
                      fontSize: '12px',
                      color: 'var(--error)',
                    }}>
                      {pattern.title?.substring(0, 40)}... ({pattern.views} views)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="card" style={{ marginTop: '24px' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>How Smart Generation Works</h3>
          <div className="grid-3">
            <div>
              <div style={{
                width: '40px', height: '40px',
                background: '#ff0000',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                1
              </div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>Analyzes Your YouTube</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                AI reviews your top performing videos, views, and engagement patterns
              </p>
            </div>
            <div>
              <div style={{
                width: '40px', height: '40px',
                background: '#ff0000',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                2
              </div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>Extracts Winning Patterns</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Identifies hook styles, story structures, and emotional triggers that work
              </p>
            </div>
            <div>
              <div style={{
                width: '40px', height: '40px',
                background: '#ff0000',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                3
              </div>
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>Creates NEW Unique Content</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Generates fresh topics using winning patterns - never repeating the same story
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
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

        .warning-icon {
          color: #fbbf24;
          flex-shrink: 0;
        }

        .warning-content {
          flex: 1;
        }

        .warning-content h3 {
          font-size: 16px;
          font-weight: 600;
          color: #fbbf24;
          margin-bottom: 4px;
        }

        .warning-content p {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        .btn-warning {
          background: rgba(251, 191, 36, 0.2) !important;
          border: 1px solid #fbbf24 !important;
          color: #fbbf24 !important;
        }

        .btn-warning:hover {
          background: rgba(251, 191, 36, 0.3) !important;
        }

        .btn-youtube {
          background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%) !important;
          color: white !important;
          border: none !important;
        }

        .btn-youtube:hover {
          background: linear-gradient(135deg, #cc0000 0%, #990000 100%) !important;
        }

        .btn-youtube:disabled {
          background: var(--bg-secondary) !important;
          color: var(--text-muted) !important;
        }

        .platform-ready-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 20px;
          background: rgba(255, 0, 0, 0.08);
          border: 1px solid rgba(255, 0, 0, 0.2);
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .ready-label {
          font-size: 13px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .ready-platforms {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          flex: 1;
        }

        .ready-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .ready-badge.youtube {
          background: rgba(255, 0, 0, 0.15);
          color: #ff0000;
        }

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
          border-color: #ff0000;
        }

        .niche-option.selected {
          border-color: #ff0000;
          background: rgba(255, 0, 0, 0.1);
          color: #ff0000;
        }

        .niche-name {
          font-weight: 500;
        }
      `}</style>
    </>
  );
}
