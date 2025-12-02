import { Link } from 'react-router-dom';
import {
  Zap, Play, TrendingUp, Clock, Globe, Shield, Check, Star,
  Youtube, Facebook, Instagram, ArrowRight, Sparkles, BarChart3,
  Wand2, Upload, Users, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// TikTok icon
const TikTokIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const FEATURES = [
  {
    icon: Wand2,
    title: 'Brand Voice AI',
    description: 'Train AI on your brand guidelines to generate on-brand content at scale',
  },
  {
    icon: Sparkles,
    title: 'Automated Production',
    description: 'From script to publish in minutes - no video editors or designers needed',
  },
  {
    icon: Upload,
    title: 'Omnichannel Distribution',
    description: 'Publish to YouTube, TikTok, Instagram & Facebook from one dashboard',
  },
  {
    icon: BarChart3,
    title: 'ROI Analytics',
    description: 'Track performance, engagement, and conversions across all channels',
  },
  {
    icon: Clock,
    title: 'Content Calendar',
    description: 'Plan, schedule, and automate your entire content strategy',
  },
  {
    icon: TrendingUp,
    title: 'A/B Testing',
    description: 'Test hooks, CTAs, and formats to optimize conversion rates',
  },
];

const PRICING = [
  {
    name: 'Startup',
    price: 299,
    description: 'For small businesses building brand awareness',
    features: [
      '2 videos per day (60/month)',
      'All 4 platforms',
      'Brand voice customization',
      'Logo & watermark overlay',
      'Performance analytics',
      'Content calendar',
      '3 team members',
      'Email support',
    ],
    notIncluded: [
      'A/B testing',
      'API access',
      'Dedicated manager',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Business',
    price: 699,
    description: 'For growing brands scaling content marketing',
    features: [
      '5 videos per day (150/month)',
      'All 4 platforms',
      'Brand voice customization',
      'Logo & watermark overlay',
      'Advanced analytics & ROI tracking',
      'A/B testing (hooks & CTAs)',
      'Competitor analysis',
      'Content calendar',
      '10 team members',
      'Priority support',
    ],
    notIncluded: [
      'API access',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 1499,
    description: 'For brands & agencies at scale',
    features: [
      '15 videos per day (450/month)',
      'All 4 platforms',
      'Custom brand guidelines AI',
      'Multi-brand management',
      'Advanced analytics & attribution',
      'A/B testing & optimization',
      'Competitor monitoring',
      'API & webhook access',
      'Unlimited team members',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    notIncluded: [],
    cta: 'Contact Sales',
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    name: 'David Chen',
    role: 'CMO, TechFlow SaaS',
    avatar: 'D',
    content: 'We cut our content production costs by 80% while 3x our output. The ROI is incredible.',
    rating: 5,
  },
  {
    name: 'Sarah Mitchell',
    role: 'Marketing Director, RetailBrand',
    avatar: 'S',
    content: 'Our social engagement increased 400% in 2 months. The brand voice AI nails our tone perfectly.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'Founder, Growth Agency',
    avatar: 'M',
    content: 'We manage 30+ brand accounts from one dashboard. Game changer for our agency.',
    rating: 5,
  },
];

const STATS = [
  { value: '2M+', label: 'Videos Created' },
  { value: '5,000+', label: 'Brands Trust Us' },
  { value: '80%', label: 'Cost Reduction' },
  { value: '10x', label: 'Content Output' },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-gradient" />
          <div className="hero-grid" />
        </div>

        <nav className="hero-nav">
          <div className="nav-logo">
            <span className="logo-icon">&#9889;</span>
            <span className="logo-text">Viral Shorts</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#testimonials">Reviews</a>
          </div>
          <div className="nav-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary">
                Go to Dashboard <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Sign In</Link>
                <Link to="/login" className="btn btn-primary">
                  Get Started Free <ArrowRight size={18} />
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            AI-Powered Content Marketing
          </div>

          <h1 className="hero-title">
            Scale Your Brand's<br />
            <span className="gradient-text">Video Content 10x</span>
          </h1>

          <p className="hero-subtitle">
            Automate short-form video production for your brand.
            From script to publish across all platforms - no video team required.
          </p>

          <div className="hero-cta">
            <Link to="/login" className="btn btn-primary btn-xl">
              <Zap size={20} />
              Start Free Trial
            </Link>
            <button className="btn btn-secondary btn-xl">
              <Play size={20} />
              See It In Action
            </button>
          </div>

          <div className="hero-platforms">
            <span>Post directly to:</span>
            <div className="platform-icons">
              <div className="platform-icon youtube"><Youtube size={20} /></div>
              <div className="platform-icon tiktok"><TikTokIcon size={20} /></div>
              <div className="platform-icon facebook"><Facebook size={20} /></div>
              <div className="platform-icon instagram"><Instagram size={20} /></div>
            </div>
          </div>
        </div>

        <div className="hero-preview">
          <div className="preview-window">
            <div className="preview-header">
              <div className="preview-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="preview-title">Viral Shorts Generator</span>
            </div>
            <div className="preview-content">
              <div className="preview-video">
                <div className="video-placeholder">
                  <Play size={48} />
                  <span>AI-Generated Video</span>
                </div>
              </div>
              <div className="preview-stats">
                <div className="stat-item">
                  <TrendingUp size={16} />
                  <span>2.4M Views</span>
                </div>
                <div className="stat-item">
                  <Users size={16} />
                  <span>+50K Followers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          {STATS.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="section-title">Everything Your Brand Needs to Scale</h2>
          <p className="section-subtitle">
            Enterprise-grade AI tools that automate your entire content pipeline
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="feature-card">
                <div className="feature-icon">
                  <Icon size={28} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="section-header">
          <h2 className="section-title">How Brands Scale Content</h2>
          <p className="section-subtitle">
            From brief to published across all channels in minutes
          </p>
        </div>

        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Set Your Brand Voice</h3>
              <p>Upload brand guidelines and let AI learn your tone, style, and messaging.</p>
            </div>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>AI Produces Content</h3>
              <p>Script, visuals, voiceover, captions - all on-brand and ready to publish.</p>
            </div>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Publish & Measure</h3>
              <p>Auto-post everywhere, track performance, and optimize with A/B testing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="section-header">
          <h2 className="section-title">Pricing That Scales With You</h2>
          <p className="section-subtitle">
            Plans designed for businesses of every size
          </p>
        </div>

        <div className="pricing-grid">
          {PRICING.map((plan) => (
            <div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && (
                <div className="popular-badge">
                  <Star size={14} /> Most Popular
                </div>
              )}

              <div className="plan-header">
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  <span className="currency">$</span>
                  <span className="amount">{plan.price}</span>
                  <span className="period">/mo</span>
                </div>
                <p className="plan-description">{plan.description}</p>
              </div>

              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature} className="feature-item included">
                    <Check size={18} />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="feature-item not-included">
                    <span className="dash">—</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className={`btn btn-plan ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="pricing-note">
          All plans include a 7-day free trial. No credit card required.
        </p>

        <div className="enterprise-cta">
          <div className="enterprise-content">
            <h3>Need more than 15 videos per day?</h3>
            <p>Custom pricing for high-volume brands, white-label solutions, and dedicated infrastructure.</p>
          </div>
          <Link to="/login" className="btn btn-secondary">
            Talk to Sales
          </Link>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="testimonials-section">
        <div className="section-header">
          <h2 className="section-title">Trusted by Marketing Teams</h2>
          <p className="section-subtitle">
            See why brands choose us for content at scale
          </p>
        </div>

        <div className="testimonials-grid">
          {TESTIMONIALS.map((testimonial) => (
            <div key={testimonial.name} className="testimonial-card">
              <div className="testimonial-rating">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={16} fill="#fbbf24" color="#fbbf24" />
                ))}
              </div>
              <p className="testimonial-content">"{testimonial.content}"</p>
              <div className="testimonial-author">
                <div className="author-avatar">{testimonial.avatar}</div>
                <div className="author-info">
                  <div className="author-name">{testimonial.name}</div>
                  <div className="author-role">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Scale Your Content?</h2>
          <p>Join 5,000+ brands automating their video marketing. Start your free trial today.</p>
          <Link to="/login" className="btn btn-primary btn-xl">
            <Zap size={20} />
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-icon">&#9889;</span>
              <span>Viral Shorts</span>
            </div>
            <p>AI-powered video creation for the modern creator.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#">API</a>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 Viral Shorts. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
        .home-page {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        /* Hero Section */
        .hero {
          position: relative;
          min-height: 100vh;
          padding: 0 5%;
          overflow: hidden;
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .hero-gradient {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top center, rgba(139, 92, 246, 0.15) 0%, transparent 60%);
        }

        .hero-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* Navigation */
        .hero-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 0;
          max-width: 1400px;
          margin: 0 auto;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 700;
        }

        .logo-icon {
          font-size: 32px;
        }

        .nav-links {
          display: flex;
          gap: 40px;
        }

        .nav-links a {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: var(--text-primary);
        }

        .nav-actions {
          display: flex;
          gap: 12px;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
        }

        .btn-secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          border-color: var(--primary);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
        }

        .btn-ghost:hover {
          color: var(--text-primary);
        }

        .btn-xl {
          padding: 16px 32px;
          font-size: 16px;
        }

        /* Hero Content */
        .hero-content {
          position: relative;
          z-index: 5;
          max-width: 800px;
          margin: 80px auto 0;
          text-align: center;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 100px;
          font-size: 14px;
          color: var(--primary);
          margin-bottom: 24px;
        }

        .hero-title {
          font-size: 64px;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--primary) 0%, #ec4899 50%, #f59e0b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 20px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 40px;
        }

        .hero-cta {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 48px;
        }

        .hero-platforms {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .platform-icons {
          display: flex;
          gap: 12px;
        }

        .platform-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .platform-icon.youtube { background: rgba(255, 0, 0, 0.15); color: #ff0000; }
        .platform-icon.tiktok { background: rgba(255, 255, 255, 0.1); color: white; }
        .platform-icon.facebook { background: rgba(24, 119, 242, 0.15); color: #1877f2; }
        .platform-icon.instagram { background: rgba(228, 64, 95, 0.15); color: #e4405f; }

        /* Hero Preview */
        .hero-preview {
          position: relative;
          z-index: 5;
          max-width: 600px;
          margin: 60px auto 0;
        }

        .preview-window {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5);
        }

        .preview-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
        }

        .preview-dots {
          display: flex;
          gap: 6px;
        }

        .preview-dots span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--border-color);
        }

        .preview-title {
          font-size: 12px;
          color: var(--text-muted);
        }

        .preview-content {
          padding: 20px;
        }

        .preview-video {
          aspect-ratio: 9/16;
          max-height: 300px;
          background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-primary) 100%);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .preview-stats {
          display: flex;
          gap: 16px;
          justify-content: center;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border-radius: 20px;
          font-size: 13px;
          color: var(--success);
        }

        /* Stats Section */
        .stats-section {
          padding: 80px 5%;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }

        .stats-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px;
        }

        .stat-card {
          text-align: center;
        }

        .stat-value {
          font-size: 48px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 16px;
          color: var(--text-muted);
        }

        /* Section Styles */
        .section-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .section-title {
          font-size: 40px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .section-subtitle {
          font-size: 18px;
          color: var(--text-secondary);
        }

        /* Features Section */
        .features-section {
          padding: 120px 5%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .feature-card {
          padding: 32px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          transition: all 0.3s;
        }

        .feature-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
        }

        .feature-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          margin-bottom: 20px;
        }

        .feature-card h3 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .feature-card p {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* How It Works */
        .how-it-works {
          padding: 120px 5%;
          background: var(--bg-secondary);
        }

        .steps-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .step {
          flex: 1;
          text-align: center;
          padding: 40px 30px;
        }

        .step-number {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
          margin: 0 auto 24px;
        }

        .step-content h3 {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .step-content p {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .step-connector {
          width: 80px;
          height: 2px;
          background: linear-gradient(90deg, var(--primary), #8b5cf6);
          flex-shrink: 0;
        }

        /* Pricing Section */
        .pricing-section {
          padding: 120px 5%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          align-items: start;
        }

        .pricing-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 40px;
          position: relative;
          transition: all 0.3s;
        }

        .pricing-card:hover {
          border-color: var(--primary);
        }

        .pricing-card.popular {
          border-color: var(--primary);
          transform: scale(1.05);
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.2);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
        }

        .plan-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .plan-name {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .plan-price {
          margin-bottom: 12px;
        }

        .plan-price .currency {
          font-size: 24px;
          color: var(--text-muted);
          vertical-align: top;
        }

        .plan-price .amount {
          font-size: 56px;
          font-weight: 800;
        }

        .plan-price .period {
          font-size: 16px;
          color: var(--text-muted);
        }

        .plan-description {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 32px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          font-size: 14px;
          border-bottom: 1px solid var(--border-color);
        }

        .feature-item:last-child {
          border-bottom: none;
        }

        .feature-item.included {
          color: var(--text-primary);
        }

        .feature-item.included svg {
          color: var(--success);
        }

        .feature-item.not-included {
          color: var(--text-muted);
        }

        .feature-item .dash {
          width: 18px;
          text-align: center;
        }

        .btn-plan {
          width: 100%;
          justify-content: center;
          padding: 16px;
        }

        .pricing-note {
          text-align: center;
          margin-top: 40px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .enterprise-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          max-width: 700px;
          margin: 48px auto 0;
          padding: 32px 40px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 20px;
        }

        .enterprise-content h3 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .enterprise-content p {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        @media (max-width: 640px) {
          .enterprise-cta {
            flex-direction: column;
            text-align: center;
            padding: 24px;
          }
        }

        /* Testimonials */
        .testimonials-section {
          padding: 120px 5%;
          background: var(--bg-secondary);
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .testimonial-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 32px;
        }

        .testimonial-rating {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
        }

        .testimonial-content {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 24px;
          color: var(--text-secondary);
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 18px;
        }

        .author-name {
          font-weight: 600;
        }

        .author-role {
          font-size: 13px;
          color: var(--text-muted);
        }

        /* CTA Section */
        .cta-section {
          padding: 120px 5%;
          text-align: center;
        }

        .cta-content h2 {
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .cta-content p {
          font-size: 18px;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        /* Footer */
        .footer {
          padding: 80px 5% 40px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto 60px;
        }

        .footer-brand {
          max-width: 300px;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .footer-brand p {
          color: var(--text-muted);
          font-size: 14px;
        }

        .footer-links {
          display: flex;
          gap: 80px;
        }

        .footer-column h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
          color: var(--text-muted);
        }

        .footer-column a {
          display: block;
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 14px;
          padding: 8px 0;
          transition: color 0.2s;
        }

        .footer-column a:hover {
          color: var(--text-primary);
        }

        .footer-bottom {
          text-align: center;
          padding-top: 40px;
          border-top: 1px solid var(--border-color);
          color: var(--text-muted);
          font-size: 14px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .hero-title {
            font-size: 48px;
          }

          .features-grid,
          .pricing-grid,
          .testimonials-grid {
            grid-template-columns: 1fr;
            max-width: 500px;
            margin: 0 auto;
          }

          .pricing-card.popular {
            transform: none;
          }

          .stats-container {
            grid-template-columns: repeat(2, 1fr);
          }

          .steps-container {
            flex-direction: column;
          }

          .step-connector {
            width: 2px;
            height: 40px;
          }

          .nav-links {
            display: none;
          }

          .footer-content {
            flex-direction: column;
            gap: 40px;
          }

          .footer-links {
            gap: 40px;
          }
        }

        @media (max-width: 640px) {
          .hero-title {
            font-size: 36px;
          }

          .hero-cta {
            flex-direction: column;
          }

          .stats-container {
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }

          .stat-value {
            font-size: 32px;
          }
        }
      `}</style>
    </div>
  );
}
