/**
 * Audit Log Repository
 * Database operations for security audit logs
 */

import db from '../db.js';

const auditLogRepository = {
    /**
     * Create a new audit log entry
     * @param {object} logData - Log entry data
     */
    async create(logData) {
        const {
            userId = null,
            event,
            details = {},
            ipAddress = null,
            userAgent = null,
            platform = null
        } = logData;

        const result = await db.query(
            `INSERT INTO audit_logs (
                user_id, event, details, ip_address, user_agent, platform
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                userId,
                event,
                JSON.stringify(details),
                ipAddress,
                userAgent,
                platform
            ]
        );

        return db.keysToCamel(result.rows[0]);
    },

    /**
     * Get recent logs with optional filters
     * @param {object} options - Query options
     */
    async getLogs(options = {}) {
        const {
            userId = null,
            event = null,
            limit = 100,
            offset = 0,
            hoursBack = null
        } = options;

        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filter by user
        if (userId) {
            query += ` AND user_id = $${paramIndex}`;
            params.push(userId);
            paramIndex++;
        }

        // Filter by event type
        if (event) {
            query += ` AND event = $${paramIndex}`;
            params.push(event);
            paramIndex++;
        }

        // Filter by time
        if (hoursBack) {
            query += ` AND created_at > NOW() - INTERVAL '${hoursBack} hours'`;
        }

        // Order and pagination
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get logs for a specific user
     * @param {string} userId - User ID
     * @param {number} limit - Maximum number of logs
     */
    async getUserLogs(userId, limit = 50) {
        const result = await db.query(
            `SELECT * FROM audit_logs
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get event statistics for a time period
     * @param {number} hoursBack - Hours to look back
     */
    async getEventStats(hoursBack = 24) {
        const result = await db.query(
            `SELECT
                event,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
             FROM audit_logs
             WHERE created_at > NOW() - INTERVAL '${hoursBack} hours'
             GROUP BY event
             ORDER BY count DESC`
        );

        const stats = {
            events: {},
            total: 0,
            period: `${hoursBack}h`
        };

        result.rows.forEach(row => {
            stats.events[row.event] = {
                count: parseInt(row.count),
                uniqueUsers: parseInt(row.unique_users)
            };
            stats.total += parseInt(row.count);
        });

        return stats;
    },

    /**
     * Get suspicious activity logs
     * @param {number} hoursBack - Hours to look back
     */
    async getSuspiciousActivity(hoursBack = 24) {
        const suspiciousEvents = [
            'RATE_LIMIT_EXCEEDED',
            'SUSPICIOUS_ACTIVITY',
            'BRUTE_FORCE_DETECTED',
            'OAUTH_CSRF_FAILED',
            'TOKEN_INVALID'
        ];

        const result = await db.query(
            `SELECT * FROM audit_logs
             WHERE event = ANY($1)
             AND created_at > NOW() - INTERVAL '${hoursBack} hours'
             ORDER BY created_at DESC
             LIMIT 100`,
            [suspiciousEvents]
        );

        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Get login attempts for IP address
     * @param {string} ipAddress - IP address
     * @param {number} minutesBack - Minutes to look back
     */
    async getLoginAttemptsByIP(ipAddress, minutesBack = 15) {
        const result = await db.query(
            `SELECT * FROM audit_logs
             WHERE ip_address = $1
             AND event IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'OAUTH_FAILED')
             AND created_at > NOW() - INTERVAL '${minutesBack} minutes'
             ORDER BY created_at DESC`,
            [ipAddress]
        );

        return result.rows.map(r => db.keysToCamel(r));
    },

    /**
     * Clean up old audit logs
     * @param {number} daysToKeep - Number of days to keep logs
     */
    async cleanup(daysToKeep = 90) {
        const result = await db.query(
            `DELETE FROM audit_logs
             WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
             RETURNING id`
        );

        return result.rowCount;
    },

    /**
     * Get total count of logs
     */
    async getCount() {
        const result = await db.query('SELECT COUNT(*) as count FROM audit_logs');
        return parseInt(result.rows[0].count);
    }
};

export default auditLogRepository;
