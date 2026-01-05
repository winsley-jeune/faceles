/**
 * End-to-End Test: Free Image Generation Pipeline
 * Tests the complete video generation flow using FREE providers only
 *
 * Run: node test_e2e_free.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Set environment to use free provider
process.env.IMAGE_PROVIDER = 'pollinations';

import { generateProImages } from './modules/visuals_pro.js';
import { generateSmartVoice } from './modules/voice_pro.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIDEOS_DIR = path.join(__dirname, '..', '..', 'videos');

// Test configuration
const TEST_CONFIG = {
    title: 'Safety Training Test',
    prompts: [
        'Worker wearing safety helmet and vest in industrial factory, safety first concept, professional photography',
        'Fire extinguisher on wall with emergency exit sign, workplace safety, clean corporate style',
        'Team meeting in conference room discussing safety procedures, professional business environment'
    ],
    sceneTypes: ['hook', 'body', 'cta'],
    voiceText: 'Welcome to our safety training video. Today we will cover important workplace safety procedures. Remember, safety is everyone\'s responsibility.',
    platform: 'youtube'
};

async function runTest() {
    console.log('='.repeat(60));
    console.log('🧪 END-TO-END TEST: FREE PROVIDER PIPELINE');
    console.log('='.repeat(60));
    console.log(`📁 Output directory: ${VIDEOS_DIR}`);
    console.log(`🎨 Image Provider: ${process.env.IMAGE_PROVIDER || 'pollinations'}`);
    console.log(`🎙️ Voice Provider: Edge-TTS (FREE)`);
    console.log('='.repeat(60));
    console.log('');

    const results = {
        images: { success: false, files: [], time: 0, cost: '$0' },
        voice: { success: false, file: null, time: 0, cost: '$0' },
        total: { time: 0, cost: '$0' }
    };

    const startTotal = Date.now();

    // ============================================
    // TEST 1: Image Generation (Pollinations - FREE)
    // ============================================
    console.log('📸 TEST 1: Image Generation (Pollinations AI - FREE)');
    console.log('-'.repeat(50));

    const startImages = Date.now();
    try {
        const imagePaths = await generateProImages(TEST_CONFIG.prompts, {
            outputDir: VIDEOS_DIR,
            sceneTypes: TEST_CONFIG.sceneTypes,
            topic: TEST_CONFIG.title,
            platform: TEST_CONFIG.platform,
            provider: 'pollinations'
        });

        results.images.time = Date.now() - startImages;
        results.images.files = imagePaths;
        results.images.success = imagePaths.length === TEST_CONFIG.prompts.length;

        console.log(`\n   ✅ Generated ${imagePaths.length}/${TEST_CONFIG.prompts.length} images`);
        console.log(`   ⏱️  Time: ${(results.images.time / 1000).toFixed(1)}s`);
        console.log(`   💰 Cost: $0 (FREE)`);

        // Show file sizes
        for (const imgPath of imagePaths) {
            if (fs.existsSync(imgPath)) {
                const stats = fs.statSync(imgPath);
                console.log(`   📄 ${path.basename(imgPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
            }
        }
    } catch (error) {
        results.images.time = Date.now() - startImages;
        console.error(`\n   ❌ Image generation failed: ${error.message}`);
    }

    console.log('');

    // ============================================
    // TEST 2: Voice Generation (Edge-TTS - FREE)
    // ============================================
    console.log('🎙️ TEST 2: Voice Generation (Edge-TTS - FREE)');
    console.log('-'.repeat(50));

    const startVoice = Date.now();
    try {
        const voiceResult = await generateSmartVoice(TEST_CONFIG.voiceText, VIDEOS_DIR, {
            preferPreset: 'professional_male'
        });

        results.voice.time = Date.now() - startVoice;
        results.voice.success = !!voiceResult;

        if (voiceResult) {
            // Edge-TTS returns base64, let's check if we got data
            const isBase64 = typeof voiceResult === 'string' && voiceResult.length > 100;
            results.voice.file = isBase64 ? 'base64 audio data' : voiceResult;

            console.log(`\n   ✅ Voice generated successfully`);
            console.log(`   ⏱️  Time: ${(results.voice.time / 1000).toFixed(1)}s`);
            console.log(`   💰 Cost: $0 (FREE)`);
            console.log(`   📄 Output: ${isBase64 ? `Base64 audio (${(voiceResult.length / 1024).toFixed(1)} KB)` : voiceResult}`);
        }
    } catch (error) {
        results.voice.time = Date.now() - startVoice;
        console.error(`\n   ❌ Voice generation failed: ${error.message}`);
    }

    console.log('');

    // ============================================
    // SUMMARY
    // ============================================
    results.total.time = Date.now() - startTotal;

    console.log('='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log('');

    console.log('┌─────────────────┬──────────┬───────────┬──────────┐');
    console.log('│ Component       │ Status   │ Time      │ Cost     │');
    console.log('├─────────────────┼──────────┼───────────┼──────────┤');
    console.log(`│ Images (${TEST_CONFIG.prompts.length}x)     │ ${results.images.success ? '✅ PASS' : '❌ FAIL'}  │ ${(results.images.time / 1000).toFixed(1).padStart(6)}s   │ $0.00    │`);
    console.log(`│ Voice           │ ${results.voice.success ? '✅ PASS' : '❌ FAIL'}  │ ${(results.voice.time / 1000).toFixed(1).padStart(6)}s   │ $0.00    │`);
    console.log('├─────────────────┼──────────┼───────────┼──────────┤');
    console.log(`│ TOTAL           │ ${results.images.success && results.voice.success ? '✅ PASS' : '❌ FAIL'}  │ ${(results.total.time / 1000).toFixed(1).padStart(6)}s   │ $0.00    │`);
    console.log('└─────────────────┴──────────┴───────────┴──────────┘');

    console.log('');

    // Cost comparison
    console.log('💰 COST COMPARISON:');
    console.log('-'.repeat(50));
    const paidImageCost = TEST_CONFIG.prompts.length * 0.003;
    const paidVoiceCost = 0.01; // Rough ElevenLabs estimate
    console.log(`   Replicate (paid):    $${paidImageCost.toFixed(3)} for ${TEST_CONFIG.prompts.length} images`);
    console.log(`   ElevenLabs (paid):   $${paidVoiceCost.toFixed(3)} for voice`);
    console.log(`   PAID TOTAL:          $${(paidImageCost + paidVoiceCost).toFixed(3)}`);
    console.log('');
    console.log(`   Pollinations (free): $0.000 for ${TEST_CONFIG.prompts.length} images`);
    console.log(`   Edge-TTS (free):     $0.000 for voice`);
    console.log(`   FREE TOTAL:          $0.000`);
    console.log('');
    console.log(`   💸 SAVINGS: $${(paidImageCost + paidVoiceCost).toFixed(3)} per video`);

    console.log('');
    console.log('='.repeat(60));

    // Return results for programmatic use
    return {
        success: results.images.success && results.voice.success,
        results,
        generatedFiles: results.images.files
    };
}

// Run the test
runTest()
    .then(({ success, generatedFiles }) => {
        if (success) {
            console.log('✅ All tests passed! Free pipeline is working.');
            console.log('');
            console.log('Generated files:');
            generatedFiles.forEach(f => console.log(`  - ${f}`));
        } else {
            console.log('❌ Some tests failed. Check the output above.');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('❌ Test crashed:', err.message);
        process.exit(1);
    });
