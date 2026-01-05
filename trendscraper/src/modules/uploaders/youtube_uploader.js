import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dataAccess from '../../utils/dataAccess.js';

// Legacy paths (fallback)
const COOKIES_PATH = '/app/data/youtube_cookies.json';
const USER_DATA_DIR = '/app/data/youtube_profile';

/**
 * YouTube Shorts Uploader using Playwright browser automation
 * Login once, then upload automatically using saved session
 */

/**
 * Launch browser with saved session
 * Uses headless: false with xvfb for better compatibility with YouTube Studio
 */
const launchBrowser = async (headless = true) => {
    const browser = await chromium.launch({
        headless: false,  // Use headed mode with xvfb for better YouTube compatibility
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Load saved cookies if exists
    const cookies = dataAccess.readJsonFileSync('youtube_cookies.json');
    if (cookies) {
        await context.addCookies(cookies);
        console.log('   📦 Loaded saved YouTube session');
    } else if (fs.existsSync(COOKIES_PATH)) {
        const legacyCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        await context.addCookies(legacyCookies);
        console.log('   📦 Loaded saved YouTube session (legacy)');
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
        await dataAccess.writeJsonFile('youtube_cookies.json', cookies);
    } catch (err) {
        // Fallback to legacy path
        const dir = path.dirname(COOKIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    }
    console.log('   💾 Session saved for future uploads');
};

/**
 * Check if logged into YouTube
 */
const isLoggedIn = async (page) => {
    await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check for avatar or channel selector (indicates logged in)
    const loggedIn = await page.$('ytcp-account-switcher') !== null ||
        await page.$('#avatar-btn') !== null ||
        await page.url().includes('studio.youtube.com/channel');

    return loggedIn;
};

/**
 * Interactive login - opens browser for user to login manually
 */
export const youtubeLogin = async () => {
    console.log('🔐 Opening YouTube login...');
    console.log('   Please login to your YouTube account in the browser window.');

    const { browser, context } = await launchBrowser(false); // headless: false for login
    const page = await context.newPage();

    await page.goto('https://accounts.google.com/signin/v2/identifier?service=youtube');

    console.log('   ⏳ Waiting for you to complete login...');
    console.log('   (The browser will close automatically after successful login)');

    // Wait for redirect to YouTube Studio (indicates successful login)
    try {
        await page.waitForURL(/studio\.youtube\.com|youtube\.com\/feed/, { timeout: 300000 }); // 5 min timeout
        await page.waitForTimeout(3000);

        await saveCookies(context);
        console.log('   ✅ YouTube login successful!');

        await browser.close();
        return { success: true };
    } catch (error) {
        await browser.close();
        console.error('   ❌ Login failed or timed out');
        return { success: false, error: error.message };
    }
};

/**
 * Upload a video to YouTube Shorts
 */
export const uploadToYouTube = async (videoPath, { title, description, hashtags = [] }) => {
    console.log('📤 Uploading to YouTube Shorts...');

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
            throw new Error('Not logged in to YouTube. Run youtubeLogin() first.');
        }

        console.log('   ✅ Logged into YouTube Studio');

        // Navigate to YouTube Studio first
        await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // Click the "Create" button in the top right to open upload dialog
        const createButton = await page.$('ytcp-button#create-icon') ||
            await page.$('#create-icon') ||
            await page.$('button[aria-label="Create"]') ||
            await page.$('#upload-icon') ||
            await page.locator('text=Create').first();

        if (createButton) {
            await createButton.click();
            console.log('   📤 Clicked Create button');
            await page.waitForTimeout(1500);

            // Click "Upload videos" from the dropdown menu
            const uploadOption = await page.$('tp-yt-paper-item:has-text("Upload videos")') ||
                await page.$('#text-item-0') ||
                await page.locator('text=Upload videos').first() ||
                await page.locator('text=Upload video').first();

            if (uploadOption) {
                await uploadOption.click();
                console.log('   📤 Clicked Upload videos');
                await page.waitForTimeout(2000);
            }
        } else {
            // Fallback: try direct URL
            await page.goto('https://www.youtube.com/upload', { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
        }

        // Now find the file input in the upload dialog
        let fileInput = await page.$('input[type="file"]');

        if (!fileInput) {
            // Wait a bit more for dialog to fully load
            await page.waitForTimeout(2000);
            fileInput = await page.$('input[type="file"]');
        }

        if (!fileInput) {
            // Try to find it via evaluate
            const handle = await page.evaluateHandle(() => document.querySelector('input[type="file"]'));
            fileInput = handle.asElement();
        }

        if (fileInput) {
            await fileInput.setInputFiles(videoPath);
            console.log('   📁 Video file selected');
        } else {
            // Take a screenshot for debugging
            await page.screenshot({ path: '/app/data/youtube_debug.png' });
            throw new Error('Could not find file upload input - check /app/data/youtube_debug.png');
        }

        // Wait for upload dialog to fully load
        await page.waitForTimeout(5000);

        // Wait for the title input to appear (indicates upload dialog is ready)
        console.log('   ⏳ Waiting for upload dialog...');
        try {
            await page.waitForSelector('#textbox', { timeout: 30000 });
        } catch (e) {
            // Try alternative selector
            await page.waitForSelector('div[id="textbox"]', { timeout: 10000 }).catch(() => {});
        }

        // Fill in title - try multiple approaches
        const titleSelectors = [
            '#textbox',
            'div#textbox',
            '[aria-label*="title"]',
            'ytcp-mention-textbox#title-textarea #textbox'
        ];

        let titleFilled = false;
        for (const selector of titleSelectors) {
            try {
                const titleInput = await page.$(selector);
                if (titleInput) {
                    await titleInput.click();
                    await page.waitForTimeout(300);
                    // Clear existing text
                    await page.keyboard.press('Control+A');
                    await page.keyboard.type(title.slice(0, 100));
                    console.log('   📝 Title added');
                    titleFilled = true;
                    break;
                }
            } catch (e) {
                // Selector not found, try next - this is expected behavior
                continue;
            }
        }

        // Fill in description
        await page.waitForTimeout(1000);
        const descSelectors = [
            'ytcp-mention-textbox#description-textarea #textbox',
            '#description-textarea #textbox',
            '[aria-label*="description"]'
        ];

        for (const selector of descSelectors) {
            try {
                const descInput = await page.$(selector);
                if (descInput) {
                    await descInput.click();
                    await page.waitForTimeout(300);
                    const fullDesc = `${description}\n\n${hashtags.join(' ')}`;
                    await page.keyboard.type(fullDesc.slice(0, 2000));
                    console.log('   📝 Description added');
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Scroll down to find "Not made for kids" option
        await page.waitForTimeout(1000);
        await page.evaluate(() => window.scrollBy(0, 300));

        // Select "No, it's not made for kids" - try multiple selectors
        const notForKidsSelectors = [
            'tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]',
            '#radioLabel:has-text("No, it\'s not made for kids")',
            'ytcp-video-metadata-editor-sidepanel tp-yt-paper-radio-button:nth-child(2)'
        ];

        for (const selector of notForKidsSelectors) {
            try {
                const notForKids = await page.$(selector);
                if (notForKids) {
                    await notForKids.click();
                    console.log('   ✅ Selected "Not made for kids"');
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        console.log('   ⏳ Waiting for video to process...');

        // Click through the wizard: Next -> Next -> Next
        // Use locator for more reliable clicking
        for (let i = 0; i < 3; i++) {
            await page.waitForTimeout(3000);
            try {
                // Try clicking Next button with multiple selectors
                const clicked = await page.evaluate(() => {
                    const btn = document.querySelector('#next-button') ||
                        document.querySelector('ytcp-button#next-button') ||
                        document.querySelector('[id="next-button"]');
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                });
                if (clicked) {
                    console.log(`   ➡️ Clicked Next (${i + 1}/3)`);
                }
            } catch (e) {
                console.log(`   ⚠️ Next button issue: ${e.message}`);
            }
        }

        // Wait for processing and find publish/done button
        await page.waitForTimeout(5000);

        // Wait for video upload to complete
        console.log('   ⏳ Waiting for upload to complete...');
        let uploadComplete = false;
        for (let attempts = 0; attempts < 60; attempts++) {
            // Check for "Checks complete" or progress at 100%
            const status = await page.evaluate(() => {
                const progressText = document.body.innerText;
                return progressText.includes('Checks complete') ||
                    progressText.includes('100%') ||
                    progressText.includes('Video uploaded');
            });
            if (status) {
                uploadComplete = true;
                console.log('   ✅ Upload processing complete');
                break;
            }
            await page.waitForTimeout(3000);
        }

        // Click Publish/Done button
        const publishClicked = await page.evaluate(() => {
            const btn = document.querySelector('#done-button') ||
                document.querySelector('ytcp-button#done-button');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (publishClicked) {
            console.log('   ✅ Video published!');
            await page.waitForTimeout(5000);

            // Try to get video URL from the success dialog
            const videoUrl = await page.evaluate(() => {
                const link = document.querySelector('a.ytcp-video-info') ||
                    document.querySelector('a[href*="/video/"]');
                return link ? link.href : null;
            });

            await saveCookies(context);
            await browser.close();

            return {
                success: true,
                platform: 'youtube',
                videoUrl: videoUrl || null,
                message: 'Video uploaded to YouTube Shorts'
            };
        }

        // If publish button wasn't clicked, still try to save and return partial success
        await saveCookies(context);
        await browser.close();

        return {
            success: false,
            platform: 'youtube',
            error: 'Could not click publish button - video may have been uploaded as draft'
        };

    } catch (error) {
        console.error('   ❌ YouTube upload failed:', error.message);
        await browser.close();
        return {
            success: false,
            platform: 'youtube',
            error: error.message
        };
    }
};

/**
 * Check if YouTube session is valid
 */
export const checkYouTubeSession = async () => {
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

export default { youtubeLogin, uploadToYouTube, checkYouTubeSession };
