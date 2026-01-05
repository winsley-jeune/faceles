/**
 * Multi-Tenant OAuth Token Migration Test
 * Verifies that all platform API uploaders properly isolate user tokens
 *
 * Run with: node test_multi_tenant_migration.js
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import dataService from './services/dataService.js';
import { initDatabase } from './database/index.js';

// Test user IDs (UUIDs for database compatibility)
const USER_A = '00000000-0000-0000-0000-000000000001';
const USER_B = '00000000-0000-0000-0000-000000000002';

console.log('🧪 Multi-Tenant OAuth Token Migration Test\n');
console.log('='.repeat(60));

// Initialize database before running tests
console.log('\n🔌 Initializing database connection...');
await initDatabase();
console.log('✅ Database initialized\n');

/**
 * Test 1: Verify dataService.tokens API exists and works
 */
async function testDataServiceAPI() {
    console.log('\n📋 Test 1: DataService Tokens API');
    console.log('-'.repeat(60));

    try {
        // Test saving token for User A
        await dataService.tokens.saveToken(USER_A, 'youtube', {
            accessToken: 'user_a_youtube_token_123',
            refreshToken: 'user_a_refresh_123',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'youtube.upload',
            tokenType: 'Bearer'
        });
        console.log('✅ User A YouTube token saved');

        // Test saving token for User B
        await dataService.tokens.saveToken(USER_B, 'youtube', {
            accessToken: 'user_b_youtube_token_456',
            refreshToken: 'user_b_refresh_456',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'youtube.upload',
            tokenType: 'Bearer'
        });
        console.log('✅ User B YouTube token saved');

        // Verify User A gets their own token
        const userAToken = await dataService.tokens.getToken(USER_A, 'youtube');
        if (userAToken?.accessToken === 'user_a_youtube_token_123') {
            console.log('✅ User A token retrieval correct');
        } else {
            throw new Error('User A token retrieval failed');
        }

        // Verify User B gets their own token
        const userBToken = await dataService.tokens.getToken(USER_B, 'youtube');
        if (userBToken?.accessToken === 'user_b_youtube_token_456') {
            console.log('✅ User B token retrieval correct');
        } else {
            throw new Error('User B token retrieval failed');
        }

        // Critical: Verify tokens are isolated (User A cannot see User B's token)
        if (userAToken.accessToken !== userBToken.accessToken) {
            console.log('✅ Token isolation verified: Users have separate tokens');
        } else {
            throw new Error('SECURITY ISSUE: Users are sharing tokens!');
        }

        return true;
    } catch (error) {
        console.error('❌ DataService API test failed:', error.message);
        return false;
    }
}

/**
 * Test 2: Verify platform-specific metadata storage
 */
async function testPlatformMetadata() {
    console.log('\n📋 Test 2: Platform-Specific Metadata');
    console.log('-'.repeat(60));

    try {
        // Test Facebook metadata (pageId, pageAccessToken)
        await dataService.tokens.saveToken(USER_A, 'facebook', {
            accessToken: 'user_a_fb_token',
            refreshToken: null,
            expiresAt: new Date(Date.now() + 5184000000), // 60 days
            scope: 'pages_manage_posts',
            tokenType: 'Bearer',
            metadata: {
                pageAccessToken: 'user_a_page_token',
                pageId: 'page_123',
                pageName: 'User A Page'
            }
        });
        console.log('✅ Facebook metadata saved');

        const fbToken = await dataService.tokens.getToken(USER_A, 'facebook');
        if (fbToken?.metadata?.pageId === 'page_123') {
            console.log('✅ Facebook metadata retrieval correct');
        } else {
            throw new Error('Facebook metadata retrieval failed');
        }

        // Test Instagram metadata (instagramAccountId)
        await dataService.tokens.saveToken(USER_A, 'instagram', {
            accessToken: 'user_a_ig_token',
            refreshToken: null,
            expiresAt: new Date(Date.now() + 5184000000),
            scope: 'instagram_basic',
            tokenType: 'Bearer',
            metadata: {
                pageAccessToken: 'user_a_page_token',
                pageId: 'page_123',
                pageName: 'User A Page',
                instagramAccountId: 'ig_account_123',
                instagramUsername: 'user_a_instagram',
                followers: 1000
            }
        });
        console.log('✅ Instagram metadata saved');

        const igToken = await dataService.tokens.getToken(USER_A, 'instagram');
        if (igToken?.metadata?.instagramAccountId === 'ig_account_123') {
            console.log('✅ Instagram metadata retrieval correct');
        } else {
            throw new Error('Instagram metadata retrieval failed');
        }

        return true;
    } catch (error) {
        console.error('❌ Platform metadata test failed:', error.message);
        return false;
    }
}

