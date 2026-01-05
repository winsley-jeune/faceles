/**
 * File System Utilities
 * Common file operations for JSON data storage
 */
import fs from 'fs';
import path from 'path';

/**
 * Load JSON from file with default value fallback
 * @param {string} filepath - Path to JSON file
 * @param {*} defaultValue - Default value if file doesn't exist or is invalid
 * @returns {*} Parsed JSON or default value
 */
export const loadJSON = (filepath, defaultValue = null) => {
    try {
        if (fs.existsSync(filepath)) {
            const content = fs.readFileSync(filepath, 'utf8');
            return JSON.parse(content);
        }
    } catch (err) {
        console.warn(`Failed to load JSON from ${filepath}:`, err.message);
    }
    return defaultValue;
};

/**
 * Save data to JSON file
 * Creates directory if it doesn't exist
 * @param {string} filepath - Path to JSON file
 * @param {*} data - Data to save
 * @param {boolean} pretty - Whether to format with indentation (default: true)
 */
export const saveJSON = (filepath, data, pretty = true) => {
    try {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        fs.writeFileSync(filepath, content);
        return true;
    } catch (err) {
        console.error(`Failed to save JSON to ${filepath}:`, err.message);
        return false;
    }
};

/**
 * Append line to JSONL file (JSON Lines format)
 * @param {string} filepath - Path to JSONL file
 * @param {Object} data - Object to append as JSON line
 */
export const appendJSONL = (filepath, data) => {
    try {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(filepath, JSON.stringify(data) + '\n');
        return true;
    } catch (err) {
        console.error(`Failed to append to JSONL ${filepath}:`, err.message);
        return false;
    }
};

/**
 * Load all lines from JSONL file
 * @param {string} filepath - Path to JSONL file
 * @returns {Array} Array of parsed JSON objects
 */
export const loadJSONL = (filepath) => {
    try {
        if (!fs.existsSync(filepath)) {
            return [];
        }
        const content = fs.readFileSync(filepath, 'utf8');
        return content
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    } catch (err) {
        console.error(`Failed to load JSONL from ${filepath}:`, err.message);
        return [];
    }
};

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
export const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Check if file exists
 * @param {string} filepath - Path to file
 * @returns {boolean}
 */
export const fileExists = (filepath) => {
    return fs.existsSync(filepath);
};

/**
 * Copy file from source to destination
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 */
export const copyFile = (source, destination) => {
    const dir = path.dirname(destination);
    ensureDir(dir);
    fs.copyFileSync(source, destination);
};

/**
 * Get file stats
 * @param {string} filepath - Path to file
 * @returns {Object|null} File stats or null if file doesn't exist
 */
export const getFileStats = (filepath) => {
    try {
        if (fs.existsSync(filepath)) {
            return fs.statSync(filepath);
        }
    } catch (err) {
        console.warn(`Failed to get stats for ${filepath}:`, err.message);
    }
    return null;
};

/**
 * List files in directory
 * @param {string} dirPath - Directory path
 * @param {string} extension - Optional file extension filter (e.g., '.mp4')
 * @returns {Array} Array of filenames
 */
export const listFiles = (dirPath, extension = null) => {
    try {
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        let files = fs.readdirSync(dirPath);
        if (extension) {
            files = files.filter(f => f.endsWith(extension));
        }
        return files;
    } catch (err) {
        console.error(`Failed to list files in ${dirPath}:`, err.message);
        return [];
    }
};

export default {
    loadJSON,
    saveJSON,
    appendJSONL,
    loadJSONL,
    ensureDir,
    fileExists,
    copyFile,
    getFileStats,
    listFiles
};
