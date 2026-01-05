/**
 * Auth Controller
 * Authentication and OAuth callbacks for dashboard login
 * Separate from platform connections (YouTube, TikTok uploads)
 */
import auth from '../modules/auth/auth.js';

const authController = {
    /**
     * Get Google OAuth URL for dashboard login
     */
    getGoogleAuthUrl: async (req, res) => {
        try {
            const authUrl = await auth.getGoogleAuthUrl();
            res.json({ authUrl });
        } catch (error) {
            console.error('Failed to get Google auth URL:', error);
            res.status(500).json({ error: 'Failed to generate login URL' });
        }
    },

    /**
     * Handle Google OAuth callback
     */
    handleGoogleCallback: async (req, res) => {
        const { code, state } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }

        try {
            const result = await auth.handleGoogleCallback(code, state || null);
            res.json(result);
        } catch (error) {
            console.error('Google auth callback failed:', error);
            res.status(401).json({ error: error.message || 'Authentication failed' });
        }
    },

    /**
     * Get Facebook OAuth URL for dashboard login
     */
    getFacebookAuthUrl: async (req, res) => {
        try {
            const authUrl = await auth.getFacebookAuthUrl();
            res.json({ authUrl });
        } catch (error) {
            console.error('Failed to get Facebook auth URL:', error);
            res.status(500).json({ error: 'Failed to generate login URL' });
        }
    },

    /**
     * Handle Facebook OAuth callback
     */
    handleFacebookCallback: async (req, res) => {
        const { code, state } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }

        try {
            const result = await auth.handleFacebookCallback(code, state || null);
            res.json(result);
        } catch (error) {
            console.error('Facebook auth callback failed:', error);
            res.status(401).json({ error: error.message || 'Authentication failed' });
        }
    },

    /**
     * Get TikTok OAuth URL for dashboard login
     */
    getTikTokAuthUrl: async (req, res) => {
        try {
            const authUrl = await auth.getTikTokAuthUrl();
            res.json({ authUrl });
        } catch (error) {
            console.error('Failed to get TikTok auth URL:', error);
            res.status(500).json({ error: 'Failed to generate login URL' });
        }
    },

    /**
     * Handle TikTok OAuth callback
     */
    handleTikTokCallback: async (req, res) => {
        const { code, state } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }

        try {
            const result = await auth.handleTikTokCallback(code, state || null);
            res.json(result);
        } catch (error) {
            console.error('TikTok auth callback failed:', error);
            res.status(401).json({ error: error.message || 'Authentication failed' });
        }
    },

    /**
     * Get current authenticated user
     * Requires requireAuth middleware
     */
    getCurrentUser: async (req, res) => {
        if (!req.user) {
            return res.status(401).json({
                authenticated: false,
                error: 'Not authenticated'
            });
        }

        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                avatar: req.user.avatar,
                providers: Object.keys(req.user.providers || {}),
                createdAt: req.user.createdAt,
                lastLogin: req.user.lastLogin
            }
        });
    },

    /**
     * Logout - invalidate session
     */
    logout: async (req, res) => {
        // In a stateless JWT system, logout is handled client-side by removing the token
        // For added security, we could implement a token blacklist here
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    },

    /**
     * Verify token validity
     */
    verifyToken: async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false, error: 'No token provided' });
        }

        const token = authHeader.slice(7);
        const userId = auth.verifyToken(token);

        if (!userId) {
            return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
        }

        const user = await auth.getUserById(userId);
        if (!user) {
            return res.status(401).json({ valid: false, error: 'User not found' });
        }

        res.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar
            }
        });
    }
};

export default authController;
