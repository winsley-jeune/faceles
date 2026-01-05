/**
 * Video Routes
 * Video listing, creation, and management
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import videoController from '../controllers/videoController.js';

const router = Router();

// GET /videos/list - List all videos with metadata
router.get('/list', asyncHandler(videoController.list));

// POST /create-full-video - Create full video with all steps
router.post('/create-full-video', asyncHandler(videoController.createFullVideo));

// POST /create-and-post - Create video and auto-post
router.post('/create-and-post', asyncHandler(videoController.createAndPost));

export default router;
