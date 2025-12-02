// trendscraper/src/modules/visuals_pro.js
import Replicate from "replicate";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import contentConfig from "./analytics/content_config.js";
import crossPlatform from "./analytics/cross_platform.js";

// Initialize Replicate with the key passed from Docker
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

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
 * Detect the best visual theme based on topic keywords and analytics data
 * Now uses cross-platform analytics to prefer visual styles that have performed well
 */
const detectVisualTheme = (topic) => {
    const topicLower = topic.toLowerCase();

    // Check analytics for preferred visual styles first
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

    // Fallback to keyword-based detection
    for (const [themeKey, theme] of Object.entries(VISUAL_THEMES)) {
        if (theme.bestFor.some(keyword => topicLower.includes(keyword))) {
            return themeKey;
        }
    }

    // Default to dark_cinematic for educational content
    return 'dark_cinematic';
};

/**
 * Get theme configuration by key
 */
const getThemeConfig = (themeKey) => {
    return VISUAL_THEMES[themeKey] || VISUAL_THEMES.dark_cinematic;
};

/**
 * Enhance a prompt with quality modifiers based on scene type and theme
 * Applies consistent visual theme across all scenes
 * NOW: Uses content_config for AI-learned visual optimization rules
 */
const enhancePrompt = (prompt, sceneType = 'body', themeKey = 'dark_cinematic') => {
    const theme = getThemeConfig(themeKey);
    const sceneEnhancement = SCENE_ENHANCEMENTS[sceneType] || SCENE_ENHANCEMENTS.body;

    // Build theme-consistent enhancement
    const themeEnhancement = `Color scheme: ${theme.colors}. Style: ${theme.style}. Lighting: ${theme.lighting}`;

    // Don't duplicate if prompt already has quality terms
    const hasQuality = prompt.toLowerCase().includes('8k') || prompt.toLowerCase().includes('detailed');

    let enhanced;
    if (hasQuality) {
        enhanced = `${themeEnhancement}. ${prompt}, ${sceneEnhancement}, ${VISUAL_ENHANCERS.composition}`;
    } else {
        enhanced = `${themeEnhancement}. ${prompt}, ${VISUAL_ENHANCERS.quality}, ${sceneEnhancement}`;
    }

    // HOOK FRAME SPECIAL TREATMENT - This is the thumbnail/first frame
    // Apply AI-learned visual optimization for maximum scroll-stopping power
    if (sceneType === 'hook') {
        try {
            const hookEnhancement = contentConfig.getVisualEnhancement('hook');
            enhanced = `${hookEnhancement.promptAddition}. ${enhanced}`;
            console.log(`      🎯 Applied AI-learned hook visual optimization`);
        } catch (e) {
            // Fallback to default hook enhancement if config not available
            enhanced = `THUMBNAIL-OPTIMIZED: ultra eye-catching, high contrast, vibrant colors, single clear focal point, dramatic lighting, scroll-stopping visual. ${enhanced}`;
        }
    }

    // Always ensure vertical aspect ratio
    if (!enhanced.toLowerCase().includes('9:16')) {
        enhanced += ', vertical 9:16 aspect ratio, portrait orientation';
    }

    return enhanced;
};

/**
 * Generate images using Replicate's Flux model with retry logic
 * Processes sequentially to avoid rate limits on low-credit accounts
 * Now supports visual themes for consistent look across all scenes
 */
export const generateProImages = async (imagePrompts, options = {}) => {
    console.log("🎨 Starting Pro Image Generation (Replicate Flux)...");

    const {
        model = "black-forest-labs/flux-schnell", // Fast & cheap, or use flux-dev for higher quality
        outputDir = "/app/videos",
        sceneTypes = [], // Optional array of scene types for enhancement
        topic = "", // Topic for auto-detecting visual theme
        visualTheme = null, // Override theme (cyber_neon, corporate_clean, dark_cinematic, etc.)
        retries = 3,
        delayBetweenImages = 12000 // 12 seconds between images to respect rate limits
    } = options;

    // Determine visual theme - use provided or auto-detect from topic
    const themeKey = visualTheme || detectVisualTheme(topic);
    const theme = getThemeConfig(themeKey);
    console.log(`   🎨 Visual theme: ${theme.name} (${themeKey})`);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const generatedFiles = [];

    // Process images SEQUENTIALLY to avoid rate limits
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
                // Enhance the prompt with theme for visual consistency
                const enhancedPrompt = enhancePrompt(promptText, sceneType, themeKey);

                // Call Flux model
                const output = await replicate.run(model, {
                    input: {
                        prompt: enhancedPrompt,
                        negative_prompt: "text, watermark, signature, ugly, deformed, distorted, low quality, bad anatomy, blurry, out of focus, disfigured, extra limbs, missing limbs",
                        aspect_ratio: "9:16", // Vertical for shorts
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

                // Save with scene type prefix for debugging
                const fileName = `scene_${Date.now()}_${index}_${sceneType}.png`;
                const filePath = path.join(outputDir, fileName);

                fs.writeFileSync(filePath, Buffer.from(buffer));
                console.log(`      ✅ Saved: ${fileName}`);

                generatedFiles.push(filePath);
                success = true;
                break; // Success, exit retry loop

            } catch (error) {
                lastError = error;
                const isRateLimit = error.message.includes('429') || error.message.includes('rate');

                console.error(`      ⚠️ Attempt ${attempt + 1} failed:`, error.message.substring(0, 100));

                if (attempt < retries) {
                    // Wait longer for rate limits
                    const waitTime = isRateLimit ? 15000 : 3000 * (attempt + 1);
                    console.log(`      ⏳ Waiting ${waitTime / 1000}s before retry...`);
                    await new Promise(r => setTimeout(r, waitTime));
                }
            }
        }

        if (!success) {
            console.error(`      ❌ All attempts failed for image ${index}`);
        }

        // Wait between images to respect rate limits (except for last image)
        if (index < imagePrompts.length - 1) {
            console.log(`      ⏳ Waiting ${delayBetweenImages / 1000}s before next image...`);
            await new Promise(r => setTimeout(r, delayBetweenImages));
        }
    }

    console.log(`🎨 Generated ${generatedFiles.length}/${imagePrompts.length} images successfully`);
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

export { VISUAL_ENHANCERS, SCENE_ENHANCEMENTS, VISUAL_THEMES, detectVisualTheme, getThemeConfig };
