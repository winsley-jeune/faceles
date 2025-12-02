import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Circle, ArrowRight, ArrowLeft, Youtube, Facebook,
  Instagram, Loader2, RefreshCw, ExternalLink, Sparkles, Rocket,
  Key, Link2, AlertCircle, Building2, Target, Users, MessageSquare,
  ShoppingBag, GraduationCap, Briefcase, TrendingUp, DollarSign, Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// TikTok icon
const TikTokIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'brand', title: 'Brand Setup', icon: Building2 },
  { id: 'platforms', title: 'Connect Platforms', icon: Link2 },
  { id: 'ready', title: 'Ready to Go', icon: Rocket },
];

const INDUSTRIES = [
  { id: 'ecommerce', name: 'E-commerce / DTC', icon: ShoppingBag, description: 'Online retail, dropshipping, physical products' },
  { id: 'coaching', name: 'Coaching / Info Products', icon: GraduationCap, description: 'Courses, coaching programs, digital products' },
  { id: 'saas', name: 'SaaS / Tech', icon: Briefcase, description: 'Software, apps, technology services' },
  { id: 'agency', name: 'Agency / Services', icon: TrendingUp, description: 'Marketing, consulting, professional services' },
];

const CONTENT_GOALS = [
  { id: 'brand-awareness', name: 'Brand Awareness', icon: Heart, description: 'Build recognition and grow your audience' },
  { id: 'lead-generation', name: 'Lead Generation', icon: Users, description: 'Capture leads and grow your email list' },
  { id: 'direct-sales', name: 'Direct Sales', icon: DollarSign, description: 'Drive immediate purchases and conversions' },
  { id: 'engagement', name: 'Engagement', icon: MessageSquare, description: 'Increase comments, shares, and community' },
];

const BRAND_TONES = [
  { id: 'professional', name: 'Professional', description: 'Authoritative and trustworthy' },
  { id: 'friendly', name: 'Friendly', description: 'Warm and approachable' },
  { id: 'bold', name: 'Bold', description: 'Confident and edgy' },
  { id: 'educational', name: 'Educational', description: 'Informative and helpful' },
  { id: 'inspirational', name: 'Inspirational', description: 'Motivating and uplifting' },
  { id: 'urgent', name: 'Urgent', description: 'Creates FOMO and action' },
];

