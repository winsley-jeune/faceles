/**
 * Auth Routes
 * Authentication and OAuth callbacks
 */
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import authController from '../controllers/authController.js';

const router = Router();

// GET /auth/google - Get Google auth URL
router.get('/google', asyncHandler(authController.getGoogleAuthUrl));

// POST /auth/google/callback - Handle Google OAuth callback
router.post('/google/callback', asyncHandler(authController.handleGoogleCallback));

// GET /auth/facebook - Get Facebook auth URL
router.get('/facebook', asyncHandler(authController.getFacebookAuthUrl));

// POST /auth/facebook/callback - Handle Facebook OAuth callback
router.post('/facebook/callback', asyncHandler(authController.handleFacebookCallback));

// GET /auth/tiktok - Get TikTok auth URL
router.get('/tiktok', asyncHandler(authController.getTikTokAuthUrl));

// POST /auth/tiktok/callback - Handle TikTok OAuth callback
router.post('/tiktok/callback', asyncHandler(authController.handleTikTokCallback));

// GET /auth/me - Get current user (protected)
router.get('/me', requireAuth, asyncHandler(authController.getCurrentUser));

// POST /auth/logout - Logout
router.post('/logout', asyncHandler(authController.logout));

// GET /auth/verify - Verify token validity
router.get('/verify', asyncHandler(authController.verifyToken));

export default router;
