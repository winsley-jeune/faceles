import fs from 'fs/promises';
import path from 'path';
import db from '../db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../../data');

// WHY: Default user email for legacy data
const DEFAULT_USER_EMAIL = 'admin@viral-shorts.local';

async function migrate() {
    console.log('🚀 Starting Multi-Tenant Migration...\n');

    // Initialize database connection
    await db.initDatabase();

    try {
        // STEP 1: Create default user
        const defaultUser = await createDefaultUser();
        console.log(`✅ Default user: ${defaultUser.id}\n`);

        // STEP 2: Migrate data with user assignment
        await migrateTopics(defaultUser.id);
        await migrateAnalytics(defaultUser.id);
        await migrateWinningPatterns(defaultUser.id);
        await migrateTokens(defaultUser.id);
        await migrateABTests(defaultUser.id);
        await migratePostQueue(defaultUser.id);
        await migrateExplorationConfig(defaultUser.id);

        console.log('\n✅ Migration completed successfully!');
        console.log(`\n📧 Default user: ${DEFAULT_USER_EMAIL}`);
        console.log(`🆔 User ID: ${defaultUser.id}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

/**
 * WHY: Create a default user to own all legacy data
 * All existing JSON data will be assigned to this user
 */
async function createDefaultUser() {
    console.log('1️⃣ Creating default user...');

    const existing = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [DEFAULT_USER_EMAIL]
    );

    if (existing.rows.length > 0) {
        console.log('  ℹ️ Default user already exists');
        return existing.rows[0];
    }

    const result = await db.query(
        `INSERT INTO users (email, name, is_active)
           VALUES ($1, $2, true)
           RETURNING *`,
        [DEFAULT_USER_EMAIL, 'Default Admin User']
    );

    return result.rows[0];
}

/**
 * WHY: Migrate topics from platform-specific JSON files
 */
async function migrateTopics(userId) {
    console.log('2️⃣ Migrating topics...');
    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    let total = 0;

    for (const platform of platforms) {
        const file = path.join(DATA_DIR, `${platform}_generated_topics.json`);

        try {
            const data = JSON.parse(await fs.readFile(file, 'utf-8'));

            for (const topic of data) {
                await db.query(
                    `INSERT INTO topics (user_id, platform, topic, niche, hook_type, source, viral_score, status, performance, generated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                       ON CONFLICT DO NOTHING`,
                    [
                        userId,  // WHY: Assign to default user
                        platform,
                        topic.topic,
                        topic.niche || 'general',
                        topic.hook || topic.metadata?.hook,
                        topic.source || 'imported',
                        topic.metadata?.viralScore || 0,
                        'generated',
                        topic.metadata ? JSON.stringify(topic.metadata) : null,
                        topic.createdAt || new Date().toISOString()
                    ]
                );
                total++;
            }
            console.log(`  ✓ ${platform}: ${data.length} topics`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`  ⚠️ ${platform}:`, err.message);
            }
        }
    }

    console.log(`  ✅ Total: ${total} topics migrated\n`);
}

/**
 * WHY: Migrate analytics from nested JSON structure
 * analytics_history.json has format: { platform: [videos...] }
 */
async function migrateAnalytics(userId) {
    console.log('3️⃣ Migrating analytics...');
    const file = path.join(DATA_DIR, 'analytics_history.json');
    let total = 0;

    try {
        const history = JSON.parse(await fs.readFile(file, 'utf-8'));

        // WHY: Explode nested structure into individual records
        for (const [platform, videos] of Object.entries(history)) {
            if (!Array.isArray(videos)) continue;

            for (const video of videos) {
                await db.query(
                    `INSERT INTO video_analytics (
                          user_id, platform, video_id, title, published_at, views, likes, comments, shares,
                          engagement_rate, viral_score, snapshot_date
                       )
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                       ON CONFLICT (platform, video_id, snapshot_date) DO UPDATE
                       SET user_id = $1`,  // WHY: Update user_id if record exists
                    [
                        userId,
                        platform,
                        video.videoId || video.id || `migrated_${total}`,
                        video.title || video.topic,
                        video.publishedAt || video.timestamp || new Date().toISOString(),
                        video.views || 0,
                        video.likes || 0,
                        video.comments || 0,
                        video.shares || 0,
                        video.engagementRate || 0,
                        video.viralScore || 0,
                        new Date().toISOString().split('T')[0]  // WHY: Today's snapshot
                    ]
                );
                total++;
            }
            console.log(`  ✓ ${platform}: ${videos.length} analytics records`);
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`  ⚠️ Error:`, err.message);
        }
    }

    console.log(`  ✅ Total: ${total} analytics records migrated\n`);
}

/**
 * WHY: Migrate winning patterns (key-value store to relational)
 */
async function migrateWinningPatterns(userId) {
    console.log('4️⃣ Migrating winning patterns...');
    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    let total = 0;

    for (const platform of platforms) {
        const file = path.join(DATA_DIR, `${platform}_winning_patterns.json`);

        try {
            const patterns = JSON.parse(await fs.readFile(file, 'utf-8'));

            // WHY: Extract pattern type and value from key "type_value"
            for (const [key, pattern] of Object.entries(patterns)) {
                const [patternType, ...valueParts] = key.split('_');
                const patternValue = valueParts.join('_') || key;

                await db.query(
                    `INSERT INTO winning_patterns (
                          user_id, platform, pattern_type, pattern_value, sample_count, total_views, avg_viral_score, confidence
                       )
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                       ON CONFLICT (user_id, platform, pattern_type, pattern_value) DO UPDATE
                       SET sample_count = $5, total_views = $6, avg_viral_score = $7, confidence = $8`,
                    [
                        userId,
                        platform,
                        patternType || 'hook',
                        patternValue,
                        pattern.sampleSize || pattern.count || 1,
                        pattern.totalViews || 0,
                        pattern.score || 0,
                        pattern.confidence || 0.5
                    ]
                );
                total++;
            }
            console.log(`  ✓ ${platform}: ${Object.keys(patterns).length} patterns`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`  ⚠️ ${platform}:`, err.message);
            }
        }
    }

    console.log(`  ✅ Total: ${total} winning patterns migrated\n`);
}

/**
 * WHY: Migrate platform OAuth tokens
 */
async function migrateTokens(userId) {
    console.log('5️⃣ Migrating platform tokens...');
    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    let total = 0;

    for (const platform of platforms) {
        const file = path.join(DATA_DIR, `${platform}_tokens.json`);

        try {
            const tokens = JSON.parse(await fs.readFile(file, 'utf-8'));

            if (Object.keys(tokens).length > 0) {
                await db.query(
                    `INSERT INTO platform_tokens (user_id, platform, access_token, refresh_token, expires_at, extra_data)
                       VALUES ($1, $2, $3, $4, $5, $6)
                       ON CONFLICT (user_id, platform) DO UPDATE
                       SET access_token = $3, refresh_token = $4, expires_at = $5, extra_data = $6`,
                    [
                        userId,
                        platform,
                        tokens.access_token,
                        tokens.refresh_token,
                        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                        JSON.stringify(tokens)  // WHY: Preserve all token metadata
                    ]
                );
                total++;
                console.log(`  ✓ ${platform}: token migrated`);
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`  ⚠️ ${platform}:`, err.message);
            }
        }
    }

    console.log(`  ✅ Total: ${total} platform tokens migrated\n`);
}

/**
 * WHY: Migrate A/B testing experiments and variants
 */
async function migrateABTests(userId) {
    console.log('6️⃣ Migrating A/B tests...');
    const file = path.join(DATA_DIR, 'ab_tests.json');
    let expCount = 0;
    let varCount = 0;

    try {
        const data = JSON.parse(await fs.readFile(file, 'utf-8'));

        for (const exp of data.experiments || []) {
            // WHY: Create experiment first to get ID
            const expResult = await db.query(
                `INSERT INTO ab_experiments (user_id, name, type, platform, niche, target_samples, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id`,
                [userId, exp.name, exp.type, exp.platform, exp.niche || 'all', exp.targetSamples || 10, exp.status || 'running']
            );
            const experimentId = expResult.rows[0].id;
            expCount++;

            // WHY: Create variants for this experiment
            for (const variant of exp.variants || []) {
                await db.query(
                    `INSERT INTO ab_variants (experiment_id, name, description, config, samples, total_views, avg_views, viral_score)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        experimentId,
                        variant.name,
                        variant.description || null,
                        JSON.stringify(variant.config || {}),
                        variant.samples || 0,
                        variant.totalViews || 0,
                        variant.avgViews || 0,
                        variant.viralScore || 0
                    ]
                );
                varCount++;
            }
        }
        console.log(`  ✓ ${expCount} experiments, ${varCount} variants`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`  ⚠️ Error:`, err.message);
        }
    }

    console.log(`  ✅ A/B tests migrated\n`);
}

