/**
 * Logger Utility
 * Centralized logging with consistent formatting
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const currentLevel = process.env.LOG_LEVEL
    ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
    : LOG_LEVELS.INFO;

const timestamp = () => new Date().toISOString();

const logger = {
    debug: (message, ...args) => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.debug(`[${timestamp()}] [DEBUG]`, message, ...args);
        }
    },

    info: (message, ...args) => {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(`[${timestamp()}] [INFO]`, message, ...args);
        }
    },

    warn: (message, ...args) => {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(`[${timestamp()}] [WARN]`, message, ...args);
        }
    },

    error: (message, ...args) => {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(`[${timestamp()}] [ERROR]`, message, ...args);
        }
    },

    // Convenience methods matching existing console.log patterns in codebase
    operation: (emoji, operation, details = '') => {
        console.log(`${emoji} ${operation}${details ? `: ${details}` : ''}`);
    },

    success: (message) => {
        console.log(`   ✅ ${message}`);
    },

    step: (message) => {
        console.log(`   ${message}`);
    }
};

export default logger;
