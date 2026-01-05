/**
 * Avatar Routes
 * AI Avatar presenter generation
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import avatarController from '../controllers/avatarController.js';

const router = Router();

// GET /avatar/status - Check Sieve API status
router.get('/status', asyncHandler(avatarController.checkStatus));

// GET /avatar/stock - Get available stock avatars
router.get('/stock', asyncHandler(avatarController.getStockAvatars));

// GET /avatar/modes - Get avatar placement modes
router.get('/modes', asyncHandler(avatarController.getAvatarModes));

// GET /avatar/preview/:avatarId - Preview specific avatar
router.get('/preview/:avatarId', asyncHandler(avatarController.previewAvatar));

// POST /avatar/upload - Upload custom avatar (image or video)
router.post('/upload', avatarController.uploadMiddleware, asyncHandler(avatarController.uploadAvatar));

// POST /avatar/generate - Generate avatar video from audio
router.post('/generate', asyncHandler(avatarController.generateAvatarVideo));

// POST /avatar/image-to-avatar - Convert static image to talking avatar
router.post('/image-to-avatar', asyncHandler(avatarController.generateImageToAvatar));

export default router;
