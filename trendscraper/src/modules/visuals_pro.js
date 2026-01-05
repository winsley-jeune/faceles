// trendscraper/src/modules/visuals_pro.js
import Replicate from "replicate";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import https from "https";
import http from "http";
import contentConfig from "./analytics/content_config.js";
import crossPlatform from "./analytics/cross_platform.js";
import performanceWeights from "./analytics/performance_weights.js";

// Initialize Replicate with the key passed from Docker (only used if premium mode)
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// ============================================================================
// IMAGE GENERATION PROVIDER CONFIGURATION
// Supports: pollinations (FREE), huggingface (FREE), replicate (PAID)
// ============================================================================
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || 'pollinations'; // Default to FREE
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

/**
 * Download image from URL to file (for Pollinations)
 */
const downloadImage = (url, destPath) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);

        const request = protocol.get(url, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadImage(response.headers.location, destPath)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        });

        request.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });

        file.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });

        // Timeout after 120 seconds (2 minutes for slower connections)
        request.setTimeout(120000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
};

/**
 * Generate image using Pollinations AI (FREE - no API key required)
 */
const generateWithPollinations = async (prompt, options = {}) => {
    const {
        outputDir = '/app/videos',
        width = 720,
        height = 1280,
        model = 'flux',
        sceneType = 'body',
        index = 0
    } = options;

    // Encode prompt for URL
    const encodedPrompt = encodeURIComponent(prompt);

    // Build URL with parameters
    const url = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&enhance=true`;

    // Create output filename
    const timestamp = Date.now();
    const fileName = `scene_${timestamp}_${index}_${sceneType}.png`;
    const filePath = path.join(outputDir, fileName);

    await downloadImage(url, filePath);
    return filePath;
};

/**
 * Generate image using Replicate (PAID - requires API key)
 */
const generateWithReplicate = async (prompt, options = {}) => {
    const {
        outputDir = '/app/videos',
        model = 'black-forest-labs/flux-schnell',
        sceneType = 'body',
        index = 0
    } = options;

    const output = await replicate.run(model, {
        input: {
            prompt: prompt,
            negative_prompt: "text, watermark, signature, ugly, deformed, distorted, low quality, bad anatomy, blurry, out of focus, disfigured, extra limbs, missing limbs",
            aspect_ratio: "9:16",
            output_format: "png",
            output_quality: 90,
            go_fast: true,
            num_inference_steps: model.includes('schnell') ? 4 : 28
        }
    });

    // Replicate returns a URL - download it
    const imageUrl = Array.isArray(output) ? output[0] : output;
    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    const fileName = `scene_${Date.now()}_${index}_${sceneType}.png`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
};

// Visual themes for consistent look across all scenes
// Each theme defines colors, style, and mood for the entire video
const VISUAL_THEMES = {
    cyber_neon: {
        name: "Cyber Neon",
        colors: "neon cyan, neon magenta, electric blue, deep black backgrounds",
        style: "cyberpunk aesthetic, digital, synthetic, glowing edges, holographic",
        lighting: "neon rim lighting, high contrast, dramatic shadows",
        bestFor: ["tech", "crypto", "ai", "future"]
    },
    corporate_clean: {
        name: "Corporate Clean",
        colors: "white, light gray, soft blue accents, minimal color palette",
        style: "professional, minimalist, clean typography, modern business",
        lighting: "soft diffused lighting, clean and bright",
        bestFor: ["business", "education", "howto"]
    },
    dark_cinematic: {
        name: "Dark Cinematic",
        colors: "dark grays, blacks, deep red or gold accents",
        style: "cinematic, moody, high contrast, film noir inspired",
        lighting: "dramatic side lighting, volumetric shadows, rim light",
        bestFor: ["conspiracy", "mystery", "history", "drama"]
    },
    finance_noir: {
        name: "Finance Noir",
        colors: "deep shadows, dark greens, muted golds, slate gray, rich mahogany",
        style: "gritty, insider, mysterious, sophisticated, 1980s Wall Street film aesthetic, analog, slight film grain",
        lighting: "low-key lighting, single light source, Venetian blinds shadows, high contrast, moody",
        bestFor: ["finance", "stocks", "investing", "money"]
    },
    warm_organic: {
        name: "Warm Organic",
        colors: "earth tones, warm yellows, natural greens, soft browns",
        style: "organic, natural, warm, approachable, friendly",
        lighting: "warm golden hour lighting, soft and inviting",
        bestFor: ["health", "wellness", "lifestyle", "nature"]
    },
    bold_vibrant: {
        name: "Bold Vibrant",
        colors: "bright saturated colors, yellow, orange, energetic palette",
        style: "energetic, eye-catching, bold graphics, high saturation",
        lighting: "bright even lighting, no harsh shadows",
        bestFor: ["motivation", "sports", "entertainment", "viral"]
    },
    scientific: {
        name: "Scientific",
        colors: "blue, white, teal accents, clean data visualization colors",
        style: "scientific, data-driven, charts, diagrams, educational",
        lighting: "clinical, clear, professional lighting",
        bestFor: ["science", "research", "data", "psychology"]
    }
};

// ============================================================================
// PLATFORM-SPECIFIC VISUAL CONFIGURATIONS
// Each platform has different visual preferences that drive engagement
// ============================================================================
const PLATFORM_VISUAL_CONFIG = {
    youtube: {
        aspectRatio: '9:16',
        style: 'cinematic, professional, detailed, high production value',
        textOverlay: 'subtle lower-third, professional typography',
        hookStyle: 'pattern-interrupt, high contrast, single focal point, thumbnail-optimized',
        preferredThemes: ['dark_cinematic', 'corporate_clean', 'scientific'],
        colorTemperature: 'neutral to warm',
        contrastLevel: 'medium-high'
    },
    tiktok: {
        aspectRatio: '9:16',
        style: 'bold, high-contrast, pattern-interrupt, trendy, chaotic energy',
        textOverlay: 'large center-screen, bold fonts, immediate visibility',
        hookStyle: 'maximum pattern interrupt, visual chaos, impossible to scroll past, neon edges',
        preferredThemes: ['cyber_neon', 'bold_vibrant', 'dark_cinematic'],
        colorTemperature: 'cool neon or high saturation',
        contrastLevel: 'maximum'
    },
    instagram: {
        aspectRatio: '9:16',
        style: 'aesthetic, polished, aspirational, visually striking',
        textOverlay: 'minimal, elegant, on-brand',
        hookStyle: 'aesthetic perfection, clean composition, Instagram-worthy',
        preferredThemes: ['warm_organic', 'corporate_clean', 'bold_vibrant'],
        colorTemperature: 'warm golden hour',
        contrastLevel: 'medium'
    },
    facebook: {
        aspectRatio: '9:16',
        style: 'storytelling, emotional, relatable, shareable',
        textOverlay: 'clear and readable, slightly larger for older demographics',
        hookStyle: 'emotional hook, curiosity-driven, family-friendly',
        preferredThemes: ['warm_organic', 'dark_cinematic', 'corporate_clean'],
        colorTemperature: 'warm and inviting',
        contrastLevel: 'medium'
    }
};

// Visual performance tracking data path
const VISUAL_PERFORMANCE_PATH = '/app/data/visual_performance.json';

/**
 * Load visual performance data
 */
const loadVisualPerformance = () => {
    try {
        if (fs.existsSync(VISUAL_PERFORMANCE_PATH)) {
            return JSON.parse(fs.readFileSync(VISUAL_PERFORMANCE_PATH, 'utf8'));
        }
    } catch (err) {
        console.error('Failed to load visual performance:', err.message);
    }
    return {
        themes: {},
        platforms: {},
        colorPalettes: {},
        hookStyles: {},
        lastUpdated: null
    };
};

/**
 * Save visual performance data
 */
const saveVisualPerformance = (data) => {
    try {
        const dir = path.dirname(VISUAL_PERFORMANCE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(VISUAL_PERFORMANCE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Failed to save visual performance:', err.message);
    }
};

/**
 * Track visual theme usage for a video
 */
const trackThemeUsage = (themeKey, platform, videoId = null) => {
    const data = loadVisualPerformance();

    // Track by theme
    if (!data.themes[themeKey]) {
        data.themes[themeKey] = { attempts: 0, totalViews: 0, avgViews: 0, platforms: {} };
    }
    data.themes[themeKey].attempts++;
    data.themes[themeKey].platforms[platform] = (data.themes[themeKey].platforms[platform] || 0) + 1;

    // Track by platform
    if (!data.platforms[platform]) {
        data.platforms[platform] = { themes: {}, totalVideos: 0 };
    }
    data.platforms[platform].totalVideos++;
    data.platforms[platform].themes[themeKey] = (data.platforms[platform].themes[themeKey] || 0) + 1;

    saveVisualPerformance(data);
    return { theme: themeKey, platform, tracked: true };
};

/**
 * Update visual performance after getting video metrics
 */
const updateThemePerformance = (themeKey, platform, metrics = {}) => {
    const data = loadVisualPerformance();

    if (!data.themes[themeKey]) {
        data.themes[themeKey] = { attempts: 0, totalViews: 0, avgViews: 0, platforms: {} };
    }

    const theme = data.themes[themeKey];
    const views = metrics.views || 0;
    const retention = metrics.retention || metrics.avgWatchPercent || 50;

    theme.totalViews += views;
    theme.avgViews = theme.attempts > 0 ? Math.round(theme.totalViews / theme.attempts) : views;
    theme.avgRetention = theme.avgRetention
        ? (theme.avgRetention * 0.7 + retention * 0.3) // Weighted moving average
        : retention;

    // Calculate theme score (views * retention weight)
    theme.score = theme.avgViews * (theme.avgRetention / 100);

    saveVisualPerformance(data);
};

/**
 * Get best performing theme for a platform
 */
const getBestThemeForPlatform = (platform) => {
    const data = loadVisualPerformance();
    const platformConfig = PLATFORM_VISUAL_CONFIG[platform] || PLATFORM_VISUAL_CONFIG.youtube;

    // Get themes with enough data for this platform
    const themesWithData = Object.entries(data.themes)
        .filter(([key, theme]) => {
            const platformAttempts = theme.platforms?.[platform] || 0;
            return platformAttempts >= 3; // Need at least 3 samples
        })
        .map(([key, theme]) => ({
            key,
            score: theme.score || 0,
            avgViews: theme.avgViews || 0,
            avgRetention: theme.avgRetention || 50,
            attempts: theme.platforms?.[platform] || 0
        }))
        .sort((a, b) => b.score - a.score);

    if (themesWithData.length > 0) {
        return {
            theme: themesWithData[0].key,
            score: themesWithData[0].score,
            reason: 'learned_from_performance',
            alternatives: themesWithData.slice(1, 3).map(t => t.key)
        };
    }

    // Fallback to platform preferred themes
    const preferred = platformConfig.preferredThemes || ['dark_cinematic'];
    return {
        theme: preferred[0],
        score: 0,
        reason: 'platform_default',
        alternatives: preferred.slice(1)
    };
};

/**
 * Get platform-specific visual config
 */
const getPlatformVisualConfig = (platform) => {
    return PLATFORM_VISUAL_CONFIG[platform?.toLowerCase()] || PLATFORM_VISUAL_CONFIG.youtube;
};

// Enhanced prompt modifiers for maximum visual impact
const VISUAL_ENHANCERS = {
    quality: "masterpiece quality, highly detailed, 8k resolution, sharp focus",
    lighting: "dramatic cinematic lighting, volumetric lighting, rim lighting",
    composition: "professional composition, rule of thirds, vertical 9:16 aspect ratio",
    mood: "intense atmosphere, emotional impact, storytelling visual"
};

// Scene-type specific enhancements
const SCENE_ENHANCEMENTS = {
    hook: "extremely eye-catching, pattern interrupt visual, bold and striking, impossible to scroll past, attention-grabbing",
    body: "engaging visual storytelling, building narrative, clear communication, informative",
    cta: "urgent feeling, call to action energy, inviting, encouraging engagement"
};

/**
 * Detect the best visual theme based on:
 * 1. Platform-specific learned performance (highest priority)
 * 2. Cross-platform analytics
 * 3. Topic keywords (fallback)
 *
 * Now platform-aware for optimal engagement
 */
const detectVisualTheme = (topic, platform = 'youtube') => {
    const topicLower = topic.toLowerCase();
    const platformConfig = getPlatformVisualConfig(platform);

    // PRIORITY 1: Check platform-specific visual performance learning
    try {
        const bestForPlatform = getBestThemeForPlatform(platform);
        if (bestForPlatform.reason === 'learned_from_performance') {
            console.log(`   🎯 Learned best theme for ${platform}: ${bestForPlatform.theme} (score: ${Math.round(bestForPlatform.score)})`);
            return bestForPlatform.theme;
        }
    } catch (e) {
        // Continue to other methods
    }

    // PRIORITY 2: Check cross-platform analytics for visual style patterns
    try {
        const patterns = crossPlatform.loadWinningPatterns();
        const visualStyles = patterns.patterns?.visualStyles || {};

        // Find the best performing visual style with enough data
        const sortedStyles = Object.entries(visualStyles)
            .filter(([_, data]) => data.totalCount >= 3) // Need enough samples
            .sort((a, b) => (b[1].avgScore || 0) - (a[1].avgScore || 0));

        if (sortedStyles.length > 0) {
            const [bestStyle, data] = sortedStyles[0];

            // Map analytics visual styles to our themes
            const styleToThemeMap = {
                'dark': 'dark_cinematic',
                'neon': 'cyber_neon',
                'cyber': 'cyber_neon',
                'corporate': 'corporate_clean',
                'clean': 'corporate_clean',
                'warm': 'warm_organic',
                'organic': 'warm_organic',
                'vibrant': 'bold_vibrant',
                'bold': 'bold_vibrant',
                'scientific': 'scientific',
                'finance': 'finance_noir',
                'noir': 'finance_noir',
                'minimalist': 'corporate_clean'
            };

            const matchedTheme = styleToThemeMap[bestStyle];
            if (matchedTheme && VISUAL_THEMES[matchedTheme]) {
                console.log(`   📊 Analytics suggests visual theme: ${matchedTheme} (top performing style: ${bestStyle})`);
                return matchedTheme;
            }
        }
    } catch (e) {
        // Analytics not available, continue with keyword detection
    }

    // PRIORITY 3: Keyword-based detection with platform preference
    for (const [themeKey, theme] of Object.entries(VISUAL_THEMES)) {
        if (theme.bestFor.some(keyword => topicLower.includes(keyword))) {
            // Check if this theme is platform-preferred
            if (platformConfig.preferredThemes.includes(themeKey)) {
                console.log(`   ✨ Keyword + platform match: ${themeKey}`);
                return themeKey;
            }
            // Still use if keyword matches even if not platform-preferred
            return themeKey;
        }
    }

    // PRIORITY 4: Platform default theme
    const defaultTheme = platformConfig.preferredThemes[0] || 'dark_cinematic';
    console.log(`   📱 Using platform default theme for ${platform}: ${defaultTheme}`);
    return defaultTheme;
};

/**
 * Get theme configuration by key
 */
const getThemeConfig = (themeKey) => {
    return VISUAL_THEMES[themeKey] || VISUAL_THEMES.dark_cinematic;
};

/**
 * Enhance a prompt with quality modifiers based on scene type, theme, AND platform
 * Applies consistent visual theme across all scenes
 * NOW: Uses content_config for AI-learned visual optimization rules
 * NOW: Platform-aware for maximum engagement per platform
 */
const enhancePrompt = (prompt, sceneType = 'body', themeKey = 'dark_cinematic', platform = 'youtube') => {
    const theme = getThemeConfig(themeKey);
    const sceneEnhancement = SCENE_ENHANCEMENTS[sceneType] || SCENE_ENHANCEMENTS.body;
    const platformConfig = getPlatformVisualConfig(platform);

    // Build theme-consistent enhancement
    const themeEnhancement = `Color scheme: ${theme.colors}. Style: ${theme.style}. Lighting: ${theme.lighting}`;

    // Add platform-specific style modifiers
    const platformStyleAddition = `Platform style: ${platformConfig.style}. Contrast: ${platformConfig.contrastLevel}. Temperature: ${platformConfig.colorTemperature}`;

    // Don't duplicate if prompt already has quality terms
    const hasQuality = prompt.toLowerCase().includes('8k') || prompt.toLowerCase().includes('detailed');

    let enhanced;
    if (hasQuality) {
        enhanced = `${themeEnhancement}. ${platformStyleAddition}. ${prompt}, ${sceneEnhancement}, ${VISUAL_ENHANCERS.composition}`;
    } else {
        enhanced = `${themeEnhancement}. ${platformStyleAddition}. ${prompt}, ${VISUAL_ENHANCERS.quality}, ${sceneEnhancement}`;
    }

    // HOOK FRAME SPECIAL TREATMENT - This is the thumbnail/first frame
    // Apply AI-learned visual optimization + platform-specific hook style
    if (sceneType === 'hook') {
        // Platform-specific hook styling
        const platformHookStyle = platformConfig.hookStyle || 'pattern-interrupt, high contrast';

        try {
            const hookEnhancement = contentConfig.getVisualEnhancement('hook');
            enhanced = `${hookEnhancement.promptAddition}. HOOK STYLE FOR ${platform.toUpperCase()}: ${platformHookStyle}. ${enhanced}`;
            console.log(`      🎯 Applied AI-learned + ${platform} hook optimization`);
        } catch (e) {
            // Fallback with platform-specific hook enhancement
            enhanced = `THUMBNAIL-OPTIMIZED: ultra eye-catching, ${platformHookStyle}, single clear focal point, scroll-stopping visual. ${enhanced}`;
        }
    }

    // Always ensure vertical aspect ratio
    if (!enhanced.toLowerCase().includes('9:16')) {
        enhanced += ', vertical 9:16 aspect ratio, portrait orientation';
    }

    return enhanced;
};

/**
 * Generate images with automatic provider selection
 * Default: Pollinations (FREE) - can switch to Replicate (PAID) via IMAGE_PROVIDER env var
 *
 * Providers:
 * - pollinations: FREE, no API key, uses Flux model (DEFAULT)
 * - replicate: PAID (~$0.003/image), highest quality
 *
 * Set IMAGE_PROVIDER=replicate in env to use paid provider
 */
export const generateProImages = async (imagePrompts, options = {}) => {
    const provider = options.provider || IMAGE_PROVIDER;
    const isFree = provider === 'pollinations';

    console.log(`🎨 Starting Image Generation (${provider.toUpperCase()}${isFree ? ' - FREE' : ' - PAID'})...`);

    const {
        model = "black-forest-labs/flux-schnell",
        outputDir = "/app/videos",
        sceneTypes = [],
        topic = "",
        visualTheme = null,
        platform = "youtube",
        retries = 5,  // Increased from 3 for better reliability with free providers
        delayBetweenImages = isFree ? 2000 : 12000 // Faster for free provider
    } = options;

    // Determine visual theme - use provided or auto-detect from topic + platform
    const themeKey = visualTheme || detectVisualTheme(topic, platform);
    const theme = getThemeConfig(themeKey);
    const platformConfig = getPlatformVisualConfig(platform);
    console.log(`   🎨 Visual theme: ${theme.name} (${themeKey})`);
    console.log(`   📱 Platform: ${platform} (${platformConfig.style.substring(0, 40)}...)`);
    console.log(`   💰 Provider: ${provider} (${isFree ? 'FREE - $0' : 'PAID - ~$0.003/image'})`);

    // Track theme usage for learning
    try {
        trackThemeUsage(themeKey, platform);
    } catch (e) {
        // Non-critical
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const generatedFiles = [];

    // Process images SEQUENTIALLY
    for (let index = 0; index < imagePrompts.length; index++) {
        const promptText = imagePrompts[index];
        const sceneType = sceneTypes[index] || 'body';

        // Special logging for hook frame (first 3 seconds)
        if (sceneType === 'hook') {
            console.log(`   🎯 Generating HOOK IMAGE (thumbnail/first frame) - This determines if viewers stay!`);
        }
        console.log(`   👉 Generating Image ${index + 1}/${imagePrompts.length} [${sceneType.toUpperCase()}]: "${promptText.substring(0, 40)}..."`);

        let lastError;
        let success = false;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Enhance the prompt with theme + platform for visual consistency
                const enhancedPrompt = enhancePrompt(promptText, sceneType, themeKey, platform);

                let filePath;

                if (provider === 'pollinations') {
                    // FREE: Use Pollinations AI
                    filePath = await generateWithPollinations(enhancedPrompt, {
                        outputDir,
                        width: 720,
                        height: 1280,
                        model: 'flux',
                        sceneType,
                        index
                    });
                } else {
                    // PAID: Use Replicate
                    filePath = await generateWithReplicate(enhancedPrompt, {
                        outputDir,
                        model,
                        sceneType,
                        index
                    });
                }

                console.log(`      ✅ Saved: ${path.basename(filePath)}`);
                generatedFiles.push(filePath);
                success = true;
                break; // Success, exit retry loop

            } catch (error) {
                lastError = error;
                const isRateLimit = error.message.includes('429') || error.message.includes('rate');

                console.error(`      ⚠️ Attempt ${attempt + 1} failed:`, error.message.substring(0, 100));

                if (attempt < retries) {
                    const waitTime = isRateLimit ? 15000 : 3000 * (attempt + 1);
                    console.log(`      ⏳ Waiting ${waitTime / 1000}s before retry...`);
                    await new Promise(r => setTimeout(r, waitTime));
                }
            }
        }

        if (!success) {
            console.error(`      ❌ All attempts failed for image ${index}`);

            // If free provider failed, try paid fallback if available
            if (isFree && process.env.REPLICATE_API_TOKEN) {
                console.log(`      🔄 Trying Replicate fallback...`);
                try {
                    const enhancedPrompt = enhancePrompt(promptText, sceneType, themeKey, platform);
                    const filePath = await generateWithReplicate(enhancedPrompt, {
                        outputDir,
                        model,
                        sceneType,
                        index
                    });
                    console.log(`      ✅ Fallback saved: ${path.basename(filePath)}`);
                    generatedFiles.push(filePath);
                } catch (fallbackError) {
                    console.error(`      ❌ Fallback also failed: ${fallbackError.message}`);
                }
            }
        }

        // Wait between images (except for last image)
        if (index < imagePrompts.length - 1) {
            console.log(`      ⏳ Waiting ${delayBetweenImages / 1000}s before next image...`);
            await new Promise(r => setTimeout(r, delayBetweenImages));
        }
    }

    console.log(`🎨 Generated ${generatedFiles.length}/${imagePrompts.length} images successfully`);

    // COMPLETION RATE CHECK
    const completionRate = generatedFiles.length / imagePrompts.length;

    if (completionRate < 0.5) {
        console.error(`❌ Image generation critically failed: Only ${generatedFiles.length}/${imagePrompts.length} images (${Math.round(completionRate * 100)}%)`);
        throw new Error(`Image generation failed: Only ${generatedFiles.length}/${imagePrompts.length} images generated. Minimum 50% required.`);
    }

    if (completionRate < 1.0) {
        console.warn(`⚠️ Image generation incomplete: ${generatedFiles.length}/${imagePrompts.length} images (${Math.round(completionRate * 100)}%). Video may have timeline issues.`);
    }

    // Attach metadata for downstream validation
    generatedFiles.completionRate = completionRate;
    generatedFiles.requestedCount = imagePrompts.length;
    generatedFiles.failedCount = imagePrompts.length - generatedFiles.length;

    return generatedFiles;
};

/**
 * Generate images with Flux Pro for highest quality (slower, more expensive)
 */
export const generatePremiumImages = async (imagePrompts, sceneTypes = []) => {
    return generateProImages(imagePrompts, {
        model: "black-forest-labs/flux-1.1-pro",
        sceneTypes,
        retries: 3
    });
};

/**
 * Generate a single test image to verify API connectivity
 */
export const testImageGeneration = async () => {
    console.log("🧪 Testing image generation...");

    const testPrompt = "Grand Theft Auto V loading screen art style, mysterious figure in suit holding glowing briefcase, dramatic urban night scene, high contrast, cinematic";

    try {
        const files = await generateProImages([testPrompt], {
            outputDir: "/app/videos"
        });

        if (files.length > 0) {
            console.log("✅ Test successful! Generated:", files[0]);
            return { success: true, file: files[0] };
        }

        return { success: false, error: "No file generated" };
    } catch (error) {
        console.error("❌ Test failed:", error.message);
        return { success: false, error: error.message };
    }
};

export {
    VISUAL_ENHANCERS,
    SCENE_ENHANCEMENTS,
    VISUAL_THEMES,
    PLATFORM_VISUAL_CONFIG,
    detectVisualTheme,
    getThemeConfig,
    getPlatformVisualConfig,
    trackThemeUsage,
    updateThemePerformance,
    getBestThemeForPlatform,
    loadVisualPerformance,
    generateWithPollinations,
    generateWithReplicate,
    IMAGE_PROVIDER
};
