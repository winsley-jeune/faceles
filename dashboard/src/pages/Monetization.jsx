import { useState, useEffect } from 'react';
import {
  CreditCard, Package, Check, X, TrendingUp, Users, DollarSign,
  Clock, AlertCircle, ExternalLink, Copy, Gift, ArrowRight,
  Zap, Star, Crown, Building2, Video, Globe, Headphones, RefreshCw,
  ChevronRight, Shield, BarChart3, FileText, Sparkles
} from 'lucide-react';
import api from '../api';

// Plan features comparison
const PLAN_FEATURES = {
  free: {
    icon: Zap,
    color: '#6b7280',
    highlights: ['5 videos/month', '1 minute max', 'YouTube only', 'Watermark']
  },
  starter: {
    icon: Star,
    color: '#f59e0b',
    highlights: ['30 videos/month', '3 minutes max', 'YouTube + TikTok', 'AI Voice']
  },
  professional: {
    icon: Crown,
    color: '#8b5cf6',
    highlights: ['100 videos/month', '5 minutes max', 'All platforms', 'Custom branding']
  },
  enterprise: {
    icon: Building2,
    color: '#ec4899',
    highlights: ['Unlimited videos', '10 minutes max', 'White label', 'Dedicated support']
  }
};

export default function Monetization() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [affiliate, setAffiliate] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [activeTab, setActiveTab] = useState('plans');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [affiliateEmail, setAffiliateEmail] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes, affiliateRes, transRes] = await Promise.allSettled([
        api.getPlans(),
        api.getSubscription(),
        api.getAffiliate(),
        api.getTransactions()
      ]);

      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.plans || []);
      }

      if (subRes.status === 'fulfilled') {
        setSubscription(subRes.value.subscription);
        setUsage(subRes.value.usage);
      }

      if (affiliateRes.status === 'fulfilled') {
        setAffiliate(affiliateRes.value.affiliate);
      }

      if (transRes.status === 'fulfilled') {
        setTransactions(transRes.value.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch monetization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    if (planId === subscription?.planId) return;

    setSubscribing(planId);
    try {
      const result = await api.subscribe(planId);

      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else if (result.success) {
        // Demo mode or free plan
        await fetchData();
      }
    } catch (error) {
      console.error('Subscription failed:', error);
      alert('Subscription failed: ' + error.message);
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) {
      return;
    }

    try {
      await api.cancelSubscription();
      await fetchData();
    } catch (error) {
      console.error('Failed to cancel:', error);
      alert('Failed to cancel subscription');
    }
  };

  const handleBillingPortal = async () => {
    try {
      const result = await api.openBillingPortal();
      if (result.url) {
        window.open(result.url, '_blank');
      } else if (result.demoMode) {
        alert('Billing portal is not available in demo mode');
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  const handleCreateAffiliate = async () => {
    if (!affiliateEmail) {
      alert('Please enter your PayPal email');
      return;
    }

    try {
      const result = await api.createAffiliate(affiliateEmail);
      if (result.success) {
        setAffiliate(result.affiliate);
        setAffiliateEmail('');
      }
    } catch (error) {
      console.error('Failed to create affiliate:', error);
      alert('Failed to create affiliate account');
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < 50) {
      alert('Minimum payout amount is $50');
      return;
    }

    try {
      const result = await api.requestPayout(amount);
      if (result.success) {
        await fetchData();
        setShowPayoutModal(false);
        setPayoutAmount('');
        alert('Payout request submitted!');
      } else {
        alert(result.error || 'Failed to request payout');
      }
    } catch (error) {
      console.error('Failed to request payout:', error);
      alert('Failed to request payout');
    }
  };

  const copyReferralLink = () => {
    if (affiliate?.referralLink) {
      navigator.clipboard.writeText(affiliate.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <RefreshCw className="animate-spin" size={32} />
        <p>Loading monetization data...</p>
      </div>
    );
  }

  return (
    <div className="monetization-page">
      <div className="page-header">
        <div>
          <h1><CreditCard size={28} /> Monetization</h1>
          <p>Manage your subscription, usage, and affiliate program</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="monetization-tabs">
        <button
          className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          <Package size={18} /> Plans
        </button>
        <button
          className={`tab ${activeTab === 'usage' ? 'active' : ''}`}
          onClick={() => setActiveTab('usage')}
        >
          <BarChart3 size={18} /> Usage
        </button>
        <button
          className={`tab ${activeTab === 'affiliate' ? 'active' : ''}`}
          onClick={() => setActiveTab('affiliate')}
        >
          <Gift size={18} /> Affiliate
        </button>
        <button
          className={`tab ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <FileText size={18} /> Billing
        </button>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="plans-section">
          {/* Current Plan Banner */}
          {subscription && (
            <div className="current-plan-banner">
              <div className="plan-info">
                <span className="label">Current Plan</span>
                <span className="plan-name">{subscription.planName}</span>
                {subscription.status === 'active' && subscription.currentPeriodEnd && (
                  <span className="period-end">
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <span className="canceling">
                    <AlertCircle size={14} /> Cancels at period end
                  </span>
                )}
              </div>
              {subscription.planId !== 'free' && (
                <div className="plan-actions">
                  <button className="btn-secondary" onClick={handleBillingPortal}>
                    <ExternalLink size={16} /> Manage Billing
                  </button>
                  {!subscription.cancelAtPeriodEnd && (
                    <button className="btn-danger" onClick={handleCancelSubscription}>
                      Cancel Plan
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Plans Grid */}
          <div className="plans-grid">
            {plans.map((plan) => {
              const planMeta = PLAN_FEATURES[plan.id] || PLAN_FEATURES.free;
              const PlanIcon = planMeta.icon;
              const isCurrentPlan = subscription?.planId === plan.id;
              const isPopular = plan.id === 'professional';

              return (
                <div
                  key={plan.id}
                  className={`plan-card ${isCurrentPlan ? 'current' : ''} ${isPopular ? 'popular' : ''}`}
                >
                  {isPopular && <div className="popular-badge"><Sparkles size={12} /> Most Popular</div>}

                  <div className="plan-header">
                    <div className="plan-icon" style={{ backgroundColor: planMeta.color + '20', color: planMeta.color }}>
                      <PlanIcon size={24} />
                    </div>
                    <h3>{plan.name}</h3>
                    <div className="plan-price">
                      <span className="amount">${plan.price}</span>
                      <span className="interval">/{plan.interval}</span>
                    </div>
                  </div>

                  <ul className="plan-features">
                    <li>
                      <Video size={16} />
                      <span>{plan.features.videosPerMonth === -1 ? 'Unlimited' : plan.features.videosPerMonth} videos/month</span>
                    </li>
                    <li>
                      <Clock size={16} />
                      <span>Up to {Math.floor(plan.features.maxVideoDuration / 60)} min videos</span>
                    </li>
                    <li>
                      <Globe size={16} />
                      <span>{plan.features.platforms.length} platform{plan.features.platforms.length > 1 ? 's' : ''}</span>
                    </li>
                    <li className={plan.features.aiVoice ? '' : 'disabled'}>
                      {plan.features.aiVoice ? <Check size={16} /> : <X size={16} />}
                      <span>AI Voice</span>
                    </li>
                    <li className={plan.features.customBranding ? '' : 'disabled'}>
                      {plan.features.customBranding ? <Check size={16} /> : <X size={16} />}
                      <span>Custom Branding</span>
                    </li>
                    <li className={plan.features.apiAccess ? '' : 'disabled'}>
                      {plan.features.apiAccess ? <Check size={16} /> : <X size={16} />}
                      <span>API Access</span>
                    </li>
                    <li>
                      <Users size={16} />
                      <span>{plan.features.teamMembers === -1 ? 'Unlimited' : plan.features.teamMembers} team member{plan.features.teamMembers !== 1 ? 's' : ''}</span>
                    </li>
                    <li>
                      <Headphones size={16} />
                      <span>{plan.features.support} support</span>
                    </li>
                  </ul>

                  <button
                    className={`btn-subscribe ${isCurrentPlan ? 'current' : ''}`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isCurrentPlan || subscribing === plan.id}
                  >
                    {subscribing === plan.id ? (
                      <><RefreshCw size={16} className="animate-spin" /> Processing...</>
                    ) : isCurrentPlan ? (
                      <><Check size={16} /> Current Plan</>
                    ) : (
                      <><ArrowRight size={16} /> {plan.price === 0 ? 'Downgrade' : 'Upgrade'}</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="usage-section">
          <div className="usage-cards">
            <div className="usage-card">
              <div className="usage-header">
                <Video size={20} />
                <h4>Videos Generated</h4>
              </div>
              <div className="usage-value">
                <span className="current">{usage?.videosGenerated || 0}</span>
                <span className="limit">
                  / {subscription?.features?.videosPerMonth === -1 ? 'Unlimited' : subscription?.features?.videosPerMonth || 5}
                </span>
              </div>
              <div className="usage-bar">
                <div
                  className="usage-fill"
                  style={{
                    width: subscription?.features?.videosPerMonth === -1
                      ? '10%'
                      : `${Math.min(100, ((usage?.videosGenerated || 0) / (subscription?.features?.videosPerMonth || 5)) * 100)}%`
                  }}
                />
              </div>
              <p className="usage-period">This month ({usage?.period})</p>
            </div>

            <div className="usage-card">
              <div className="usage-header">
                <BarChart3 size={20} />
                <h4>API Calls</h4>
              </div>
              <div className="usage-value">
                <span className="current">{usage?.apiCalls || 0}</span>
              </div>
              <p className="usage-period">This month</p>
            </div>

            <div className="usage-card">
              <div className="usage-header">
                <Shield size={20} />
                <h4>Storage Used</h4>
              </div>
              <div className="usage-value">
                <span className="current">{formatBytes(usage?.storageUsed || 0)}</span>
                <span className="limit">/ {subscription?.features?.storage || '1GB'}</span>
              </div>
            </div>
          </div>

          {/* Features Access */}
          <div className="features-access">
            <h3>Feature Access</h3>
            <div className="features-grid">
              <FeatureAccess
                name="AI Voice"
                enabled={subscription?.features?.aiVoice}
                icon={<Headphones size={18} />}
              />
              <FeatureAccess
                name="Custom Branding"
                enabled={subscription?.features?.customBranding}
                icon={<Star size={18} />}
              />
              <FeatureAccess
                name="API Access"
                enabled={subscription?.features?.apiAccess}
                icon={<Zap size={18} />}
              />
              <FeatureAccess
                name="No Watermark"
                enabled={!subscription?.features?.watermark}
                icon={<Shield size={18} />}
              />
            </div>
          </div>

          {/* Platform Access */}
          <div className="platform-access">
            <h3>Platform Access</h3>
            <div className="platforms-list">
              {['youtube', 'tiktok', 'facebook', 'instagram'].map(platform => (
                <div
                  key={platform}
                  className={`platform-item ${subscription?.features?.platforms?.includes(platform) ? 'enabled' : 'disabled'}`}
                >
                  {subscription?.features?.platforms?.includes(platform) ? <Check size={16} /> : <X size={16} />}
                  <span>{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Affiliate Tab */}
      {activeTab === 'affiliate' && (
        <div className="affiliate-section">
          {affiliate ? (
            <>
              {/* Affiliate Stats */}
              <div className="affiliate-stats">
                <div className="stat-card">
                  <DollarSign size={24} />
                  <div className="stat-info">
                    <span className="stat-value">${affiliate.earnings?.total?.toFixed(2) || '0.00'}</span>
                    <span className="stat-label">Total Earnings</span>
                  </div>
                </div>
                <div className="stat-card">
                  <Clock size={24} />
                  <div className="stat-info">
                    <span className="stat-value">${affiliate.earnings?.pending?.toFixed(2) || '0.00'}</span>
                    <span className="stat-label">Pending</span>
                  </div>
                </div>
                <div className="stat-card">
                  <Users size={24} />
                  <div className="stat-info">
                    <span className="stat-value">{affiliate.totalReferrals || 0}</span>
                    <span className="stat-label">Total Referrals</span>
                  </div>
                </div>
                <div className="stat-card">
                  <TrendingUp size={24} />
                  <div className="stat-info">
                    <span className="stat-value">{affiliate.commissionRate || '20%'}</span>
                    <span className="stat-label">Commission Rate</span>
                  </div>
                </div>
              </div>

              {/* Referral Link */}
              <div className="referral-section">
                <h3>Your Referral Link</h3>
                <div className="referral-link-box">
                  <input type="text" value={affiliate.referralLink || ''} readOnly />
                  <button onClick={copyReferralLink}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="referral-code">Your code: <strong>{affiliate.code}</strong></p>
              </div>

              {/* Payout */}
              {affiliate.earnings?.pending >= 50 && (
                <div className="payout-section">
                  <button className="btn-primary" onClick={() => setShowPayoutModal(true)}>
                    <DollarSign size={16} /> Request Payout
                  </button>
                  <p>Minimum payout: $50</p>
                </div>
              )}
            </>
          ) : (
            <div className="affiliate-signup">
              <Gift size={48} />
              <h3>Join Our Affiliate Program</h3>
              <p>Earn 20% commission on every referral that subscribes to a paid plan!</p>
              <div className="affiliate-form">
                <input
                  type="email"
                  placeholder="PayPal email for payouts"
                  value={affiliateEmail}
                  onChange={(e) => setAffiliateEmail(e.target.value)}
                />
                <button className="btn-primary" onClick={handleCreateAffiliate}>
                  <Gift size={16} /> Become an Affiliate
                </button>
              </div>
              <div className="affiliate-benefits">
                <div className="benefit">
                  <Check size={16} />
                  <span>20% lifetime commission</span>
                </div>
                <div className="benefit">
                  <Check size={16} />
                  <span>Monthly payouts via PayPal</span>
                </div>
                <div className="benefit">
                  <Check size={16} />
                  <span>Real-time tracking dashboard</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="billing-section">
          <div className="billing-header">
            <h3>Billing History</h3>
            {subscription?.planId !== 'free' && (
              <button className="btn-secondary" onClick={handleBillingPortal}>
                <ExternalLink size={16} /> Manage in Stripe
              </button>
            )}
          </div>

          {transactions.length > 0 ? (
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td>{tx.type === 'subscription' ? 'Subscription payment' : tx.type}</td>
                    <td>${tx.amount?.toFixed(2) || '0.00'} {tx.currency?.toUpperCase()}</td>
                    <td>
                      <span className={`status ${tx.status || 'completed'}`}>
                        {tx.status || 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <FileText size={48} />
              <p>No billing history yet</p>
            </div>
          )}
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request Payout</h3>
            <p>Available: ${affiliate?.earnings?.pending?.toFixed(2) || '0.00'}</p>
            <input
              type="number"
              placeholder="Amount to withdraw"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              min="50"
              max={affiliate?.earnings?.pending || 0}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPayoutModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleRequestPayout}>
                Request Payout
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .monetization-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          margin-bottom: 4px;
        }

        .page-header p {
          color: var(--text-secondary);
        }

        .monetization-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }

        .monetization-tabs .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 8px 8px 0 0;
          transition: all 0.2s;
        }

        .monetization-tabs .tab:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }

        .monetization-tabs .tab.active {
          color: var(--primary);
          background: var(--primary-light);
          font-weight: 500;
        }

        /* Current Plan Banner */
        .current-plan-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: var(--bg-secondary);
          border-radius: 12px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }

        .current-plan-banner .plan-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .current-plan-banner .label {
          font-size: 12px;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .current-plan-banner .plan-name {
          font-size: 18px;
          font-weight: 600;
        }

        .current-plan-banner .period-end {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .current-plan-banner .canceling {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--warning);
          font-size: 13px;
        }

        .current-plan-banner .plan-actions {
          display: flex;
          gap: 8px;
        }

        /* Plans Grid */
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .plan-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          position: relative;
          transition: all 0.3s;
        }

        .plan-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .plan-card.current {
          border-color: var(--primary);
          background: linear-gradient(135deg, var(--primary-light) 0%, var(--bg-secondary) 100%);
        }

        .plan-card.popular {
          border-color: #8b5cf6;
        }

        .popular-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #8b5cf6;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .plan-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .plan-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .plan-header h3 {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .plan-price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
        }

        .plan-price .amount {
          font-size: 36px;
          font-weight: 700;
        }

        .plan-price .interval {
          color: var(--text-secondary);
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 20px;
        }

        .plan-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }

        .plan-features li:last-child {
          border-bottom: none;
        }

        .plan-features li.disabled {
          color: var(--text-secondary);
          opacity: 0.6;
        }

        .plan-features li svg {
          flex-shrink: 0;
        }

        .btn-subscribe {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: var(--primary);
          color: white;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-subscribe:hover:not(:disabled) {
          background: var(--primary-dark);
        }

        .btn-subscribe.current {
          background: var(--success);
          cursor: default;
        }

        .btn-subscribe:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Usage Section */
        .usage-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .usage-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .usage-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .usage-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          color: var(--text-secondary);
        }

        .usage-header h4 {
          font-size: 14px;
          font-weight: 500;
        }

        .usage-value {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 8px;
        }

        .usage-value .current {
          font-size: 32px;
          font-weight: 700;
        }

        .usage-value .limit {
          color: var(--text-secondary);
        }

        .usage-bar {
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
        }

        .usage-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 3px;
          transition: width 0.3s;
        }

        .usage-period {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        .features-access, .platform-access {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .features-access h3, .platform-access h3 {
          margin-bottom: 16px;
          font-size: 16px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .platforms-list {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .platform-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          font-size: 14px;
        }

        .platform-item.enabled {
          color: var(--success);
        }

        .platform-item.disabled {
          color: var(--text-secondary);
          opacity: 0.6;
        }

        /* Affiliate Section */
        .affiliate-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .affiliate-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .stat-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .stat-card svg {
          color: var(--primary);
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
        }

        .stat-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .referral-section {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .referral-section h3 {
          margin-bottom: 12px;
        }

        .referral-link-box {
          display: flex;
          gap: 8px;
        }

        .referral-link-box input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-tertiary);
          font-size: 14px;
        }

        .referral-link-box button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .referral-code {
          margin-top: 12px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .affiliate-signup {
          text-align: center;
          padding: 48px 24px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
        }

        .affiliate-signup svg {
          color: var(--primary);
          margin-bottom: 16px;
        }

        .affiliate-signup h3 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .affiliate-signup p {
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .affiliate-form {
          display: flex;
          gap: 8px;
          max-width: 400px;
          margin: 0 auto 24px;
        }

        .affiliate-form input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-tertiary);
        }

        .affiliate-benefits {
          display: flex;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .benefit {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--success);
        }

        /* Billing Section */
        .billing-section {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .billing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .transactions-table {
          width: 100%;
          border-collapse: collapse;
        }

        .transactions-table th,
        .transactions-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .transactions-table th {
          font-weight: 500;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .transactions-table .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .transactions-table .status.completed {
          background: var(--success-light);
          color: var(--success);
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        .empty-state svg {
          opacity: 0.5;
          margin-bottom: 12px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: var(--bg-primary);
          border-radius: 16px;
          padding: 24px;
          min-width: 320px;
          max-width: 90%;
        }

        .modal h3 {
          margin-bottom: 8px;
        }

        .modal p {
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .modal input {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-bottom: 16px;
          background: var(--bg-secondary);
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-danger {
          padding: 10px 20px;
          background: var(--error);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          gap: 16px;
          color: var(--text-secondary);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Helper component for feature access display
function FeatureAccess({ name, enabled, icon }) {
  return (
    <div className={`feature-access-item ${enabled ? 'enabled' : 'disabled'}`}>
      {icon}
      <span>{name}</span>
      {enabled ? <Check size={16} /> : <X size={16} />}
      <style>{`
        .feature-access-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }
        .feature-access-item span {
          flex: 1;
        }
        .feature-access-item.enabled {
          color: var(--success);
        }
        .feature-access-item.disabled {
          color: var(--text-secondary);
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
