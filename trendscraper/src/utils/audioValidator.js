/**
 * Audio Validator Utility
 * Validates audio files and extracts duration information
 */
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import logger from './logger.js';

const execFilePromise = promisify(execFile);

/**
 * Get audio duration from base64 encoded audio
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {string} tmpDir - Directory for temporary file
 * @returns {Promise<number>} Duration in milliseconds
 */
export const getAudioDuration = async (audioBase64, tmpDir) => {
    const tmpPath = path.join(tmpDir, `audio_validate_${Date.now()}.mp3`);

    try {
        // Write base64 to temp file
        const audioBuffer = Buffer.from(audioBase64, 'base64');

        if (audioBuffer.length === 0) {
            throw new Error('Audio buffer is empty');
        }

        fs.writeFileSync(tmpPath, audioBuffer);

        // Use ffprobe to get duration
        const { stdout } = await execFilePromise('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            tmpPath
        ]);

        const durationSeconds = parseFloat(stdout.trim());

        if (!isFinite(durationSeconds) || durationSeconds <= 0) {
            throw new Error(`Invalid audio duration: ${durationSeconds}`);
        }

        return durationSeconds * 1000; // Return milliseconds
    } catch (error) {
        logger.error('Failed to get audio duration', { error: error.message });
        throw error;
    } finally {
        // Cleanup temp file
        try {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        } catch (cleanupError) {
            logger.warn('Failed to cleanup temp audio file', { path: tmpPath });
        }
    }
};

/**
 * Validate that audio base64 is properly formatted
 * @param {string} audioBase64 - Base64 encoded audio
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateAudioBase64 = (audioBase64) => {
    if (!audioBase64 || typeof audioBase64 !== 'string') {
        return { valid: false, error: 'audioBase64 must be a non-empty string' };
    }

    try {
        const buffer = Buffer.from(audioBase64, 'base64');

        if (buffer.length === 0) {
            return { valid: false, error: 'audioBase64 decodes to empty buffer' };
        }

        // Check for common audio file signatures
        const header = buffer.slice(0, 4).toString('hex').toUpperCase();

        // MP3: FF FB, FF FA, FF F3, or ID3 tag
        const isMP3 = header.startsWith('FFFB') ||
                      header.startsWith('FFFA') ||
                      header.startsWith('FFF3') ||
                      header.startsWith('4944'); // ID3

        // WAV: RIFF
        const isWAV = header.startsWith('52494646'); // RIFF

        // OGG: OggS
        const isOGG = header.startsWith('4F676753'); // OggS

        if (!isMP3 && !isWAV && !isOGG) {
            return {
                valid: true,
                warning: `Unknown audio format (header: ${header}). Proceeding anyway.`
            };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, error: `Invalid base64: ${error.message}` };
    }
};

/**
 * Calculate expected video duration from storyboard
 * @param {Array} storyboard - Array of scenes with duration
 * @returns {number} Total duration in milliseconds
 */
export const calculateExpectedDuration = (storyboard) => {
    if (!Array.isArray(storyboard) || storyboard.length === 0) {
        return 0;
    }

    const totalSeconds = storyboard.reduce((sum, scene) => {
        const duration = scene?.duration || 5; // Default 5 seconds per scene
        return sum + duration;
    }, 0);

    return totalSeconds * 1000; // Return milliseconds
};

/**
 * Check if audio and video durations are reasonably aligned
 * @param {number} audioDurationMs - Audio duration in milliseconds
 * @param {number} expectedDurationMs - Expected video duration in milliseconds
 * @param {number} tolerancePercent - Acceptable variance (default 20%)
 * @returns {{ aligned: boolean, variance: number, warning?: string }}
 */
export const checkDurationAlignment = (audioDurationMs, expectedDurationMs, tolerancePercent = 20) => {
    if (expectedDurationMs === 0) {
        return { aligned: false, variance: 100, warning: 'Expected duration is 0' };
    }

    const variance = Math.abs(audioDurationMs - expectedDurationMs) / expectedDurationMs * 100;
    const aligned = variance <= tolerancePercent;

    const result = { aligned, variance: Math.round(variance * 10) / 10 };

    if (!aligned) {
        result.warning = `Audio duration (${Math.round(audioDurationMs / 1000)}s) differs from ` +
                        `expected video duration (${Math.round(expectedDurationMs / 1000)}s) ` +
                        `by ${result.variance}%`;
    }

    return result;
};

export default {
    getAudioDuration,
    validateAudioBase64,
    calculateExpectedDuration,
    checkDurationAlignment
};
