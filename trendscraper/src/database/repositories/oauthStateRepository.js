import { getPool, isDatabaseAvailable } from '../db.js';
import { logger } from '../../utils/index.js';

/**
 * OAuth State Repository
 * Manages OAuth state tokens for CSRF protection during authentication flow
 */

/**
 * Store OAuth state for CSRF protection
 * @param {string} state - Random state token
 * @param {string} provider - OAuth provider (google, facebook, tiktok)
 * @param {object} data - Additional data (e.g., code_verifier for PKCE)
 * @returns {Promise<boolean>} Success status
 */
export async function store(state, provider, data = {}) {
    if (!isDatabaseAvailable()) {
        throw new Error('Database not available - OAuth state storage requires database connection');
    }

    try {
        const pool = getPool();
        const { codeVerifier, ...metadata } = data;

        await pool.query(
            `INSERT INTO oauth_states (state, provider, code_verifier, metadata)
             VALUES ($1, $2, $3, $4)`,
            [state, provider, codeVerifier || null, Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null]
        );

        logger.info(`OAuth state stored: ${state.substring(0, 8)}... for provider: ${provider}`);
        return true;
    } catch (error) {
        logger.error(`Failed to store OAuth state: ${error.message}`);
        throw error;
    }
}

/**
 * Validate and consume OAuth state (one-time use)
 * @param {string} state - State token to validate
 * @returns {Promise<object|null>} State data if valid, null if invalid/expired
 */
export async function consume(state) {
    if (!isDatabaseAvailable()) {
        throw new Error('Database not available - OAuth state validation requires database connection');
    }

    try {
        const pool = getPool();
        // Begin transaction for atomic consume operation
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch and delete in one operation (consume)
            const result = await client.query(
                `DELETE FROM oauth_states
                 WHERE state = $1 AND expires_at > NOW()
                 RETURNING provider, code_verifier, metadata`,
                [state]
            );

            await client.query('COMMIT');

            if (result.rows.length === 0) {
                logger.warn(`OAuth state validation failed: ${state.substring(0, 8)}... (not found or expired)`);
                return null;
            }

            const row = result.rows[0];
            const stateData = {
                provider: row.provider,
                codeVerifier: row.code_verifier,
                ...(row.metadata || {})
            };

            logger.info(`OAuth state consumed: ${state.substring(0, 8)}... for provider: ${row.provider}`);
            return stateData;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error(`Failed to consume OAuth state: ${error.message}`);
        throw error;
    }
}

/**
 * Validate OAuth state without consuming it (for debugging)
 * @param {string} state - State token to validate
 * @returns {Promise<boolean>} True if valid and not expired
 */
export async function validate(state) {
    if (!isDatabaseAvailable()) {
        return false;
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `SELECT 1 FROM oauth_states
             WHERE state = $1 AND expires_at > NOW()`,
            [state]
        );

        return result.rows.length > 0;
    } catch (error) {
        logger.error(`Failed to validate OAuth state: ${error.message}`);
        return false;
    }
}

/**
 * Clean up expired OAuth states (called periodically)
 * @returns {Promise<number>} Number of states deleted
 */
export async function cleanExpired() {
    if (!isDatabaseAvailable()) {
        return 0;
    }

    try {
        const pool = getPool();
        const result = await pool.query(
            `DELETE FROM oauth_states
             WHERE expires_at <= NOW()`
        );

        const count = result.rowCount || 0;
        if (count > 0) {
            logger.info(`Cleaned ${count} expired OAuth states`);
        }

        return count;
    } catch (error) {
        logger.error(`Failed to clean expired OAuth states: ${error.message}`);
        return 0;
    }
}

export default {
    store,
    consume,
    validate,
    cleanExpired
};
