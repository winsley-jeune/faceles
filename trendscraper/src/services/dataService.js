/**
 * Data Service - Multi-Tenant Edition
 * PostgreSQL-only data access with user isolation
 * All methods require userId for proper multi-tenant support
 */

import database, { isDatabaseAvailable } from '../database/index.js';

/**
 * Check if database is available
 * @throws {Error} If database is not available
 */
function ensureDatabase() {
    if (!isDatabaseAvailable()) {
        throw new Error('Database not available. Ensure PostgreSQL is running and USE_DATABASE=true');
    }
}

/**
 * Validate userId parameter
 * @param {string} userId - User ID
 * @param {string} operation - Operation name for error message
 * @throws {Error} If userId is missing
 */
function validateUserId(userId, operation) {
    if (!userId) {
        throw new Error(`userId is required for ${operation}`);
    }
}

// ============================================
// PLATFORM TOKENS
// ============================================

export const tokenService = {
    /**
     * Get platform token for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     */
    async getToken(userId, platform) {
        validateUserId(userId, 'tokenService.getToken');
        ensureDatabase();
        return database.tokens.findByPlatform(userId, platform);
    },

    /**
     * Save platform token for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {object} tokenData - Token data
     */
    async saveToken(userId, platform, tokenData) {
        validateUserId(userId, 'tokenService.saveToken');
        ensureDatabase();
        return database.tokens.upsert(userId, platform, tokenData);
    },

    /**
     * Delete platform token for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     */
    async deleteToken(userId, platform) {
        validateUserId(userId, 'tokenService.deleteToken');
        ensureDatabase();
        return database.tokens.delete(userId, platform);
    }
};

// ============================================
// TOPICS
// ============================================

export const topicService = {
    /**
     * Get topics for user and platform
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {object} options - Query options
     */
    async getTopics(userId, platform, options = {}) {
        validateUserId(userId, 'topicService.getTopics');
        ensureDatabase();
        return database.topics.findByPlatform(platform, { userId, ...options });
    },

    /**
     * Save topic for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {object} topicData - Topic data
     */
    async saveTopic(userId, platform, topicData) {
        validateUserId(userId, 'topicService.saveTopic');
        ensureDatabase();
        return database.topics.create({
            userId,
            platform,
            ...topicData
        });
    },

    /**
     * Update topic status
     * @param {string} topicId - Topic ID
     * @param {string} status - New status
     */
    async updateTopicStatus(topicId, status) {
        ensureDatabase();
        return database.topics.updateStatus(topicId, status);
    },

    /**
     * Get pending topics for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {number} limit - Maximum number of topics
     */
    async getPendingTopics(userId, platform, limit = 10) {
        validateUserId(userId, 'topicService.getPendingTopics');
        ensureDatabase();
        return database.topics.getPendingForUser(userId, platform, limit);
    },

    /**
     * Get top performing topics for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {number} limit - Maximum number of topics
     */
    async getTopPerforming(userId, platform, limit = 10) {
        validateUserId(userId, 'topicService.getTopPerforming');
        ensureDatabase();
        return database.topics.getTopPerformingForUser(userId, platform, limit);
    }
};

// ============================================
// ANALYTICS
// ============================================

