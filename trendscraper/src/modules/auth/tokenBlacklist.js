/**
 * Token Blacklist System - Database Edition
 * Manages revoked/blacklisted JWT tokens to enable proper logout
 * and token invalidation for security purposes
 * Now stores blacklist in PostgreSQL for better performance and consistency
 */

import crypto from 'crypto';
import dataService from '../../services/dataService.js';

/**
 * Get token hash for storage (we don't store full tokens)
 * @param {string} token - JWT token
 * @returns {string} SHA-256 hash of token
 */
const getTokenHash = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Add a token to the blacklist
 * @param {string} token - JWT token to blacklist
 * @param {string} reason - Reason for blacklisting (logout, revoked, etc.)
 * @param {number} expiresAt - Token expiration timestamp (optional)
 * @param {string} userId - User ID (optional)
 */
export const addToBlacklist = async (token, reason = 'logout', expiresAt = null, userId = null) => {
    const tokenHash = getTokenHash(token);

    // Extract expiration from token if not provided
    if (!expiresAt) {
        try {
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
            expiresAt = payload.exp ? payload.exp * 1000 : (Date.now() + 7 * 24 * 60 * 60 * 1000);

            // Extract userId from payload if not provided
            if (!userId && payload.userId) {
                userId = payload.userId;
            }
        } catch {
            expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // Default 7 days
        }
    }

    try {
        await dataService.tokenBlacklist.add(tokenHash, reason, expiresAt, userId);
        console.log(`🚫 Token blacklisted: ${tokenHash.substring(0, 16)}... (${reason})`);
    } catch (err) {
        console.error('Failed to blacklist token:', err.message);
    }
};

/**
 * Check if a token is blacklisted
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is blacklisted
 */
export const isBlacklisted = async (token) => {
    const tokenHash = getTokenHash(token);

    try {
        return await dataService.tokenBlacklist.isBlacklisted(tokenHash);
    } catch (err) {
        console.error('Failed to check blacklist:', err.message);
        // Fail secure: if we can't check, assume it's not blacklisted
        // This prevents lockout if database is down
        return false;
    }
};

/**
 * Remove a token from the blacklist (rarely needed)
 * @param {string} token - JWT token to remove from blacklist
 */
export const removeFromBlacklist = async (token) => {
    const tokenHash = getTokenHash(token);

    try {
        const removed = await dataService.tokenBlacklist.remove(tokenHash);
        if (removed) {
            console.log(`✅ Token removed from blacklist: ${tokenHash.substring(0, 16)}...`);
        }
        return removed;
    } catch (err) {
        console.error('Failed to remove token from blacklist:', err.message);
        return false;
    }
};

/**
 * Blacklist all tokens for a user (for security events)
 * @param {string} userId - User ID to blacklist all tokens for
 * @param {string} reason - Reason for blacklisting
 */
export const blacklistAllUserTokens = async (userId, reason = 'security_event') => {
    try {
        const count = await dataService.tokenBlacklist.blacklistAllUserTokens(userId, reason);
        console.log(`🚫 Blacklisted ${count} tokens for user ${userId} (${reason})`);
        return count;
    } catch (err) {
        console.error('Failed to blacklist user tokens:', err.message);
        return 0;
    }
};

/**
 * Clean up expired entries from blacklist
 * Should be called periodically (e.g., daily)
 */
export const cleanupExpired = async () => {
    try {
        const removed = await dataService.tokenBlacklist.cleanupExpired();
        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} expired blacklist entries`);
        }
        return removed;
    } catch (err) {
        console.error('Failed to cleanup blacklist:', err.message);
        return 0;
    }
};

/**
 * Get blacklist statistics
 * @returns {object} Stats about the blacklist
 */
export const getStats = async () => {
    try {
        return await dataService.tokenBlacklist.getStats();
    } catch (err) {
        console.error('Failed to get blacklist stats:', err.message);
        return {
            total: 0,
            active: 0,
            expired: 0,
            reasons: {}
        };
    }
};

// Run cleanup every hour
setInterval(async () => {
    await cleanupExpired();
}, 60 * 60 * 1000);

export default {
    addToBlacklist,
    isBlacklisted,
    removeFromBlacklist,
    blacklistAllUserTokens,
    cleanupExpired,
    getStats
};
