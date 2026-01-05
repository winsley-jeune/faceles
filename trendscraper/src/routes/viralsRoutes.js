/**
 * Virals Routes
 * Viral content discovery and analysis
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import viralsController from '../controllers/viralsController.js';

const router = Router();

// GET /virals/tiktok - Get TikTok viral content
router.get('/tiktok', asyncHandler(viralsController.getTikTok));

// GET /virals/tiktok/sounds - Get TikTok trending sounds
router.get('/tiktok/sounds', asyncHandler(viralsController.getTikTokSounds));

// GET /virals/youtube - Get YouTube viral content
router.get('/youtube', asyncHandler(viralsController.getYouTube));

// GET /virals/instagram - Get Instagram viral content
router.get('/instagram', asyncHandler(viralsController.getInstagram));

// GET /virals/facebook - Get Facebook viral content
router.get('/facebook', asyncHandler(viralsController.getFacebook));

// POST /virals/clone - Clone viral content concept
router.post('/clone', asyncHandler(viralsController.clone));

// POST /virals/discover - Discover viral content
router.post('/discover', asyncHandler(viralsController.discover));

// POST /virals/discover-and-create - Discover and create video
router.post('/discover-and-create', asyncHandler(viralsController.discoverAndCreate));

// GET /virals/topics - Get viral topics
router.get('/topics', asyncHandler(viralsController.getTopics));

export default router;