export const analyticsService = {
    /**
     * Get analytics history for user
     * @param {string} userId - User ID (required)
     * @param {object} options - Query options (platform, days)
     */
    async getAnalyticsHistory(userId, options = {}) {
        validateUserId(userId, 'analyticsService.getAnalyticsHistory');
        ensureDatabase();

        const { platform, days = 30 } = options;

        if (platform) {
            return database.analytics.getAnalyticsByPlatformAndUser(userId, platform, { days });
        }

        // Aggregate from all platforms
        const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
        const results = {};
        for (const p of platforms) {
            results[p] = await database.analytics.getAnalyticsByPlatformAndUser(userId, p, { days });
        }
        return results;
    },

    /**
     * Save video analytics for user
     * @param {string} userId - User ID (required)
     * @param {object} data - Analytics data
     */
    async saveVideoAnalytics(userId, data) {
        validateUserId(userId, 'analyticsService.saveVideoAnalytics');
        ensureDatabase();
        return database.analytics.createVideoAnalytics({
            userId,
            ...data
        });
    },

    /**
     * Get winning patterns for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {string} patternType - Pattern type (optional)
     */
    async getWinningPatterns(userId, platform, patternType = null) {
        validateUserId(userId, 'analyticsService.getWinningPatterns');
        ensureDatabase();
        return database.analytics.getWinningPatternsForUser(userId, platform, patternType);
    },

    /**
     * Save winning pattern for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {object} patternData - Pattern data
     */
    async saveWinningPattern(userId, platform, patternData) {
        validateUserId(userId, 'analyticsService.saveWinningPattern');
        ensureDatabase();
        return database.analytics.saveWinningPattern({
            userId,
            platform,
            ...patternData
        });
    },

    /**
     * Get platform summary for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {number} days - Number of days to include
     */
    async getPlatformSummary(userId, platform, days = 30) {
        validateUserId(userId, 'analyticsService.getPlatformSummary');
        ensureDatabase();
        return database.analytics.getPlatformSummaryForUser(userId, platform, days);
    }
};

// ============================================
// VIRAL INTELLIGENCE
// ============================================

export const viralIntelligenceService = {
    /**
     * Get viral intelligence data for user
     * @param {string} userId - User ID (required)
     * @param {string} patternType - Pattern type (optional)
     */
    async getData(userId, patternType = null) {
        validateUserId(userId, 'viralIntelligenceService.getData');
        ensureDatabase();
        return database.analytics.getCrossPlatformPatternsForUser(userId, patternType);
    },

    /**
     * Save viral intelligence pattern for user
     * @param {string} userId - User ID (required)
     * @param {object} patternData - Pattern data
     */
    async savePattern(userId, patternData) {
        validateUserId(userId, 'viralIntelligenceService.savePattern');
        ensureDatabase();
        return database.analytics.saveCrossPlatformPattern({
            userId,
            ...patternData
        });
    },

    /**
     * Get universal patterns (work across all platforms) for user
     * @param {string} userId - User ID (required)
     * @param {number} minPlatforms - Minimum number of platforms
     * @param {number} minScore - Minimum average score
     */
    async getUniversalPatterns(userId, minPlatforms = 3, minScore = 0.7) {
        validateUserId(userId, 'viralIntelligenceService.getUniversalPatterns');
        ensureDatabase();
        return database.analytics.getUniversalPatternsForUser(userId, minPlatforms, minScore);
    }
};

// ============================================
// EXPLORATION CONFIG
// ============================================

export const explorationService = {
    /**
     * Get exploration config for user
     * @param {string} userId - User ID (required)
     */
    async getConfig(userId) {
        validateUserId(userId, 'explorationService.getConfig');
        ensureDatabase();

        const config = await database.settings.getExplorationConfig(userId);

        // Return default if no config exists
        if (!config) {
            return {
                explorationRate: 0.2,
                minExplorationRate: 0.05,
                maxExplorationRate: 0.4,
                adaptiveMode: true
            };
        }

        return config;
    },

    /**
     * Save exploration config for user
     * @param {string} userId - User ID (required)
     * @param {object} config - Configuration data
     */
    async saveConfig(userId, config) {
        validateUserId(userId, 'explorationService.saveConfig');
        ensureDatabase();
        return database.settings.upsertExplorationConfig(userId, config);
    }
};

// ============================================
// POST QUEUE
// ============================================

