/**
 * Topic Repository
 * Database operations for topics and topic variations
 */

import db from '../db.js';

const topicRepository = {
    /**
     * Find topic by ID (user-scoped)
     */
    async findById(userId, id) {
        const result = await db.query(
            'SELECT * FROM topics WHERE user_id = $1 AND id = $2',
            [userId, id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get topics for user and platform
     */
    async findByPlatform(platform, options = {}) {
        const { userId, limit = 50, offset = 0, status, niche } = options;
        let query = 'SELECT * FROM topics WHERE user_id = $1 AND platform = $2';
        const params = [userId, platform];
        let paramIndex = 3;

        if (status) {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (niche) {
            query += ` AND niche = $${paramIndex}`;
            params.push(niche);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Create topic (user-scoped)
     */
    async create(data) {
        const {
            userId,
            platform,
            niche,
            topic,
            hook,
            script,
            visualStyle,
            voiceStyle,
            source,
            parentTopicId,
            performanceScore,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO topics (
                user_id, platform, niche, topic, hook, script, visual_style, voice_style,
                source, parent_topic_id, performance_score, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [userId, platform, niche, topic, hook, script, visualStyle, voiceStyle,
             source, parentTopicId, performanceScore || 0, metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Update topic
     */
    async update(id, updates) {
        const allowedFields = [
            'status', 'hook', 'script', 'visual_style', 'voice_style',
            'performance_score', 'metadata'
        ];
        const snakeUpdates = db.keysToSnake(updates);

        const fields = Object.keys(snakeUpdates).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return this.findById(id);

        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => f === 'metadata' ? JSON.stringify(snakeUpdates[f]) : snakeUpdates[f]);

        const result = await db.query(
            `UPDATE topics SET ${setClause}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update topic status
     */
    async updateStatus(id, status) {
        const result = await db.query(
            `UPDATE topics SET status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [id, status]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete topic
     */
    async delete(id) {
        const result = await db.query(
            'DELETE FROM topics WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount > 0;
    },

    /**
     * Get pending topics for user and platform
     */
    async getPendingForUser(userId, platform, limit = 10) {
        const result = await db.query(
            `SELECT * FROM topics
             WHERE user_id = $1 AND platform = $2 AND status = 'pending'
             ORDER BY performance_score DESC, created_at ASC
             LIMIT $3`,
            [userId, platform, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get topics by niche with performance for user
     */
    async getByNicheWithPerformanceForUser(userId, platform, niche, limit = 20) {
        const result = await db.query(
            `SELECT t.*,
                    COALESCE(AVG(va.engagement_rate), 0) as avg_engagement,
                    COUNT(va.id) as video_count
             FROM topics t
             LEFT JOIN video_analytics va ON t.id = va.topic_id
             WHERE t.user_id = $1 AND t.platform = $2 AND t.niche = $3
             GROUP BY t.id
             ORDER BY avg_engagement DESC, t.performance_score DESC
             LIMIT $4`,
            [userId, platform, niche, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    // ============================================
    // TOPIC VARIATIONS
    // ============================================

    /**
     * Create topic variation
     */
    async createVariation(topicId, data) {
        const {
            variationType,
            hook,
            script,
            visualStyle,
            voiceStyle,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO topic_variations (
                topic_id, variation_type, hook, script, visual_style, voice_style, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [topicId, variationType, hook, script, visualStyle, voiceStyle,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get variations for topic
     */
    async getVariations(topicId) {
        const result = await db.query(
            `SELECT * FROM topic_variations WHERE topic_id = $1 ORDER BY created_at DESC`,
            [topicId]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Update variation status
     */
    async updateVariationStatus(variationId, status) {
        const result = await db.query(
            `UPDATE topic_variations SET status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [variationId, status]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get unused variations for user
     */
    async getUnusedVariationsForUser(userId, platform, limit = 10) {
        const result = await db.query(
            `SELECT tv.*, t.niche, t.platform FROM topic_variations tv
             JOIN topics t ON tv.topic_id = t.id
             WHERE t.user_id = $1 AND t.platform = $2 AND tv.status = 'pending'
             ORDER BY tv.created_at ASC
             LIMIT $3`,
            [userId, platform, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Count topics by status for user
     */
    async countByStatusForUser(userId, platform) {
        const result = await db.query(`
            SELECT status, COUNT(*) as count
            FROM topics
            WHERE user_id = $1 AND platform = $2
            GROUP BY status
        `, [userId, platform]);
        return result.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});
    },

    /**
     * Get top performing topics for user
     */
    async getTopPerformingForUser(userId, platform, limit = 10) {
        const result = await db.query(
            `SELECT t.*,
                    AVG(va.engagement_rate) as avg_engagement,
                    AVG(va.retention_rate) as avg_retention,
                    SUM(va.views) as total_views
             FROM topics t
             JOIN video_analytics va ON t.id = va.topic_id
             WHERE t.user_id = $1 AND t.platform = $2
             GROUP BY t.id
             HAVING COUNT(va.id) >= 1
             ORDER BY avg_engagement DESC
             LIMIT $3`,
            [userId, platform, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    }
};

export default topicRepository;
