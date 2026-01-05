/**
 * A/B Testing Repository
 * Database operations for experiments, variants, and assignments
 */

import db from '../db.js';

const abTestingRepository = {
    // ============================================
    // EXPERIMENTS
    // ============================================

    /**
     * Create experiment
     */
    async createExperiment(data) {
        const {
            name,
            description,
            platform,
            targetMetric,
            minSampleSize,
            confidenceLevel,
            metadata
        } = data;

        const result = await db.query(
            `INSERT INTO ab_experiments (
                name, description, platform, target_metric, min_sample_size,
                confidence_level, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, description, platform, targetMetric, minSampleSize || 100,
             confidenceLevel || 0.95, metadata ? JSON.stringify(metadata) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get experiment by ID
     */
    async findExperimentById(id) {
        const result = await db.query(
            'SELECT * FROM ab_experiments WHERE id = $1',
            [id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get active experiments for platform
     */
    async getActiveExperiments(platform) {
        const result = await db.query(
            `SELECT * FROM ab_experiments
             WHERE platform = $1 AND status = 'active'
             ORDER BY created_at DESC`,
            [platform]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get all experiments
     */
    async getAllExperiments(options = {}) {
        const { status, platform, limit = 50, offset = 0 } = options;
        let query = 'SELECT * FROM ab_experiments WHERE 1=1';
        const params = [];
        let paramIndex = 1;

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

    /**
     * Update experiment status
     */
    async updateExperimentStatus(id, status) {
        const endedAt = status === 'completed' || status === 'stopped'
            ? 'CURRENT_TIMESTAMP' : 'NULL';

        const result = await db.query(
            `UPDATE ab_experiments
             SET status = $2, ended_at = ${endedAt}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [id, status]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update experiment with winner
     */
    async setExperimentWinner(experimentId, winningVariantId) {
        const result = await db.query(
            `UPDATE ab_experiments
             SET status = 'completed', winning_variant_id = $2,
                 ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [experimentId, winningVariantId]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    // ============================================
    // VARIANTS
    // ============================================

    /**
     * Create variant
     */
    async createVariant(experimentId, data) {
        const {
            name,
            description,
            isControl,
            trafficPercent,
            config
        } = data;

        const result = await db.query(
            `INSERT INTO ab_variants (
                experiment_id, name, description, is_control, traffic_percent, config
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [experimentId, name, description, isControl || false,
             trafficPercent || 50, config ? JSON.stringify(config) : null]
        );
        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get variants for experiment
     */
    async getVariants(experimentId) {
        const result = await db.query(
            `SELECT * FROM ab_variants
             WHERE experiment_id = $1
             ORDER BY is_control DESC, created_at ASC`,
            [experimentId]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get variant by ID
     */
    async findVariantById(id) {
        const result = await db.query(
            'SELECT * FROM ab_variants WHERE id = $1',
            [id]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update variant metrics
     */
    async updateVariantMetrics(variantId, impressions, conversions, metricValue) {
        const result = await db.query(
            `UPDATE ab_variants
             SET impressions = impressions + $2,
                 conversions = conversions + $3,
                 metric_value = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [variantId, impressions, conversions, metricValue]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Set variant metrics directly
     */
    async setVariantMetrics(variantId, data) {
        const { impressions, conversions, metricValue } = data;
        const result = await db.query(
            `UPDATE ab_variants
             SET impressions = $2, conversions = $3, metric_value = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 RETURNING *`,
            [variantId, impressions, conversions, metricValue]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    // ============================================
    // ASSIGNMENTS
    // ============================================

    /**
     * Create assignment
     */
    async createAssignment(experimentId, variantId, entityId, entityType = 'video') {
        const result = await db.query(
            `INSERT INTO ab_assignments (experiment_id, variant_id, entity_id, entity_type)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (experiment_id, entity_id, entity_type) DO NOTHING
             RETURNING *`,
            [experimentId, variantId, entityId, entityType]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get assignment for entity
     */
    async getAssignment(experimentId, entityId, entityType = 'video') {
        const result = await db.query(
            `SELECT a.*, v.name as variant_name, v.config as variant_config
             FROM ab_assignments a
             JOIN ab_variants v ON a.variant_id = v.id
             WHERE a.experiment_id = $1 AND a.entity_id = $2 AND a.entity_type = $3`,
            [experimentId, entityId, entityType]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Update assignment outcome
     */
    async updateAssignmentOutcome(assignmentId, outcome, metadata = null) {
        const result = await db.query(
            `UPDATE ab_assignments
             SET outcome = $2, metadata = COALESCE($3, metadata)
             WHERE id = $1 RETURNING *`,
            [assignmentId, outcome, metadata ? JSON.stringify(metadata) : null]
        );
        return result.rows[0] ? db.keysToCamel(result.rows[0]) : null;
    },

    /**
     * Get assignments for experiment
     */
    async getAssignments(experimentId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const result = await db.query(
            `SELECT a.*, v.name as variant_name
             FROM ab_assignments a
             JOIN ab_variants v ON a.variant_id = v.id
             WHERE a.experiment_id = $1
             ORDER BY a.created_at DESC
             LIMIT $2 OFFSET $3`,
            [experimentId, limit, offset]
        );
        return result.rows.map(r => db.keysToCamel(r));
    },

    // ============================================
    // ANALYSIS
    // ============================================

    /**
     * Get experiment results summary
     */
    async getExperimentResults(experimentId) {
        const result = await db.query(`
            SELECT
                v.id as variant_id,
                v.name,
                v.is_control,
                v.impressions,
                v.conversions,
                v.metric_value,
                CASE WHEN v.impressions > 0
                    THEN v.conversions::float / v.impressions
                    ELSE 0
                END as conversion_rate,
                COUNT(a.id) as assignment_count,
                AVG(a.outcome) as avg_outcome
            FROM ab_variants v
            LEFT JOIN ab_assignments a ON v.id = a.variant_id
            WHERE v.experiment_id = $1
            GROUP BY v.id
            ORDER BY v.is_control DESC, conversion_rate DESC
        `, [experimentId]);

        return result.rows.map(r => ({
            variantId: r.variant_id,
            name: r.name,
            isControl: r.is_control,
            impressions: parseInt(r.impressions),
            conversions: parseInt(r.conversions),
            metricValue: parseFloat(r.metric_value) || 0,
            conversionRate: parseFloat(r.conversion_rate),
            assignmentCount: parseInt(r.assignment_count),
            avgOutcome: parseFloat(r.avg_outcome) || 0
        }));
    },

    /**
     * Check if experiment has enough data
     */
    async hasEnoughData(experimentId) {
        const experiment = await this.findExperimentById(experimentId);
        if (!experiment) return false;

        const result = await db.query(
            `SELECT MIN(impressions) as min_impressions
             FROM ab_variants WHERE experiment_id = $1`,
            [experimentId]
        );

        const minImpressions = parseInt(result.rows[0].min_impressions) || 0;
        return minImpressions >= experiment.minSampleSize;
    },

    /**
     * Get experiment with full details
     */
    async getExperimentWithDetails(experimentId) {
        const experiment = await this.findExperimentById(experimentId);
        if (!experiment) return null;

        const variants = await this.getVariants(experimentId);
        const results = await this.getExperimentResults(experimentId);

        return {
            ...experiment,
            variants,
            results
        };
    },

    /**
     * Assign entity to random variant
     */
    async assignToRandomVariant(experimentId, entityId, entityType = 'video') {
        // Check existing assignment
        const existing = await this.getAssignment(experimentId, entityId, entityType);
        if (existing) return existing;

        // Get variants with traffic weights
        const variants = await this.getVariants(experimentId);
        if (variants.length === 0) return null;

        // Weighted random selection
        const totalWeight = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
        let random = Math.random() * totalWeight;
        let selectedVariant = variants[0];

        for (const variant of variants) {
            random -= variant.trafficPercent;
            if (random <= 0) {
                selectedVariant = variant;
                break;
            }
        }

        return this.createAssignment(experimentId, selectedVariant.id, entityId, entityType);
    }
};

export default abTestingRepository;
