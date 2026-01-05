/**
   * Migration Verification Script
   * Checks data migration success and multi-tenant isolation
   */

import db from '../db.js';

async function verify() {
    console.log('🔍 Verifying Migration...\n');

    try {
        // 1. Check user_id columns exist
        await verifySchema();

        // 2. Check data counts
        await verifyDataCounts();

        // 3. Check data isolation
        await verifyDataIsolation();

        console.log('\n✅ Verification completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

/**
 * WHY: Verify all required tables have user_id
 */
async function verifySchema() {
    console.log('1️⃣ Verifying schema...');

    const result = await db.query(`
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE column_name = 'user_id'
          AND table_schema = 'public'
          ORDER BY table_name
      `);

    console.log(`  ✓ Found user_id in ${result.rows.length} tables:`);
    result.rows.forEach(row => {
        console.log(`    - ${row.table_name}`);
    });
    console.log('');
}

/**
 * WHY: Verify data was migrated successfully
 */
async function verifyDataCounts() {
    console.log('2️⃣ Verifying data counts...');

    const tables = [
        'topics',
        'video_analytics',
        'winning_patterns',
        'platform_tokens',
        'ab_experiments',
        'post_queue',
        'exploration_config'
    ];

    for (const table of tables) {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        console.log(`  ${count.toString().padStart(5)} records in ${table}`);
    }
    console.log('');
}

/**
 * WHY: Verify data is properly scoped to users
 */
async function verifyDataIsolation() {
    console.log('3️⃣ Verifying data isolation...');

    // WHY: Check how many users have data
    const userStats = await db.query(`
          SELECT
              u.id,
              u.email,
              (SELECT COUNT(*) FROM topics WHERE user_id = u.id) as topics,
              (SELECT COUNT(*) FROM video_analytics WHERE user_id = u.id) as analytics,
              (SELECT COUNT(*) FROM winning_patterns WHERE user_id = u.id) as patterns
          FROM users u
          ORDER BY u.created_at
      `);

    console.log('  User data distribution:');
    userStats.rows.forEach(user => {
        console.log(`    ${user.email}:`);
        console.log(`      - ${user.topics} topics`);
        console.log(`      - ${user.analytics} analytics records`);
        console.log(`      - ${user.patterns} patterns`);
    });
    console.log('');

    // WHY: Check for orphaned records (user_id is NULL)
    const orphanCheck = await db.query(`
          SELECT
              (SELECT COUNT(*) FROM topics WHERE user_id IS NULL) as topics_orphaned,
              (SELECT COUNT(*) FROM video_analytics WHERE user_id IS NULL) as analytics_orphaned,
              (SELECT COUNT(*) FROM winning_patterns WHERE user_id IS NULL) as patterns_orphaned
      `);

    const orphans = orphanCheck.rows[0];
    if (orphans.topics_orphaned > 0 || orphans.analytics_orphaned > 0 || orphans.patterns_orphaned > 0) {
        console.warn('  ⚠️ Warning: Found orphaned records (user_id IS NULL):');
        if (orphans.topics_orphaned > 0) console.warn(`    - ${orphans.topics_orphaned} topics`);
        if (orphans.analytics_orphaned > 0) console.warn(`    - ${orphans.analytics_orphaned} analytics`);
        if (orphans.patterns_orphaned > 0) console.warn(`    - ${orphans.patterns_orphaned} patterns`);
    } else {
        console.log('  ✓ No orphaned records found');
    }
    console.log('');
}

// Run verification
verify();
