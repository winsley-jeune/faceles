-- ============================================
-- Viral Shorts Generator - PostgreSQL Schema
-- Phase 5: Database Migration
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    avatar VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE user_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- google, facebook, tiktok
    provider_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    profile_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
);

CREATE INDEX idx_user_providers_user_id ON user_providers(user_id);
CREATE INDEX idx_user_providers_provider ON user_providers(provider);

-- ============================================
-- SUBSCRIPTIONS & MONETIZATION
-- ============================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    demo_mode BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

CREATE TABLE usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    videos_generated INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    storage_used BIGINT DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period)
);

CREATE INDEX idx_usage_user_period ON usage(user_id, period);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'completed',
    stripe_invoice_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE TABLE affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    commission_rate DECIMAL(3, 2) DEFAULT 0.20,
    paypal_email VARCHAR(255),
    total_earnings DECIMAL(10, 2) DEFAULT 0,
    pending_earnings DECIMAL(10, 2) DEFAULT 0,
    paid_earnings DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_affiliates_code ON affiliates(code);

CREATE TABLE affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,
    commission DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_affiliate_referrals_affiliate ON affiliate_referrals(affiliate_id);

CREATE TABLE affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    paypal_email VARCHAR(255),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- PLATFORM TOKENS
-- ============================================

CREATE TABLE platform_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_type VARCHAR(50),
    scope TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    -- Legacy columns (for backward compatibility)
    page_id VARCHAR(255),
    page_name VARCHAR(255),
    open_id VARCHAR(255),
    extra_data JSONB,
    -- New columns for multi-tenant token storage
    channel_id VARCHAR(255),        -- YouTube/platform-specific channel ID
    channel_name VARCHAR(255),      -- Channel/account display name
    scopes TEXT,                    -- OAuth scopes granted
    metadata JSONB,                 -- Platform-specific metadata (pageAccessToken, instagramAccountId, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform)
);

CREATE INDEX idx_platform_tokens_user_platform ON platform_tokens(user_id, platform);

-- ============================================
-- TOPICS & CONTENT GENERATION
-- ============================================

CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    platform VARCHAR(50),
    topic TEXT NOT NULL,
    fingerprint VARCHAR(64),
    niche VARCHAR(100),
    hook_type VARCHAR(50),
    emotion VARCHAR(50),
    structure VARCHAR(50),
    source VARCHAR(50),
    viral_score DECIMAL(3, 1),
    video_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'generated',
    performance JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_topics_user_id ON topics(user_id);
CREATE INDEX idx_topics_platform ON topics(platform);
CREATE INDEX idx_topics_fingerprint ON topics(fingerprint);
CREATE INDEX idx_topics_status ON topics(status);

CREATE TABLE topic_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    tone VARCHAR(50),
    hook_type VARCHAR(50),
    emotion VARCHAR(50),
    angle TEXT,
    risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 5),
    status VARCHAR(50) DEFAULT 'pending',
    video_path VARCHAR(500),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    performance JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_topic_variations_source ON topic_variations(source_topic_id);
CREATE INDEX idx_topic_variations_status ON topic_variations(status);

-- ============================================
-- ANALYTICS & PERFORMANCE
-- ============================================

CREATE TABLE video_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    video_id VARCHAR(255) NOT NULL,
    title TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    views BIGINT DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5, 4),
    viral_score DECIMAL(3, 1),
    thumbnail_url TEXT,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, video_id, snapshot_date)
);

CREATE INDEX idx_video_analytics_user ON video_analytics(user_id);
CREATE INDEX idx_video_analytics_platform ON video_analytics(platform);
CREATE INDEX idx_video_analytics_date ON video_analytics(snapshot_date);

CREATE TABLE winning_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    platform VARCHAR(50),
    pattern_type VARCHAR(50) NOT NULL,
    pattern_value VARCHAR(255) NOT NULL,
    sample_count INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    avg_viral_score DECIMAL(3, 1),
    confidence DECIMAL(3, 2),
    is_killed BOOLEAN DEFAULT false,
    killed_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform, pattern_type, pattern_value)
);

CREATE INDEX idx_winning_patterns_user ON winning_patterns(user_id);
CREATE INDEX idx_winning_patterns_platform ON winning_patterns(platform);
CREATE INDEX idx_winning_patterns_type ON winning_patterns(pattern_type);

CREATE TABLE emotion_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    emotion VARCHAR(50) NOT NULL,
    confidence DECIMAL(3, 2),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, video_id)
);

CREATE INDEX idx_emotion_cache_video ON emotion_cache(platform, video_id);

CREATE TABLE retention_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    video_id VARCHAR(255) NOT NULL,
    avg_view_duration INTEGER,
    completion_rate DECIMAL(3, 2),
    hook_effectiveness DECIMAL(3, 2),
    drop_off_points JSONB,
    scene_performance JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, video_id)
);

CREATE INDEX idx_retention_analytics_video ON retention_analytics(platform, video_id);

