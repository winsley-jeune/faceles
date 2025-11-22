import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SPEECHALIGN_URL = process.env.SPEECHALIGN_URL || "http://speechalign:5000";

/**
 * Call the speechalign service to sync subtitles with audio
 */
export const alignSubtitlesToAudio = async (audioBase64, text) => {
    console.log("🔄 Aligning subtitles to audio...");

    try {
        const response = await fetch(`${SPEECHALIGN_URL}/align`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                audio: audioBase64,
                text: text
            }),
            timeout: 60000
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Alignment failed: ${error}`);
        }

        const result = await response.json();
        console.log("   ✅ Subtitles aligned to speech");
        return result.srt;

    } catch (error) {
        console.error(`   ⚠️ Alignment failed: ${error.message}`);
        return null;
    }
};

/**
 * Parse SRT content into structured data
 */
export const parseSRT = (srtContent) => {
    const blocks = srtContent.trim().split(/\n\n+/);
    const subtitles = [];

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 3) continue;

        const index = parseInt(lines[0]);
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

        if (timeMatch) {
            subtitles.push({
                index,
                start: timeMatch[1],
                end: timeMatch[2],
                startMs: srtTimeToMs(timeMatch[1]),
                endMs: srtTimeToMs(timeMatch[2]),
                text: lines.slice(2).join(' ')
            });
        }
    }

    return subtitles;
};

/**
 * Convert SRT time format to milliseconds
 */
const srtTimeToMs = (timeStr) => {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(ms);
};

/**
 * Convert milliseconds to SRT time format
 */
const msToSrtTime = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
};

/**
 * Get optimal chunk size based on word characteristics
 * Shorter words can be grouped, longer words stand alone
 */
const getOptimalChunkSize = (words, startIndex) => {
    if (startIndex >= words.length) return 1;

    const currentWord = words[startIndex];
    const nextWord = words[startIndex + 1];

    // Long words (8+ chars) stand alone for readability
    if (currentWord.length >= 8) return 1;

    // Short words (1-3 chars) like "the", "a", "is" should pair with next word
    if (currentWord.length <= 3 && nextWord) {
        return 2;
    }

    // Medium words can pair if next word is short
    if (nextWord && nextWord.length <= 4) {
        return 2;
    }

    // Punctuation at end of word - let it stand alone for pause effect
    if (/[.!?]$/.test(currentWord)) return 1;

    // Default to 2 words for engaging pace
    return nextWord ? 2 : 1;
};

/**
 * Create word-by-word karaoke-style subtitles from aligned SRT
 * Uses 1-2 word chunks for maximum engagement
 */
export const createKaraokeSubtitles = (alignedSRT) => {
    const subtitles = parseSRT(alignedSRT);
    let karaokeContent = "";
    let globalIndex = 1;

    subtitles.forEach((sub) => {
        const words = sub.text.split(' ');
        const duration = sub.endMs - sub.startMs;
        const wordDuration = duration / words.length;

        let currentTime = sub.startMs;
        let j = 0;

        while (j < words.length) {
            // Dynamically determine chunk size (1-2 words)
            const chunkSize = getOptimalChunkSize(words, j);
            const chunk = words.slice(j, Math.min(j + chunkSize, words.length));
            const chunkDuration = wordDuration * chunk.length;

            karaokeContent += `${globalIndex}\n`;
            karaokeContent += `${msToSrtTime(currentTime)} --> ${msToSrtTime(currentTime + chunkDuration)}\n`;
            karaokeContent += `${chunk.join(' ')}\n\n`;

            currentTime += chunkDuration;
            j += chunkSize;
            globalIndex++;
        }
    });

    return karaokeContent;
};

/**
 * Generate fallback subtitles based on estimated word timing
 * Used when speechalign service is unavailable
 * Uses dynamic 1-2 word chunks for better engagement
 */
export const generateEstimatedSubtitles = (storyboard, totalAudioDuration = null) => {
    console.log("   📝 Generating estimated subtitles...");

    let srtContent = "";
    let currentTime = 0;
    let subtitleIndex = 1;

    // Calculate total script duration from storyboard
    const totalDuration = totalAudioDuration ||
        storyboard.reduce((sum, s) => sum + (s.duration || 5), 0) * 1000;

    // Estimate words per second (average speaking rate ~150 wpm = 2.5 wps)
    const totalWords = storyboard.reduce((sum, s) => sum + s.text.split(' ').length, 0);
    const msPerWord = totalDuration / totalWords;

    for (const scene of storyboard) {
        const words = scene.text.split(' ');
        let i = 0;

        // Use dynamic chunking (1-2 words) for engaging pace
        while (i < words.length) {
            const chunkSize = getOptimalChunkSize(words, i);
            const chunk = words.slice(i, Math.min(i + chunkSize, words.length));
            const chunkDuration = msPerWord * chunk.length;

            const startTime = msToSrtTime(currentTime);
            currentTime += chunkDuration;
            const endTime = msToSrtTime(currentTime);

            srtContent += `${subtitleIndex}\n${startTime} --> ${endTime}\n${chunk.join(' ')}\n\n`;
            subtitleIndex++;
            i += chunkSize;
        }
    }

    return srtContent;
};

export { msToSrtTime, srtTimeToMs };
