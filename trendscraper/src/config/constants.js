/**
 * Application Constants
 * Centralized configuration values, enums, and file paths
 * NOTE: Niches and viral criteria are defined in modules/topic_generator.js
 */

// Social media platforms
export const PLATFORMS = {
    YOUTUBE: 'youtube',
    TIKTOK: 'tiktok',
    FACEBOOK: 'facebook',
    INSTAGRAM: 'instagram'
};

// YouTube category IDs (from YouTube Data API)
export const YOUTUBE_CATEGORIES = {
    FILM_ANIMATION: '1',
    AUTOS_VEHICLES: '2',
    MUSIC: '10',
    PETS_ANIMALS: '15',
    SPORTS: '17',
    TRAVEL_EVENTS: '19',
    GAMING: '20',
    PEOPLE_BLOGS: '22',
    COMEDY: '23',
    ENTERTAINMENT: '24',
    NEWS_POLITICS: '25',
    HOWTO_STYLE: '26',
    EDUCATION: '27',
    SCIENCE_TECH: '28',
    NONPROFITS_ACTIVISM: '29'
};

// Default category for videos
export const DEFAULT_YOUTUBE_CATEGORY = YOUTUBE_CATEGORIES.PEOPLE_BLOGS;

// MINIMAX scoring thresholds for video performance analysis
export const MINIMAX_THRESHOLDS = {
    VIRAL: 5000,
    GOOD: 1500,
    AVERAGE: 500,
    POOR: 100,
    FLOP: 0
};

// Score labels for MINIMAX
export const SCORE_LABELS = {
    VIRAL: 'VIRAL',
    GOOD: 'GOOD',
    AVERAGE: 'AVERAGE',
    POOR: 'POOR',
    FLOP: 'FLOP'
};

// Video subtitle styles
export const SUBTITLE_STYLES = {
    VIRAL: 'viral',
    CLEAN: 'clean',
    MINIMAL: 'minimal'
};

// Allowed media types for upload
export const ALLOWED_MEDIA_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
];

// HTTP Status codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

// API Response messages
export const MESSAGES = {
    SUCCESS: 'Operation completed successfully',
    UNAUTHORIZED: 'Unauthorized access',
    INVALID_TOKEN: 'Invalid or expired token',
    MISSING_REQUIRED_FIELDS: 'Missing required fields',
    NOT_FOUND: 'Resource not found',
    SERVER_ERROR: 'Internal server error',
    VIDEO_CREATED: 'Video created successfully',
    UPLOAD_SUCCESS: 'Upload completed successfully',
    INVALID_FILE_TYPE: 'Invalid file type',
    RATE_LIMITED: 'Too many requests, please try again later'
};

// Data file paths (relative to DATA_DIR)
export const DATA_FILES = {
    USERS: 'users.json',
    SESSIONS: 'sessions.json',
    GENERATED_TOPICS: 'generated_topics.json',
    ANALYTICS_HISTORY: 'analytics_history.json',
    YOUTUBE_WINNING_PATTERNS: 'youtube_winning_patterns.json',
    FACEBOOK_WINNING_PATTERNS: 'facebook_winning_patterns.json',
    INSTAGRAM_WINNING_PATTERNS: 'instagram_winning_patterns.json',
    TIKTOK_WINNING_PATTERNS: 'tiktok_winning_patterns.json',
    TIKTOK_GENERATED_TOPICS: 'tiktok_generated_topics.json',
    FACEBOOK_GENERATED_TOPICS: 'facebook_generated_topics.json',
    VIRAL_INTELLIGENCE: 'viral_intelligence.json',
    EMOTION_CACHE: 'emotion_cache.json',
    CONTENT_CONFIG: 'content_config.json',
    EXPLORATION_CONFIG: 'exploration_config.json',
    BRAND_CONTEXT: 'brand_context.json',
    POSTING_SCHEDULE: 'posting_schedule.json',
    POST_QUEUE: 'post_queue.json',
    POSTER_SETTINGS: 'poster_settings.json',
    YOUTUBE_TOKENS: 'youtube_tokens.json',
    FACEBOOK_TOKENS: 'facebook_tokens.json',
    TIKTOK_TOKENS: 'tiktok_tokens.json',
    VARIATION_QUEUE: 'variation_queue.json',
    TRAINING_DATA: 'training/video_training_data.jsonl',
    TRAINING_METADATA: 'training/dataset_metadata.json'
};

// Default energy levels for music selection (can be overridden)
export const ENERGY_LEVELS = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

// Gemini models in order of preference
export const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash'
];

// Scheduler timing constants
export const SCHEDULER = {
    DEFAULT_INTERVAL_MINUTES: 60,
    MIN_INTERVAL_MINUTES: 15,
    MAX_INTERVAL_MINUTES: 1440 // 24 hours
};

// Video generation limits
export const VIDEO_LIMITS = {
    MIN_SCENES: 5,
    MAX_SCENES: 25,
    MIN_SCENE_DURATION: 4,
    MAX_SCENE_DURATION: 20,
    TARGET_DURATION_SECONDS: 120
};

export default {
    PLATFORMS,
    YOUTUBE_CATEGORIES,
    DEFAULT_YOUTUBE_CATEGORY,
    MINIMAX_THRESHOLDS,
    SCORE_LABELS,
    SUBTITLE_STYLES,
    ALLOWED_MEDIA_TYPES,
    HTTP_STATUS,
    MESSAGES,
    DATA_FILES,
    ENERGY_LEVELS,
    GEMINI_MODELS,
    SCHEDULER,
    VIDEO_LIMITS
};
