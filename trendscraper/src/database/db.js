/**
 * Database Connection Module
 * PostgreSQL connection pool and query helpers
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'viral_shorts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_SIZE) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Use individual params (more reliable than connectionString)
const poolConfig = config;

let pool = null;
let isConnected = false;

/**
 * Initialize database connection pool
 */
export const initDatabase = async () => {
    if (pool) return pool;

    // Check if database is enabled
    if (process.env.USE_DATABASE === 'false') {
        console.log('📁 Database disabled, using JSON file storage');
        return null;
    }

    try {
        pool = new Pool(poolConfig);

        // Test connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();

        isConnected = true;
        console.log('🐘 PostgreSQL connected successfully');

        // Handle pool errors
        pool.on('error', (err) => {
            console.error('Unexpected database pool error:', err);
            isConnected = false;
        });

        return pool;
    } catch (error) {
        console.warn('⚠️ PostgreSQL connection failed, falling back to JSON storage:', error.message);
        isConnected = false;
        return null;
    }
};

/**
 * Check if database is available
 */
export const isDatabaseAvailable = () => isConnected && pool !== null;

/**
 * Get database pool
 */
export const getPool = () => pool;

/**
 * Execute a query
 */
export const query = async (text, params = []) => {
    if (!isDatabaseAvailable()) {
        throw new Error('Database not available');
    }
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.DB_LOG_QUERIES === 'true') {
        console.log('DB Query:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }

    return result;
};

/**
 * Get a client from the pool for transactions
 */
export const getClient = async () => {
    if (!isDatabaseAvailable()) {
        throw new Error('Database not available');
    }
    return pool.connect();
};

/**
 * Execute queries in a transaction
 */
export const transaction = async (callback) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Close database connection
 */
export const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        pool = null;
        isConnected = false;
        console.log('🐘 PostgreSQL connection closed');
    }
};

// ============================================
// QUERY BUILDERS
// ============================================

/**
 * Build INSERT query with RETURNING
 */
export const buildInsert = (table, data, returning = '*') => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    return {
        text: `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING ${returning}`,
        values
    };
};

/**
 * Build UPDATE query
 */
export const buildUpdate = (table, data, whereClause, whereValues = []) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    // Adjust where clause placeholders
    const adjustedWhere = whereClause.replace(/\$(\d+)/g, (_, num) => `$${parseInt(num) + keys.length}`);

    return {
        text: `UPDATE ${table} SET ${setClause} WHERE ${adjustedWhere} RETURNING *`,
        values: [...values, ...whereValues]
    };
};

/**
 * Build SELECT query with conditions
 */
export const buildSelect = (table, conditions = {}, options = {}) => {
    const { orderBy, limit, offset, columns = '*' } = options;
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);

    let text = `SELECT ${columns} FROM ${table}`;

    if (keys.length > 0) {
        const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        text += ` WHERE ${whereClause}`;
    }

    if (orderBy) text += ` ORDER BY ${orderBy}`;
    if (limit) text += ` LIMIT ${limit}`;
    if (offset) text += ` OFFSET ${offset}`;

    return { text, values };
};

/**
 * Build UPSERT query (INSERT ... ON CONFLICT UPDATE)
 */
export const buildUpsert = (table, data, conflictColumns, updateColumns = null) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');
    const conflict = Array.isArray(conflictColumns) ? conflictColumns.join(', ') : conflictColumns;

    // If updateColumns not specified, update all columns except conflict columns
    const toUpdate = updateColumns || keys.filter(k => !conflictColumns.includes(k));
    const updateClause = toUpdate.map(key => `${key} = EXCLUDED.${key}`).join(', ');

    return {
        text: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})
               ON CONFLICT (${conflict}) DO UPDATE SET ${updateClause}
               RETURNING *`,
        values
    };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert camelCase to snake_case
 */
export const toSnakeCase = (str) =>
    str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/**
 * Convert snake_case to camelCase
 */
export const toCamelCase = (str) =>
    str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

/**
 * Convert object keys from camelCase to snake_case
 */
export const keysToSnake = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(keysToSnake);
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[toSnakeCase(key)] = keysToSnake(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

/**
 * Convert object keys from snake_case to camelCase
 */
export const keysToCamel = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(keysToCamel);
    }
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        return Object.keys(obj).reduce((acc, key) => {
            acc[toCamelCase(key)] = keysToCamel(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

/**
 * Get current period string (YYYY-MM)
 */
export const getCurrentPeriod = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default {
    initDatabase,
    isDatabaseAvailable,
    getPool,
    query,
    getClient,
    transaction,
    closeDatabase,
    buildInsert,
    buildUpdate,
    buildSelect,
    buildUpsert,
    keysToSnake,
    keysToCamel,
    getCurrentPeriod
};
