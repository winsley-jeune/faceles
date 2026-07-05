/**
 * Environment Variables Validator
 * Validates required environment variables at startup
 */

const ENV_CONFIG = {
    // Required for core functionality
    required: [
        {
            name: 'ANTHROPIC_API_KEY',
            description: 'Anthropic (Claude) API key for AI content generation',
            category: 'AI Services'
        }
    ],

    // Required for specific features (will warn if missing)
    recommended: [
        {
            name: 'ELEVENLABS_API_KEY',
            description: 'ElevenLabs API key for premium voice synthesis',
            category: 'Voice Services',
            fallback: 'Will use free Edge-TTS instead'
        },
        {
            name: 'REPLICATE_API_TOKEN',
            description: 'Replicate API token for image generation',
            category: 'Image Services',
            fallback: 'Will use Pollinations (free) instead'
        }
    ],

    // Platform OAuth credentials
    platforms: {
        youtube: [
            { name: 'YOUTUBE_CLIENT_ID', description: 'YouTube OAuth Client ID' },
            { name: 'YOUTUBE_CLIENT_SECRET', description: 'YouTube OAuth Client Secret' }
        ],
        facebook: [
            { name: 'FACEBOOK_APP_ID', description: 'Facebook App ID' },
            { name: 'FACEBOOK_APP_SECRET', description: 'Facebook App Secret' }
        ],
        tiktok: [
            { name: 'TIKTOK_CLIENT_KEY', description: 'TikTok Client Key' },
            { name: 'TIKTOK_CLIENT_SECRET', description: 'TikTok Client Secret' }
        ]
    },

    // Database configuration
    database: [
        { name: 'DATABASE_URL', description: 'PostgreSQL connection string' },
        { name: 'DB_HOST', description: 'Database host', default: 'localhost' },
        { name: 'DB_PORT', description: 'Database port', default: '5432' },
        { name: 'DB_NAME', description: 'Database name', default: 'viral_shorts' },
        { name: 'DB_USER', description: 'Database user', default: 'postgres' },
        { name: 'DB_PASSWORD', description: 'Database password' }
    ],

    // Monetization (Stripe)
    monetization: [
        { name: 'STRIPE_SECRET_KEY', description: 'Stripe secret key for payments' },
        { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook signing secret' },
        { name: 'STRIPE_STARTER_PRICE_ID', description: 'Stripe price ID for Starter plan' },
        { name: 'STRIPE_PROFESSIONAL_PRICE_ID', description: 'Stripe price ID for Professional plan' },
        { name: 'STRIPE_ENTERPRISE_PRICE_ID', description: 'Stripe price ID for Enterprise plan' }
    ],

    // Authentication
    auth: [
        { name: 'JWT_SECRET', description: 'Secret key for JWT signing', generateDefault: true },
        { name: 'SESSION_SECRET', description: 'Secret key for session management', generateDefault: true }
    ]
};

/**
 * Validate environment variables
 * @param {Object} options - Validation options
 * @param {boolean} options.exitOnError - Exit process if required vars missing (default: true)
 * @param {boolean} options.verbose - Show detailed output (default: true)
 * @returns {Object} Validation result
 */
export function validateEnv(options = {}) {
    const { exitOnError = true, verbose = true } = options;

    const result = {
        valid: true,
        errors: [],
        warnings: [],
        info: [],
        platforms: {
            youtube: false,
            facebook: false,
            tiktok: false,
            instagram: false
        },
        features: {
            database: false,
            monetization: false,
            premiumVoice: false,
            premiumImages: false
        }
    };

    if (verbose) {
        console.log('\n========================================');
        console.log('   Environment Variables Validation');
        console.log('========================================\n');
    }

    // Check required variables
    if (verbose) console.log('Checking required variables...');
    for (const envVar of ENV_CONFIG.required) {
        if (!process.env[envVar.name]) {
            result.valid = false;
            result.errors.push(`Missing required: ${envVar.name} - ${envVar.description}`);
            if (verbose) console.log(`  [MISSING] ${envVar.name} - ${envVar.description}`);
        } else {
            if (verbose) console.log(`  [OK] ${envVar.name}`);
        }
    }

    // Check recommended variables
    if (verbose) console.log('\nChecking recommended variables...');
    for (const envVar of ENV_CONFIG.recommended) {
        if (!process.env[envVar.name]) {
            result.warnings.push(`Missing recommended: ${envVar.name} - ${envVar.fallback}`);
            if (verbose) console.log(`  [WARN] ${envVar.name} - ${envVar.fallback}`);
        } else {
            if (envVar.name === 'ELEVENLABS_API_KEY') result.features.premiumVoice = true;
            if (envVar.name === 'REPLICATE_API_TOKEN') result.features.premiumImages = true;
            if (verbose) console.log(`  [OK] ${envVar.name}`);
        }
    }

    // Check platform credentials
    if (verbose) console.log('\nChecking platform credentials...');
    for (const [platform, vars] of Object.entries(ENV_CONFIG.platforms)) {
        const hasAll = vars.every(v => process.env[v.name]);
        result.platforms[platform] = hasAll;

        if (hasAll) {
            if (verbose) console.log(`  [OK] ${platform.toUpperCase()} - Ready for uploads`);
        } else {
            const missing = vars.filter(v => !process.env[v.name]).map(v => v.name);
            result.info.push(`${platform.toUpperCase()} not configured: Missing ${missing.join(', ')}`);
            if (verbose) console.log(`  [SKIP] ${platform.toUpperCase()} - Missing: ${missing.join(', ')}`);
        }
    }

    // Check database configuration
    if (verbose) console.log('\nChecking database configuration...');
    const useDatabase = process.env.USE_DATABASE === 'true';

    if (useDatabase) {
        const hasDbUrl = !!process.env.DATABASE_URL;
        const hasDbParams = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;

        if (hasDbUrl || hasDbParams) {
            result.features.database = true;
            if (verbose) console.log('  [OK] PostgreSQL configured');
        } else {
            result.warnings.push('USE_DATABASE=true but no database credentials provided');
            if (verbose) console.log('  [WARN] USE_DATABASE=true but missing credentials');
        }
    } else {
        result.info.push('Database disabled - using JSON file storage');
        if (verbose) console.log('  [INFO] Database disabled - using JSON file storage');
    }

    // Check monetization configuration
    if (verbose) console.log('\nChecking monetization configuration...');
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;

    if (hasStripe) {
        result.features.monetization = true;
        if (verbose) console.log('  [OK] Stripe configured');

        // Check for price IDs
        const missingPrices = [];
        if (!process.env.STRIPE_STARTER_PRICE_ID) missingPrices.push('Starter');
        if (!process.env.STRIPE_PROFESSIONAL_PRICE_ID) missingPrices.push('Professional');
        if (!process.env.STRIPE_ENTERPRISE_PRICE_ID) missingPrices.push('Enterprise');

        if (missingPrices.length > 0) {
            result.warnings.push(`Missing Stripe price IDs for: ${missingPrices.join(', ')}`);
            if (verbose) console.log(`  [WARN] Missing price IDs: ${missingPrices.join(', ')}`);
        }
    } else {
        result.info.push('Stripe not configured - monetization in demo mode');
        if (verbose) console.log('  [INFO] Stripe not configured - demo mode enabled');
    }

    // Check auth configuration
    if (verbose) console.log('\nChecking authentication configuration...');
    for (const envVar of ENV_CONFIG.auth) {
        if (!process.env[envVar.name]) {
            if (envVar.generateDefault) {
                // Generate a default secret for development
                const generated = generateRandomSecret();
                process.env[envVar.name] = generated;
                result.warnings.push(`${envVar.name} not set - generated random value for this session`);
                if (verbose) console.log(`  [WARN] ${envVar.name} - Generated random value (set in .env for production)`);
            } else {
                result.warnings.push(`Missing: ${envVar.name} - ${envVar.description}`);
                if (verbose) console.log(`  [WARN] ${envVar.name} - Not configured`);
            }
        } else {
            if (verbose) console.log(`  [OK] ${envVar.name}`);
        }
    }

    // Summary
    if (verbose) {
        console.log('\n========================================');
        console.log('            Summary');
        console.log('========================================');
        console.log(`\nStatus: ${result.valid ? 'READY' : 'ERRORS FOUND'}`);

        console.log('\nEnabled Platforms:');
        for (const [platform, enabled] of Object.entries(result.platforms)) {
            console.log(`  ${enabled ? '[YES]' : '[ NO]'} ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
        }

        console.log('\nEnabled Features:');
        console.log(`  ${result.features.database ? '[YES]' : '[ NO]'} PostgreSQL Database`);
        console.log(`  ${result.features.monetization ? '[YES]' : '[ NO]'} Stripe Monetization`);
        console.log(`  ${result.features.premiumVoice ? '[YES]' : '[ NO]'} Premium Voice (ElevenLabs)`);
        console.log(`  ${result.features.premiumImages ? '[YES]' : '[ NO]'} Premium Images (Replicate)`);

        if (result.errors.length > 0) {
            console.log('\nErrors:');
            result.errors.forEach(e => console.log(`  - ${e}`));
        }

        if (result.warnings.length > 0) {
            console.log('\nWarnings:');
            result.warnings.forEach(w => console.log(`  - ${w}`));
        }

        console.log('\n========================================\n');
    }

    // Exit if required vars missing and exitOnError is true
    if (!result.valid && exitOnError) {
        console.error('\nCannot start application - missing required environment variables.');
        console.error('Please check your .env file and ensure all required variables are set.\n');
        process.exit(1);
    }

    return result;
}

/**
 * Generate a random secret for development
 */
function generateRandomSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Get environment variable with default
 */
export function getEnv(name, defaultValue = null) {
    return process.env[name] || defaultValue;
}

/**
 * Check if a feature is enabled based on environment
 */
export function isFeatureEnabled(feature) {
    const checks = {
        database: () => process.env.USE_DATABASE === 'true',
        youtube: () => !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
        facebook: () => !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        tiktok: () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
        stripe: () => !!process.env.STRIPE_SECRET_KEY,
        elevenlabs: () => !!process.env.ELEVENLABS_API_KEY,
        replicate: () => !!process.env.REPLICATE_API_TOKEN
    };

    return checks[feature] ? checks[feature]() : false;
}

/**
 * Get all enabled platforms
 */
export function getEnabledPlatforms() {
    const platforms = [];
    if (isFeatureEnabled('youtube')) platforms.push('youtube');
    if (isFeatureEnabled('facebook')) platforms.push('facebook');
    if (isFeatureEnabled('tiktok')) platforms.push('tiktok');
    // Instagram uses Facebook credentials
    if (isFeatureEnabled('facebook')) platforms.push('instagram');
    return platforms;
}

export default {
    validateEnv,
    getEnv,
    isFeatureEnabled,
    getEnabledPlatforms,
    ENV_CONFIG
};
