/**
 * Post Queue Repository
 * Database operations for post scheduling and results
 */

import db from '../db.js';

const postQueueRepository = {
    // ============================================
    // POST QUEUE
    // ============================================

    /**
     * Add post to queue
     */
    async addToQueue(data) {
        const {
            userId,
            platform,
            videoPath,
            title,
            description,
            hashtags,
            scheduledFor,
            priority,
            topicId,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO post_queue (
                user_id, platform, video_path, title, description, hashtags,
                scheduled_for, priority, topic_id, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [userId, platform, videoPath, title, description,
             hashtags, scheduledFor, priority || 0, topicId,
             metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get queued post by ID
     */
    async findById(id) {
        const result = await db.query(
            'SELECT * FROM post_queue WHERE id = $1',
            [id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get pending posts for user and platform
     */
    async getPendingPostsForUser(userId, platform, limit = 10) {
        const result = await db.query(
            `SELECT * FROM post_queue
             WHERE user_id = $1 AND platform = $2
             AND status = 'pending'
             AND (scheduled_for IS NULL OR scheduled_for <= CURRENT_TIMESTAMP)
             ORDER BY priority DESC, created_at ASC
             LIMIT $3`,
            [userId, platform, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get all pending posts across platforms for user
     */
    async getAllPendingForUser(userId, limit = 50) {
        const result = await db.query(
            `SELECT * FROM post_queue
             WHERE user_id = $1
             AND status = 'pending'
             AND (scheduled_for IS NULL OR scheduled_for <= CURRENT_TIMESTAMP)
             ORDER BY priority DESC, created_at ASC
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get scheduled posts (future) for user
     */
    async getScheduledPostsForUser(userId, platform = null, limit = 50) {
        let query = `SELECT * FROM post_queue
                     WHERE user_id = $1
                     AND status = 'pending'
                     AND scheduled_for > CURRENT_TIMESTAMP`;
        const params = [userId];

        if (platform) {
            query += ' AND platform = $2';
            params.push(platform);
        }

        query += ` ORDER BY scheduled_for ASC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Update post status
     */
    async updateStatus(id, status, errorMessage = null) {
        const result = await db.query(
            `UPDATE post_queue
             SET status = $2,
                 error_message = $3,
                 attempts = CASE WHEN $2 = 'failed' THEN attempts + 1 ELSE attempts END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [id, status, errorMessage]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Mark as processing
     */
    async markProcessing(id) {
        return this.updateStatus(id, 'processing');
    },

    /**
     * Mark as completed
     */
    async markCompleted(id) {
        return this.updateStatus(id, 'completed');
    },

    /**
     * Mark as failed
     */
    async markFailed(id, errorMessage) {
        return this.updateStatus(id, 'failed', errorMessage);
    },

    /**
     * Retry failed post
     */
    async retry(id) {
        const result = await db.query(
            `UPDATE post_queue
             SET status = 'pending',
                 error_message = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'failed'
             RETURNING *`,
            [id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Cancel queued post
     */
    async cancel(id) {
        const result = await db.query(
            `UPDATE post_queue
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status IN ('pending', 'failed')
             RETURNING *`,
            [id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Delete from queue
     */
    async delete(id) {
        const result = await db.query(
            'DELETE FROM post_queue WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount > 0;
    },

    /**
     * Get queue stats for user
     */
    async getQueueStatsForUser(userId, platform = null) {
        let query = `SELECT
                        status,
                        COUNT(*) as count,
                        platform
                     FROM post_queue
                     WHERE user_id = $1`;
        const params = [userId];

        if (platform) {
            query += ' AND platform = $2';
            params.push(platform);
        }

        query += ' GROUP BY status, platform';

        const result = await db.query(query, params);
        return result.rows.map(r => ({
            status: r.status,
            count: parseInt(r.count),
            platform: r.platform
        }));
    },

    /**
     * Get user's queue
     */
    async getUserQueue(userId, options = {}) {
        const { status, platform, limit = 50, offset = 0 } = options;
        let query = 'SELECT * FROM post_queue WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        if (status) {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (platform) {
            query += ` AND platform = $${paramIndex}`;
            params.push(platform);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    // ============================================
    // POST RESULTS
    // ============================================

    /**
     * Save post result
     */
    async saveResult(data) {
        const {
            postQueueId,
            platform,
            platformVideoId,
            postUrl,
            initialViews,
            initialLikes,
            responseData
        } = data;

        const result = await db.query(
            `INSERT INTO post_results (
                post_queue_id, platform, platform_video_id, post_url,
                initial_views, initial_likes, response_data
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [postQueueId, platform, platformVideoId, postUrl,
             initialViews || 0, initialLikes || 0,
             responseData ? JSON.stringify(responseData) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get result for queued post
     */
    async getResult(postQueueId) {
        const result = await db.query(
            'SELECT * FROM post_results WHERE post_queue_id = $1',
            [postQueueId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get results by platform for user
     */
    async getResultsByPlatformForUser(userId, platform, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const result = await db.query(
            `SELECT pr.* FROM post_results pr
             JOIN post_queue pq ON pr.post_queue_id = pq.id
             WHERE pq.user_id = $1 AND pr.platform = $2
             ORDER BY pr.posted_at DESC
             LIMIT $3 OFFSET $4`,
            [userId, platform, limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Update result metrics
     */
    async updateResultMetrics(resultId, views, likes) {
        const result = await db.query(
            `UPDATE post_results
             SET initial_views = $2, initial_likes = $3
             WHERE id = $1 RETURNING *`,
            [resultId, views, likes]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get recent posts with results for user
     */
    async getRecentPostsWithResultsForUser(userId, platform, days = 7, limit = 20) {
        const result = await db.query(
            `SELECT pq.*, pr.platform_video_id, pr.post_url,
                    pr.initial_views, pr.initial_likes, pr.posted_at
             FROM post_queue pq
             LEFT JOIN post_results pr ON pq.id = pr.post_queue_id
             WHERE pq.user_id = $1
             AND pq.platform = $2
             AND pq.status = 'completed'
             AND pq.updated_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
             ORDER BY pq.updated_at DESC
             LIMIT $3`,
            [userId, platform, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get posting frequency stats for user
     */
    async getPostingFrequencyForUser(userId, platform, days = 30) {
        const result = await db.query(`
            SELECT
                DATE(updated_at) as date,
                COUNT(*) as posts
            FROM post_queue
            WHERE user_id = $1
            AND platform = $2
            AND status = 'completed'
            AND updated_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY DATE(updated_at)
            ORDER BY date DESC
        `, [userId, platform]);

        return result.rows.map(r => ({
            date: r.date,
            posts: parseInt(r.posts)
        }));
    }
};

export default postQueueRepository;
