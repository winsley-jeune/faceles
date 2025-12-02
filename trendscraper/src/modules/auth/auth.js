import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';

const USERS_PATH = '/app/data/users.json';
const SESSIONS_PATH = '/app/data/sessions.json';

// JWT secret - in production, use a proper secret management
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Load users from file
 */
const loadUsers = () => {
    if (fs.existsSync(USERS_PATH)) {
        return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    }
    return [];
};

/**
 * Save users to file
 */
const saveUsers = (users) => {
    const dir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
};

/**
 * Load sessions from file
 */
const loadSessions = () => {
    if (fs.existsSync(SESSIONS_PATH)) {
        return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8'));
    }
    return {};
};

/**
 * Save sessions to file
 */
const saveSessions = (sessions) => {
    const dir = path.dirname(SESSIONS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
};

/**
 * Generate a simple JWT-like token
 */
const generateToken = (userId) => {
    const payload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(payloadBase64)
        .digest('base64url');
    return `${payloadBase64}.${signature}`;
};

/**
 * Verify token and return user ID
 */
export const verifyToken = (token) => {
    try {
        const [payloadBase64, signature] = token.split('.');
        const expectedSignature = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(payloadBase64)
            .digest('base64url');

        if (signature !== expectedSignature) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

        if (payload.exp < Date.now()) {
            return null;
        }

        return payload.userId;
    } catch {
        return null;
    }
};

/**
 * Find or create user from OAuth data
 */
const findOrCreateUser = (provider, profile) => {
    const users = loadUsers();

    // Find existing user by provider ID
    let user = users.find(u =>
        u.providers?.[provider]?.id === profile.id
    );

    // Or find by email
    if (!user && profile.email) {
        user = users.find(u => u.email === profile.email);
    }

    if (user) {
        // Update provider info
        user.providers = user.providers || {};
        user.providers[provider] = {
            id: profile.id,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
        };
        user.lastLogin = new Date().toISOString();
        if (profile.avatar && !user.avatar) {
            user.avatar = profile.avatar;
        }
        saveUsers(users);
        return user;
    }

    // Create new user
    const newUser = {
        id: crypto.randomUUID(),
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        providers: {
            [provider]: {
                id: profile.id,
                accessToken: profile.accessToken,
                refreshToken: profile.refreshToken,
            }
        },
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);
    return newUser;
};

/**
 * Get user by ID
 */
export const getUserById = (userId) => {
    const users = loadUsers();
    return users.find(u => u.id === userId);
};

// ============ GOOGLE OAuth ============
// Use YOUTUBE credentials for Google login if GOOGLE_ not set (same Google project)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/auth/callback/google';

export const getGoogleAuthUrl = () => {
    const scope = [
        'openid',
        'email',
        'profile'
    ].join(' ');

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope,
        access_type: 'offline',
        prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

export const handleGoogleCallback = async (code) => {
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

    const tokens = await tokenRes.json();

    if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
    }

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = await userRes.json();

    const user = findOrCreateUser('google', {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
    });

    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
        },
    };
};

// ============ FACEBOOK OAuth ============
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5174/auth/callback/facebook';

export const getFacebookAuthUrl = () => {
    const scope = 'email,public_profile';

    const params = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        redirect_uri: FACEBOOK_REDIRECT_URI,
        scope,
        response_type: 'code',
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
};

export const handleFacebookCallback = async (code) => {
    // Exchange code for token
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${FACEBOOK_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(FACEBOOK_REDIRECT_URI)}&` +
        `client_secret=${FACEBOOK_APP_SECRET}&` +
        `code=${code}`
    );

    const tokens = await tokenRes.json();

    if (tokens.error) {
        throw new Error(tokens.error.message || 'Facebook auth failed');
    }

    // Get user info
    const userRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokens.access_token}`
    );

    const profile = await userRes.json();

    const user = findOrCreateUser('facebook', {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.picture?.data?.url,
        accessToken: tokens.access_token,
    });

    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
        },
    };
};

// ============ TIKTOK OAuth ============
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_LOGIN_REDIRECT_URI || 'http://localhost:5174/auth/callback/tiktok';

// Store code verifier for PKCE
let tiktokCodeVerifier = null;

export const getTikTokAuthUrl = () => {
    // Generate PKCE
    const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let codeVerifier = '';
    const randomBytes = crypto.randomBytes(64);
    for (let i = 0; i < 64; i++) {
        codeVerifier += allowedChars[randomBytes[i] % allowedChars.length];
    }
    tiktokCodeVerifier = codeVerifier;

    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('hex');

    const scope = 'user.info.basic';
    const state = crypto.randomBytes(16).toString('hex');

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

export const handleTikTokCallback = async (code) => {
    if (!tiktokCodeVerifier) {
        throw new Error('No code verifier. Please restart login.');
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
            code_verifier: tiktokCodeVerifier,
        }),
    });

    tiktokCodeVerifier = null;
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

    const user = findOrCreateUser('tiktok', {
        id: tokens.open_id,
        email: null, // TikTok doesn't provide email in basic scope
        name: profile.display_name || profile.username,
        avatar: profile.avatar_url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
    });

    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
        },
    };
};

export default {
    verifyToken,
    getUserById,
    getGoogleAuthUrl,
    handleGoogleCallback,
    getFacebookAuthUrl,
    handleFacebookCallback,
    getTikTokAuthUrl,
    handleTikTokCallback,
};
