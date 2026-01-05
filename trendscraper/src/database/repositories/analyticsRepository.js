/**
 * Analytics Repository
 * Database operations for video analytics, winning patterns, retention, and cross-platform data
 */

import db from '../db.js';

const analyticsRepository = {
    // ============================================
    // VIDEO ANALYTICS
    // ============================================

    /**
     * Create video analytics record
     */
    async createVideoAnalytics(data) {
        const {
            userId,
            platform,
            videoId,
            topicId,
            title,
            views,
            likes,
            comments,
            shares,
            watchTime,
            retentionRate,
            engagementRate,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO video_analytics (
                user_id, platform, video_id, topic_id, title, views, likes, comments, shares,
                watch_time, retention_rate, engagement_rate, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (platform, video_id)
             DO UPDATE SET
                user_id = $1, views = $6, likes = $7, comments = $8, shares = $9,
                watch_time = $10, retention_rate = $11, engagement_rate = $12,
                metadata = $13, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, platform, videoId, topicId, title, views || 0, likes || 0,
             comments || 0, shares || 0, watchTime || 0, retentionRate || 0,
             engagementRate || 0, metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get video analytics by platform video ID (user-scoped)
     */
    async getVideoAnalytics(userId, platform, videoId) {
        const result = await db.query(
            'SELECT * FROM video_analytics WHERE user_id = $1 AND platform = $2 AND video_id = $3',
            [userId, platform, videoId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get analytics for platform and user
     */
    async getAnalyticsByPlatformAndUser(userId, platform, options = {}) {
        const { limit = 50, offset = 0, orderBy = 'created_at DESC', days } = options;
        let query = `SELECT * FROM video_analytics
                     WHERE user_id = $1 AND platform = $2`;
        const params = [userId, platform];
        let paramIndex = 3;

        if (days) {
            query += ` AND created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
        }

        query += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get platform summary stats for user
     */
    async getPlatformSummaryForUser(userId, platform, days = 30) {
        const result = await db.query(`
            SELECT
                COUNT(*) as total_videos,
                SUM(views) as total_views,
                SUM(likes) as total_likes,
                AVG(engagement_rate) as avg_engagement,
                MAX(views) as top_views
            FROM video_analytics
            WHERE user_id = $1 AND platform = $2
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
        `, [userId, platform]);

        const row = result.rows[0];
        return {
            totalVideos: parseInt(row.total_videos) || 0,
            totalViews: parseInt(row.total_views) || 0,
            totalLikes: parseInt(row.total_likes) || 0,
            avgEngagement: parseFloat(row.avg_engagement) || 0,

            topViews: parseInt(row.top_views) || 0
        };
    },

    // ============================================
    // WINNING PATTERNS
    // ============================================

    /**
     * Save winning pattern (user-scoped)
     */
    async saveWinningPattern(data) {
        const {
            userId,
            platform,
            patternType,
            pattern,
            score,
            sampleSize,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO winning_patterns (user_id, platform, pattern_type, pattern, score, sample_size, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, platform, pattern_type, pattern)
             DO UPDATE SET
                score = $5,
                sample_size = $6,
                metadata = COALESCE($7, winning_patterns.metadata),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, platform, patternType, pattern, score, sampleSize || 0,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get winning patterns for user and platform
     */
    async getWinningPatternsForUser(userId, platform, patternType = null) {
        let query = 'SELECT * FROM winning_patterns WHERE user_id = $1 AND platform = $2';
        const params = [userId, platform];

        if (patternType) {
            query += ' AND pattern_type = $3';
            params.push(patternType);
        }

        query += ' ORDER BY score DESC';
        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get top patterns by type for user
     */
    async getTopPatternsForUser(userId, platform, patternType, limit = 10) {
        const result = await db.query(
            `SELECT * FROM winning_patterns
             WHERE user_id = $1 AND platform = $2 AND pattern_type = $3
             ORDER BY score DESC
             LIMIT $4`,
            [userId, platform, patternType, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    // ============================================
    // EMOTION CACHE
    // ============================================

    /**
     * Get cached emotion
     */
    async getCachedEmotion(textHash) {
        const result = await db.query(
            'SELECT * FROM emotion_cache WHERE text_hash = $1',
            [textHash]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Cache emotion result
     */
    async cacheEmotion(textHash, text, emotion, confidence) {
        const result = await db.query(
            `INSERT INTO emotion_cache (text_hash, text, emotion, confidence)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (text_hash)
             DO UPDATE SET emotion = $3, confidence = $4, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [textHash, text, emotion, confidence]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Clean old emotion cache entries
     */
    async cleanEmotionCache(daysOld = 30) {
        const result = await db.query(
            `DELETE FROM emotion_cache
             WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
             RETURNING id`
        );
        return result.rowCount;
    },

    // ============================================
    // RETENTION ANALYTICS
    // ============================================

    /**
     * Save retention analytics
     */
    async saveRetentionAnalytics(data) {
        const {
            videoAnalyticsId,
            hookRetention,
            midRetention,
            endRetention,
            dropOffPoints,
            peakPoints,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO retention_analytics (
                video_analytics_id, hook_retention, mid_retention, end_retention,
                drop_off_points, peak_points, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (video_analytics_id)
             DO UPDATE SET
                hook_retention = $2, mid_retention = $3, end_retention = $4,
                drop_off_points = $5, peak_points = $6, metadata = $7,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [videoAnalyticsId, hookRetention, midRetention, endRetention,
             dropOffPoints ? JSON.stringify(dropOffPoints) : null,
             peakPoints ? JSON.stringify(peakPoints) : null,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get retention analytics for video
     */
    async getRetentionAnalytics(videoAnalyticsId) {
        const result = await db.query(
            'SELECT * FROM retention_analytics WHERE video_analytics_id = $1',
            [videoAnalyticsId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get average retention by platform for user
     */
    async getAverageRetentionForUser(userId, platform) {
        const result = await db.query(`
            SELECT
                AVG(ra.hook_retention) as avg_hook,
                AVG(ra.mid_retention) as avg_mid,
                AVG(ra.end_retention) as avg_end
            FROM retention_analytics ra
            JOIN video_analytics va ON ra.video_analytics_id = va.id
            WHERE va.user_id = $1 AND va.platform = $2
        `, [userId, platform]);

        const row = result.rows[0];
        return {
            avgHook: parseFloat(row.avg_hook) || 0,
            avgMid: parseFloat(row.avg_mid) || 0,
            avgEnd: parseFloat(row.avg_end) || 0
        };
    },

    // ============================================
    // CROSS-PLATFORM PATTERNS
    // ============================================

    /**
     * Save cross-platform pattern (user-scoped)
     */
    async saveCrossPlatformPattern(data) {
        const {
            userId,
            patternType,
            pattern,
            platforms,
            avgScore,
            platformScores,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO cross_platform_patterns (
                user_id, pattern_type, pattern, platforms, avg_score, platform_scores, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, pattern_type, pattern)
             DO UPDATE SET
                platforms = $4, avg_score = $5, platform_scores = $6,
                metadata = $7, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, patternType, pattern, platforms, avgScore,
             platformScores ? JSON.stringify(platformScores) : null,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get cross-platform patterns for user
     */
    async getCrossPlatformPatternsForUser(userId, patternType = null) {
        let query = 'SELECT * FROM cross_platform_patterns WHERE user_id = $1';
        const params = [userId];

        if (patternType) {
            query += ' AND pattern_type = $2';
            params.push(patternType);
        }

        query += ' ORDER BY avg_score DESC';
        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get patterns performing well on multiple platforms for user
     */
    async getUniversalPatternsForUser(userId, minPlatforms = 3, minScore = 0.7) {
        const result = await db.query(
            `SELECT * FROM cross_platform_patterns
             WHERE user_id = $1
             AND array_length(platforms, 1) >= $2
             AND avg_score >= $3
             ORDER BY avg_score DESC`,
            [userId, minPlatforms, minScore]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    // ============================================
    // VISUAL PERFORMANCE
    // ============================================

    /**
     * Save visual performance data
     */
    async saveVisualPerformance(data) {
        const {
            videoAnalyticsId,
            visualStyle,
            colorScheme,
            textStyle,
            transitionStyle,
            performanceScore,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO visual_performance (
                video_analytics_id, visual_style, color_scheme, text_style,
                transition_style, performance_score, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (video_analytics_id)
             DO UPDATE SET
                visual_style = $2, color_scheme = $3, text_style = $4,
                transition_style = $5, performance_score = $6, metadata = $7,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [videoAnalyticsId, visualStyle, colorScheme, textStyle,
             transitionStyle, performanceScore,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get top visual styles by platform for user
     */
    async getTopVisualStylesForUser(userId, platform, limit = 10) {
        const result = await db.query(`
            SELECT
                vp.visual_style,
                AVG(vp.performance_score) as avg_score,
                COUNT(*) as usage_count
            FROM visual_performance vp
            JOIN video_analytics va ON vp.video_analytics_id = va.id
            WHERE va.user_id = $1 AND va.platform = $2
            GROUP BY vp.visual_style
            HAVING COUNT(*) >= 3
            ORDER BY avg_score DESC
            LIMIT $3
        `, [userId, platform, limit]);
        return result.rows.map(r => ({
            visualStyle: r.visual_style,
            avgScore: parseFloat(r.avg_score),
            usageCount: parseInt(r.usage_count)
        }));
    }
};

export default analyticsRepository;