/**
 * Test 3: Verify token deletion
 */
async function testTokenDeletion() {
    console.log('\n📋 Test 3: Token Deletion');
    console.log('-'.repeat(60));

    try {
        // Save a token
        await dataService.tokens.saveToken(USER_A, 'tiktok', {
            accessToken: 'user_a_tiktok_token',
            refreshToken: 'user_a_tiktok_refresh',
            expiresAt: new Date(Date.now() + 86400000),
            scope: 'video.publish',
            tokenType: 'Bearer'
        });
        console.log('✅ TikTok token saved');

        // Verify it exists
        let token = await dataService.tokens.getToken(USER_A, 'tiktok');
        if (token) {
            console.log('✅ TikTok token exists');
        }

        // Delete it
        await dataService.tokens.deleteToken(USER_A, 'tiktok');
        console.log('✅ TikTok token deleted');

        // Verify it's gone
        token = await dataService.tokens.getToken(USER_A, 'tiktok');
        if (!token) {
            console.log('✅ TikTok token deletion verified');
        } else {
            throw new Error('Token deletion failed - token still exists');
        }

        return true;
    } catch (error) {
        console.error('❌ Token deletion test failed:', error.message);
        return false;
    }
}

/**
 * Test 4: Cross-user isolation verification
 */
async function testCrossUserIsolation() {
    console.log('\n📋 Test 4: Cross-User Token Isolation');
    console.log('-'.repeat(60));

    try {
        // User A connects YouTube
        await dataService.tokens.saveToken(USER_A, 'youtube', {
            accessToken: 'user_a_youtube_secret',
            refreshToken: 'user_a_refresh_secret',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'youtube.upload',
            tokenType: 'Bearer'
        });

        // User B connects YouTube
        await dataService.tokens.saveToken(USER_B, 'youtube', {
            accessToken: 'user_b_youtube_secret',
            refreshToken: 'user_b_refresh_secret',
            expiresAt: new Date(Date.now() + 3600000),
            scope: 'youtube.upload',
            tokenType: 'Bearer'
        });

        // Verify User A cannot access User B's tokens
        const userAToken = await dataService.tokens.getToken(USER_A, 'youtube');
        const userBToken = await dataService.tokens.getToken(USER_B, 'youtube');

        if (userAToken.accessToken === 'user_a_youtube_secret' &&
            userBToken.accessToken === 'user_b_youtube_secret' &&
            userAToken.accessToken !== userBToken.accessToken) {
            console.log('✅ Cross-user isolation PASSED');
            console.log('   - User A has their own tokens');
            console.log('   - User B has their own tokens');
            console.log('   - Tokens are completely isolated');
        } else {
            throw new Error('SECURITY BREACH: Cross-user isolation failed!');
        }

        return true;
    } catch (error) {
        console.error('❌ Cross-user isolation test failed:', error.message);
        return false;
    }
}

/**
 * Test 5: Cleanup test data
 */
async function cleanup() {
    console.log('\n📋 Test 5: Cleanup');
    console.log('-'.repeat(60));

    try {
        const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];

        for (const platform of platforms) {
            await dataService.tokens.deleteToken(USER_A, platform);
            await dataService.tokens.deleteToken(USER_B, platform);
        }

        console.log('✅ Test data cleaned up');
        return true;
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    const results = {
        dataServiceAPI: false,
        platformMetadata: false,
        tokenDeletion: false,
        crossUserIsolation: false,
        cleanup: false
    };

    results.dataServiceAPI = await testDataServiceAPI();
    results.platformMetadata = await testPlatformMetadata();
    results.tokenDeletion = await testTokenDeletion();
    results.crossUserIsolation = await testCrossUserIsolation();
    results.cleanup = await cleanup();

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));

    const allPassed = Object.values(results).every(r => r === true);

    Object.entries(results).forEach(([test, passed]) => {
        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    console.log('='.repeat(60));

    if (allPassed) {
        console.log('\n🎉 ALL TESTS PASSED - Multi-tenant migration successful!');
        console.log('\n✅ Key Features Verified:');
        console.log('   - Each user has isolated OAuth tokens');
        console.log('   - Platform-specific metadata is stored correctly');
        console.log('   - Token deletion works properly');
        console.log('   - Cross-user token access is prevented');
        process.exit(0);
    } else {
        console.log('\n❌ SOME TESTS FAILED - Review errors above');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
});
