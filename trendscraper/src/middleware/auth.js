/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */
import auth from '../modules/auth/auth.js';
import { ApiError } from './errorHandler.js';
import env from '../config/env.js';
import { isBlacklisted } from '../modules/auth/tokenBlacklist.js';
import { log as logAuthEvent, EVENTS as AUTH_EVENTS } from '../modules/auth/auditLogger.js';

/**
 * Require authentication middleware
 * Verifies Bearer token and attaches user to request
 * Authentication is ALWAYS required - no dev mode bypass
 */
export const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logAuthEvent(AUTH_EVENTS.AUTH_REQUIRED, { ip: req.ip, path: req.path });
        return next(ApiError.unauthorized('Authentication required'));
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (revoked/logged out)
    if (await isBlacklisted(token)) {
        logAuthEvent(AUTH_EVENTS.TOKEN_INVALID, { ip: req.ip, reason: 'blacklisted' });
        return next(ApiError.unauthorized('Authentication required'));
    }

    const userId = auth.verifyToken(token);

    if (!userId) {
        logAuthEvent(AUTH_EVENTS.TOKEN_INVALID, { ip: req.ip, reason: 'verification_failed' });
        return next(ApiError.unauthorized('Authentication required'));
    }

    req.userId = userId;
    req.user = await auth.getUserById(userId);

    if (!req.user) {
        logAuthEvent(AUTH_EVENTS.USER_NOT_FOUND, { userId, ip: req.ip });
        return next(ApiError.unauthorized('Authentication required'));
    }

    next();
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const userId = auth.verifyToken(token);

        if (userId) {
            req.userId = userId;
            req.user = await auth.getUserById(userId);
        }
    }

    next();
};

/**
 * Check if a specific platform is connected
 * Use after requireAuth middleware
 */
export const requirePlatform = (platform) => {
    return (req, res, next) => {
        // This would check platform-specific token status
        // Implementation depends on your token storage strategy
        next();
    };
};

export default {
    requireAuth,
    optionalAuth,
    requirePlatform
};
