/**
 * Environment Configuration
 * Centralized environment variables with defaults
 */
import 'dotenv/config';

const env = {
    // Server
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Helper to check if in development mode
    isDevelopment: () => (process.env.NODE_ENV || 'development') === 'development',
    isProduction: () => process.env.NODE_ENV === 'production',

    // Paths
    VIDEOS_DIR: process.env.VIDEOS_DIR || '/app/videos',
    DATA_DIR: process.env.DATA_DIR || '/app/data',
    PRODUCT_MEDIA_DIR: process.env.PRODUCT_MEDIA_DIR || '/app/videos/product_media',

    // CORS Origins
    CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5175').split(','),

    // API Keys
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, // LLM content brain (Claude) — replaces Gemini
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY, // legacy — retained until all call sites migrate off Gemini
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,

    // OAuth - Google/YouTube
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/youtube-api/callback',

    // OAuth - Facebook
    FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
    FACEBOOK_REDIRECT_URI: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/facebook-api/callback',

    // OAuth - TikTok
    TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET,
    TIKTOK_REDIRECT_URI: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/tiktok-api/callback',

    // Auth - NEVER use default secret in production
    JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-only-secret-not-for-production'),
    JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',

    // Limits
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
    JSON_LIMIT: process.env.JSON_LIMIT || '50mb',
    MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3, // Max concurrent video generation jobs

    // Feature Flags
    ENABLE_AUTO_POSTER: process.env.ENABLE_AUTO_POSTER !== 'false',
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
};

// Validate required environment variables in production
if (env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET'];
    const missing = required.filter(key => !env[key]);
    if (missing.length > 0) {
        console.error(`SECURITY ERROR: Missing required environment variables: ${missing.join(', ')}`);
        console.error('JWT_SECRET must be set in production. Generate with: openssl rand -hex 32');
        process.exit(1);
    }

    // Validate JWT_SECRET strength
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
        console.error('SECURITY ERROR: JWT_SECRET must be at least 32 characters');
        console.error('Generate a strong secret with: openssl rand -hex 32');
        process.exit(1);
    }

    // Warn about weak secrets
    const weakSecrets = ['secret', 'password', 'your-secret', 'change-me', 'dev-only'];
    if (env.JWT_SECRET && weakSecrets.some(weak => env.JWT_SECRET.toLowerCase().includes(weak))) {
        console.error('SECURITY ERROR: JWT_SECRET appears to be a weak/default value');
        console.error('Generate a strong secret with: openssl rand -hex 32');
        process.exit(1);
    }

    // Warn about missing API keys (not fatal)
    const recommended = ['GOOGLE_API_KEY', 'GEMINI_API_KEY'];
    const missingRecommended = recommended.filter(key => !env[key]);
    if (missingRecommended.length > 0) {
        console.warn(`Warning: Missing recommended environment variables: ${missingRecommended.join(', ')}`);
    }
}

export default env;
