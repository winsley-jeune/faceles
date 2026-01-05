/**
 * PROMOTIONAL CONTENT CONFIGURATION
 *
 * Manages settings for self-promotional content generation and posting.
 * Controls frequency, content mix, platforms, and scheduling.
 * Multi-tenant with database storage.
 */

import dataService from '../services/dataService.js';

// Default configuration
const DEFAULT_PROMO_CONFIG = {
  version: 1,
  enabled: false,  // Master on/off switch
  mode: 'mixed',   // 'mixed' | 'separate'

  frequency: {
    percentage: 20,  // If mixed mode: 20% of content is promotional
    interval: 7,     // If separate mode: post every N days
    minHoursBetween: 24  // Minimum hours between promotional posts
  },

  platforms: ['youtube', 'tiktok', 'instagram', 'facebook'],

  contentMix: {
    features: 30,     // 30% features
    benefits: 30,     // 30% benefits
    tutorials: 20,    // 20% tutorials
    socialProof: 20   // 20% social proof
  },

  tracking: {
    totalGenerated: 0,
    totalPosted: 0,
    lastPromoPost: null,
    lastPromoType: null,
    postHistory: []
  },

  createdAt: null,
  lastUpdated: null
};

/**
 * Load promotional configuration from database
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Promotional configuration
 */
export async function loadPromoConfig(userId) {
  try {
    const config = await dataService.promoConfig.get(userId);

    if (config) {
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_PROMO_CONFIG,
        ...config,
        frequency: { ...DEFAULT_PROMO_CONFIG.frequency, ...config.frequency },
        contentMix: { ...DEFAULT_PROMO_CONFIG.contentMix, ...config.contentMix },
        platforms: config.platforms || DEFAULT_PROMO_CONFIG.platforms,
        tracking: { ...DEFAULT_PROMO_CONFIG.tracking, ...config.tracking }
      };
    }
  } catch (error) {
    console.error('Error loading promo config:', error.message);
  }

  // Return default config if doesn't exist or error occurred
  return {
    ...DEFAULT_PROMO_CONFIG,
    createdAt: new Date().toISOString()
  };
}

/**
 * Save promotional configuration to database
 * @param {string} userId - User ID
 * @param {Object} config - Configuration object to save
 * @returns {Promise<boolean>} Success status
 */
export async function savePromoConfig(userId, config) {
  try {
    await dataService.promoConfig.save(userId, config);
    return true;
  } catch (error) {
    console.error('Error saving promo config:', error.message);
    return false;
  }
}

/**
 * Update specific section of promotional config
 * @param {string} userId - User ID
 * @param {string} section - Section to update
 * @param {Object} data - Data to update
 * @returns {Promise<boolean>} Success status
 */
export async function updatePromoSection(userId, section, data) {
  const config = await loadPromoConfig(userId);

  if (config[section]) {
    config[section] = { ...config[section], ...data };
  } else {
    config[section] = data;
  }

  return savePromoConfig(userId, config);
}

/**
 * Check if it's time to generate promotional content
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether promotional content should be generated
 */
export async function shouldGeneratePromo(userId) {
  const config = await loadPromoConfig(userId);

  if (!config.enabled) {
    return false;
  }

  const now = Date.now();
  const lastPromo = config.tracking.lastPromoPost;

  // If never posted promo content before, allow it
  if (!lastPromo) {
    return true;
  }

  // Check minimum time between promotional posts
  const hoursSinceLastPromo = (now - new Date(lastPromo).getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastPromo < config.frequency.minHoursBetween) {
    return false;
  }

  // Mode-specific logic
  if (config.mode === 'mixed') {
    // In mixed mode, use percentage-based decision
    // Generate promotional content X% of the time
    const randomValue = Math.random() * 100;
    return randomValue < config.frequency.percentage;
  } else {
    // In separate mode, use interval-based decision
    const daysSinceLastPromo = hoursSinceLastPromo / 24;
    return daysSinceLastPromo >= config.frequency.interval;
  }
}

/**
 * Get next promotional content type based on content mix
 * @param {string} userId - User ID
 * @returns {Promise<string>} Content type (features|benefits|tutorials|socialProof)
 */