export const postQueueService = {
    /**
     * Get post queue for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name (optional)
     */
    async getQueue(userId, platform = null) {
        validateUserId(userId, 'postQueueService.getQueue');
        ensureDatabase();

        if (platform) {
            return database.postQueue.getPendingPostsForUser(userId, platform);
        }
        return database.postQueue.getAllPendingForUser(userId);
    },

    /**
     * Add post to queue for user
     * @param {string} userId - User ID (required)
     * @param {object} postData - Post data
     */
    async addToQueue(userId, postData) {
        validateUserId(userId, 'postQueueService.addToQueue');
        ensureDatabase();
        return database.postQueue.addToQueue({
            userId,
            ...postData
        });
    },

    /**
     * Update post status
     * @param {string} postId - Post ID
     * @param {string} status - New status
     * @param {string} error - Error message (optional)
     */
    async updateStatus(postId, status, error = null) {
        ensureDatabase();
        return database.postQueue.updateStatus(postId, status, error);
    }
};

// ============================================
// VARIATIONS
// ============================================

export const variationService = {
    /**
     * Get variation queue for user
     * @param {string} userId - User ID (required)
     * @param {string} platform - Platform name
     * @param {number} limit - Maximum number of variations
     */
    async getQueue(userId, platform, limit = 100) {
        validateUserId(userId, 'variationService.getQueue');
        ensureDatabase();
        return database.topics.getUnusedVariationsForUser(userId, platform, limit);
    },

    /**
     * Add variation for topic
     * @param {string} topicId - Topic ID
     * @param {object} variation - Variation data
     */
    async addVariation(topicId, variation) {
        ensureDatabase();
        return database.topics.createVariation(topicId, variation);
    }
};

// ============================================
// VARIATION ENGINE (for auto-posting)
// ============================================

export const variationEngineService = {
    /**
     * Get variation queue from user settings
     * @param {string} userId - User ID (required)
     */
    async getVariationQueue(userId) {
        validateUserId(userId, 'variationEngineService.getVariationQueue');
        ensureDatabase();

        const result = await database.query(
            'SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = $2',
            [userId, 'variation_queue']
        );

        return result.rows[0] ? result.rows[0].setting_value : null;
    },

    /**
     * Save variation queue to user settings
     * @param {string} userId - User ID (required)
     * @param {object} queue - Variation queue data
     */
    async saveVariationQueue(userId, queue) {
        validateUserId(userId, 'variationEngineService.saveVariationQueue');
        ensureDatabase();

        await database.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, setting_key)
             DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
            [userId, 'variation_queue', JSON.stringify(queue)]
        );
    },

    /**
     * Get posting schedule from user settings
     * @param {string} userId - User ID (required)
     */
    async getPostingSchedule(userId) {
        validateUserId(userId, 'variationEngineService.getPostingSchedule');
        ensureDatabase();

        const result = await database.query(
            'SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = $2',
            [userId, 'posting_schedule']
        );

        return result.rows[0] ? result.rows[0].setting_value : null;
    },

    /**
     * Save posting schedule to user settings
     * @param {string} userId - User ID (required)
     * @param {object} schedule - Posting schedule data
     */
    async savePostingSchedule(userId, schedule) {
        validateUserId(userId, 'variationEngineService.savePostingSchedule');
        ensureDatabase();

        await database.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, setting_key)
             DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
            [userId, 'posting_schedule', JSON.stringify(schedule)]
        );
    }
};

// ============================================
// EMOTION CACHE (GLOBAL - Can be shared)
// ============================================

export const emotionCacheService = {
    /**
     * Get cached emotion analysis
     * @param {string} textHash - Text hash
     */
    async get(textHash) {
        ensureDatabase();
        const cached = await database.analytics.getCachedEmotion(textHash);
        return cached ? { emotion: cached.emotion, confidence: cached.confidence } : null;
    },

    /**
     * Cache emotion analysis result
     * @param {string} textHash - Text hash
     * @param {string} text - Original text
     * @param {string} emotion - Detected emotion
     * @param {number} confidence - Confidence score
     */
    async set(textHash, text, emotion, confidence) {
        ensureDatabase();
        return database.analytics.cacheEmotion(textHash, text, emotion, confidence);
    }
};

// ============================================
// VISUAL PERFORMANCE
// ============================================

