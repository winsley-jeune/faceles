/**
 * Database Module - Main Entry Point
 * Provides backward-compatible database access with JSON fallback
 */

import db, { initDatabase, isDatabaseAvailable, closeDatabase } from './db.js';
import userRepository from './repositories/userRepository.js';
import subscriptionRepository from './repositories/subscriptionRepository.js';
import usageRepository from './repositories/usageRepository.js';
import affiliateRepository from './repositories/affiliateRepository.js';
import tokenRepository from './repositories/tokenRepository.js';
import topicRepository from './repositories/topicRepository.js';
import analyticsRepository from './repositories/analyticsRepository.js';
import abTestingRepository from './repositories/abTestingRepository.js';
import postQueueRepository from './repositories/postQueueRepository.js';
import settingsRepository from './repositories/settingsRepository.js';
import trainingRepository from './repositories/trainingRepository.js';
import auditLogRepository from './repositories/auditLogRepository.js';
import tokenBlacklistRepository from './repositories/tokenBlacklistRepository.js';

// Export all repositories
export {
    db,
    initDatabase,
    isDatabaseAvailable,
    closeDatabase,
    userRepository,
    subscriptionRepository,
    usageRepository,
    affiliateRepository,
    tokenRepository,
    topicRepository,
    analyticsRepository,
    abTestingRepository,
    postQueueRepository,
    settingsRepository,
    trainingRepository,
    auditLogRepository,
    tokenBlacklistRepository
};

// Export default object with all repositories
export default {
    db,
    initDatabase,
    isDatabaseAvailable,
    closeDatabase,
    users: userRepository,
    subscriptions: subscriptionRepository,
    usage: usageRepository,
    affiliates: affiliateRepository,
    tokens: tokenRepository,
    topics: topicRepository,
    analytics: analyticsRepository,
    abTesting: abTestingRepository,
    postQueue: postQueueRepository,
    settings: settingsRepository,
    training: trainingRepository,
    auditLogs: auditLogRepository,
    tokenBlacklist: tokenBlacklistRepository
};
