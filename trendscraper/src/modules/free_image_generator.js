/**
 * Free Image Generator Module
 * Provides free image generation using Pollinations AI and Hugging Face
 *
 * Providers:
 * 1. Pollinations AI - Completely free, no API key, URL-based
 * 2. Hugging Face - Free tier with API key
 * 3. Replicate - Paid fallback (existing)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Configuration
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const HUGGINGFACE_API = 'https://api-inference.huggingface.co/models';

// Default models
const HF_MODELS = {
    sdxl: 'stabilityai/stable-diffusion-xl-base-1.0',
    flux: 'black-forest-labs/FLUX.1-schnell',
    sd15: 'runwayml/stable-diffusion-v1-5'
};

// Image dimensions for different aspect ratios
const DIMENSIONS = {
    portrait: { width: 720, height: 1280 },  // 9:16 for shorts
    landscape: { width: 1280, height: 720 }, // 16:9
    square: { width: 1024, height: 1024 }    // 1:1
};

/**
 * Download image from URL to file
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
            fs.unlink(destPath, () => {}); // Clean up partial file
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
 * Generate image using Pollinations AI
 * Completely free - no API key required
 *
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options
 * @returns {Promise<string>} - Path to saved image
 */
export const generateWithPollinations = async (prompt, options = {}) => {
    const {
        outputDir = './videos',
        width = 720,
        height = 1280,
        seed = null,
        model = 'flux',  // flux, turbo, or default
        nologo = true,
        enhance = true
    } = options;

    // Encode prompt for URL
    const encodedPrompt = encodeURIComponent(prompt);

    // Build URL with parameters
    let url = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}`;

    if (seed) url += `&seed=${seed}`;
    if (model) url += `&model=${model}`;
    if (nologo) url += `&nologo=true`;
    if (enhance) url += `&enhance=true`;

    console.log(`   🎨 Pollinations: Generating image...`);

    // Create output filename
    const timestamp = Date.now();
    const filename = `pollinations_${timestamp}.png`;
    const outputPath = path.join(outputDir, filename);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        await downloadImage(url, outputPath);
        console.log(`   ✅ Pollinations: Image saved to ${filename}`);
        return outputPath;
    } catch (error) {
        console.error(`   ❌ Pollinations failed: ${error.message}`);
        throw error;
    }
};

/**
 * Generate image using Hugging Face Inference API
 * Requires HUGGINGFACE_API_KEY environment variable
 * Free tier: ~30,000 requests/month
 *
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options
 * @returns {Promise<string>} - Path to saved image
 */
export const generateWithHuggingFace = async (prompt, options = {}) => {
    const {
        outputDir = './videos',
        model = 'flux',
        negativePrompt = 'blurry, low quality, distorted, watermark, text'
    } = options;

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
        throw new Error('HUGGINGFACE_API_KEY not set');
    }

    const modelId = HF_MODELS[model] || HF_MODELS.flux;
    const apiUrl = `${HUGGINGFACE_API}/${modelId}`;

    console.log(`   🎨 HuggingFace: Generating with ${model}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    negative_prompt: negativePrompt,
                    num_inference_steps: 30
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
        }

        const buffer = await response.arrayBuffer();

        // Save image
        const timestamp = Date.now();
        const filename = `huggingface_${timestamp}.png`;
        const outputPath = path.join(outputDir, filename);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`   ✅ HuggingFace: Image saved to ${filename}`);
        return outputPath;

    } catch (error) {
        console.error(`   ❌ HuggingFace failed: ${error.message}`);
        throw error;
    }
};

/**
 * Generate image with automatic fallback chain
 * Tries providers in order: Pollinations -> HuggingFace -> Replicate
 *
 * @param {string} prompt - Image generation prompt
 * @param {object} options - Generation options
 * @returns {Promise<string>} - Path to saved image
 */
export const generateFreeImage = async (prompt, options = {}) => {
    const {
        outputDir = './videos',
        aspectRatio = 'portrait',
        preferredProvider = 'pollinations',
        allowPaidFallback = false
    } = options;

    const dims = DIMENSIONS[aspectRatio] || DIMENSIONS.portrait;

    // Provider attempt order
    const providers = [];

    // Add preferred provider first
    if (preferredProvider === 'huggingface' && process.env.HUGGINGFACE_API_KEY) {
        providers.push('huggingface');
        providers.push('pollinations');
    } else {
        providers.push('pollinations');
        if (process.env.HUGGINGFACE_API_KEY) {
            providers.push('huggingface');
        }
    }

    // Add paid fallback if allowed
    if (allowPaidFallback && process.env.REPLICATE_API_TOKEN) {
        providers.push('replicate');
    }

    let lastError = null;

    for (const provider of providers) {
        try {
            console.log(`   🔄 Trying ${provider}...`);

            switch (provider) {
                case 'pollinations':
                    return await generateWithPollinations(prompt, {
                        outputDir,
                        width: dims.width,
                        height: dims.height,
                        model: 'flux',
                        enhance: true
                    });

                case 'huggingface':
                    return await generateWithHuggingFace(prompt, {
                        outputDir,
                        model: 'flux'
                    });

                case 'replicate':
                    // Import existing replicate module dynamically
                    const { generateWithReplicate } = await import('./visuals_pro.js');
                    return await generateWithReplicate(prompt, { outputDir, ...dims });

                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }
        } catch (error) {
            console.warn(`   ⚠️ ${provider} failed: ${error.message}`);
            lastError = error;
            continue;
        }
    }

    throw new Error(`All image providers failed. Last error: ${lastError?.message}`);
};

