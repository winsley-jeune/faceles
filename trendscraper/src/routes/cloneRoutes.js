/**
 * Clone Routes
 * Viral content cloning and competitor analysis
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import cloneController from '../controllers/cloneController.js';

const router = Router();

// GET /clone/tiktok - Analyze TikTok viral content
router.get('/tiktok', asyncHandler(cloneController.getTikTokVirals));

// GET /clone/tiktok/sounds - Get trending TikTok sounds
router.get('/tiktok/sounds', asyncHandler(cloneController.getTikTokSounds));

// GET /clone/youtube - Analyze YouTube viral content
router.get('/youtube', asyncHandler(cloneController.getYouTubeVirals));

// POST /clone/generate - Generate content based on clone
router.post('/generate', asyncHandler(cloneController.generate));

// POST /clone/discover - Discover viral content
router.post('/discover', asyncHandler(cloneController.discover));

// POST /clone/create-video - Create video from cloned concept
router.post('/create-video', asyncHandler(cloneController.createVideo));

export default router;
