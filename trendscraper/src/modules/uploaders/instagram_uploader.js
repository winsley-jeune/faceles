import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dataAccess from '../../utils/dataAccess.js';

// Legacy path (fallback)
const COOKIES_PATH = '/app/data/instagram_cookies.json';

/**
 * Instagram Reels Uploader using Playwright browser automation
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
    const cookies = dataAccess.readJsonFileSync('instagram_cookies.json');
    if (cookies) {
        await context.addCookies(cookies);
        console.log('   📦 Loaded saved Instagram session');
    } else if (fs.existsSync(COOKIES_PATH)) {
        const legacyCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        await context.addCookies(legacyCookies);
        console.log('   📦 Loaded saved Instagram session (legacy)');
    }

    return { browser, context };
};

const saveCookies = async (context) => {
    const cookies = await context.cookies();
    try {
        // Use dataAccess for unified data access
        await dataAccess.writeJsonFile('instagram_cookies.json', cookies);
    } catch (err) {
        // Fallback to legacy path
        const dir = path.dirname(COOKIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    }
    console.log('   💾 Instagram session saved');
};

const isLoggedIn = async (page) => {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check for login form vs home feed
    const loginForm = await page.$('input[name="username"]');
    const homeFeed = await page.$('svg[aria-label="Home"]') ||
        await page.$('a[href="/direct/inbox/"]');

    return !loginForm && homeFeed !== null;
};

/**
 * Interactive login
 */
export const instagramLogin = async () => {
    console.log('🔐 Opening Instagram login...');

    const { browser, context } = await launchBrowser(false);
    const page = await context.newPage();

    await page.goto('https://www.instagram.com/accounts/login/');

    console.log('   ⏳ Waiting for you to complete login...');
    console.log('   (You can use Facebook login or email/password)');

    try {
        // Wait for redirect to home
        await page.waitForURL(/instagram\.com\/$|instagram\.com\/\?/, { timeout: 300000 });
        await page.waitForTimeout(3000);

        await saveCookies(context);
        console.log('   ✅ Instagram login successful!');

        await browser.close();
        return { success: true };
    } catch (error) {
        await browser.close();
        return { success: false, error: error.message };
    }
};

/**
 * Upload a Reel to Instagram
 * Money Printer Strategy: Clean aesthetic, 3-5 strategic hashtags, share to Story
 */
export const uploadToInstagram = async (videoPath, { description, hashtags = [], shareToStory = true }) => {
    console.log('📤 Uploading to Instagram Reels...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const { browser, context } = await launchBrowser(true);
    const page = await context.newPage();

    try {
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
            await browser.close();
            throw new Error('Not logged in to Instagram. Run instagramLogin() first.');
        }

        console.log('   ✅ Logged into Instagram');

        // Click Create button (+ icon)
        const createButton = await page.$('svg[aria-label="New post"]') ||
            await page.$('a[href="/create/select/"]') ||
            await page.$('[aria-label="Create"]');

        if (createButton) {
            await createButton.click();
            await page.waitForTimeout(2000);
        } else {
            // Try direct navigation
            await page.goto('https://www.instagram.com/create/select/', { waitUntil: 'networkidle' });
        }

        // Wait for upload dialog
        await page.waitForTimeout(2000);

        // Find file input
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(videoPath);
            console.log('   📁 Video file selected');
        } else {
            throw new Error('Could not find file upload input');
        }

        // Wait for video to load
        await page.waitForTimeout(5000);

        // Click "Next" buttons through the wizard
        for (let i = 0; i < 2; i++) {
            await page.waitForTimeout(2000);
            const nextButton = await page.$('button:has-text("Next")') ||
                await page.$('div[role="button"]:has-text("Next")');
            if (nextButton) {
                await nextButton.click();
            }
        }

        // Add caption
        await page.waitForTimeout(2000);
        const captionInput = await page.$('textarea[aria-label="Write a caption..."]') ||
            await page.$('div[aria-label="Write a caption..."]') ||
            await page.$('textarea');

        if (captionInput) {
            const fullCaption = `${description}\n\n${hashtags.join(' ')}`.slice(0, 2200);
            await captionInput.click();
            await captionInput.type(fullCaption);
            console.log('   📝 Caption added');
        }

        // Click Share
        await page.waitForTimeout(2000);
        const shareButton = await page.$('button:has-text("Share")') ||
            await page.$('div[role="button"]:has-text("Share")');

        if (shareButton) {
            await shareButton.click();
            console.log('   🚀 Sharing Reel...');

            // Wait for success
            await page.waitForTimeout(15000);

            // Money Printer Strategy: Share to Story for extra visibility
            let sharedToStory = false;
            if (shareToStory) {
                console.log('   📖 Attempting to share to Story...');
                try {
                    // Look for "Share to Story" option or the three dots menu
                    const storyButton = await page.$('button:has-text("Add to your story")') ||
                        await page.$('div[role="button"]:has-text("Add to story")') ||
                        await page.$('span:has-text("Add to your story")');

                    if (storyButton) {
                        await storyButton.click();
                        await page.waitForTimeout(5000);

                        // Click Share/Post for story
                        const postStoryBtn = await page.$('button:has-text("Share")') ||
                            await page.$('div[role="button"]:has-text("Share")');
                        if (postStoryBtn) {
                            await postStoryBtn.click();
                            sharedToStory = true;
                            console.log('   📖 Shared to Story!');
                        }
                    } else {
                        console.log('   ⚠️ Story share button not found (share manually)');
                    }
                } catch (e) {
                    console.log('   ⚠️ Could not share to Story:', e.message);
                }
            }

            await saveCookies(context);
            await browser.close();

            return {
                success: true,
                platform: 'instagram',
                message: 'Reel uploaded to Instagram' + (sharedToStory ? ' + Story' : ''),
                sharedToStory
            };
        }

        throw new Error('Could not find Share button');

    } catch (error) {
        console.error('   ❌ Instagram upload failed:', error.message);
        await browser.close();
        return {
            success: false,
            platform: 'instagram',
            error: error.message
        };
    }
};

export const checkInstagramSession = async () => {
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
            message: loggedIn ? 'Session is valid' : 'Session expired'
        };
    } catch (error) {
        await browser.close();
        return { valid: false, message: error.message };
    }
};

export default { instagramLogin, uploadToInstagram, checkInstagramSession };
