/**
 * Settings Repository
 * Database operations for user settings, brand context, and exploration config
 */

import db from '../db.js';

const settingsRepository = {
    // ============================================
    // USER SETTINGS
    // ============================================

    /**
     * Get user settings
     */
    async getSettings(userId) {
        const result = await db.query(
            'SELECT * FROM user_settings WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Generic per-user key/value read. user_settings is a KV table
     * (setting_key / setting_value JSONB); used for JSON blobs such as
     * 'emotion_cache' and 'viral_intelligence'. Returns the stored value or null.
     */
    async getKV(userId, key) {
        const result = await db.query(
            'SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = $2',
            [userId, key]
        );
        return result.rows[0] ? result.rows[0].setting_value : null;
    },

    /**
     * Generic per-user key/value upsert (keyed on the user_id+setting_key unique constraint).
     */
    async setKV(userId, key, value) {
        await db.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, setting_key)
             DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
            [userId, key, JSON.stringify(value)]
        );
        return value;
    },

    /**
     * Create or update user settings
     */
    async upsertSettings(userId, settings) {
        const {
            defaultPlatform,
            defaultNiche,
            autoPost,
            postingSchedule,
            notificationEmail,
            notificationPreferences,
            voiceSettings,
            visualSettings,
            metadata
        } = settings;

        const result = await db.query(
            `INSERT INTO user_settings (
                user_id, default_platform, default_niche, auto_post, posting_schedule,
                notification_email, notification_preferences, voice_settings, visual_settings, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (user_id)
             DO UPDATE SET
                default_platform = COALESCE($2, user_settings.default_platform),
                default_niche = COALESCE($3, user_settings.default_niche),
                auto_post = COALESCE($4, user_settings.auto_post),
                posting_schedule = COALESCE($5, user_settings.posting_schedule),
                notification_email = COALESCE($6, user_settings.notification_email),
                notification_preferences = COALESCE($7, user_settings.notification_preferences),
                voice_settings = COALESCE($8, user_settings.voice_settings),
                visual_settings = COALESCE($9, user_settings.visual_settings),
                metadata = COALESCE($10, user_settings.metadata),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, defaultPlatform, defaultNiche, autoPost,
             postingSchedule ? JSON.stringify(postingSchedule) : null,
             notificationEmail,
             notificationPreferences ? JSON.stringify(notificationPreferences) : null,
             voiceSettings ? JSON.stringify(voiceSettings) : null,
             visualSettings ? JSON.stringify(visualSettings) : null,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update specific setting
     */
    async updateSetting(userId, key, value) {
        const allowedKeys = [
            'default_platform', 'default_niche', 'auto_post', 'posting_schedule',
            'notification_email', 'notification_preferences', 'voice_settings',
            'visual_settings', 'metadata'
        ];

        const snakeKey = db.keysToSnake({ [key]: true });
        const dbKey = Object.keys(snakeKey)[0];

        if (!allowedKeys.includes(dbKey)) {
            throw new Error(`Invalid setting key: ${key}`);
        }

        const jsonKeys = ['posting_schedule', 'notification_preferences', 'voice_settings', 'visual_settings', 'metadata'];
        const dbValue = jsonKeys.includes(dbKey) ? JSON.stringify(value) : value;

        const result = await db.query(
            `UPDATE user_settings
             SET ${dbKey} = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, dbValue]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete user settings
     */
    async deleteSettings(userId) {
        const result = await db.query(
            'DELETE FROM user_settings WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount > 0;
    },

    // ============================================
    // BRAND CONTEXT
    // ============================================

    /**
     * Get brand context
     */
    async getBrandContext(userId) {
        const result = await db.query(
            'SELECT * FROM brand_context WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create or update brand context
     */
    async upsertBrandContext(userId, context) {
        const {
            business,
            products,
            targetAudience,
            brandVoice,
            contentGoals,
            templates,
            onboardingComplete
        } = context;

        const result = await db.query(
            `INSERT INTO brand_context (
                user_id, business, products, target_audience, brand_voice,
                content_goals, templates, onboarding_complete
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (user_id)
             DO UPDATE SET
                business = COALESCE($2, brand_context.business),
                products = COALESCE($3, brand_context.products),
                target_audience = COALESCE($4, brand_context.target_audience),
                brand_voice = COALESCE($5, brand_context.brand_voice),
                content_goals = COALESCE($6, brand_context.content_goals),
                templates = COALESCE($7, brand_context.templates),
                onboarding_complete = COALESCE($8, brand_context.onboarding_complete),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                userId,
                business ? JSON.stringify(business) : null,
                products ? JSON.stringify(products) : null,
                targetAudience ? JSON.stringify(targetAudience) : null,
                brandVoice ? JSON.stringify(brandVoice) : null,
                contentGoals ? JSON.stringify(contentGoals) : null,
                templates ? JSON.stringify(templates) : null,
                onboardingComplete
            ]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update specific section of brand context
     */
    async updateBrandSection(userId, section, data) {
        const allowedSections = ['business', 'products', 'target_audience', 'brand_voice', 'content_goals', 'templates'];
        if (!allowedSections.includes(section)) {
            throw new Error(`Invalid brand section: ${section}`);
        }

        const result = await db.query(
            `UPDATE brand_context
             SET ${section} = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, JSON.stringify(data)]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete brand context
     */
    async deleteBrandContext(userId) {
        const result = await db.query(
            'DELETE FROM brand_context WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount > 0;
    },

    // ============================================
    // PROMOTIONAL CONFIG
    // ============================================

    /**
     * Get promo config
     */
    async getPromoConfig(userId) {
        const result = await db.query(
            'SELECT * FROM promo_configs WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create or update promo config
     */
    async upsertPromoConfig(userId, config) {
        const {
            enabled,
            mode,
            frequency,
            platforms,
            contentMix,
            tracking
        } = config;

        const result = await db.query(
            `INSERT INTO promo_configs (
                user_id, enabled, mode, frequency, platforms, content_mix, tracking
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id)
             DO UPDATE SET
                enabled = COALESCE($2, promo_configs.enabled),
                mode = COALESCE($3, promo_configs.mode),
                frequency = COALESCE($4, promo_configs.frequency),
                platforms = COALESCE($5, promo_configs.platforms),
                content_mix = COALESCE($6, promo_configs.content_mix),
                tracking = COALESCE($7, promo_configs.tracking),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                userId,
                enabled,
                mode,
                frequency ? JSON.stringify(frequency) : null,
                platforms ? JSON.stringify(platforms) : null,
                contentMix ? JSON.stringify(contentMix) : null,
                tracking ? JSON.stringify(tracking) : null
            ]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update promo tracking data
     */
    async updatePromoTracking(userId, tracking) {
        const result = await db.query(
            `UPDATE promo_configs
             SET tracking = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, JSON.stringify(tracking)]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete promo config
     */
    async deletePromoConfig(userId) {
        const result = await db.query(
            'DELETE FROM promo_configs WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount > 0;
    },

    // ============================================
    // CONTENT CONFIG
    // ============================================

    /**
     * Get content config
     */
    async getContentConfig(userId) {
        const result = await db.query(
            'SELECT * FROM content_configs WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create or update content config
     */
    async upsertContentConfig(userId, config) {
        const {
            hooks,
            topics,
            titles,
            contentStyle,
            posting,
            benchmarks,
            visuals,
            learningHistory,
            currentPriority
        } = config;

        const result = await db.query(
            `INSERT INTO content_configs (
                user_id, hooks, topics, titles, content_style, posting,
                benchmarks, visuals, learning_history, current_priority
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (user_id)
             DO UPDATE SET
                hooks = COALESCE($2, content_configs.hooks),
                topics = COALESCE($3, content_configs.topics),
                titles = COALESCE($4, content_configs.titles),
                content_style = COALESCE($5, content_configs.content_style),
                posting = COALESCE($6, content_configs.posting),
                benchmarks = COALESCE($7, content_configs.benchmarks),
                visuals = COALESCE($8, content_configs.visuals),
                learning_history = COALESCE($9, content_configs.learning_history),
                current_priority = COALESCE($10, content_configs.current_priority),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                userId,
                hooks ? JSON.stringify(hooks) : null,
                topics ? JSON.stringify(topics) : null,
                titles ? JSON.stringify(titles) : null,
                contentStyle ? JSON.stringify(contentStyle) : null,
                posting ? JSON.stringify(posting) : null,
                benchmarks ? JSON.stringify(benchmarks) : null,
                visuals ? JSON.stringify(visuals) : null,
                learningHistory ? JSON.stringify(learningHistory) : null,
                currentPriority
            ]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update specific section of content config
     */
    async updateContentSection(userId, section, data) {
        const allowedSections = [
            'hooks', 'topics', 'titles', 'content_style', 'posting',
            'benchmarks', 'visuals', 'learning_history', 'current_priority'
        ];
        if (!allowedSections.includes(section)) {
            throw new Error(`Invalid content section: ${section}`);
        }

        const value = section === 'current_priority' ? data : JSON.stringify(data);

        const result = await db.query(
            `UPDATE content_configs
             SET ${section} = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, value]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete content config
     */
    async deleteContentConfig(userId) {
        const result = await db.query(
            'DELETE FROM content_configs WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount > 0;
    },

    // ============================================
    // EXPLORATION CONFIG
    // ============================================

    /**
     * Get exploration config
     */
    async getExplorationConfig(userId) {
        const result = await db.query(
            'SELECT * FROM exploration_config WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Create or update exploration config
     */
    async upsertExplorationConfig(userId, config) {
        const {
            explorationRate,
            minExplorationRate,
            maxExplorationRate,
            adaptiveMode,
            explorationDecay,
            recentWindowSize,
            performanceThreshold,
            metadata
        } = config;

        const result = await db.query(
            `INSERT INTO exploration_config (
                user_id, exploration_rate, min_exploration_rate, max_exploration_rate,
                adaptive_mode, exploration_decay, recent_window_size, performance_threshold, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (user_id)
             DO UPDATE SET
                exploration_rate = COALESCE($2, exploration_config.exploration_rate),
                min_exploration_rate = COALESCE($3, exploration_config.min_exploration_rate),
                max_exploration_rate = COALESCE($4, exploration_config.max_exploration_rate),
                adaptive_mode = COALESCE($5, exploration_config.adaptive_mode),
                exploration_decay = COALESCE($6, exploration_config.exploration_decay),
                recent_window_size = COALESCE($7, exploration_config.recent_window_size),
                performance_threshold = COALESCE($8, exploration_config.performance_threshold),
                metadata = COALESCE($9, exploration_config.metadata),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, explorationRate, minExplorationRate, maxExplorationRate,
             adaptiveMode, explorationDecay, recentWindowSize, performanceThreshold,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update exploration rate
     */
    async updateExplorationRate(userId, rate) {
        const result = await db.query(
            `UPDATE exploration_config
             SET exploration_rate = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 RETURNING *`,
            [userId, rate]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete exploration config
     */
    async deleteExplorationConfig(userId) {
        const result = await db.query(
            'DELETE FROM exploration_config WHERE user_id = $1 RETURNING id',
            [userId]
        );
        return result.rowCount > 0;
    },

    // ============================================
    // GLOBAL SETTINGS (Admin)
    // ============================================

    /**
     * Get all users with auto-post enabled
     */
    async getUsersWithAutoPost() {
        const result = await db.query(
            `SELECT us.*, u.email, u.name FROM user_settings us
             JOIN users u ON us.user_id = u.id
             WHERE us.auto_post = true`
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get users by notification preference
     */
    async getUsersByNotificationPref(preference) {
        const result = await db.query(
            `SELECT us.*, u.email, u.name FROM user_settings us
             JOIN users u ON us.user_id = u.id
             WHERE us.notification_preferences ? $1
             AND (us.notification_preferences->>$1)::boolean = true`,
            [preference]
        );
        return result.rows.map(r => db.keysToCamel(r));
    }
};

export default settingsRepository;
