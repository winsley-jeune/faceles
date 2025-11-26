/**
 * Social Media Login Helper
 * Uses your ACTUAL Chrome profile where you're already logged in!
 * Cookies are saved to ./data/ folder for Docker to use
 *
 * Usage:
 *   node login-helper.js youtube
 *   node login-helper.js tiktok
 *   node login-helper.js instagram
 *   node login-helper.js facebook
 *   node login-helper.js all
 *   node login-helper.js export   <-- NEW: Export cookies from your real Chrome
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Find Chrome user data directory on Windows
function getChromeUserDataDir() {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
    return path.join(localAppData, 'Google', 'Chrome', 'User Data');
}

const PLATFORMS = {
    youtube: {
        name: 'YouTube',
        url: 'https://www.youtube.com',
        loginUrl: 'https://accounts.google.com/signin/v2/identifier?service=youtube',
        successPattern: /studio\.youtube\.com|youtube\.com\/feed|youtube\.com\/?$|myaccount\.google\.com/,
        cookieFile: 'youtube_cookies.json',
        cookieDomains: ['.youtube.com', '.google.com', 'youtube.com', 'google.com']
    },
    tiktok: {
        name: 'TikTok',
        url: 'https://www.tiktok.com',
        loginUrl: 'https://www.tiktok.com/login',
        successPattern: /tiktok\.com\/(foryou|@|creator-center|$)/,
        cookieFile: 'tiktok_cookies.json',
        cookieDomains: ['.tiktok.com', 'tiktok.com']
    },
    instagram: {
        name: 'Instagram',
        url: 'https://www.instagram.com',
        loginUrl: 'https://www.instagram.com/accounts/login/',
        successPattern: /instagram\.com\/?($|\?)/,
        cookieFile: 'instagram_cookies.json',
        cookieDomains: ['.instagram.com', 'instagram.com']
    },
    facebook: {
        name: 'Facebook',
        url: 'https://www.facebook.com',
        loginUrl: 'https://www.facebook.com/login',
        successPattern: /facebook\.com\/?($|\?)/,
        cookieFile: 'facebook_cookies.json',
        cookieDomains: ['.facebook.com', 'facebook.com']
    }
};

// Export cookies from your REAL Chrome browser (where you're already logged in)
async function exportFromRealChrome(platformKey) {
    const platform = platformKey ? PLATFORMS[platformKey] : null;

    console.log('\n📦 Exporting cookies from your REAL Chrome browser...');
    console.log('   ⚠️  Please CLOSE Chrome completely before running this!\n');

    const chromeUserDataDir = getChromeUserDataDir();

    if (!fs.existsSync(chromeUserDataDir)) {
        console.error('❌ Chrome user data directory not found at:', chromeUserDataDir);
        return false;
    }

    console.log(`   📂 Found Chrome at: ${chromeUserDataDir}`);

    try {
        // Launch browser using real Chrome profile (read-only copy)
        const context = await chromium.launchPersistentContext(chromeUserDataDir, {
            headless: false,
            channel: 'chrome',
            viewport: { width: 1280, height: 800 },
            args: [
                '--disable-blink-features=AutomationControlled',
                '--profile-directory=Default'
            ]
        });

        const page = context.pages()[0] || await context.newPage();

        if (platform) {
            // Export single platform
            console.log(`   🔍 Navigating to ${platform.name}...`);
            await page.goto(platform.url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const allCookies = await context.cookies();
            const platformCookies = allCookies.filter(c =>
                platform.cookieDomains.some(d => c.domain.includes(d.replace('.', '')))
            );

            if (platformCookies.length > 0) {
                const cookiePath = path.join(DATA_DIR, platform.cookieFile);
                fs.writeFileSync(cookiePath, JSON.stringify(platformCookies, null, 2));
                console.log(`   ✅ ${platform.name}: Exported ${platformCookies.length} cookies`);
            } else {
                console.log(`   ⚠️  ${platform.name}: No cookies found (are you logged in?)`);
            }
        } else {
            // Export all platforms
            for (const [key, plat] of Object.entries(PLATFORMS)) {
                console.log(`   🔍 Checking ${plat.name}...`);
                await page.goto(plat.url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);

                const allCookies = await context.cookies();
                const platformCookies = allCookies.filter(c =>
                    plat.cookieDomains.some(d => c.domain.includes(d.replace('.', '')))
                );

                if (platformCookies.length > 0) {
                    const cookiePath = path.join(DATA_DIR, plat.cookieFile);
                    fs.writeFileSync(cookiePath, JSON.stringify(platformCookies, null, 2));
                    console.log(`   ✅ ${plat.name}: Exported ${platformCookies.length} cookies`);
                } else {
                    console.log(`   ⚠️  ${plat.name}: No cookies found (are you logged in?)`);
                }
            }
        }

        await context.close();
        console.log('\n✅ Done! Cookies saved to ./data/ folder');
        return true;

    } catch (error) {
        if (error.message.includes('lock') || error.message.includes('already in use')) {
            console.error('\n❌ Chrome is still running! Please close ALL Chrome windows and try again.');
        } else {
            console.error(`\n❌ Error: ${error.message}`);
        }
        return false;
    }
}

// Interactive login (opens browser for manual login)
async function loginToPlatform(platformKey) {
    const platform = PLATFORMS[platformKey];
    if (!platform) {
        console.error(`❌ Unknown platform: ${platformKey}`);
        console.log('Available: youtube, tiktok, instagram, facebook, all, export');
        return false;
    }

    console.log(`\n🔐 Opening ${platform.name} login...`);
    console.log('   A Chrome window will open. Please login manually.');
    console.log('   The window will close automatically after successful login.\n');

    // Use persistent context with user data dir
    const userDataDir = path.join(DATA_DIR, 'chrome_profile');

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-first-run',
            '--no-default-browser-check'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.goto(platform.loginUrl);

        console.log('   ⏳ Waiting for you to complete login...');
        console.log('   (Max wait time: 5 minutes)\n');

        await page.waitForURL(platform.successPattern, { timeout: 300000 });
        await page.waitForTimeout(3000);

        const cookies = await context.cookies();
        const cookiePath = path.join(DATA_DIR, platform.cookieFile);
        fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));

        console.log(`   ✅ ${platform.name} login successful!`);
        console.log(`   💾 Cookies saved to: ${cookiePath}`);

        await context.close();
        return true;

    } catch (error) {
        console.error(`   ❌ Login failed or timed out: ${error.message}`);
        await context.close();
        return false;
    }
}

async function loginToAll() {
    console.log('🚀 Starting login process for all platforms...\n');

    const results = {};
    for (const platform of Object.keys(PLATFORMS)) {
        results[platform] = await loginToPlatform(platform);
        if (platform !== 'facebook') {
            console.log('\n   ⏳ Waiting 3 seconds before next platform...\n');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log('\n📊 Login Results:');
    for (const [platform, success] of Object.entries(results)) {
        const icon = success ? '✅' : '❌';
        console.log(`   ${icon} ${PLATFORMS[platform].name}`);
    }

    return results;
}

async function checkSessions() {
    console.log('🔍 Checking saved sessions...\n');

    for (const [key, platform] of Object.entries(PLATFORMS)) {
        const cookiePath = path.join(DATA_DIR, platform.cookieFile);
        if (fs.existsSync(cookiePath)) {
            const stats = fs.statSync(cookiePath);
            const age = Math.round((Date.now() - stats.mtimeMs) / 1000 / 60 / 60);
            const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
            console.log(`   ✅ ${platform.name}: ${cookies.length} cookies (${age} hours old)`);
        } else {
            console.log(`   ❌ ${platform.name}: No session`);
        }
    }
}

// Main
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (!command || command === 'help') {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           Social Media Login Helper                               ║
╠═══════════════════════════════════════════════════════════════════╣
║  Usage:                                                           ║
║    node login-helper.js <command>                                 ║
║                                                                   ║
║  Commands:                                                        ║
║    export      - 🌟 RECOMMENDED: Export from your real Chrome    ║
║                  (Use this if you're already logged in!)          ║
║                                                                   ║
║    youtube     - Interactive login to YouTube/Google              ║
║    tiktok      - Interactive login to TikTok                      ║
║    instagram   - Interactive login to Instagram                   ║
║    facebook    - Interactive login to Facebook                    ║
║    all         - Interactive login to all platforms               ║
║    check       - Check existing sessions                          ║
║                                                                   ║
║  Examples:                                                        ║
║    node login-helper.js export          # Best option!            ║
║    node login-helper.js export youtube  # Export only YouTube     ║
║    node login-helper.js check                                     ║
╚═══════════════════════════════════════════════════════════════════╝
`);
} else if (command === 'export') {
    const platform = args[1]?.toLowerCase();
    exportFromRealChrome(platform);
} else if (command === 'all') {
    loginToAll();
} else if (command === 'check') {
    checkSessions();
} else if (PLATFORMS[command]) {
    loginToPlatform(command);
} else {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "node login-helper.js help" for usage');
}
