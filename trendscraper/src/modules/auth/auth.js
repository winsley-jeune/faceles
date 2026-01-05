import crypto from 'crypto';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { addToBlacklist } from './tokenBlacklist.js';
import { log as logAuthEvent, EVENTS as AUTH_EVENTS } from './auditLogger.js';
import userRepository from '../../database/repositories/userRepository.js';
import subscriptionRepository from '../../database/repositories/subscriptionRepository.js';
import oauthStateRepository from '../../database/repositories/oauthStateRepository.js';
import { isDatabaseAvailable } from '../../database/db.js';
import { logger } from '../../utils/index.js';

// ============================================
// JWT CONFIGURATION
// ============================================

/**
 * Get JWT secret from environment
 * MUST be set in production for security
 */
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET environment variable must be set');
    }

    if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters for security');
    }

    return secret;
};

const JWT_SECRET = getJwtSecret();
const JWT_ACCESS_EXPIRY = '7d'; // 7 days
const JWT_REFRESH_EXPIRY = '30d'; // 30 days

/**
 * Generate JWT access token
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
export const generateToken = (userId) => {
    return jwt.sign(
        { userId, type: 'access' },
        JWT_SECRET,
        { expiresIn: JWT_ACCESS_EXPIRY, issuer: 'viral-shorts-api' }
    );
};

/**
 * Generate JWT refresh token
 * @param {string} userId - User ID
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRY, issuer: 'viral-shorts-api' }
    );
};

/**
 * Verify JWT token and return user ID
 * @param {string} token - JWT token
 * @returns {string|null} User ID if valid, null if invalid
 */
export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'viral-shorts-api' });

        if (decoded.type !== 'access') {
            logger.warn('Token type mismatch - expected access token');
            return null;
        }

        return decoded.userId;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.debug('Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('Invalid token signature');
        } else {
            logger.error(`Token verification failed: ${error.message}`);
        }
        return null;
    }
};

/**
 * Verify refresh token and return user ID
 * @param {string} token - JWT refresh token
 * @returns {string|null} User ID if valid, null if invalid
 */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'viral-shorts-api' });

        if (decoded.type !== 'refresh') {
            logger.warn('Token type mismatch - expected refresh token');
            return null;
        }

        return decoded.userId;
    } catch (error) {
        logger.error(`Refresh token verification failed: ${error.message}`);
        return null;
    }
};

// ============================================
// USER AUTHENTICATION
// ============================================

/**
 * Find or create user from OAuth data using PostgreSQL database
 */
const findOrCreateUserInDatabase = async (provider, profile) => {
    // Ensure database is available
    if (!isDatabaseAvailable()) {
        logger.error('Database not available - cannot authenticate user');
        throw new Error('Database connection required for authentication');
    }

    try {
        // Use userRepository to find or create user from OAuth
        const user = await userRepository.findOrCreateFromOAuth(provider, profile);

        logger.info(`User authenticated: ${user.email} via ${provider}`);

        // Check if user has a subscription
        const subscription = await subscriptionRepository.findByUserId(user.id);

        // If no subscription, create a FREE plan
        if (!subscription) {
            await subscriptionRepository.upsert(user.id, {
                planId: 'free',
                status: 'active',
                demoMode: false
            });
            logger.info(`Created free subscription for new user: ${user.email}`);
        }

        return user;
    } catch (error) {
        logger.error(`Failed to authenticate user via ${provider}: ${error.message}`);
        throw error;
    }
};

/**
 * Get user by ID from database
 */
export const getUserById = async (userId) => {
    if (!isDatabaseAvailable()) {
        logger.error('Database not available - cannot get user');
        return null;
    }

    try {
        return await userRepository.findById(userId);
    } catch (error) {
        logger.error(`Failed to get user by ID: ${error.message}`);
        return null;
    }
};

// ============================================
// GOOGLE OAUTH
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/auth/callback/google';

export const getGoogleAuthUrl = async () => {
    const scope = [
        'openid',
        'email',
        'profile'
    ].join(' ');

    const state = crypto.randomBytes(32).toString('hex');
    await oauthStateRepository.store(state, 'google');

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope,
        access_type: 'offline',
        prompt: 'consent',
        state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

export const handleGoogleCallback = async (code, state) => {
    // Validate state for CSRF protection
    if (state) {
        const stateData = await oauthStateRepository.consume(state);
        if (!stateData || stateData.provider !== 'google') {
            throw new Error('Invalid OAuth state - possible CSRF attack');
        }
    } else {
        throw new Error('Missing OAuth state parameter');
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_REDIRECT_URI,
        }),
    });

    if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || 'Google auth failed');
    }

    const tokens = await tokenRes.json();

    if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
    }

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = await userRes.json();

    const user = await findOrCreateUserInDatabase('google', {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
    });

    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logAuthEvent(AUTH_EVENTS.LOGIN_SUCCESS, { userId: user.id, provider: 'google' });

    return {
        token: accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
        },
    };
};

// ============================================
// FACEBOOK OAUTH
// ============================================

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5174/auth/callback/facebook';

export const getFacebookAuthUrl = async () => {
    const scope = 'email,public_profile';
    const state = crypto.randomBytes(32).toString('hex');
    await oauthStateRepository.store(state, 'facebook');

    const params = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        redirect_uri: FACEBOOK_REDIRECT_URI,
        scope,
        response_type: 'code',
        state,
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
};