/**
 * WHY: Migrate scheduled posts queue
 */
async function migratePostQueue(userId) {
    console.log('7️⃣ Migrating post queue...');
    const file = path.join(DATA_DIR, 'posting_schedule.json');
    let total = 0;

    try {
        const queue = JSON.parse(await fs.readFile(file, 'utf-8'));

        for (const post of queue || []) {
            await db.query(
                `INSERT INTO post_queue (user_id, video_path, topic, niche, content, status, scheduled_for)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    userId,
                    post.videoPath || post.video || '/videos/pending.mp4',
                    post.topic,
                    post.niche || 'general',
                    JSON.stringify(post),  // WHY: Preserve all post data
                    post.status || 'pending',
                    post.scheduledFor || new Date()
                ]
            );
            total++;
        }
        console.log(`  ✓ ${total} scheduled posts`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`  ⚠️ Error:`, err.message);
        }
    }

    console.log(`  ✅ Post queue migrated\n`);
}

/**
 * WHY: Migrate exploration configuration
 */
async function migrateExplorationConfig(userId) {
    console.log('8️⃣ Migrating exploration config...');
    const file = path.join(DATA_DIR, 'exploration_config.json');

    try {
        const config = JSON.parse(await fs.readFile(file, 'utf-8'));

        await db.query(
            `INSERT INTO exploration_config (user_id, global_config, platform_config, tone_distribution, auto_adjust)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (user_id) DO UPDATE
               SET global_config = $2, platform_config = $3, tone_distribution = $4, auto_adjust = $5`,
            [
                userId,
                JSON.stringify(config.global || { exploration_rate: 0.2, enabled: true }),
                JSON.stringify(config.platform || {}),
                JSON.stringify(config.toneDistribution || { safe: 0.7, edgy: 0.2, controversial: 0.1 }),
                JSON.stringify(config.autoAdjust || { enabled: true })
            ]
        );
        console.log(`  ✓ Exploration config migrated`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`  ⚠️ Error:`, err.message);
        }
    }

    console.log(`  ✅ Exploration config migrated\n`);
}

// Run migration
migrate();