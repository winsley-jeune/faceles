#!/usr/bin/env node

/**
 * JSON to PostgreSQL Migration Script
 * Migrates existing JSON file data to PostgreSQL database
 *
 * Usage:
 *   node migrate-json-to-postgres.js [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Show what would be migrated without actually migrating
 *   --verbose   Show detailed progress
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Database connection
let pool;

// System user ID for global data
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000000';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function log(message, level = 'info') {
    const prefix = {
        info: '📋',
        success: '✅',
        error: '❌',
        warn: '⚠️',
        verbose: '   '
    }[level] || '  ';

    if (level === 'verbose' && !VERBOSE) return;
    console.log(`${prefix} ${message}`);
}

async function readJsonFile(filename) {
    try {
        const filePath = path.join(DATA_DIR, filename);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

async function query(sql, params = []) {
    if (DRY_RUN) {
        log(`Would execute: ${sql.substring(0, 100)}...`, 'verbose');
        return { rows: [], rowCount: 0 };
    }
    return pool.query(sql, params);
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateTokens() {
    log('Migrating platform tokens...');

    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    let count = 0;

    for (const platform of platforms) {
        const tokens = await readJsonFile(`${platform}_tokens.json`);
        if (!tokens || Object.keys(tokens).length === 0) {
            log(`No tokens found for ${platform}`, 'verbose');
            continue;
        }

        try {
            await query(`
                INSERT INTO platform_tokens (user_id, platform, access_token, refresh_token, expires_at, channel_id, channel_name, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (user_id, platform) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at = EXCLUDED.expires_at,
                    channel_id = EXCLUDED.channel_id,
                    channel_name = EXCLUDED.channel_name,
                    metadata = EXCLUDED.metadata
            `, [
                SYSTEM_USER_ID,
                platform,
                tokens.access_token || tokens.accessToken,
                tokens.refresh_token || tokens.refreshToken,
                tokens.expires_at || tokens.expiresAt ? new Date(tokens.expires_at || tokens.expiresAt) : null,
                tokens.channel_id || tokens.channelId,
                tokens.channel_name || tokens.channelName,
                JSON.stringify(tokens)
            ]);
            count++;
            log(`Migrated ${platform} tokens`, 'verbose');
        } catch (error) {
            log(`Error migrating ${platform} tokens: ${error.message}`, 'error');
        }
    }

    log(`Migrated ${count} platform tokens`, 'success');
    return count;
}

async function migrateTopics() {
    log('Migrating topics...');

    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    let count = 0;

    for (const platform of platforms) {
        const topics = await readJsonFile(`${platform}_generated_topics.json`);
        if (!topics || !Array.isArray(topics)) {
            log(`No topics found for ${platform}`, 'verbose');
            continue;
        }

        for (const topic of topics) {
            try {
                await query(`
                    INSERT INTO topics (platform, niche, topic, hook, script, visual_style, voice_style, source, performance_score, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    platform,
                    topic.niche || 'general',
                    topic.topic || topic.title,
                    topic.hook,
                    topic.script,
                    topic.visualStyle || topic.visual_style,
                    topic.voiceStyle || topic.voice_style,
                    topic.source || 'migration',
                    topic.performanceScore || topic.performance_score || 0,
                    JSON.stringify(topic)
                ]);
                count++;
            } catch (error) {
                log(`Error migrating topic: ${error.message}`, 'verbose');
            }
        }
        log(`Migrated ${topics.length} topics for ${platform}`, 'verbose');
    }

    // Also migrate general topics
    const generalTopics = await readJsonFile('generated_topics.json');
    if (generalTopics && Array.isArray(generalTopics)) {
        for (const topic of generalTopics) {
            try {
                await query(`
                    INSERT INTO topics (platform, niche, topic, hook, script, visual_style, voice_style, source, performance_score, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    topic.platform || 'general',
                    topic.niche || 'general',
                    topic.topic || topic.title,
                    topic.hook,
                    topic.script,
                    topic.visualStyle || topic.visual_style,
                    topic.voiceStyle || topic.voice_style,
                    topic.source || 'migration',
                    topic.performanceScore || topic.performance_score || 0,
                    JSON.stringify(topic)
                ]);
                count++;
            } catch (error) {
                log(`Error migrating general topic: ${error.message}`, 'verbose');
            }
        }
    }

    log(`Migrated ${count} total topics`, 'success');
    return count;
}

async function migrateAnalytics() {
    log('Migrating analytics history...');

    const analytics = await readJsonFile('analytics_history.json');
    if (!analytics) {
        log('No analytics history found', 'verbose');
        return 0;
    }

    let count = 0;

    for (const [platform, entries] of Object.entries(analytics)) {
        if (!Array.isArray(entries)) continue;

        for (const entry of entries) {
            try {
                await query(`
                    INSERT INTO video_analytics (
                        platform, video_id, title, views, likes, comments, shares,
                        watch_time, retention_rate, engagement_rate, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (platform, video_id) DO NOTHING
                `, [
                    platform,
                    entry.videoId || entry.video_id || `migrated_${Date.now()}_${count}`,
                    entry.title,
                    entry.views || 0,
                    entry.likes || 0,
                    entry.comments || 0,
                    entry.shares || 0,
                    entry.watchTime || entry.watch_time || 0,
                    entry.retentionRate || entry.retention_rate || 0,
                    entry.engagementRate || entry.engagement_rate || 0,
                    JSON.stringify(entry)
                ]);
                count++;
            } catch (error) {
                log(`Error migrating analytics entry: ${error.message}`, 'verbose');
            }
        }
    }

    log(`Migrated ${count} analytics entries`, 'success');
    return count;
}

async function migrateWinningPatterns() {
    log('Migrating winning patterns...');

    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    let count = 0;

    for (const platform of platforms) {
        const patterns = await readJsonFile(`${platform}_winning_patterns.json`);
        if (!patterns || typeof patterns !== 'object') {
            log(`No winning patterns found for ${platform}`, 'verbose');
            continue;
        }

        for (const [key, value] of Object.entries(patterns)) {
            try {
                const patternType = value.patternType || value.pattern_type || 'general';
                const pattern = value.pattern || key;

                await query(`
                    INSERT INTO winning_patterns (platform, pattern_type, pattern, score, sample_size, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (platform, pattern_type, pattern) DO UPDATE SET
                        score = EXCLUDED.score,
                        sample_size = EXCLUDED.sample_size,
                        metadata = EXCLUDED.metadata
                `, [
                    platform,
                    patternType,
                    pattern,
                    value.score || 0,
                    value.sampleSize || value.sample_size || 0,
                    JSON.stringify(value)
                ]);
                count++;
            } catch (error) {
                log(`Error migrating winning pattern: ${error.message}`, 'verbose');
            }
        }
    }

    log(`Migrated ${count} winning patterns`, 'success');
    return count;
}

async function migrateEmotionCache() {
    log('Migrating emotion cache...');

    const cache = await readJsonFile('emotion_cache.json');
    if (!cache || typeof cache !== 'object') {
        log('No emotion cache found', 'verbose');
        return 0;
    }

    let count = 0;

    for (const [hash, entry] of Object.entries(cache)) {
        try {
            await query(`
                INSERT INTO emotion_cache (text_hash, text, emotion, confidence)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (text_hash) DO NOTHING
            `, [
                hash,
                entry.text || '',
                entry.emotion,
                entry.confidence || 0
            ]);
            count++;
        } catch (error) {
            log(`Error migrating emotion cache entry: ${error.message}`, 'verbose');
        }
    }

    log(`Migrated ${count} emotion cache entries`, 'success');
    return count;
}

async function migrateExplorationConfig() {
    log('Migrating exploration config...');

    const config = await readJsonFile('exploration_config.json');
    if (!config) {
        log('No exploration config found', 'verbose');
        return 0;
    }

    try {
        await query(`
            INSERT INTO exploration_config (
                user_id, exploration_rate, min_exploration_rate, max_exploration_rate,
                adaptive_mode, exploration_decay, recent_window_size, performance_threshold, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id) DO UPDATE SET
                exploration_rate = EXCLUDED.exploration_rate,
                min_exploration_rate = EXCLUDED.min_exploration_rate,
                max_exploration_rate = EXCLUDED.max_exploration_rate,
                adaptive_mode = EXCLUDED.adaptive_mode,
                exploration_decay = EXCLUDED.exploration_decay,
                recent_window_size = EXCLUDED.recent_window_size,
                performance_threshold = EXCLUDED.performance_threshold,
                metadata = EXCLUDED.metadata
        `, [
            SYSTEM_USER_ID,
            config.explorationRate || config.exploration_rate || 0.2,
            config.minExplorationRate || config.min_exploration_rate || 0.05,
            config.maxExplorationRate || config.max_exploration_rate || 0.4,
            config.adaptiveMode !== false,
            config.explorationDecay || config.exploration_decay || 0.99,
            config.recentWindowSize || config.recent_window_size || 10,
            config.performanceThreshold || config.performance_threshold || 0.7,
            JSON.stringify(config)
        ]);
        log('Migrated exploration config', 'success');
        return 1;
    } catch (error) {
        log(`Error migrating exploration config: ${error.message}`, 'error');
        return 0;
    }
}

async function migrateViralIntelligence() {
    log('Migrating viral intelligence...');

    const intelligence = await readJsonFile('viral_intelligence.json');
    if (!intelligence || typeof intelligence !== 'object') {
        log('No viral intelligence found', 'verbose');
        return 0;
    }

    let count = 0;

    for (const [key, value] of Object.entries(intelligence)) {
        try {
            await query(`
                INSERT INTO cross_platform_patterns (pattern_type, pattern, platforms, avg_score, platform_scores, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (pattern_type, pattern) DO UPDATE SET
                    platforms = EXCLUDED.platforms,
                    avg_score = EXCLUDED.avg_score,
                    platform_scores = EXCLUDED.platform_scores,
                    metadata = EXCLUDED.metadata
            `, [
                'viral',
                key,
                value.platforms || ['youtube', 'tiktok', 'facebook', 'instagram'],
                value.avgScore || value.avg_score || 0,
                JSON.stringify(value.platformScores || value.platform_scores || {}),
                JSON.stringify(value)
            ]);
            count++;
        } catch (error) {
            log(`Error migrating viral intelligence: ${error.message}`, 'verbose');
        }
    }

    log(`Migrated ${count} viral intelligence patterns`, 'success');
    return count;
}

async function migratePostingSchedule() {
    log('Migrating posting schedule...');

    const schedule = await readJsonFile('posting_schedule.json');
    if (!schedule || !Array.isArray(schedule)) {
        log('No posting schedule found', 'verbose');
        return 0;
    }

    let count = 0;

    for (const post of schedule) {
        try {
            await query(`
                INSERT INTO post_queue (
                    platform, video_path, title, description, hashtags,
                    scheduled_for, priority, status, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                post.platform,
                post.videoPath || post.video_path,
                post.title,
                post.description,
                post.hashtags,
                post.scheduledFor || post.scheduled_for ? new Date(post.scheduledFor || post.scheduled_for) : null,
                post.priority || 0,
                post.status || 'pending',
                JSON.stringify(post)
            ]);
            count++;
        } catch (error) {
            log(`Error migrating post: ${error.message}`, 'verbose');
        }
    }

    log(`Migrated ${count} scheduled posts`, 'success');
    return count;
}

async function migrateVariationQueue() {
    log('Migrating variation queue...');

    const variations = await readJsonFile('variation_queue.json');
    if (!variations || !Array.isArray(variations)) {
        log('No variation queue found', 'verbose');
        return 0;
    }

    // For variations, we'd need topic IDs which we don't have from migration
    // So we'll just log the count and skip
    log(`Found ${variations.length} variations (skipped - requires topic IDs)`, 'warn');
    return 0;
}

// ============================================
// MAIN MIGRATION
// ============================================

async function main() {
    console.log('\n========================================');
    console.log('  JSON to PostgreSQL Migration Script');
    console.log('========================================\n');

    if (DRY_RUN) {
        console.log('  DRY RUN MODE - No data will be written\n');
    }

    // Check for required environment variables
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl && !DRY_RUN) {
        console.error('DATABASE_URL environment variable is required');
        console.log('\nSet it in your .env file:');
        console.log('DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viral_shorts\n');
        process.exit(1);
    }

    // Connect to database
    if (!DRY_RUN) {
        try {
            pool = new pg.Pool({
                connectionString: dbUrl,
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
            });

            // Test connection
            await pool.query('SELECT NOW()');
            log('Connected to PostgreSQL database', 'success');
        } catch (error) {
            console.error('Failed to connect to database:', error.message);
            process.exit(1);
        }
    }

    console.log('\nStarting migration...\n');

    const results = {
        tokens: await migrateTokens(),
        topics: await migrateTopics(),
        analytics: await migrateAnalytics(),
        winningPatterns: await migrateWinningPatterns(),
        emotionCache: await migrateEmotionCache(),
        explorationConfig: await migrateExplorationConfig(),
        viralIntelligence: await migrateViralIntelligence(),
        postingSchedule: await migratePostingSchedule(),
        variationQueue: await migrateVariationQueue()
    };

    // Summary
    console.log('\n========================================');
    console.log('         Migration Summary');
    console.log('========================================');
    console.log(`Platform Tokens:     ${results.tokens}`);
    console.log(`Topics:              ${results.topics}`);
    console.log(`Analytics Entries:   ${results.analytics}`);
    console.log(`Winning Patterns:    ${results.winningPatterns}`);
    console.log(`Emotion Cache:       ${results.emotionCache}`);
    console.log(`Exploration Config:  ${results.explorationConfig}`);
    console.log(`Viral Intelligence:  ${results.viralIntelligence}`);
    console.log(`Posting Schedule:    ${results.postingSchedule}`);
    console.log(`Variation Queue:     ${results.variationQueue}`);

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`\nTotal records migrated: ${total}\n`);

    if (DRY_RUN) {
        console.log('This was a dry run. Run without --dry-run to actually migrate data.\n');
    } else {
        console.log('Migration completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Set USE_DATABASE=true in your .env file');
        console.log('2. Restart your application');
        console.log('3. Verify data in PostgreSQL\n');
    }

    // Close database connection
    if (pool) {
        await pool.end();
    }
}

// Run migration
main().catch(error => {
    console.error('\nMigration failed:', error);
    process.exit(1);
});
