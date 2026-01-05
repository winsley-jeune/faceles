import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dataAccess from '../../utils/dataAccess.js';

// Legacy path (fallback)
const COOKIES_PATH = '/app/data/tiktok_cookies.json';

/**
 * TikTok Uploader using Playwright browser automation
 * Login once, then upload automatically using saved session
 */

/**
 * Launch browser with saved session
 */
const launchBrowser = async (headless = true) => {
    const browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Load saved cookies if exists
    const cookies = dataAccess.readJsonFileSync('tiktok_cookies.json');
    if (cookies) {
        await context.addCookies(cookies);
        console.log('   📦 Loaded saved TikTok session');
    } else if (fs.existsSync(COOKIES_PATH)) {
        const legacyCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        await context.addCookies(legacyCookies);
        console.log('   📦 Loaded saved TikTok session (legacy)');
    }

    return { browser, context };
};

/**
 * Save session cookies for future use
 */
const saveCookies = async (context) => {
    const cookies = await context.cookies();
    try {
        // Use dataAccess for unified data access
        await dataAccess.writeJsonFile('tiktok_cookies.json', cookies);
    } catch (err) {
        // Fallback to legacy path
        const dir = path.dirname(COOKIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    }
    console.log('   💾 TikTok session saved');
};

/**
 * Check if logged into TikTok
 */
const isLoggedIn = async (page) => {
    await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check for login wall or upload interface
    const loginButton = await page.$('button:has-text("Log in")');
    const uploadArea = await page.$('input[type="file"]') ||
        await page.$('[class*="upload"]') ||
        await page.$('div[class*="uploader"]');

    return !loginButton && uploadArea !== null;
};

/**
 * Interactive login - opens browser for user to login manually
 */
export const tiktokLogin = async () => {
    console.log('🔐 Opening TikTok login...');
    console.log('   Please login to your TikTok account in the browser window.');

    const { browser, context } = await launchBrowser(false); // headless: false for login
    const page = await context.newPage();

    await page.goto('https://www.tiktok.com/login');

    console.log('   ⏳ Waiting for you to complete login...');
    console.log('   (You can use Google, Facebook, or email to login)');
    console.log('   (The browser will close automatically after successful login)');

    try {
        // Wait for redirect to home or creator center
        await page.waitForURL(/tiktok\.com\/(foryou|@|creator-center)/, { timeout: 300000 });
        await page.waitForTimeout(3000);

        await saveCookies(context);
        console.log('   ✅ TikTok login successful!');

        await browser.close();
        return { success: true };
    } catch (error) {
        await browser.close();
        console.error('   ❌ Login failed or timed out');
        return { success: false, error: error.message };
    }
};

/**
 * Upload a video to TikTok
 * Uses search-optimized caption (question/answer format for TikTok SEO)
 * Example: "How to calculate compound interest correctly. Stop losing money. #moneytok"
 */
export const uploadToTikTok = async (videoPath, { title, description, caption, hashtags = [] }) => {
    console.log('📤 Uploading to TikTok...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const { browser, context } = await launchBrowser(true);
    const page = await context.newPage();

    try {
        // Check if logged in
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
            await browser.close();
            throw new Error('Not logged in to TikTok. Run tiktokLogin() first.');
        }

        console.log('   ✅ Logged into TikTok Creator Center');

        // Navigate to upload page
        await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // Find and click file input
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(videoPath);
            console.log('   📁 Video file selected');
        } else {
            throw new Error('Could not find file upload input');
        }

        // Wait for video to upload
        console.log('   ⏳ Uploading video...');
        await page.waitForTimeout(10000);

        // Wait for upload to complete (look for editor or caption input)
        await page.waitForSelector('div[class*="caption"]', { timeout: 120000 }).catch(() => { });

        // TikTok SEO: Use description as-is (already search-optimized with question format)
        // The description from social_content.js is formatted as: "How to [topic]. [Answer]. #hashtags"
        // Support caption, description, or title parameter
        const captionText = caption || description || title || '';
        const fullCaption = captionText.slice(0, 2200);
        console.log(`   🔍 TikTok SEO Caption: ${fullCaption.substring(0, 50)}...`);

        // Find caption/description input
        const captionInput = await page.$('div[class*="caption-input"]') ||
            await page.$('div[contenteditable="true"]') ||
            await page.$('textarea') ||
            await page.$('[data-text="true"]');

        if (captionInput) {
            await captionInput.click();
            await page.waitForTimeout(500);

            // Clear and type caption
            await page.keyboard.press('Control+A');
            await page.keyboard.type(fullCaption);
            console.log('   📝 Caption added');
        }

        // Wait for processing
        await page.waitForTimeout(5000);

        // Look for "Post" button
        const postButton = await page.$('button:has-text("Post")') ||
            await page.$('button[class*="post-button"]') ||
            await page.$('div[class*="btn-post"]');

        if (postButton) {
            // Check if button is enabled
            const isDisabled = await postButton.getAttribute('disabled');
            if (!isDisabled) {
                await postButton.click();
                console.log('   🚀 Posting video...');

                // Wait for success message or redirect
                await page.waitForTimeout(10000);

                await saveCookies(context);
                await browser.close();

                return {
                    success: true,
                    platform: 'tiktok',
                    message: 'Video uploaded to TikTok'
                };
            }
        }

        throw new Error('Could not find or click Post button');

    } catch (error) {
        console.error('   ❌ TikTok upload failed:', error.message);
        await browser.close();
        return {
            success: false,
            platform: 'tiktok',
            error: error.message
        };
    }
};

/**
 * Check if TikTok session is valid
 */
export const checkTikTokSession = async () => {
    if (!fs.existsSync(COOKIES_PATH)) {
        return { valid: false, message: 'No saved session found' };
    }

    const { browser, context } = await launchBrowser(true);
    const page = await context.newPage();

    try {
        const loggedIn = await isLoggedIn(page);
        await browser.close();

        return {
            valid: loggedIn,
            message: loggedIn ? 'Session is valid' : 'Session expired, please login again'
        };
    } catch (error) {
        await browser.close();
        return { valid: false, message: error.message };
    }
};

export default { tiktokLogin, uploadToTikTok, checkTikTokSession };