CREATE TABLE cross_platform_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    pattern TEXT NOT NULL,
    platforms VARCHAR(50)[] NOT NULL,
    unified_score DECIMAL(3, 1),
    platform_scores JSONB,
    transfer_success DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cross_platform_user ON cross_platform_patterns(user_id);

-- ============================================
-- A/B TESTING
-- ============================================

CREATE TABLE ab_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    platform VARCHAR(50),
    niche VARCHAR(100),
    target_samples INTEGER DEFAULT 10,
    status VARCHAR(50) DEFAULT 'running',
    winner_variant VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ab_experiments_user ON ab_experiments(user_id);
CREATE INDEX idx_ab_experiments_status ON ab_experiments(status);

CREATE TABLE ab_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB,
    samples INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    avg_views DECIMAL(12, 2) DEFAULT 0,
    viral_score DECIMAL(3, 1),
    confidence DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ab_variants_experiment ON ab_variants(experiment_id);

CREATE TABLE ab_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES ab_variants(id) ON DELETE CASCADE,
    video_id VARCHAR(255) NOT NULL,
    views BIGINT DEFAULT 0,
    retention DECIMAL(3, 2),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ab_assignments_experiment ON ab_assignments(experiment_id);

-- ============================================
-- POST QUEUE & SCHEDULING
-- ============================================

CREATE TABLE post_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    video_path VARCHAR(500) NOT NULL,
    topic TEXT,
    niche VARCHAR(100),
    content JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_queue_user ON post_queue(user_id);
CREATE INDEX idx_post_queue_status ON post_queue(status);
CREATE INDEX idx_post_queue_scheduled ON post_queue(scheduled_for);

CREATE TABLE post_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_queue_id UUID NOT NULL REFERENCES post_queue(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    platform_post_id VARCHAR(255),
    error_message TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_post_results_queue ON post_results(post_queue_id);
CREATE INDEX idx_post_results_platform ON post_results(platform);

-- ============================================
-- CONFIGURATION
-- ============================================

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

CREATE TABLE brand_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business JSONB,
    products JSONB,
    target_audience JSONB,
    brand_voice JSONB,
    content_goals JSONB,
    templates JSONB,
    onboarding_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_brand_context_user ON brand_context(user_id);

CREATE TABLE promo_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    mode VARCHAR(20) DEFAULT 'mixed',
    frequency JSONB NOT NULL DEFAULT '{"percentage": 20, "interval": 7, "minHoursBetween": 24}',
    platforms JSONB NOT NULL DEFAULT '["youtube", "tiktok", "instagram", "facebook"]',
    content_mix JSONB NOT NULL DEFAULT '{"features": 30, "benefits": 30, "tutorials": 20, "socialProof": 20}',
    tracking JSONB NOT NULL DEFAULT '{"totalGenerated": 0, "totalPosted": 0, "lastPromoPost": null, "lastPromoType": null, "postHistory": []}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_promo_configs_user ON promo_configs(user_id);

CREATE TABLE content_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hooks JSONB NOT NULL DEFAULT '{}',
    topics JSONB NOT NULL DEFAULT '{"focus": [], "avoid": [], "suggested": [], "niches": {"preferred": [], "testing": [], "avoid": []}}',
    titles JSONB NOT NULL DEFAULT '{"patterns": [], "keywords": [], "avoidKeywords": [], "maxLength": 70, "useNumbers": true, "useEmojis": false}',
    content_style JSONB NOT NULL DEFAULT '{"tone": "storytelling", "pacing": "fast", "emotionalHook": true, "useCliffhangers": true, "callToAction": "subtle"}',
    posting JSONB NOT NULL DEFAULT '{"optimalTimes": [], "frequency": "2-3 per day", "bestDays": []}',
    benchmarks JSONB NOT NULL DEFAULT '{"targetViews": 1000, "targetLikes": 50, "targetWatchTime": 70, "currentAvgViews": 0}',
    visuals JSONB NOT NULL DEFAULT '{}',
    learning_history JSONB NOT NULL DEFAULT '[]',
    current_priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_content_configs_user ON content_configs(user_id);

CREATE TABLE exploration_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    global_config JSONB NOT NULL DEFAULT '{"exploration_rate": 0.2, "enabled": true}',
    platform_config JSONB NOT NULL DEFAULT '{}',
    tone_distribution JSONB NOT NULL DEFAULT '{"safe": 0.7, "edgy": 0.2, "controversial": 0.1}',
    auto_adjust JSONB NOT NULL DEFAULT '{"enabled": true}',
    stupid_hustle JSONB NOT NULL DEFAULT '{"enabled": false, "max_per_day": 3}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- ML TRAINING DATA
-- ============================================

CREATE TABLE training_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sample_id VARCHAR(100) UNIQUE NOT NULL, -- Original vid_xxx_xxx format ID

    -- Input features
    input JSONB NOT NULL DEFAULT '{}',

    -- Script features
    script JSONB NOT NULL DEFAULT '{}',

    -- Visual features
    visuals JSONB NOT NULL DEFAULT '{}',

    -- Audio features
    audio JSONB NOT NULL DEFAULT '{}',

    -- Timing features
    timing JSONB NOT NULL DEFAULT '{}',

    -- Platform-specific production metadata
    platform_variants JSONB NOT NULL DEFAULT '{}',

    -- Performance metrics (updated after posting)
    performance JSONB NOT NULL DEFAULT '{}',

    -- Meta fields
    meta JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_samples_user ON training_samples(user_id);
CREATE INDEX idx_training_samples_sample_id ON training_samples(sample_id);
CREATE INDEX idx_training_samples_created ON training_samples(created_at DESC);

-- Performance query optimization
CREATE INDEX idx_training_samples_performance ON training_samples USING GIN (performance);

-- ============================================
-- VISUAL PERFORMANCE TRACKING
-- ============================================

CREATE TABLE visual_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    theme VARCHAR(100) NOT NULL,
    platform VARCHAR(50),
    attempts INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    avg_views DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, theme, platform)
);