export const visualPerformanceService = {
    /**
     * Get visual performance data for user
     * @param {string} userId - User ID (required)
     */
    async getData(userId) {
        validateUserId(userId, 'visualPerformanceService.getData');
        ensureDatabase();

        const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
        const results = {};
        for (const platform of platforms) {
            results[platform] = await database.analytics.getTopVisualStylesForUser(userId, platform);
        }
        return results;
    },

    /**
     * Save visual performance data
     * @param {string} userId - User ID (required)
     * @param {string} videoAnalyticsId - Video analytics ID
     * @param {object} data - Visual performance data
     */
    async saveData(userId, videoAnalyticsId, data) {
        validateUserId(userId, 'visualPerformanceService.saveData');
        ensureDatabase();
        return database.analytics.saveVisualPerformance({
            videoAnalyticsId,
            ...data
        });
    }
};

// ============================================
// BRAND CONTEXT
// ============================================

export const brandContextService = {
    /**
     * Get brand context for user
     * @param {string} userId - User ID (required)
     */
    async get(userId) {
        validateUserId(userId, 'brandContextService.get');
        ensureDatabase();
        return database.settings.getBrandContext(userId);
    },

    /**
     * Save brand context for user
     * @param {string} userId - User ID (required)
     * @param {object} context - Brand context data
     */
    async save(userId, context) {
        validateUserId(userId, 'brandContextService.save');
        ensureDatabase();
        return database.settings.upsertBrandContext(userId, context);
    },

    /**
     * Update specific section of brand context
     * @param {string} userId - User ID (required)
     * @param {string} section - Section name
     * @param {object} data - Section data
     */
    async updateSection(userId, section, data) {
        validateUserId(userId, 'brandContextService.updateSection');
        ensureDatabase();
        return database.settings.updateBrandSection(userId, section, data);
    },

    /**
     * Delete brand context for user
     * @param {string} userId - User ID (required)
     */
    async delete(userId) {
        validateUserId(userId, 'brandContextService.delete');
        ensureDatabase();
        return database.settings.deleteBrandContext(userId);
    }
};

// ============================================
// PROMOTIONAL CONFIG
// ============================================

export const promoConfigService = {
    /**
     * Get promo config for user
     * @param {string} userId - User ID (required)
     */
    async get(userId) {
        validateUserId(userId, 'promoConfigService.get');
        ensureDatabase();
        return database.settings.getPromoConfig(userId);
    },

    /**
     * Save promo config for user
     * @param {string} userId - User ID (required)
     * @param {object} config - Promo config data
     */
    async save(userId, config) {
        validateUserId(userId, 'promoConfigService.save');
        ensureDatabase();
        return database.settings.upsertPromoConfig(userId, config);
    },

    /**
     * Update promo tracking data
     * @param {string} userId - User ID (required)
     * @param {object} tracking - Tracking data
     */
    async updateTracking(userId, tracking) {
        validateUserId(userId, 'promoConfigService.updateTracking');
        ensureDatabase();
        return database.settings.updatePromoTracking(userId, tracking);
    },

    /**
     * Delete promo config for user
     * @param {string} userId - User ID (required)
     */
    async delete(userId) {
        validateUserId(userId, 'promoConfigService.delete');
        ensureDatabase();
        return database.settings.deletePromoConfig(userId);
    }
};

// ============================================
// CONTENT CONFIG
// ============================================

export const contentConfigService = {
    /**
     * Get content config for user
     * @param {string} userId - User ID (required)
     */
    async get(userId) {
        validateUserId(userId, 'contentConfigService.get');
        ensureDatabase();
        return database.settings.getContentConfig(userId);
    },

    /**
     * Save content config for user
     * @param {string} userId - User ID (required)
     * @param {object} config - Content config data
     */
    async save(userId, config) {
        validateUserId(userId, 'contentConfigService.save');
        ensureDatabase();
        return database.settings.upsertContentConfig(userId, config);
    },

    /**
     * Update specific section of content config
     * @param {string} userId - User ID (required)
     * @param {string} section - Section name
     * @param {object} data - Section data
     */
    async updateSection(userId, section, data) {
        validateUserId(userId, 'contentConfigService.updateSection');
        ensureDatabase();
        return database.settings.updateContentSection(userId, section, data);
    },

    /**
     * Delete content config for user
     * @param {string} userId - User ID (required)
     */
    async delete(userId) {
        validateUserId(userId, 'contentConfigService.delete');
        ensureDatabase();
        return database.settings.deleteContentConfig(userId);
    }
};

