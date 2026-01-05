/**
 * Data Access Utility
 * Provides unified data access for modules with automatic dataService/JSON fallback
 * This utility wraps common file operations to use dataService when available
 */

import fs from 'fs';
import path from 'path';
import dataService from '../services/dataService.js';
import { encryptTokens, decryptTokens } from './encryption.js';

const DATA_DIR = '/app/data';

// Enable/disable token encryption (can be toggled via env var)
const ENCRYPT_TOKENS = process.env.ENCRYPT_TOKENS !== 'false';

/**
 * Check if dataService is available and enabled
 */
export const isDataServiceEnabled = () => {
    return dataService.useDatabase && dataService.useDatabase();
};

/**
 * Read JSON file with dataService awareness
 * Falls back to direct file read if dataService unavailable
 */
export const readJsonFile = async (filename) => {
    const filePath = path.join(DATA_DIR, filename);

    try {
        // Try dataService first
        const data = await dataService.readJsonFile(filename);
        if (data !== null) {
            return data;
        }
    } catch (err) {
        // dataService not available
    }

    // Fallback to direct file read
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
};

/**
 * Sync version - direct file read only
 */
export const readJsonFileSync = (filename) => {
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
};

/**
 * Write JSON file with dataService awareness
 */
export const writeJsonFile = async (filename, data) => {
    const filePath = path.join(DATA_DIR, filename);

    // Always write to file for backward compatibility
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // Also try to write via dataService
    try {
        await dataService.writeJsonFile(filename, data);
    } catch (err) {
        // dataService write failed, but file write succeeded
    }

    return true;
};

/**
 * Sync version - direct file write only
 */