export const handleFacebookCallback = async (code, state) => {
    // Validate state for CSRF protection
    if (state) {
        const stateData = await oauthStateRepository.consume(state);
        if (!stateData || stateData.provider !== 'facebook') {
            throw new Error('Invalid OAuth state - possible CSRF attack');
        }
    } else {
        throw new Error('Missing OAuth state parameter');
    }

    // Exchange code for token
    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: FACEBOOK_APP_ID,
            client_secret: FACEBOOK_APP_SECRET,
            code,
            redirect_uri: FACEBOOK_REDIRECT_URI,
        }),
    });

    if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.error_description || 'Facebook auth failed');
    }

    const tokens = await tokenRes.json();

    if (tokens.error) {
        throw new Error(tokens.error.message || tokens.error_description || 'Facebook auth failed');
    }

    // Get user info
    const userRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokens.access_token}`
    );

    const profile = await userRes.json();

    const user = await findOrCreateUserInDatabase('facebook', {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.picture?.data?.url,
        accessToken: tokens.access_token,
    });

    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logAuthEvent(AUTH_EVENTS.LOGIN_SUCCESS, { userId: user.id, provider: 'facebook' });

    return {
        token: accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
        },
    };
};

// ============================================
// TIKTOK OAUTH
// ============================================

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_LOGIN_REDIRECT_URI || 'http://localhost:5174/auth/callback/tiktok';

export const getTikTokAuthUrl = async () => {
    // Generate PKCE
    const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let codeVerifier = '';
    const randomBytes = crypto.randomBytes(64);
    for (let i = 0; i < 64; i++) {
        codeVerifier += allowedChars[randomBytes[i] % allowedChars.length];
    }

    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    const scope = 'user.info.basic';
    const state = crypto.randomBytes(32).toString('hex');

    // Store state with code verifier for PKCE
    await oauthStateRepository.store(state, 'tiktok', { codeVerifier });

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
        `?client_key=${TIKTOK_CLIENT_KEY}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(TIKTOK_REDIRECT_URI)}` +
        `&state=${state}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`;

    return authUrl;
};

export const handleTikTokCallback = async (code, state) => {
    // Validate state and get codeVerifier for PKCE
    let codeVerifier = null;

    if (state) {
        const stateData = await oauthStateRepository.consume(state);
        if (!stateData || stateData.provider !== 'tiktok') {
            throw new Error('Invalid OAuth state - possible CSRF attack');
        }
        codeVerifier = stateData.codeVerifier;
    } else {
        throw new Error('Missing OAuth state parameter');
    }

    if (!codeVerifier) {
        throw new Error('No code verifier found. Please restart TikTok login.');
    }

    // Exchange code for token
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_key: TIKTOK_CLIENT_KEY,
            client_secret: TIKTOK_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: TIKTOK_REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
    });

    if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || 'TikTok auth failed');
    }

    const tokens = await tokenRes.json();

    if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
    }

    // Get user info
    const userRes = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
        {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
    );

    const userData = await userRes.json();
    const profile = userData.data?.user || {};

    const user = await findOrCreateUserInDatabase('tiktok', {
        id: tokens.open_id,
        email: null, // TikTok doesn't provide email in basic scope
        name: profile.display_name || profile.username,
        avatar: profile.avatar_url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
    });

    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logAuthEvent(AUTH_EVENTS.LOGIN_SUCCESS, { userId: user.id, provider: 'tiktok' });

    return {
        token: accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
        },
    };
};

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - JWT refresh token
 * @returns {object} New access token and refresh token
 */
export const refreshAccessToken = async (refreshToken) => {
    const userId = verifyRefreshToken(refreshToken);

    if (!userId) {
        throw new Error('Invalid refresh token');
    }

    const user = await getUserById(userId);

    if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
    }

    const newAccessToken = generateToken(userId);
    const newRefreshToken = generateRefreshToken(userId);

    logAuthEvent(AUTH_EVENTS.TOKEN_REFRESHED, { userId });

    return {
        token: newAccessToken,
        refreshToken: newRefreshToken,
    };
};

/**
 * Logout user - blacklist their token
 * @param {string} token - JWT token to invalidate
 * @param {string} userId - User ID (optional, for logging)
 */
export const logout = (token, userId = null) => {
    if (token) {
        addToBlacklist(token, 'logout');
        logAuthEvent(AUTH_EVENTS.LOGOUT, { userId });
    }
    return { success: true, message: 'Logged out successfully' };
};

/**
 * Revoke a token (for security events)
 * @param {string} token - JWT token to revoke
 * @param {string} reason - Reason for revocation
 */
export const revokeToken = (token, reason = 'revoked') => {
    if (token) {
        addToBlacklist(token, reason);
        logAuthEvent(AUTH_EVENTS.TOKEN_REVOKED, { reason });
    }
};

export default {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    getUserById,
    getGoogleAuthUrl,
    handleGoogleCallback,
    getFacebookAuthUrl,
    handleFacebookCallback,
    getTikTokAuthUrl,
    handleTikTokCallback,
    refreshAccessToken,
    logout,
    revokeToken,
};
