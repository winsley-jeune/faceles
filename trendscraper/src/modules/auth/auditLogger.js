/**
 * Audit Logger - Database Edition
 * Security audit trail for authentication and authorization events
 * Now stores logs in PostgreSQL for better querying and user isolation
 */

import dataService from '../../services/dataService.js';

// Event types (unchanged from original)
export const EVENTS = {
    // Login events
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    LOGOUT_ALL: 'LOGOUT_ALL',

    // Token events
    TOKEN_CREATED: 'TOKEN_CREATED',
    TOKEN_REFRESHED: 'TOKEN_REFRESHED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_BLACKLISTED: 'TOKEN_BLACKLISTED',

    // OAuth events
    OAUTH_STARTED: 'OAUTH_STARTED',
    OAUTH_CALLBACK: 'OAUTH_CALLBACK',
    OAUTH_SUCCESS: 'OAUTH_SUCCESS',
    OAUTH_FAILED: 'OAUTH_FAILED',
    OAUTH_CSRF_FAILED: 'OAUTH_CSRF_FAILED',

    // Platform connection events
    PLATFORM_CONNECTED: 'PLATFORM_CONNECTED',
    PLATFORM_DISCONNECTED: 'PLATFORM_DISCONNECTED',
    PLATFORM_TOKEN_REFRESH: 'PLATFORM_TOKEN_REFRESH',

    // Security events
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    BRUTE_FORCE_DETECTED: 'BRUTE_FORCE_DETECTED',

    // Access events
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    AUTH_BYPASS_DEV: 'AUTH_BYPASS_DEV'
};

/**
 * Sanitize sensitive data from log entries
 * @param {object} details - Event details
 * @returns {object} Sanitized details
 */
const sanitizeDetails = (details = {}) => {
    const sanitized = { ...details };

    // Sanitize tokens
    if (sanitized.token && typeof sanitized.token === 'string') {
        sanitized.token = `${sanitized.token.substring(0, 10)}...`;
    }
    if (sanitized.accessToken) {
        sanitized.accessToken = '[REDACTED]';
    }
    if (sanitized.refreshToken) {
        sanitized.refreshToken = '[REDACTED]';
    }
    if (sanitized.password) {
        sanitized.password = '[REDACTED]';
    }

    return sanitized;
};

/**
 * Log an event to the audit trail
 * @param {string} event - Event type from EVENTS
 * @param {object} details - Event details
 */
export const log = async (event, details = {}) => {
    try {
        const sanitized = sanitizeDetails(details);

        await dataService.auditLogs.log({
            userId: sanitized.userId || null,
            event,
            details: sanitized,
            ipAddress: sanitized.ip || sanitized.ipAddress || null,
            userAgent: sanitized.userAgent || null,
            platform: sanitized.platform || null
        });

        console.log(`🔒 [AUDIT] ${event}${sanitized.userId ? ` - User: ${sanitized.userId}` : ''}`);
    } catch (err) {
        // Log errors but don't fail the request
        console.error('Failed to write audit log:', err.message);
    }
};

/**
 * Get recent audit logs with optional filters
 * @param {object} options - Query options
 * @returns {array} Audit log entries
 */
export const getRecentLogs = async (options = {}) => {
    try {
        return await dataService.auditLogs.getLogs(options);
    } catch (err) {
        console.error('Failed to get audit logs:', err.message);
        return [];
    }
};

/**
 * Get event statistics for a time period
 * @param {number} hoursBack - Hours to look back (default: 24)
 * @returns {object} Event statistics
 */
export const getEventStats = async (hoursBack = 24) => {
    try {
        return await dataService.auditLogs.getStats(hoursBack);
    } catch (err) {
        console.error('Failed to get event stats:', err.message);
        return { events: {}, total: 0, period: `${hoursBack}h` };
    }
};

/**
 * Get audit logs for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of logs (default: 50)
 * @returns {array} User's audit log entries
 */
export const getUserLogs = async (userId, limit = 50) => {
    try {
        return await dataService.auditLogs.getUserLogs(userId, limit);
    } catch (err) {
        console.error('Failed to get user logs:', err.message);
        return [];
    }
};

/**
 * Get suspicious activity logs
 * @param {number} hoursBack - Hours to look back (default: 24)
 * @returns {array} Suspicious activity logs
 */
export const getSuspiciousActivity = async (hoursBack = 24) => {
    try {
        return await dataService.auditLogs.getSuspiciousActivity(hoursBack);
    } catch (err) {
        console.error('Failed to get suspicious activity:', err.message);
        return [];
    }
};

/**
 * Get login attempts for an IP address
 * @param {string} ipAddress - IP address
 * @param {number} minutesBack - Minutes to look back (default: 15)
 * @returns {array} Login attempt logs
 */
export const getLoginAttemptsByIP = async (ipAddress, minutesBack = 15) => {
    try {
        return await dataService.auditLogs.getLoginAttemptsByIP(ipAddress, minutesBack);
    } catch (err) {
        console.error('Failed to get login attempts by IP:', err.message);
        return [];
    }
};

/**
 * Clean up old audit logs
 * @param {number} daysToKeep - Number of days to keep logs (default: 90)
 * @returns {number} Number of logs deleted
 */
export const clearOldLogs = async (daysToKeep = 90) => {
    try {
        const removed = await dataService.auditLogs.cleanup(daysToKeep);
        console.log(`🔒 Cleared ${removed} old audit log entries (older than ${daysToKeep} days)`);
        return removed;
    } catch (err) {
        console.error('Failed to clear old logs:', err.message);
        return 0;
    }
};

// Schedule automatic cleanup (runs every 24 hours)
setInterval(async () => {
    await clearOldLogs(90); // Keep 90 days of logs
}, 24 * 60 * 60 * 1000);

export default {
    log,
    getRecentLogs,
    getEventStats,
    getUserLogs,
    getSuspiciousActivity,
    getLoginAttemptsByIP,
    clearOldLogs,
    EVENTS
};