const PLATFORMS = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    description: 'Post YouTube Shorts to your channel',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: TikTokIcon,
    color: '#000000',
    description: 'Share videos on TikTok',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    description: 'Post Reels to your Facebook Page',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: '#E4405F',
    description: 'Share Reels via Instagram',
    requiresFacebook: true,
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [platformStatus, setPlatformStatus] = useState({});
  const [loading, setLoading] = useState({});
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);

  // Brand context state
  const [brandData, setBrandData] = useState({
    business: {
      name: '',
      industry: '',
      description: '',
      uniqueValue: '',
    },
    targetAudience: {
      demographics: '',
      painPoints: [],
      desires: [],
    },
    brandVoice: {
      tone: 'professional',
      personality: [],
    },
    contentGoals: {
      primary: 'brand-awareness',
      callToActions: [],
    },
    products: [],
  });

  // Brand form sub-step (0: industry, 1: audience, 2: voice & goals)
  const [brandSubStep, setBrandSubStep] = useState(0);

  useEffect(() => {
    checkAllPlatforms();
  }, []);

  const checkAllPlatforms = async () => {
    setCheckingStatus(true);
    try {
      const [youtube, tiktok, facebook, instagram] = await Promise.allSettled([
        api.checkYouTubeStatus(),
        api.checkTikTokStatus(),
        api.checkFacebookStatus(),
        api.checkInstagramStatus(),
      ]);

      setPlatformStatus({
        youtube: youtube.status === 'fulfilled' ? youtube.value : { connected: false },
        tiktok: tiktok.status === 'fulfilled' ? tiktok.value : { connected: false },
        facebook: facebook.status === 'fulfilled' ? facebook.value : { connected: false },
        instagram: instagram.status === 'fulfilled' ? instagram.value : { connected: false },
      });
    } catch (err) {
      console.error('Failed to check platforms:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectPlatform = async (platformId) => {
    setLoading(prev => ({ ...prev, [platformId]: true }));

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
      }

      if (authUrl) {
        const authWindow = window.open(authUrl, '_blank', 'width=600,height=700');

        // Poll for window close
        const pollInterval = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(pollInterval);
            setTimeout(() => {
              checkAllPlatforms();
              setLoading(prev => ({ ...prev, [platformId]: false }));
            }, 1000);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Connect failed:', err);
      setLoading(prev => ({ ...prev, [platformId]: false }));
    }
  };

  const connectedCount = Object.values(platformStatus).filter(p => p?.connected).length;

  // Check if brand step is complete (minimum: name and industry)
  const brandStepComplete = brandData.business.name && brandData.business.industry;

  const canProceed = currentStep === 0 || // Welcome - always can proceed
    (currentStep === 1 && brandStepComplete) || // Brand - need at least name + industry
    currentStep === 2 || // Platforms - optional, can skip
    currentStep === 3; // Ready - always can proceed

  const handleNext = async () => {
    // If on brand step, save brand data to backend
    if (currentStep === 1) {
      setSavingBrand(true);
      try {
        await api.saveBrandOnboarding(brandData);
      } catch (err) {
        console.error('Failed to save brand data:', err);
        // Continue anyway - user can update later
      } finally {
        setSavingBrand(false);
      }
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      // Reset brand sub-step when moving to next main step
      if (currentStep === 1) {
        setBrandSubStep(0);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    // Save brand data one final time
    if (brandData.business.name) {
      try {
        await api.saveBrandOnboarding(brandData);
      } catch (err) {
        console.error('Failed to save brand data:', err);
      }
    }

    // Mark onboarding as complete
    localStorage.setItem('onboarding_complete', 'true');
    navigate('/dashboard');
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    navigate('/dashboard');
  };

  // Brand data update helpers
  const updateBusiness = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      business: { ...prev.business, [field]: value }
    }));
  };

  const updateAudience = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      targetAudience: { ...prev.targetAudience, [field]: value }
    }));
  };

  const updateGoals = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      contentGoals: { ...prev.contentGoals, [field]: value }
    }));
  };

  const updateVoice = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      brandVoice: { ...prev.brandVoice, [field]: value }
    }));
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {/* Progress Steps */}
        <div className="progress-steps">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <div key={step.id} className={`progress-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}>
                <div className="step-indicator">
                  {isComplete ? (
                    <CheckCircle size={24} />
                  ) : (
                    <StepIcon size={24} />
                  )}
                </div>
                <span className="step-title">{step.title}</span>
                {index < STEPS.length - 1 && <div className="step-connector" />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="step-content">
          {/* Step 1: Welcome */}
          {currentStep === 0 && (
            <div className="welcome-step">
              <div className="welcome-icon">
                <Sparkles size={48} />
              </div>
              <h1>Welcome to Viral Shorts Generator!</h1>
              <p className="welcome-subtitle">
                Hi {user?.name?.split(' ')[0] || 'there'}! Let's get you set up to create viral short-form videos.
              </p>

              <div className="feature-cards">
                <div className="feature-card">
                  <div className="feature-icon" style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
                    <Sparkles size={24} style={{ color: '#8b5cf6' }} />
                  </div>
                  <h3>AI-Powered Creation</h3>
                  <p>Generate scripts, visuals, and voiceovers automatically</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
                    <Link2 size={24} style={{ color: '#22c55e' }} />
                  </div>
                  <h3>Multi-Platform Posting</h3>
                  <p>Post to YouTube, TikTok, Facebook & Instagram at once</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                    <Rocket size={24} style={{ color: '#3b82f6' }} />
                  </div>
                  <h3>Smart Analytics</h3>
                  <p>AI analyzes your performance and suggests winning topics</p>
                </div>
              </div>

              <p className="next-step-hint">
                Next, we'll connect your social media accounts so you can start posting.
              </p>
            </div>
          )}

          {/* Step 2: Brand Setup */}
          {currentStep === 1 && (
            <div className="brand-step">
              <h2>Tell Us About Your Brand</h2>
              <p className="step-description">
                Help our AI create content that drives results for your business.
              </p>

              {/* Brand Name & Industry */}
              <div className="brand-form">
                <div className="form-group">
                  <label>Brand / Business Name *</label>
                  <input
                    type="text"
                    placeholder="Your brand name"
                    value={brandData.business.name}
                    onChange={(e) => updateBusiness('name', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Industry *</label>
                  <div className="industry-grid">
                    {INDUSTRIES.map((industry) => {
                      const Icon = industry.icon;
                      const isSelected = brandData.business.industry === industry.id;
                      return (
                        <div
                          key={industry.id}
                          className={`industry-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateBusiness('industry', industry.id)}
                        >
                          <Icon size={24} />
                          <span className="industry-name">{industry.name}</span>
                          <span className="industry-desc">{industry.description}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label>Primary Content Goal</label>
                  <div className="goals-grid">
                    {CONTENT_GOALS.map((goal) => {
                      const Icon = goal.icon;
                      const isSelected = brandData.contentGoals.primary === goal.id;
                      return (
                        <div
                          key={goal.id}
                          className={`goal-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateGoals('primary', goal.id)}
                        >
                          <Icon size={20} />
                          <span className="goal-name">{goal.name}</span>
                          <span className="goal-desc">{goal.description}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label>Brand Voice / Tone</label>
                  <div className="tones-grid">
                    {BRAND_TONES.map((tone) => {
                      const isSelected = brandData.brandVoice.tone === tone.id;
                      return (
                        <div
                          key={tone.id}
                          className={`tone-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateVoice('tone', tone.id)}
                        >
                          <span className="tone-name">{tone.name}</span>
                          <span className="tone-desc">{tone.description}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label>Target Audience (optional)</label>
                  <textarea
                    placeholder="Describe your ideal customer... e.g., 'Busy moms aged 25-40 looking for healthy meal prep solutions'"
                    value={brandData.targetAudience.demographics}
                    onChange={(e) => updateAudience('demographics', e.target.value)}
                    className="form-textarea"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>What makes you unique? (optional)</label>
                  <textarea
                    placeholder="Your unique value proposition... e.g., 'The only meal kit with 15-minute recipes'"
                    value={brandData.business.uniqueValue}
                    onChange={(e) => updateBusiness('uniqueValue', e.target.value)}
                    className="form-textarea"
                    rows={2}
                  />
                </div>
              </div>

              {!brandStepComplete && (
                <p className="brand-hint">
                  <AlertCircle size={14} />
                  Enter your brand name and select an industry to continue
                </p>
              )}
            </div>
          )}

          {/* Step 3: Connect Platforms */}
          {currentStep === 2 && (
            <div className="platforms-step">
              <h2>Connect Your Platforms</h2>
              <p className="step-description">
                Connect at least one platform to start posting videos. You can always add more later.
              </p>

              {checkingStatus ? (
                <div className="loading-state">
                  <Loader2 size={32} className="spinning" />
                  <p>Checking connection status...</p>
                </div>
              ) : (
                <div className="platforms-grid">
                  {PLATFORMS.map((platform) => {
                    const status = platformStatus[platform.id] || {};
                    const isConnected = status.connected;
                    const isLoading = loading[platform.id];
                    const Icon = platform.icon;
                    const isDisabled = platform.requiresFacebook && !platformStatus.facebook?.connected;

                    return (
                      <div
                        key={platform.id}
                        className={`platform-card ${isConnected ? 'connected' : ''} ${isDisabled ? 'disabled' : ''}`}
                      >
                        <div className="platform-header">
                          <div
                            className="platform-icon"
                            style={{ background: `${platform.color}20`, color: platform.color }}
                          >
                            <Icon size={28} />
                          </div>
                          {isConnected && (
                            <span className="connected-badge">
                              <CheckCircle size={16} /> Connected
                            </span>
                          )}
                        </div>

                        <h3>{platform.name}</h3>
                        <p>{platform.description}</p>

                        {isConnected && status.channelName && (
                          <p className="account-name">{status.channelName}</p>
                        )}
                        {isConnected && status.pageName && (
                          <p className="account-name">{status.pageName}</p>
                        )}
                        {isConnected && status.username && (
                          <p className="account-name">@{status.username}</p>
                        )}

                        {isDisabled && (
                          <p className="dependency-note">
                            <AlertCircle size={14} /> Connect Facebook first
                          </p>
                        )}

                        {!isConnected && !isDisabled && (
                          <button
                            className="btn btn-connect"
                            onClick={() => handleConnectPlatform(platform.id)}
                            disabled={isLoading}
                            style={{ borderColor: platform.color, color: platform.color }}
                          >
                            {isLoading ? (
                              <><Loader2 size={16} className="spinning" /> Connecting...</>
                            ) : (
                              <><ExternalLink size={16} /> Connect</>
                            )}
                          </button>
                        )}

                        {isConnected && (
                          <button
                            className="btn btn-reconnect"
                            onClick={() => handleConnectPlatform(platform.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <><Loader2 size={16} className="spinning" /></>
                            ) : (
                              <><RefreshCw size={14} /> Reconnect</>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="platforms-summary">
                {connectedCount === 0 ? (
                  <p className="warning-text">
                    <AlertCircle size={16} />
                    Connect at least one platform to post your videos
                  </p>
                ) : (
                  <p className="success-text">
                    <CheckCircle size={16} />
                    {connectedCount} platform{connectedCount > 1 ? 's' : ''} connected! You can add more anytime.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {currentStep === 3 && (
            <div className="ready-step">
              <div className="ready-icon">
                <Rocket size={64} />
              </div>
              <h1>You're All Set!</h1>
              <p className="ready-subtitle">
                Your account is ready to create viral short-form content.
              </p>

              <div className="setup-summary">
                <h3>Your Setup</h3>
                <div className="summary-item">
                  <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                  <span>Account: {user?.email}</span>
                </div>
                {brandData.business.name && (
                  <div className="summary-item">
                    <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                    <span>Brand: {brandData.business.name} ({INDUSTRIES.find(i => i.id === brandData.business.industry)?.name || brandData.business.industry})</span>
                  </div>
                )}
                {brandData.contentGoals.primary && (
                  <div className="summary-item">
                    <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                    <span>Goal: {CONTENT_GOALS.find(g => g.id === brandData.contentGoals.primary)?.name}</span>
                  </div>
                )}
                {connectedCount > 0 ? (
                  <div className="summary-item">
                    <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                    <span>{connectedCount} platform{connectedCount > 1 ? 's' : ''} connected</span>
                  </div>
                ) : (
                  <div className="summary-item warning">
                    <AlertCircle size={20} style={{ color: 'var(--warning)' }} />
                    <span>No platforms connected (you can add them later)</span>
                  </div>
                )}
              </div>

              <div className="next-steps-list">
                <h3>What's Next?</h3>
                <ol>
                  <li>
                    <strong>Create your first video</strong> - Use AI to generate viral content
                  </li>
                  <li>
                    <strong>Review & post</strong> - Preview and publish to your platforms
                  </li>
                  <li>
                    <strong>Track performance</strong> - See analytics and optimize
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="step-navigation">
          <div className="nav-left">
            {currentStep > 0 && (
              <button className="btn btn-secondary" onClick={handleBack}>
                <ArrowLeft size={18} /> Back
              </button>
            )}
          </div>

          <div className="nav-center">
            <button className="btn-skip" onClick={handleSkip}>
              Skip setup
            </button>
          </div>

          <div className="nav-right">
            {currentStep < STEPS.length - 1 ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!canProceed || savingBrand}
              >
                {savingBrand ? (
                  <><Loader2 size={18} className="spinning" /> Saving...</>
                ) : (
                  <>Continue <ArrowRight size={18} /></>
                )}
              </button>
            ) : (
              <button className="btn btn-primary btn-finish" onClick={handleFinish}>
                <Rocket size={18} /> Start Creating
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .onboarding-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
          padding: 20px;
        }

        .onboarding-card {
          background: rgba(30, 30, 40, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          width: 100%;
          max-width: 800px;
          padding: 40px;
        }

        /* Progress Steps */
        .progress-steps {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 40px;
          gap: 8px;
        }

        .progress-step {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .step-indicator {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.3s;
        }

        .progress-step.active .step-indicator {
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          color: white;
        }

        .progress-step.complete .step-indicator {
          background: var(--success);
          color: white;
        }

        .step-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-muted);
        }

        .progress-step.active .step-title {
          color: var(--text-primary);
        }

        .progress-step.complete .step-title {
          color: var(--success);
        }

        .step-connector {
          width: 60px;
          height: 2px;
          background: var(--border-color);
          margin: 0 8px;
        }

        .progress-step.complete + .progress-step .step-connector,
        .progress-step.complete .step-connector {
          background: var(--success);
        }

        /* Step Content */
        .step-content {
          min-height: 400px;
          margin-bottom: 32px;
        }

        /* Welcome Step */
        .welcome-step {
          text-align: center;
        }

        .welcome-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .welcome-step h1 {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .welcome-subtitle {
          color: var(--text-secondary);
          font-size: 16px;
          margin-bottom: 32px;
        }

        .feature-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .feature-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .feature-card h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .feature-card p {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0;
        }

        .next-step-hint {
          color: var(--text-muted);
          font-size: 14px;
        }

        /* Brand Step */
        .brand-step h2 {
          text-align: center;
          margin-bottom: 8px;
        }

        .brand-form {
          max-width: 600px;
          margin: 0 auto;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          font-size: 15px;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .industry-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .industry-card {
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
          text-align: center;
        }

        .industry-card:hover {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.05);
        }

        .industry-card.selected {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
        }

        .industry-name {
          font-weight: 600;
          font-size: 14px;
        }

        .industry-desc {
          font-size: 11px;
          color: var(--text-muted);
        }

        .goals-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .goal-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .goal-card:hover {
          border-color: var(--success);
          background: rgba(34, 197, 94, 0.05);
        }

        .goal-card.selected {
          border-color: var(--success);
          background: rgba(34, 197, 94, 0.1);
        }

        .goal-name {
          font-weight: 600;
          font-size: 13px;
        }

        .goal-desc {
          font-size: 11px;
          color: var(--text-muted);
        }

        .tones-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .tone-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .tone-card:hover {
          border-color: var(--primary);
        }

        .tone-card.selected {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
        }

        .tone-name {
          font-weight: 600;
          font-size: 13px;
        }

        .tone-desc {
          font-size: 10px;
          color: var(--text-muted);
        }

        .brand-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--warning);
          font-size: 13px;
          margin-top: 16px;
        }

        /* Platforms Step */
        .platforms-step h2 {
          text-align: center;
          margin-bottom: 8px;
        }

        .step-description {
          text-align: center;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        .loading-state {
          text-align: center;
          padding: 60px 0;
          color: var(--text-muted);
        }

        .platforms-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .platform-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s;
        }

        .platform-card:hover {
          border-color: var(--primary);
        }

        .platform-card.connected {
          border-color: var(--success);
          background: rgba(34, 197, 94, 0.05);
        }

        .platform-card.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .platform-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .platform-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .connected-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--success);
          background: rgba(34, 197, 94, 0.1);
          padding: 4px 10px;
          border-radius: 20px;
        }

        .platform-card h3 {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .platform-card > p {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .account-name {
          font-size: 12px;
          color: var(--text-secondary);
          background: var(--bg-primary);
          padding: 6px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .dependency-note {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--warning);
          margin-bottom: 12px;
        }

        .btn-connect {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: transparent;
          border: 1px solid;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-connect:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .btn-reconnect {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
        }

        .platforms-summary {
          text-align: center;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .platforms-summary p {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0;
        }

        .warning-text {
          color: var(--warning);
        }

        .success-text {
          color: var(--success);
        }

        /* Ready Step */
        .ready-step {
          text-align: center;
        }

        .ready-icon {
          width: 100px;
          height: 100px;
          margin: 0 auto 24px;
          background: linear-gradient(135deg, var(--success) 0%, #22c55e 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .ready-step h1 {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .ready-subtitle {
          color: var(--text-secondary);
          font-size: 16px;
          margin-bottom: 32px;
        }

        .setup-summary {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          text-align: left;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .setup-summary h3 {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .summary-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          font-size: 14px;
        }

        .summary-item.warning {
          color: var(--warning);
        }

        .next-steps-list {
          text-align: left;
          max-width: 400px;
          margin: 0 auto;
        }

        .next-steps-list h3 {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .next-steps-list ol {
          padding-left: 20px;
          margin: 0;
        }

        .next-steps-list li {
          padding: 8px 0;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .next-steps-list strong {
          color: var(--text-primary);
        }

        /* Navigation */
        .step-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 24px;
          border-top: 1px solid var(--border-color);
        }

        .nav-left, .nav-right {
          min-width: 140px;
        }

        .nav-right {
          text-align: right;
        }

        .btn-skip {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 14px;
          cursor: pointer;
          padding: 8px 16px;
        }

        .btn-skip:hover {
          color: var(--text-secondary);
        }

        .btn-finish {
          background: linear-gradient(135deg, var(--success) 0%, #22c55e 100%) !important;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .feature-cards {
            grid-template-columns: 1fr;
          }

          .platforms-grid {
            grid-template-columns: 1fr;
          }

          .progress-steps {
            flex-wrap: wrap;
          }

          .step-connector {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