export async function getNextPromoType(userId) {
  const config = await loadPromoConfig(userId);
  const mix = config.contentMix;

  // Create weighted array
  const types = [];
  types.push(...Array(mix.features).fill('features'));
  types.push(...Array(mix.benefits).fill('benefits'));
  types.push(...Array(mix.tutorials).fill('tutorials'));
  types.push(...Array(mix.socialProof).fill('socialProof'));

  // Random weighted selection
  const randomIndex = Math.floor(Math.random() * types.length);
  return types[randomIndex] || 'features';
}

/**
 * Record a promotional post
 * @param {string} userId - User ID
 * @param {Object} postData - Post data (videoPath, topic, platforms, etc.)
 * @returns {Promise<boolean>} Success status
 */
export async function recordPromoPost(userId, postData) {
  const config = await loadPromoConfig(userId);

  config.tracking.totalPosted++;
  config.tracking.lastPromoPost = new Date().toISOString();
  config.tracking.lastPromoType = postData.type || 'unknown';

  // Add to history (keep last 50)
  config.tracking.postHistory.unshift({
    ...postData,
    postedAt: new Date().toISOString()
  });

  if (config.tracking.postHistory.length > 50) {
    config.tracking.postHistory = config.tracking.postHistory.slice(0, 50);
  }

  return savePromoConfig(userId, config);
}

/**
 * Record a promotional video generation
 * @param {string} userId - User ID
 * @param {string} type - Content type
 * @returns {Promise<boolean>} Success status
 */
export async function recordPromoGeneration(userId, type) {
  const config = await loadPromoConfig(userId);
  config.tracking.totalGenerated++;
  return savePromoConfig(userId, config);
}

/**
 * Get promotional post history
 * @param {string} userId - User ID
 * @param {number} limit - Max number of records to return
 * @returns {Promise<Array>} Post history
 */
export async function getPromoHistory(userId, limit = 20) {
  const config = await loadPromoConfig(userId);
  return config.tracking.postHistory.slice(0, limit);
}

/**
 * Get promotional statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Statistics
 */
export async function getPromoStats(userId) {
  const config = await loadPromoConfig(userId);

  return {
    enabled: config.enabled,
    mode: config.mode,
    totalGenerated: config.tracking.totalGenerated,
    totalPosted: config.tracking.totalPosted,
    lastPromoPost: config.tracking.lastPromoPost,
    lastPromoType: config.tracking.lastPromoType,
    recentPosts: config.tracking.postHistory.slice(0, 5)
  };
}

/**
 * Reset promotional configuration to defaults
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function resetPromoConfig(userId) {
  const config = {
    ...DEFAULT_PROMO_CONFIG,
    createdAt: new Date().toISOString(),
    tracking: {
      ...DEFAULT_PROMO_CONFIG.tracking,
      postHistory: []
    }
  };

  return savePromoConfig(userId, config);
}

/**
 * Enable promotional content
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function enablePromo(userId) {
  const config = await loadPromoConfig(userId);
  config.enabled = true;
  return savePromoConfig(userId, config);
}

/**
 * Disable promotional content
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function disablePromo(userId) {
  const config = await loadPromoConfig(userId);
  config.enabled = false;
  return savePromoConfig(userId, config);
}

/**
 * Get time until next promotional post is allowed
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Time info
 */
export async function getNextPromoSchedule(userId) {
  const config = await loadPromoConfig(userId);

  if (!config.enabled) {
    return { allowed: false, reason: 'Promotional content is disabled' };
  }

  const lastPromo = config.tracking.lastPromoPost;

  if (!lastPromo) {
    return { allowed: true, reason: 'No promotional content posted yet', hoursRemaining: 0 };
  }

  const now = Date.now();
  const hoursSinceLastPromo = (now - new Date(lastPromo).getTime()) / (1000 * 60 * 60);
  const hoursRemaining = Math.max(0, config.frequency.minHoursBetween - hoursSinceLastPromo);

  if (hoursRemaining > 0) {
    return {
      allowed: false,
      reason: 'Minimum time between posts not met',
      hoursRemaining: hoursRemaining.toFixed(1),
      nextAllowedTime: new Date(now + hoursRemaining * 60 * 60 * 1000).toISOString()
    };
  }

  return {
    allowed: true,
    reason: 'Ready for next promotional post',
    hoursRemaining: 0
  };
}

export default {
  loadPromoConfig,
  savePromoConfig,
  updatePromoSection,
  shouldGeneratePromo,
  getNextPromoType,
  recordPromoPost,
  recordPromoGeneration,
  getPromoHistory,
  getPromoStats,
  resetPromoConfig,
  enablePromo,
  disablePromo,
  getNextPromoSchedule
};
