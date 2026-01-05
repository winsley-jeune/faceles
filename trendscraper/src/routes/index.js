/**
 * Routes Index
 * Aggregates all route modules and mounts them to the Express app
 */
import { Router } from 'express';

// Import all route modules
import smartRoutes from './smartRoutes.js';
import youtubeRoutes from './youtubeRoutes.js';
import facebookRoutes from './facebookRoutes.js';
import facebookSmartRoutes from './facebookSmartRoutes.js';
import instagramRoutes from './instagramRoutes.js';
import instagramSmartRoutes from './instagramSmartRoutes.js';
import tiktokRoutes from './tiktokRoutes.js';
import tiktokSmartRoutes from './tiktokSmartRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import variationsRoutes from './variationsRoutes.js';
import cloneRoutes from './cloneRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import viralsRoutes from './viralsRoutes.js';
import brandRoutes from './brandRoutes.js';
import trainingRoutes from './trainingRoutes.js';
import batchRoutes from './batchRoutes.js';
import explorationRoutes from './explorationRoutes.js';
import videoRoutes from './videoRoutes.js';
import socialRoutes from './socialRoutes.js';
import authRoutes from './authRoutes.js';
import productRoutes from './productRoutes.js';
import avatarRoutes from './avatarRoutes.js';
import abTestingRoutes from './abTestingRoutes.js';
import monetizationRoutes from './monetizationRoutes.js';
import promoRoutes from './promoRoutes.js';
import jobRoutes from './jobRoutes.js';

// Import auth middleware
import { optionalAuth } from '../middleware/auth.js';

/**
 * Mount all routes to the Express app
 * @param {Express} app - Express application instance
 */
export const mountRoutes = (app) => {
    // Auth routes (public - no auth required)
    app.use('/auth', authRoutes);

    // Apply optional auth to all subsequent routes
    // This attaches user info to requests if a valid token is present
    // but doesn't block requests without tokens (for backwards compatibility)
    app.use(optionalAuth);

    // Smart generation routes
    app.use('/smart', smartRoutes);

    // Platform API routes (these handle their own platform-specific auth)
    app.use('/youtube-api', youtubeRoutes);
    app.use('/facebook-api', facebookRoutes);
    app.use('/instagram-api', instagramRoutes);
    app.use('/tiktok-api', tiktokRoutes);

    // Platform-specific smart generation
    app.use('/facebook/smart', facebookSmartRoutes);
    app.use('/instagram/smart', instagramSmartRoutes);
    app.use('/tiktok/smart', tiktokSmartRoutes);

    // Analytics and intelligence
    app.use('/analytics', analyticsRoutes);
    app.use('/ab-testing', abTestingRoutes);
    app.use('/variations', variationsRoutes);
    app.use('/clone', cloneRoutes);
    app.use('/virals', viralsRoutes);
    app.use('/exploration', explorationRoutes);

    // Content management
    app.use('/upload', uploadRoutes);
    app.use('/brand', brandRoutes);
    app.use('/promo', promoRoutes);
    app.use('/training', trainingRoutes);
    app.use('/batch', batchRoutes);
    app.use('/product', productRoutes);
    app.use('/avatar', avatarRoutes);

    // Video and social
    app.use('/videos', videoRoutes);
    app.use('/social', socialRoutes);

    // Monetization
    app.use('/monetization', monetizationRoutes);

    // Job Queue System
    app.use('/jobs', jobRoutes);

    // Legacy routes (mounted at root) - for backwards compatibility
    app.use('/', videoRoutes);
};

export default { mountRoutes };