// ============================================
// TRAINING DATA
// ============================================

export const trainingService = {
    /**
     * Create a new training sample
     * @param {string} userId - User ID (required)
     * @param {object} sampleData - Training sample data
     */
    async createSample(userId, sampleData) {
        validateUserId(userId, 'trainingService.createSample');
        ensureDatabase();
        return database.training.createSample(userId, sampleData);
    },

    /**
     * Get all training samples for user
     * @param {string} userId - User ID (required)
     * @param {object} options - Query options (limit, offset, orderBy, orderDir)
     */
    async getAllSamples(userId, options = {}) {
        validateUserId(userId, 'trainingService.getAllSamples');
        ensureDatabase();
        return database.training.getAllSamples(userId, options);
    },

    /**
     * Get specific training sample by sample_id
     * @param {string} userId - User ID (required)
     * @param {string} sampleId - Sample ID
     */
    async getSampleById(userId, sampleId) {
        validateUserId(userId, 'trainingService.getSampleById');
        ensureDatabase();
        return database.training.getSampleById(userId, sampleId);
    },

    /**
     * Update performance data for a sample
     * @param {string} userId - User ID (required)
     * @param {string} sampleId - Sample ID
     * @param {string} platform - Platform name
     * @param {object} performanceData - Performance metrics
     */
    async updatePerformance(userId, sampleId, platform, performanceData) {
        validateUserId(userId, 'trainingService.updatePerformance');
        ensureDatabase();
        return database.training.updatePerformance(userId, sampleId, platform, performanceData);
    },

    /**
     * Get samples with performance data
     * @param {string} userId - User ID (required)
     */
    async getSamplesWithPerformance(userId) {
        validateUserId(userId, 'trainingService.getSamplesWithPerformance');
        ensureDatabase();
        return database.training.getSamplesWithPerformance(userId);
    },

    /**
     * Get top performing samples
     * @param {string} userId - User ID (required)
     * @param {number} limit - Maximum number of samples
     */
    async getTopPerformers(userId, limit = 10) {
        validateUserId(userId, 'trainingService.getTopPerformers');
        ensureDatabase();
        return database.training.getTopPerformers(userId, limit);
    },

    /**
     * Get training data statistics for user
     * @param {string} userId - User ID (required)
     */
    async getStats(userId) {
        validateUserId(userId, 'trainingService.getStats');
        ensureDatabase();
        return database.training.getStats(userId);
    },

    /**
     * Delete a training sample
     * @param {string} userId - User ID (required)
     * @param {string} sampleId - Sample ID
     */
    async deleteSample(userId, sampleId) {
        validateUserId(userId, 'trainingService.deleteSample');
        ensureDatabase();
        return database.training.deleteSample(userId, sampleId);
    },

    /**
     * Delete all training samples for user
     * @param {string} userId - User ID (required)
     */
    async deleteAllSamples(userId) {
        validateUserId(userId, 'trainingService.deleteAllSamples');
        ensureDatabase();
        return database.training.deleteAllSamples(userId);
    }
};

// ============================================
// AUDIT LOGS
// ============================================

