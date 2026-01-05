/**
 * Configure Auto-Posting for User
 *
 * Sets up automatic video posting schedule:
 * - 5 videos per day
 * - Automatically generates topics using viral intelligence
 * - Posts to connected platforms
 */

import dataService from './services/dataService.js';
import database, { initDatabase } from './database/index.js';

async function configureAutoPosting() {
    console.log('🚀 Configuring Auto-Posting System...\n');

    // Initialize database connection
    await initDatabase();

    try {
        // Get user from database (Winsley Jeune)
        const userResult = await database.db.query(
            "SELECT id, email, name FROM users WHERE email = $1",
            ['jeunewinsley9@gmail.com']
        );

        if (userResult.rows.length === 0) {
            console.error('❌ User not found. Please log in first.');
            process.exit(1);
        }

        const user = userResult.rows[0];
        console.log(`✅ Found user: ${user.name} (${user.email})`);
        console.log(`   User ID: ${user.id}\n`);

        // Check connected platforms
        const platformsResult = await database.db.query(
            "SELECT platform FROM platform_tokens WHERE user_id = $1",
            [user.id]
        );

        const connectedPlatforms = platformsResult.rows.map(r => r.platform);
        console.log(`📱 Connected platforms: ${connectedPlatforms.join(', ') || 'None'}\n`);

        if (connectedPlatforms.length === 0) {
            console.warn('⚠️  Warning: No platforms connected. Videos will be generated but not posted.');
            console.warn('   Connect platforms in the dashboard first.\n');
        }

        // Configure posting schedule
        const schedule = {
            enabled: true,                          // ✅ Enable auto-posting
            maxPostsPerDay: 5,                      // 📊 5 videos per day
            intervalHours: 4.8,                     // ⏰ Post every 4.8 hours (24/5)
            platforms: connectedPlatforms.length > 0 ? connectedPlatforms : ['youtube'],
            niche: 'general',                       // Default niche (can be customized)
            lastPost: null,
            nextPost: null,
            postsToday: 0,
            lastUpdated: new Date().toISOString()
        };

        console.log('⚙️  Posting Schedule Configuration:');
        console.log(`   - Enabled: ${schedule.enabled}`);
        console.log(`   - Posts per day: ${schedule.maxPostsPerDay}`);
        console.log(`   - Interval: Every ${schedule.intervalHours} hours`);
        console.log(`   - Platforms: ${schedule.platforms.join(', ')}`);
        console.log(`   - Niche: ${schedule.niche}\n`);

        // Save schedule to database
        await dataService.variationEngine.savePostingSchedule(user.id, schedule);
        console.log('✅ Posting schedule saved to database\n');

        // Initialize variation queue
        const queue = {
            variations: [],
            explorations: [],
            lastGenerated: null,
            stats: {
                totalGenerated: 0,
                totalPosted: 0,
                totalViews: 0
            },
            lastUpdated: new Date().toISOString()
        };

        await dataService.variationEngine.saveVariationQueue(user.id, queue);
        console.log('✅ Variation queue initialized\n');

        // Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ AUTO-POSTING CONFIGURED SUCCESSFULLY!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📋 What happens next:');
        console.log('   1. Auto-scheduler runs every 10 minutes');
        console.log('   2. Checks if it\'s time to post (every 4.8 hours)');
        console.log('   3. Generates viral topic using YouTube analytics');
        console.log('   4. Creates and posts video automatically');
        console.log('   5. Repeats up to 5 times per day\n');

        console.log('📊 Track progress:');
        console.log('   - Jobs Dashboard: http://localhost:5174/jobs');
        console.log('   - Analytics: http://localhost:5174/analytics\n');

        console.log('⚠️  Important:');
        console.log('   - Make sure YouTube analytics have been fetched (happens on startup)');
        console.log('   - Ensure platforms are connected in the dashboard');
        console.log('   - Backend server must be running for auto-posting to work\n');

        console.log('🎯 Next post will be scheduled based on:');
        console.log(`   - First post: Immediately (on next scheduler check)`);
        console.log(`   - Subsequent posts: Every ${schedule.intervalHours} hours`);
        console.log(`   - Daily limit: ${schedule.maxPostsPerDay} videos\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error configuring auto-posting:', error);
        process.exit(1);
    }
}

configureAutoPosting();
