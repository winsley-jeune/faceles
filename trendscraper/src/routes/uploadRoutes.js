/**
 * Upload Routes
 * Direct upload to platforms
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import uploadController from '../controllers/uploadController.js';

const router = Router();

// GET /upload/status - Get upload status for all platforms
router.get('/status', asyncHandler(uploadController.getStatus));

// POST /upload/:platform - Upload to specific platform
router.post('/:platform', asyncHandler(uploadController.uploadToPlatform));

// POST /upload/all - Upload to all platforms
router.post('/all', asyncHandler(uploadController.uploadToAll));

export default router;
