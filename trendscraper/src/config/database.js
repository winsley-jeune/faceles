/**
 * Database Configuration
 * Centralized JSON file-based data layer configuration
 */
import fs from 'fs';
import path from 'path';
import env from './env.js';
import { DATA_FILES } from './constants.js';

// Ensure data directory exists
const ensureDataDir = () => {
    if (!fs.existsSync(env.DATA_DIR)) {
        fs.mkdirSync(env.DATA_DIR, { recursive: true });
    }
    const trainingDir = path.join(env.DATA_DIR, 'training');
    if (!fs.existsSync(trainingDir)) {
        fs.mkdirSync(trainingDir, { recursive: true });
    }
};

// Get full path for a data file
const getDataPath = (filename) => {
    return path.join(env.DATA_DIR, filename);
};

// Get all configured data file paths
const getDataFilePaths = () => {
    const paths = {};
    for (const [key, filename] of Object.entries(DATA_FILES)) {
        paths[key] = getDataPath(filename);
    }
    return paths;
};

export default {
    ensureDataDir,
    getDataPath,
    getDataFilePaths,
    DATA_DIR: env.DATA_DIR,
    VIDEOS_DIR: env.VIDEOS_DIR,
    PRODUCT_MEDIA_DIR: env.PRODUCT_MEDIA_DIR
};

export {
    ensureDataDir,
    getDataPath,
    getDataFilePaths
};