/**
 * Generate multiple images with batch optimization
 *
 * @param {string[]} prompts - Array of prompts
 * @param {object} options - Generation options
 * @returns {Promise<string[]>} - Array of image paths
 */
export const generateBatchFreeImages = async (prompts, options = {}) => {
    const {
        outputDir = './videos',
        aspectRatio = 'portrait',
        concurrency = 2,  // Parallel downloads
        delayMs = 500     // Delay between batches to avoid rate limiting
    } = options;

    console.log(`   📦 Generating ${prompts.length} images (concurrency: ${concurrency})...`);

    const results = [];

    for (let i = 0; i < prompts.length; i += concurrency) {
        const batch = prompts.slice(i, i + concurrency);

        const batchPromises = batch.map((prompt, idx) =>
            generateFreeImage(prompt, {
                outputDir,
                aspectRatio,
                ...options
            }).catch(err => {
                console.error(`   ❌ Batch item ${i + idx} failed: ${err.message}`);
                return null;
            })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Delay between batches
        if (i + concurrency < prompts.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    // Filter out failed generations
    const successfulResults = results.filter(r => r !== null);
    console.log(`   ✅ Successfully generated ${successfulResults.length}/${prompts.length} images`);

    return results;
};

/**
 * Enhance prompt for better image quality
 * Adds style modifiers based on scene type
 */
export const enhancePrompt = (prompt, options = {}) => {
    const {
        sceneType = 'body',
        style = 'professional',
        includeNegative = false
    } = options;

    const styleModifiers = {
        professional: 'professional photography, high quality, sharp focus, well-lit',
        cinematic: 'cinematic lighting, film grain, dramatic shadows, movie still',
        illustration: 'digital illustration, vibrant colors, detailed artwork',
        corporate: 'corporate style, clean, modern, business professional',
        educational: 'educational diagram, clear visuals, informative',
        safety: 'safety training visual, clear warning signs, attention-grabbing'
    };

    const sceneModifiers = {
        hook: 'attention-grabbing, dramatic, impactful',
        body: 'clear, detailed, informative',
        cta: 'call to action, engaging, memorable'
    };

    let enhanced = prompt;

    // Add style modifier
    if (styleModifiers[style]) {
        enhanced = `${enhanced}, ${styleModifiers[style]}`;
    }

    // Add scene type modifier
    if (sceneModifiers[sceneType]) {
        enhanced = `${enhanced}, ${sceneModifiers[sceneType]}`;
    }

    // Return with optional negative prompt
    if (includeNegative) {
        return {
            prompt: enhanced,
            negativePrompt: 'blurry, low quality, distorted, watermark, text, logo, signature, cropped, out of frame'
        };
    }

    return enhanced;
};

/**
 * Get provider status and availability
 */
export const getProviderStatus = async () => {
    const status = {
        pollinations: {
            available: true,
            free: true,
            requiresKey: false,
            note: 'Always available, no limits'
        },
        huggingface: {
            available: !!process.env.HUGGINGFACE_API_KEY,
            free: true,
            requiresKey: true,
            note: process.env.HUGGINGFACE_API_KEY
                ? 'API key configured (free tier: ~30k requests/month)'
                : 'Set HUGGINGFACE_API_KEY for additional capacity'
        },
        replicate: {
            available: !!process.env.REPLICATE_API_TOKEN,
            free: false,
            requiresKey: true,
            note: process.env.REPLICATE_API_TOKEN
                ? 'API key configured (paid, ~$0.003/image)'
                : 'Set REPLICATE_API_TOKEN for paid fallback'
        }
    };

    return status;
};

/**
 * Test image generation - generates a sample to compare quality
 */
export const testImageGeneration = async (outputDir = './videos') => {
    const testPrompt = 'Professional business person in modern office, confident pose, corporate environment, high quality photography, sharp focus';

    console.log('🧪 Testing Pollinations AI image generation...');
    console.log(`   Prompt: "${testPrompt}"`);

    try {
        const imagePath = await generateWithPollinations(testPrompt, {
            outputDir,
            width: 720,
            height: 1280,
            model: 'flux',
            enhance: true
        });

        console.log(`\n✅ Test complete! Image saved to: ${imagePath}`);
        console.log('   Open the image to compare quality with Replicate.');

        return imagePath;
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        throw error;
    }
};

export default {
    generateWithPollinations,
    generateWithHuggingFace,
    generateFreeImage,
    generateBatchFreeImages,
    enhancePrompt,
    getProviderStatus,
    testImageGeneration,
    DIMENSIONS,
    HF_MODELS
};