export const writeJsonFileSync = (filename, data) => {
    const filePath = path.join(DATA_DIR, filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
};

// ============================================
// PLATFORM-SPECIFIC DATA ACCESS
// ============================================

/**
 * Get platform tokens (with automatic decryption)
 */
export const getTokens = async (platform) => {
    try {
        const tokens = await dataService.tokens.getToken(platform);
        if (tokens) {
            return ENCRYPT_TOKENS ? decryptTokens(tokens) : tokens;
        }
    } catch (err) {
        // Fall through to file read
    }

    const tokens = readJsonFileSync(`${platform}_tokens.json`);
    if (tokens && ENCRYPT_TOKENS) {
        return decryptTokens(tokens);
    }
    return tokens;
};

/**
 * Save platform tokens (with automatic encryption)
 */
export const saveTokens = async (platform, tokens) => {
    // Encrypt tokens before saving
    const tokensToSave = ENCRYPT_TOKENS ? encryptTokens(tokens) : tokens;

    try {
        await dataService.tokens.saveToken(platform, tokensToSave);
    } catch (err) {
        // Fallback handled by writeJsonFile
    }
    writeJsonFileSync(`${platform}_tokens.json`, tokensToSave);
};

/**
 * Get generated topics for platform
 */
export const getTopics = async (platform) => {
    try {
        return await dataService.topics.getTopics(platform);
    } catch (err) {
        const filename = platform === 'general'
            ? 'generated_topics.json'
            : `${platform}_generated_topics.json`;
        return readJsonFileSync(filename) || [];
    }
};

/**
 * Save generated topic
 */
export const saveTopic = async (platform, topicData) => {
    try {
        await dataService.topics.saveTopic(platform, topicData);
    } catch (err) {
        // Fallback to file
    }

    // Also save to file
    const filename = platform === 'general'
        ? 'generated_topics.json'
        : `${platform}_generated_topics.json`;
    const existing = readJsonFileSync(filename) || [];
    existing.push({ ...topicData, createdAt: new Date().toISOString() });
    writeJsonFileSync(filename, existing);
};

/**
 * Get analytics history
 */
export const getAnalytics = async (platform = null) => {
    try {
        const history = await dataService.analytics.getAnalyticsHistory();
        if (platform && history[platform]) {
            return history[platform];
        }
        return history;
    } catch (err) {
        const data = readJsonFileSync('analytics_history.json');
        if (platform && data?.snapshots?.length > 0) {
            const latest = data.snapshots[data.snapshots.length - 1];
            return latest.videos || [];
        }
        return data;
    }
};

/**
 * Save video analytics
 */
export const saveVideoAnalytics = async (data) => {
    try {
        await dataService.analytics.saveVideoAnalytics(data);
    } catch (err) {
        // Fallback - append to history file
        const history = readJsonFileSync('analytics_history.json') || { snapshots: [] };
        const platform = data.platform || 'general';
        if (!history[platform]) history[platform] = [];
        history[platform].push({ ...data, timestamp: new Date().toISOString() });
        writeJsonFileSync('analytics_history.json', history);
    }
};

/**
 * Get winning patterns for platform
 */
export const getWinningPatterns = async (platform) => {
    try {
        return await dataService.analytics.getWinningPatterns(platform);
    } catch (err) {
        return readJsonFileSync(`${platform}_winning_patterns.json`) || {};
    }
};

/**
 * Save winning pattern
 */
export const saveWinningPattern = async (platform, patternData) => {
    try {
        await dataService.analytics.saveWinningPattern({ platform, ...patternData });
    } catch (err) {
        // Fallback to file
    }

    const patterns = readJsonFileSync(`${platform}_winning_patterns.json`) || {};
    const key = `${patternData.patternType}_${patternData.pattern}`;
    patterns[key] = { ...patternData, updatedAt: new Date().toISOString() };
    writeJsonFileSync(`${platform}_winning_patterns.json`, patterns);
};

/**
 * Get exploration config
 */
export const getExplorationConfig = async () => {
    try {
        return await dataService.exploration.getConfig();
    } catch (err) {
        return readJsonFileSync('exploration_config.json') || {
            explorationRate: 0.2,
            minExplorationRate: 0.05,
            maxExplorationRate: 0.4,
            adaptiveMode: true
        };
    }
};

/**
 * Save exploration config
 */
export const saveExplorationConfig = async (config) => {
    try {
        await dataService.exploration.saveConfig(config);
    } catch (err) {
        // Fallback
    }
    writeJsonFileSync('exploration_config.json', config);
};

/**
 * Get emotion cache
 */
export const getEmotionCache = async (textHash) => {
    try {
        return await dataService.emotionCache.get(textHash);
    } catch (err) {
        const cache = readJsonFileSync('emotion_cache.json') || {};
        return cache[textHash] || null;
    }
};

/**
 * Set emotion cache
 */
export const setEmotionCache = async (textHash, text, emotion, confidence) => {
    try {
        await dataService.emotionCache.set(textHash, text, emotion, confidence);
    } catch (err) {
        // Fallback
    }

    const cache = readJsonFileSync('emotion_cache.json') || {};
    cache[textHash] = { emotion, confidence, text, timestamp: Date.now() };
    writeJsonFileSync('emotion_cache.json', cache);
};

/**
 * Get viral intelligence data
 */
export const getViralIntelligence = async () => {
    try {
        return await dataService.viralIntelligence.getData();
    } catch (err) {
        return readJsonFileSync('viral_intelligence.json') || {};
    }
};

/**
 * Save viral intelligence data
 */
export const saveViralIntelligence = async (data) => {
    try {
        await dataService.viralIntelligence.saveData(data);
    } catch (err) {
        // Fallback
    }
    writeJsonFileSync('viral_intelligence.json', data);
};

/**
 * Get post queue
 */
export const getPostQueue = async (platform = null) => {
    try {
        return await dataService.postQueue.getQueue(platform);
    } catch (err) {
        const queue = readJsonFileSync('posting_schedule.json') || [];
        if (platform) {
            return queue.filter(p => p.platform === platform);
        }
        return queue;
    }
};

/**
 * Add to post queue
 */
export const addToPostQueue = async (postData) => {
    try {
        return await dataService.postQueue.addToQueue(postData);
    } catch (err) {
        // Fallback
    }

    const queue = readJsonFileSync('posting_schedule.json') || [];
    const newPost = {
        id: Date.now().toString(),
        ...postData,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    queue.push(newPost);
    writeJsonFileSync('posting_schedule.json', queue);
    return newPost;
};

/**
 * Get variation queue
 */
export const getVariationQueue = async () => {
    try {
        return await dataService.variations.getQueue();
    } catch (err) {
        return readJsonFileSync('variation_queue.json') || [];
    }
};

/**
 * Add variation to queue
 */
export const addVariation = async (variation) => {
    try {
        return await dataService.variations.addVariation(variation);
    } catch (err) {
        // Fallback
    }

    const queue = readJsonFileSync('variation_queue.json') || [];
    queue.push({ ...variation, createdAt: new Date().toISOString() });
    writeJsonFileSync('variation_queue.json', queue);
    return variation;
};

export default {
    isDataServiceEnabled,
    readJsonFile,
    readJsonFileSync,
    writeJsonFile,
    writeJsonFileSync,
    getTokens,
    saveTokens,
    getTopics,
    saveTopic,
    getAnalytics,
    saveVideoAnalytics,
    getWinningPatterns,
    saveWinningPattern,
    getExplorationConfig,
    saveExplorationConfig,
    getEmotionCache,
    setEmotionCache,
    getViralIntelligence,
    saveViralIntelligence,
    getPostQueue,
    addToPostQueue,
    getVariationQueue,
    addVariation
};
