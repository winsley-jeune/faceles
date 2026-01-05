/**
 * Express Application Setup
 * Configures middleware chain and mounts all routes
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/index.js';
import { mountRoutes } from './routes/index.js';
import env from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===========================================
// RATE LIMITING
// ===========================================

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    skip: (req) => req.path === '/health' // Don't rate limit health checks
});

// Stricter rate limiter for auth endpoints - 10 requests per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: 'Too many authentication attempts',
        message: 'Please wait before trying again.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Video generation rate limiter - 20 per hour (expensive operations)
const videoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        error: 'Video generation rate limit exceeded',
        message: 'You can generate up to 20 videos per hour.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ===========================================
// MIDDLEWARE CHAIN
// ===========================================

// CORS - Allow cross-origin requests
app.use(cors());

// Apply general rate limiter to all API routes
app.use('/smart', apiLimiter);
app.use('/analytics', apiLimiter);
app.use('/variations', apiLimiter);
app.use('/clone', apiLimiter);
app.use('/virals', apiLimiter);
app.use('/brand', apiLimiter);

// Apply auth rate limiter to OAuth endpoints
app.use('/youtube-api/auth', authLimiter);
app.use('/tiktok-api/auth', authLimiter);
app.use('/facebook-api/auth', authLimiter);
app.use('/instagram-api/auth', authLimiter);

// Apply video generation rate limiter
app.use('/smart/generate', videoLimiter);
app.use('/batch', videoLimiter);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files - serve videos directory
app.use('/videos', express.static(env.VIDEOS_DIR));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            if (req.method !== 'OPTIONS') {
                console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            }
        });
        next();
    });
}

// ===========================================
// HEALTH CHECK
// ===========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ===========================================
// MOUNT ALL ROUTES
// ===========================================

mountRoutes(app);

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        availableRoutes: [
            '/health',
            '/smart/*',
            '/youtube-api/*',
            '/tiktok-api/*',
            '/facebook-api/*',
            '/instagram-api/*',
            '/analytics/*',
            '/variations/*',
            '/clone/*',
            '/virals/*',
            '/upload/*',
            '/brand/*',
            '/training/*',
            '/batch/*',
            '/exploration/*'
        ]
    });
});

// Global error handler
app.use(errorHandler);

export default app;
