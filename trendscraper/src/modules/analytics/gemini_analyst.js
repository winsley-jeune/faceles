import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gemini Analyst - AI Marketing Executive
 * Analyzes YouTube performance data and provides actionable recommendations
 */

const SYSTEM_PROMPT = `You are a Senior YouTube Shorts Marketing Executive with 10+ years of experience growing channels from 0 to millions of subscribers. You specialize in viral short-form content.

Your job is to analyze channel performance data and provide:
1. Clear insights on what's working and what's not
2. Specific, actionable recommendations
3. Content ideas based on top performers
4. Honest feedback - don't sugarcoat poor performance

Your analysis style:
- Be direct and data-driven
- Focus on the metrics that matter for Shorts: views, watch time, CTR
- Consider the hook (first 3 seconds) as critical
- Think about trending topics and timing
- Remember: consistency beats perfection at the early stage

Output format: Always respond with valid JSON.`;

/**
 * Analyze weekly performance and provide recommendations
 */
export const analyzeWeeklyPerformance = async (analyticsData) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `${SYSTEM_PROMPT}

Here's this week's YouTube Shorts channel performance data:

SUMMARY:
- Total Videos: ${analyticsData.summary.totalVideos}
- Total Views: ${analyticsData.summary.totalViews}
- Average Views per Video: ${analyticsData.summary.avgViewsPerVideo}
- Total Likes: ${analyticsData.summary.totalLikes}

TOP 5 PERFORMING VIDEOS:
${analyticsData.videos.slice(0, 5).map((v, i) => `
${i + 1}. "${v.title}"
   - Views: ${v.stats.views}
   - Likes: ${v.stats.likes}
   - Days since published: ${v.daysSincePublished}
`).join('')}

BOTTOM 5 PERFORMING VIDEOS:
${analyticsData.videos.slice(-5).reverse().map((v, i) => `
${i + 1}. "${v.title}"
   - Views: ${v.stats.views}
   - Likes: ${v.stats.likes}
   - Days since published: ${v.daysSincePublished}
`).join('')}

${analyticsData.weekOverWeek ? `
WEEK OVER WEEK CHANGES:
- Views Change: ${analyticsData.weekOverWeek.changes.totalViews > 0 ? '+' : ''}${analyticsData.weekOverWeek.changes.totalViews}
- New Videos: ${analyticsData.weekOverWeek.changes.totalVideos}
- Avg Views Change: ${analyticsData.weekOverWeek.changes.avgViewsPerVideo > 0 ? '+' : ''}${analyticsData.weekOverWeek.changes.avgViewsPerVideo}
` : 'First week of tracking - no comparison available.'}

Analyze this data and provide your recommendations in this exact JSON format:
{
    "overallAssessment": "One paragraph honest assessment of channel health",
    "whatWorking": ["List of things working well based on top performers"],
    "whatNotWorking": ["List of things not working based on poor performers"],
    "keyInsights": [
        {
            "insight": "Specific pattern or observation",
            "evidence": "Data that supports this",
            "action": "What to do about it"
        }
    ],
    "contentRecommendations": {
        "topicsToDoubleDown": ["Topics that performed well to make more of"],
        "topicsToAvoid": ["Topics that underperformed"],
        "newTopicsToTest": ["3-5 new topic ideas based on what's working"]
    },
    "technicalRecommendations": {
        "hooks": "Advice on improving first 3 seconds",
        "titles": "Advice on title optimization",
        "postingSchedule": "Advice on when/how often to post",
        "hashtags": "Advice on hashtag strategy"
    },
    "weeklyGoals": [
        "Specific measurable goal 1",
        "Specific measurable goal 2",
        "Specific measurable goal 3"
    ],
    "suggestedVideos": [
        {
            "topic": "Specific video topic",
            "niche": "psychology|finance|tech|money|health|general",
            "whyThisWillWork": "Brief explanation"
        }
    ],
    "confidenceScore": 0.0-1.0,
    "priorityFocus": "The ONE thing to focus on this week"
}`;

    try {
        console.log('🧠 Gemini analyzing performance data...');
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            console.log('   ✅ Analysis complete');
            return analysis;
        }

        throw new Error('Could not parse Gemini response as JSON');

    } catch (error) {
        console.error('❌ Gemini analysis failed:', error.message);
        throw error;
    }
};

/**
 * Generate specific video ideas based on analysis
 */
export const generateVideoIdeas = async (analysis, count = 5) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `${SYSTEM_PROMPT}

Based on this channel analysis:
- Priority Focus: ${analysis.priorityFocus}
- Topics to double down on: ${analysis.contentRecommendations.topicsToDoubleDown.join(', ')}
- What's working: ${analysis.whatWorking.join(', ')}

Generate ${count} specific video ideas that are likely to perform well.

Return as JSON:
{
    "videoIdeas": [
        {
            "topic": "Full video topic/title idea",
            "niche": "psychology|finance|tech|money|health|news|general",
            "hook": "Exact words for first 3 seconds",
            "whyItWorks": "Brief explanation",
            "estimatedViralPotential": "low|medium|high"
        }
    ]
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Could not parse response');

    } catch (error) {
        console.error('❌ Video idea generation failed:', error.message);
        throw error;
    }
};

/**
 * Compare two videos and explain why one performed better
 */
export const compareVideos = async (videoA, videoB) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `${SYSTEM_PROMPT}

Compare these two YouTube Shorts and explain why one performed better:

VIDEO A (${videoA.stats.views} views):
- Title: "${videoA.title}"
- Likes: ${videoA.stats.likes}
- Days old: ${videoA.daysSincePublished}

VIDEO B (${videoB.stats.views} views):
- Title: "${videoB.title}"
- Likes: ${videoB.stats.likes}
- Days old: ${videoB.daysSincePublished}

Analyze and return JSON:
{
    "winner": "A or B",
    "viewsDifference": number,
    "likelyReasons": ["reason1", "reason2", "reason3"],
    "titleAnalysis": {
        "videoA": "What works/doesn't work in title A",
        "videoB": "What works/doesn't work in title B"
    },
    "lessonLearned": "Key takeaway for future videos"
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Could not parse response');

    } catch (error) {
        console.error('❌ Video comparison failed:', error.message);
        throw error;
    }
};

/**
 * Quick health check - is the channel on track?
 */
export const quickHealthCheck = async (summary) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `${SYSTEM_PROMPT}

Quick health check for this YouTube Shorts channel:
- Total Videos: ${summary.totalVideos}
- Total Views: ${summary.totalViews}
- Avg Views/Video: ${summary.avgViewsPerVideo}
- Total Likes: ${summary.totalLikes}

Give a quick assessment (respond in JSON):
{
    "healthScore": 1-10,
    "status": "critical|struggling|growing|healthy|thriving",
    "oneLineSummary": "One sentence summary",
    "immediateAction": "The one thing to do right now",
    "encouragement": "Brief motivational note based on data"
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Could not parse response');

    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        throw error;
    }
};

export default {
    analyzeWeeklyPerformance,
    generateVideoIdeas,
    compareVideos,
    quickHealthCheck
};
