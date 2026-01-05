import fs from 'fs/promises';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'postgres',  // Docker service name
    port: 5432,
    database: 'viral_shorts',
    user: 'postgres',
    password: 'postgres'
});

async function migrate() {
    console.log('🚀 Starting Data Migration...\n');

    try {
        // Get existing user
        const userResult = await pool.query('SELECT * FROM users LIMIT 1');
        if (userResult.rows.length === 0) {
            console.error('❌ No user found in database');
            process.exit(1);
        }

        const userId = userResult.rows[0].id;
        const userEmail = userResult.rows[0].email;

        console.log(`✅ Using user: ${userEmail}`);
        console.log(`🆔 User ID: ${userId}\n`);

        // Migrate YouTube topics
        await migrateTopics(userId, 'youtube');
        await migrateTopics(userId, 'tiktok');
        await migrateTopics(userId, 'facebook');
        await migrateTopics(userId, 'instagram');

        // Migrate analytics
        await migrateAnalytics(userId);

        // Migrate tokens
        await migrateTokens(userId, 'youtube');
        await migrateTokens(userId, 'tiktok');
        await migrateTokens(userId, 'facebook');
        await migrateTokens(userId, 'instagram');

        // Migrate A/B tests
        await migrateABTests(userId);

        console.log('\n✅ Migration completed successfully!');
        console.log(`📧 All data assigned to: ${userEmail}`);

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

async function migrateTopics(userId, platform) {
    try {
        const data = JSON.parse(await fs.readFile(`data/${platform}_generated_topics.json`, 'utf-8'));
        let count = 0;

        for (const topic of data) {
            await pool.query(
                `INSERT INTO topics (user_id, platform, topic, niche, hook_type, source, viral_score, status, generated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT DO NOTHING`,
                [userId, platform, topic.topic, topic.niche || 'general', topic.hook,
                 topic.source || 'imported', topic.metadata?.viralScore || 0,
                 'generated', topic.createdAt || new Date().toISOString()]
            );
            count++;
        }

        if (count > 0) {
            console.log(`✓ ${platform}: ${count} topics migrated`);
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`⚠️ ${platform} topics error:`, err.message);
        }
    }
}

async function migrateAnalytics(userId) {
    try {
        const history = JSON.parse(await fs.readFile('data/analytics_history.json', 'utf-8'));
        let total = 0;

        for (const [platform, videos] of Object.entries(history)) {
            if (!Array.isArray(videos)) continue;

            for (const video of videos) {
                await pool.query(
                    `INSERT INTO video_analytics (user_id, platform, video_id, title, views, likes, comments, shares, engagement_rate, viral_score, snapshot_date)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     ON CONFLICT (platform, video_id, snapshot_date) DO UPDATE SET user_id = $1`,
                    [userId, platform, video.videoId || video.id || `vid_${total}`,
                     video.title || video.topic, video.views || 0, video.likes || 0,
                     video.comments || 0, video.shares || 0, video.engagementRate || 0,
                     video.viralScore || 0, new Date().toISOString().split('T')[0]]
                );
                total++;
            }
        }

        if (total > 0) {
            console.log(`✓ Analytics: ${total} records migrated`);
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('⚠️ Analytics error:', err.message);
        }
    }
}

async function migrateTokens(userId, platform) {
    try {
        const tokens = JSON.parse(await fs.readFile(`data/${platform}_tokens.json`, 'utf-8'));

        if (Object.keys(tokens).length > 0) {
            await pool.query(
                `INSERT INTO platform_tokens (user_id, platform, access_token, refresh_token, expires_at, extra_data)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, platform) DO UPDATE
                 SET access_token = $3, refresh_token = $4, expires_at = $5, extra_data = $6`,
                [userId, platform, tokens.access_token, tokens.refresh_token,
                 tokens.expiry_date ? new Date(tokens.expiry_date) : null, JSON.stringify(tokens)]
            );
            console.log(`✓ ${platform}: token migrated`);
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`⚠️ ${platform} token error:`, err.message);
        }
    }
}

async function migrateABTests(userId) {
    try {
        const data = JSON.parse(await fs.readFile('data/ab_tests.json', 'utf-8'));
        let expCount = 0;

        for (const exp of data.experiments || []) {
            const result = await pool.query(
                `INSERT INTO ab_experiments (user_id, name, type, platform, niche, target_samples, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [userId, exp.name, exp.type, exp.platform, exp.niche || 'all',
                 exp.targetSamples || 10, exp.status || 'running']
            );

            const expId = result.rows[0].id;
            expCount++;

            for (const variant of exp.variants || []) {
                await pool.query(
                    `INSERT INTO ab_variants (experiment_id, name, config, samples, total_views)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [expId, variant.name, JSON.stringify(variant.config || {}),
                     variant.samples || 0, variant.totalViews || 0]
                );
            }
        }

        if (expCount > 0) {
            console.log(`✓ A/B Tests: ${expCount} experiments migrated`);
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('⚠️ A/B tests error:', err.message);
        }
    }
}

migrate();
