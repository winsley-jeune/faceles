/**
 * Avatar Controller
 * AI Avatar presenter generation using MuseTalk/Sieve
 */
import fs from 'fs';
import path from 'path';
import multer from 'multer';

import avatarPresenter from '../modules/avatar_presenter.js';
import env from '../config/env.js';

const VIDEOS_DIR = env.VIDEOS_DIR;

// Multer config for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(VIDEOS_DIR, 'avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${Date.now()}${ext}`);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/webp',
            'video/mp4', 'video/quicktime', 'video/webm'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images (JPG, PNG, WebP) and videos (MP4, MOV, WebM) are allowed'));
        }
    }
});

const avatarController = {
    // Multer middleware
    uploadMiddleware: avatarUpload.single('file'),

    /**
     * Check API status
     */
    checkStatus: async (req, res) => {
        const status = await avatarPresenter.checkAvatarAPIStatus();
        res.json(status);
    },

    /**
     * Get available stock avatars
     */
    getStockAvatars: async (req, res) => {
        const avatars = avatarPresenter.getStockAvatars();
        res.json({
            success: true,
            avatars
        });
    },

    /**
     * Get avatar placement modes
     */
    getAvatarModes: async (req, res) => {
        const modes = avatarPresenter.getAvatarModes();
        res.json({
            success: true,
            modes
        });
    },

    /**
     * Upload custom avatar (image or video)
     */
    uploadAvatar: async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const isImage = req.file.mimetype.startsWith('image/');
        console.log(`📤 Avatar uploaded: ${req.file.filename} (${isImage ? 'image' : 'video'})`);

        res.json({
            success: true,
            path: req.file.path,
            filename: req.file.filename,
            type: isImage ? 'image' : 'video',
            size: req.file.size
        });
    },

    /**
     * Generate avatar presenter video
     */
    generateAvatarVideo: async (req, res) => {
        const {
            audioPath,
            avatarId,
            customAvatarPath,
            highQuality
        } = req.body;

        if (!audioPath) {
            return res.status(400).json({ error: 'Audio path is required' });
        }

        if (!avatarPresenter.isAvatarEnabled()) {
            return res.status(503).json({
                error: 'AI Avatar feature not available',
                message: 'SIEVE_API_KEY is not configured. Get your API key at sievedata.com'
            });
        }

        try {
            console.log('🎭 Starting avatar video generation...');

            const result = await avatarPresenter.generateAvatarVideo({
                audioPath,
                avatarId: avatarId || 'professional_female',
                customAvatarPath,
                outputDir: VIDEOS_DIR,
                highQuality: highQuality || false
            });

            res.json({
                success: true,
                ...result,
                message: 'Avatar video generated successfully!'
            });

        } catch (error) {
            console.error('❌ Avatar generation failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Generate avatar from static image
     */
    generateImageToAvatar: async (req, res) => {
        const {
            imagePath,
            audioPath,
            highQuality
        } = req.body;

        if (!imagePath || !audioPath) {
            return res.status(400).json({
                error: 'Both imagePath and audioPath are required'
            });
        }

        if (!avatarPresenter.isAvatarEnabled()) {
            return res.status(503).json({
                error: 'AI Avatar feature not available',
                message: 'SIEVE_API_KEY is not configured'
            });
        }

        try {
            console.log('🎭 Converting image to talking avatar...');

            const result = await avatarPresenter.generateImageToAvatar({
                imagePath,
                audioPath,
                outputDir: VIDEOS_DIR,
                highQuality: highQuality !== false // Default to true
            });

            res.json({
                success: true,
                ...result,
                message: 'Image-to-avatar conversion successful!'
            });

        } catch (error) {
            console.error('❌ Image-to-avatar failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Preview avatar with sample audio
     */
    previewAvatar: async (req, res) => {
        const { avatarId } = req.params;

        const avatar = avatarPresenter.getAvatarById(avatarId);
        if (!avatar) {
            return res.status(404).json({ error: 'Avatar not found' });
        }

        res.json({
            success: true,
            avatar,
            previewUrl: avatar.videoUrl
        });
    }
};

export default avatarController;
