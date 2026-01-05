/**
 * Training Repository
 * Database operations for ML training samples
 */

import db from '../db.js';

const trainingRepository = {
    /**
     * Create a new training sample
     */
    async createSample(userId, sampleData) {
        const {
            sampleId,
            input,
            script,
            visuals,
            audio,
            timing,
            platformVariants,
            performance,
            meta
        } = sampleData;

        const result = await db.query(
            `INSERT INTO training_samples (
                user_id, sample_id, input, script, visuals, audio,
                timing, platform_variants, performance, meta
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                userId,
                sampleId,
                JSON.stringify(input || {}),
                JSON.stringify(script || {}),
                JSON.stringify(visuals || {}),
                JSON.stringify(audio || {}),
                JSON.stringify(timing || {}),
                JSON.stringify(platformVariants || {}),
                JSON.stringify(performance || {}),
                JSON.stringify(meta || {})
            ]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get all training samples for a user
     */
    async getAllSamples(userId, options = {}) {
        const { limit, offset, orderBy = 'created_at', orderDir = 'DESC' } = options;

        let query = 'SELECT * FROM training_samples WHERE user_id = $1';
        const params = [userId];

        // Add ordering
        query += ` ORDER BY ${orderBy} ${orderDir}`;

        // Add pagination
        if (limit) {
            query += ` LIMIT $${params.length + 1}`;
            params.push(limit);
        }
        if (offset) {
            query += ` OFFSET $${params.length + 1}`;
            params.push(offset);
        }

        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get a specific training sample by sample_id
     */
    async getSampleById(userId, sampleId) {
        const result = await db.query(
            'SELECT * FROM training_samples WHERE user_id = $1 AND sample_id = $2',
            [userId, sampleId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update performance data for a sample
     */
    async updatePerformance(userId, sampleId, platform, performanceData) {
        // First get the current sample
        const sample = await this.getSampleById(userId, sampleId);
        if (!sample) {
            throw new Error(`Sample ${sampleId} not found for user ${userId}`);
        }

        // Update the performance data for the specific platform
        const performance = sample.performance || {};
        performance[platform] = performanceData;
        performance.lastUpdated = new Date().toISOString();

        // Recalculate cross-platform metrics
        const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
        const availablePerf = platforms.filter(p => performance[p]);

        if (availablePerf.length > 0) {
            performance.crossPlatform = {
                totalViews: availablePerf.reduce((sum, p) => sum + (performance[p]?.views || 0), 0),
                totalEngagement: availablePerf.reduce((sum, p) => {
                    const perf = performance[p];
                    return sum + (perf?.likes || 0) + (perf?.comments || 0) + (perf?.shares || 0);
                }, 0),
                bestPlatform: availablePerf.reduce((best, p) => {
                    const current = performance[p]?.score || -10;
                    const bestScore = performance[best]?.score || -10;
                    return current > bestScore ? p : best;
                }, availablePerf[0]),
                universalScore: availablePerf.reduce((sum, p) => sum + (performance[p]?.score || 0), 0) / availablePerf.length,
            };
        }

        // Update the database
        const result = await db.query(
            `UPDATE training_samples
             SET performance = $3, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND sample_id = $2
             RETURNING *`,
            [userId, sampleId, JSON.stringify(performance)]
        );

        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get samples with performance data
     */
    async getSamplesWithPerformance(userId) {
        const result = await db.query(
            `SELECT * FROM training_samples
             WHERE user_id = $1
             AND (
                 performance->>'youtube' IS NOT NULL OR
                 performance->>'tiktok' IS NOT NULL OR
                 performance->>'facebook' IS NOT NULL OR
                 performance->>'instagram' IS NOT NULL
             )
             ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get top performing samples
     */
    async getTopPerformers(userId, limit = 10) {
        const result = await db.query(
            `SELECT * FROM training_samples
             WHERE user_id = $1
             AND performance->'crossPlatform'->>'universalScore' IS NOT NULL
             ORDER BY (performance->'crossPlatform'->>'universalScore')::numeric DESC
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get statistics for user's training data
     */
    async getStats(userId) {
        const result = await db.query(
            `SELECT
                COUNT(*) as total_samples,
                COUNT(CASE WHEN performance->>'youtube' IS NOT NULL THEN 1 END) as youtube_samples,
                COUNT(CASE WHEN performance->>'tiktok' IS NOT NULL THEN 1 END) as tiktok_samples,
                COUNT(CASE WHEN performance->>'facebook' IS NOT NULL THEN 1 END) as facebook_samples,
                COUNT(CASE WHEN performance->>'instagram' IS NOT NULL THEN 1 END) as instagram_samples,
                MIN(created_at) as first_sample_date,
                MAX(created_at) as last_sample_date
             FROM training_samples
             WHERE user_id = $1`,
            [userId]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Delete a training sample
     */
    async deleteSample(userId, sampleId) {
        const result = await db.query(
            'DELETE FROM training_samples WHERE user_id = $1 AND sample_id = $2 RETURNING id',
            [userId, sampleId]
        );
        return result.rowCount > 0;
    },

    /**
     * Delete all training samples for a user
     */
    async deleteAllSamples(userId) {
        const result = await db.query(
            'DELETE FROM training_samples WHERE user_id = $1',
            [userId]
        );
        return result.rowCount;
    }
};

export default trainingRepository;