export const auditLogService = {
    /**
     * Create audit log entry
     * @param {object} logData - Log entry data
     */
    async log(logData) {
        ensureDatabase();
        return database.auditLogs.create(logData);
    },

    /**
     * Get logs with filters
     * @param {object} options - Query options
     */
    async getLogs(options = {}) {
        ensureDatabase();
        return database.auditLogs.getLogs(options);
    },

    /**
     * Get logs for a specific user
     * @param {string} userId - User ID (required)
     * @param {number} limit - Maximum number of logs
     */
    async getUserLogs(userId, limit = 50) {
        validateUserId(userId, 'auditLogService.getUserLogs');
        ensureDatabase();
        return database.auditLogs.getUserLogs(userId, limit);
    },

    /**
     * Get event statistics
     * @param {number} hoursBack - Hours to look back
     */
    async getStats(hoursBack = 24) {
        ensureDatabase();
        return database.auditLogs.getEventStats(hoursBack);
    },

    /**
     * Get suspicious activity
     * @param {number} hoursBack - Hours to look back
     */
    async getSuspiciousActivity(hoursBack = 24) {
        ensureDatabase();
        return database.auditLogs.getSuspiciousActivity(hoursBack);
    },

    /**
     * Get login attempts by IP
     * @param {string} ipAddress - IP address
     * @param {number} minutesBack - Minutes to look back
     */
    async getLoginAttemptsByIP(ipAddress, minutesBack = 15) {
        ensureDatabase();
        return database.auditLogs.getLoginAttemptsByIP(ipAddress, minutesBack);
    },

    /**
     * Clean up old logs
     * @param {number} daysToKeep - Days to keep logs
     */
    async cleanup(daysToKeep = 90) {
        ensureDatabase();
        return database.auditLogs.cleanup(daysToKeep);
    }
};

// ============================================
// TOKEN BLACKLIST
// ============================================

export const tokenBlacklistService = {
    /**
     * Add token to blacklist
     * @param {string} tokenHash - SHA-256 hash of token
     * @param {string} reason - Reason for blacklisting
     * @param {Date|number} expiresAt - Token expiration
     * @param {string} userId - User ID (optional)
     */
    async add(tokenHash, reason, expiresAt, userId = null) {
        ensureDatabase();
        return database.tokenBlacklist.add(tokenHash, reason, expiresAt, userId);
    },

    /**
     * Check if token is blacklisted
     * @param {string} tokenHash - SHA-256 hash of token
     */
    async isBlacklisted(tokenHash) {
        ensureDatabase();
        return database.tokenBlacklist.isBlacklisted(tokenHash);
    },

    /**
     * Remove token from blacklist
     * @param {string} tokenHash - SHA-256 hash of token
     */
    async remove(tokenHash) {
        ensureDatabase();
        return database.tokenBlacklist.remove(tokenHash);
    },

    /**
     * Blacklist all tokens for a user
     * @param {string} userId - User ID (required)
     * @param {string} reason - Reason for blacklisting
     */
    async blacklistAllUserTokens(userId, reason = 'security_event') {
        validateUserId(userId, 'tokenBlacklistService.blacklistAllUserTokens');
        ensureDatabase();
        return database.tokenBlacklist.blacklistAllUserTokens(userId, reason);
    },

    /**
     * Clean up expired entries
     */
    async cleanupExpired() {
        ensureDatabase();
        return database.tokenBlacklist.cleanupExpired();
    },

    /**
     * Get blacklist statistics
     */
    async getStats() {
        ensureDatabase();
        return database.tokenBlacklist.getStats();
    },

    /**
     * Get user's blacklisted tokens
     * @param {string} userId - User ID (required)
     */
    async getUserBlacklist(userId) {
        validateUserId(userId, 'tokenBlacklistService.getUserBlacklist');
        ensureDatabase();
        return database.tokenBlacklist.getUserBlacklist(userId);
    }
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
    tokens: tokenService,
    topics: topicService,
    analytics: analyticsService,
    viralIntelligence: viralIntelligenceService,
    exploration: explorationService,
    postQueue: postQueueService,
    variations: variationService,
    variationEngine: variationEngineService,
    emotionCache: emotionCacheService,
    visualPerformance: visualPerformanceService,
    brandContext: brandContextService,
    promoConfig: promoConfigService,
    contentConfig: contentConfigService,
    training: trainingService,
    auditLogs: auditLogService,
    tokenBlacklist: tokenBlacklistService,

    // Direct database access
    database,

    // Utilities
    ensureDatabase,
    validateUserId
};
