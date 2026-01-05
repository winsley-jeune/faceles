/**
 * Product Routes
 * Product video generation
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import productController from '../controllers/productController.js';

const router = Router();

// Apply authentication to all product routes
router.use(requireAuth);

// POST /product/upload-media - Upload product media (images/videos)
router.post('/upload-media', productController.uploadMiddleware, asyncHandler(productController.uploadMedia));

// POST /product/generate-video - Generate product promotional video
router.post('/generate-video', asyncHandler(productController.generateVideo));

export default router;
