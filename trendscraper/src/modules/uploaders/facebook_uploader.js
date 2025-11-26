import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = '/app/data/facebook_cookies.json';

/**
 * Facebook Reels Uploader using Playwright browser automation
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

    if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        await context.addCookies(cookies);
        console.log('   📦 Loaded saved Facebook session');
    }

    return { browser, context };
};

const saveCookies = async (context) => {
    const cookies = await context.cookies();
    const dir = path.dirname(COOKIES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('   💾 Facebook session saved');
};

const isLoggedIn = async (page) => {
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check for login form vs news feed
    const loginForm = await page.$('input[name="email"]');
    const newsFeed = await page.$('div[role="feed"]') ||
        await page.$('a[aria-label="Home"]');

    return !loginForm && newsFeed !== null;
};

/**
 * Interactive login
 */
export const facebookLogin = async () => {
    console.log('🔐 Opening Facebook login...');

    const { browser, context } = await launchBrowser(false);
    const page = await context.newPage();

    await page.goto('https://www.facebook.com/login');

    console.log('   ⏳ Waiting for you to complete login...');

    try {
        // Wait for redirect to home feed
        await page.waitForURL(/facebook\.com\/$|facebook\.com\/\?/, { timeout: 300000 });
        await page.waitForTimeout(3000);

        await saveCookies(context);
        console.log('   ✅ Facebook login successful!');

        await browser.close();
        return { success: true };
    } catch (error) {
        await browser.close();
        return { success: false, error: error.message };
    }
};

/**
 * Upload a Reel to Facebook
 * Supports pinnedComment for affiliate link strategy (Money Printer)
 */
export const uploadToFacebook = async (videoPath, { description, hashtags = [], pinnedComment = null }) => {
    console.log('📤 Uploading to Facebook Reels...');

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
    }

    const { browser, context } = await launchBrowser(true);
    const page = await context.newPage();

    try {
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
            await browser.close();
            throw new Error('Not logged in to Facebook. Run facebookLogin() first.');
        }

        console.log('   ✅ Logged into Facebook');

        // Navigate to Reels creation
        await page.goto('https://www.facebook.com/reels/create', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // Find file input
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(videoPath);
            console.log('   📁 Video file selected');
        } else {
            // Try clicking upload button first
            const uploadButton = await page.$('div[role="button"]:has-text("Add video")') ||
                await page.$('div[aria-label="Add video"]');
            if (uploadButton) {
                await uploadButton.click();
                await page.waitForTimeout(2000);
                const input = await page.$('input[type="file"]');
                if (input) await input.setInputFiles(videoPath);
            } else {
                throw new Error('Could not find file upload input');
            }
        }

        // Wait for video to upload and process
        console.log('   ⏳ Uploading video...');
        await page.waitForTimeout(15000);

        // Add description
        const captionInput = await page.$('div[aria-label="Describe your reel"]') ||
            await page.$('div[contenteditable="true"]') ||
            await page.$('textarea');

        if (captionInput) {
            const fullCaption = `${description}\n\n${hashtags.join(' ')}`.slice(0, 2200);
            await captionInput.click();
            await page.keyboard.type(fullCaption);
            console.log('   📝 Description added');
        }

        // Click Next or Publish
        await page.waitForTimeout(2000);
        const nextButton = await page.$('div[role="button"]:has-text("Next")');
        if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(3000);
        }

        // Click Publish
        const publishButton = await page.$('div[role="button"]:has-text("Publish")') ||
            await page.$('div[aria-label="Publish"]');

        if (publishButton) {
            await publishButton.click();
            console.log('   🚀 Publishing Reel...');

            await page.waitForTimeout(15000);

            // Try to add pinned comment if provided (Money Printer affiliate strategy)
            let commentPosted = false;
            if (pinnedComment) {
                console.log('   💬 Adding pinned comment...');
                try {
                    // Look for comment input on the published reel
                    const commentInput = await page.$('div[aria-label="Write a comment"]') ||
                        await page.$('div[contenteditable="true"][role="textbox"]');

                    if (commentInput) {
                        await commentInput.click();
                        await page.keyboard.type(pinnedComment);
                        await page.waitForTimeout(1000);

                        // Press Enter or find Post button
                        await page.keyboard.press('Enter');
                        await page.waitForTimeout(3000);
                        commentPosted = true;
                        console.log('   📌 Comment posted (pin manually in FB app)');
                    }
                } catch (e) {
                    console.log('   ⚠️ Could not add comment:', e.message);
                }
            }

            await saveCookies(context);
            await browser.close();

            return {
                success: true,
                platform: 'facebook',
                message: 'Reel uploaded to Facebook' + (commentPosted ? ' with comment' : ''),
                pinnedComment: pinnedComment  // Return for manual pinning if needed
            };
        }

        throw new Error('Could not find Publish button');

    } catch (error) {
        console.error('   ❌ Facebook upload failed:', error.message);
        await browser.close();
        return {
            success: false,
            platform: 'facebook',
            error: error.message
        };
    }
};

export const checkFacebookSession = async () => {
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

export default { facebookLogin, uploadToFacebook, checkFacebookSession };
