/**
 * Server Entry Point
 * Minimal index.js that bootstraps the Express application
 *
 * MVC Refactored Structure:
 * - config/     : Environment, constants, database paths
 * - middleware/ : Express middleware (error handling, async wrapper)
 * - utils/      : Logging, file system utilities
 * - routes/     : Express Router definitions
 * - controllers/: Request handlers
 * - services/   : Background services (auto-scheduler)
 * - modules/    : Business logic (existing)
 * - database/   : PostgreSQL connection and repositories
 */
import 'dotenv/config';
import app from './app.js';
import env from './config/env.js';
import { validateEnv } from './config/envValidator.js';
import { logger } from './utils/index.js';
import autoScheduler from './services/autoScheduler.js';
import jobQueueService from './services/jobQueueService.js';
import youtubeAnalytics from './modules/analytics/youtube_analytics.js';
import { initDatabase, closeDatabase } from './database/index.js';
import { runMigrations } from './database/migrate.js';

const PORT = env.PORT;

// ===========================================
// ENVIRONMENT VALIDATION
// ===========================================

// Validate environment variables before starting
const envValidation = validateEnv({
    exitOnError: true,
    verbose: true
});

// ===========================================
// STARTUP ANALYTICS REFRESH
// ===========================================

/**
 * Refresh YouTube analytics on startup
 * Ensures viral score calculations use fresh data
 */
const refreshAnalyticsOnStartup = async () => {
    logger.info('📊 Refreshing YouTube analytics on startup...');

    try {
        const { videos, summary } = await youtubeAnalytics.fetchAllVideoStats();

        if (videos && videos.length > 0) {
            // Save fresh snapshot to analytics history
            youtubeAnalytics.saveAnalyticsSnapshot({ videos, summary });

            logger.info(`   ✅ Analytics refreshed: ${videos.length} videos, ${summary.avgViewsPerVideo} avg views`);
            logger.info(`   🎯 Viral threshold (9+): ${summary.avgViewsPerVideo * 3}+ views`);

            // Log top 3 performers
            const top3 = videos.slice(0, 3);
            logger.info('   🏆 Top performers:');
            top3.forEach((v, i) => {
                logger.info(`      ${i + 1}. ${v.stats.views} views - ${v.title.substring(0, 40)}...`);
            });
        } else {
            logger.info('   ⚠️ No videos found or YouTube not connected');
        }
    } catch (err) {
        logger.warn(`   ⚠️ Could not refresh analytics: ${err.message}`);
        logger.warn('   📌 System will use cached data. Connect YouTube API to enable fresh analytics.');
    }
};

// ===========================================
// SERVER STARTUP
// ===========================================

// ===========================================
// DATABASE INITIALIZATION
// ===========================================

const initializeDatabaseConnection = async () => {
    if (process.env.USE_DATABASE === 'true') {
        logger.info('Initializing PostgreSQL database connection...');
        try {
            await initDatabase();
            logger.info('   Database connected successfully');
            logger.info('   Running database migrations...');
            await runMigrations();
        } catch (err) {
            logger.warn(`   Database connection failed: ${err.message}`);
            logger.warn('   Falling back to JSON file storage');
        }
    } else {
        logger.info('Database disabled - using JSON file storage');
    }
};

// ===========================================
// SERVER STARTUP
// ===========================================

const server = app.listen(PORT, async () => {
    logger.info(`Engine running on port ${PORT}`);
    logger.info(`Videos directory: ${env.VIDEOS_DIR}`);
    logger.info(`Data directory: ${env.DATA_DIR}`);

    // Show enabled platforms
    const platforms = [];
    if (envValidation.platforms.youtube) platforms.push('YouTube');
    if (envValidation.platforms.facebook) platforms.push('Facebook');
    if (envValidation.platforms.tiktok) platforms.push('TikTok');
    if (envValidation.platforms.instagram) platforms.push('Instagram');
    logger.info(`Enabled platforms: ${platforms.length > 0 ? platforms.join(', ') : 'None'}`);

    if (process.env.NODE_ENV !== 'production') {
        logger.info('Development mode - request logging enabled');
    }

    // Initialize database connection
    await initializeDatabaseConnection();

    // Refresh analytics FIRST before starting scheduler
    await refreshAnalyticsOnStartup();

    // Start job queue service for background video generation
    jobQueueService.start();
    logger.info(`   Job queue service started with ${env.MAX_CONCURRENT_JOBS} workers`);

    // Start auto-scheduler for batch processing
    autoScheduler.start();

    logger.info('Server startup complete - ready to generate videos!');
});

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);

    // Stop job queue service (aborts active jobs)
    jobQueueService.stop();

    // Stop auto-scheduler
    autoScheduler.stop();

    // Close database connection
    try {
        await closeDatabase();
        logger.info('Database connection closed.');
    } catch (err) {
        logger.warn(`Error closing database: ${err.message}`);
    }

    server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===========================================
// UNHANDLED ERRORS
// ===========================================

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default server;