CREATE INDEX idx_visual_performance_user ON visual_performance(user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_tokens_updated_at BEFORE UPDATE ON platform_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_winning_patterns_updated_at BEFORE UPDATE ON winning_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cross_platform_patterns_updated_at BEFORE UPDATE ON cross_platform_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_queue_updated_at BEFORE UPDATE ON post_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_context_updated_at BEFORE UPDATE ON brand_context
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promo_configs_updated_at BEFORE UPDATE ON promo_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_configs_updated_at BEFORE UPDATE ON content_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exploration_config_updated_at BEFORE UPDATE ON exploration_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_samples_updated_at BEFORE UPDATE ON training_samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visual_performance_updated_at BEFORE UPDATE ON visual_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_providers_updated_at BEFORE UPDATE ON user_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW user_subscription_summary AS
SELECT
    u.id as user_id,
    u.email,
    u.name,
    COALESCE(s.plan_id, 'free') as plan_id,
    COALESCE(s.status, 'active') as subscription_status,
    s.current_period_end,
    COALESCE(us.videos_generated, 0) as videos_this_month,
    COALESCE(us.api_calls, 0) as api_calls_this_month
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN usage us ON u.id = us.user_id AND us.period = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

CREATE VIEW platform_connection_status AS
SELECT
    u.id as user_id,
    u.email,
    CASE WHEN pt_yt.id IS NOT NULL THEN true ELSE false END as youtube_connected,
    CASE WHEN pt_tt.id IS NOT NULL THEN true ELSE false END as tiktok_connected,
    CASE WHEN pt_fb.id IS NOT NULL THEN true ELSE false END as facebook_connected,
    CASE WHEN pt_ig.id IS NOT NULL THEN true ELSE false END as instagram_connected
FROM users u
LEFT JOIN platform_tokens pt_yt ON u.id = pt_yt.user_id AND pt_yt.platform = 'youtube'
LEFT JOIN platform_tokens pt_tt ON u.id = pt_tt.user_id AND pt_tt.platform = 'tiktok'
LEFT JOIN platform_tokens pt_fb ON u.id = pt_fb.user_id AND pt_fb.platform = 'facebook'
LEFT JOIN platform_tokens pt_ig ON u.id = pt_ig.user_id AND pt_ig.platform = 'instagram';

CREATE VIEW affiliate_dashboard AS
SELECT
    a.id as affiliate_id,
    u.email,
    u.name,
    a.code,
    a.commission_rate,
    a.total_earnings,
    a.pending_earnings,
    a.paid_earnings,
    COUNT(ar.id) as total_referrals,
    COUNT(CASE WHEN ar.created_at > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as monthly_referrals
FROM affiliates a
JOIN users u ON a.user_id = u.id
LEFT JOIN affiliate_referrals ar ON a.id = ar.affiliate_id
GROUP BY a.id, u.email, u.name;

-- ============================================
-- AUDIT LOGS
-- Security audit trail for authentication and authorization events
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event VARCHAR(100) NOT NULL,

    -- Event details (flexible JSONB for various event types)
    details JSONB NOT NULL DEFAULT '{}',

    -- Request context
    ip_address VARCHAR(45),           -- IPv4 or IPv6
    user_agent TEXT,

    -- Platform context (for OAuth events)
    platform VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_event ON audit_logs(user_id, event);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Composite index for common query patterns
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- ============================================
-- TOKEN BLACKLIST
-- JWT token revocation system for secure logout and token invalidation
-- ============================================

CREATE TABLE token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Token hash (SHA-256) - we don't store full tokens
    token_hash VARCHAR(64) UNIQUE NOT NULL,

    -- User context (optional - for user-specific revocations)
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Revocation details
    reason VARCHAR(100) NOT NULL,           -- logout, revoked, security_event, etc.

    -- Expiration (token would expire anyway after this)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Timestamps
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX idx_token_blacklist_hash ON token_blacklist(token_hash);
CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Index for cleanup queries (find expired tokens)
CREATE INDEX idx_token_blacklist_expired ON token_blacklist(expires_at)
WHERE expires_at < CURRENT_TIMESTAMP;
