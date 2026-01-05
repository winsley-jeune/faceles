// API client for Viral Shorts Generator backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const api = {
  // ============ Authentication ============
  async getGoogleLoginUrl() {
    const response = await fetch(`${API_BASE}/auth/google`);
    if (!response.ok) throw new Error('Failed to get Google auth URL');
    return response.json();
  },

  async getFacebookLoginUrl() {
    const response = await fetch(`${API_BASE}/auth/facebook`);
    if (!response.ok) throw new Error('Failed to get Facebook auth URL');
    return response.json();
  },

  async getTikTokLoginUrl() {
    const response = await fetch(`${API_BASE}/auth/tiktok`);
    if (!response.ok) throw new Error('Failed to get TikTok auth URL');
    return response.json();
  },

  async handleOAuthCallback(provider, code, state) {
    const response = await fetch(`${API_BASE}/auth/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'OAuth callback failed');
    }
    return response.json();
  },

  async getCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get current user');
    return response.json();
  },

  async logout() {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.ok;
  },

  // ============ Video Generation ============
  async createVideo({ topic, niche, autoPost }) {
    const response = await fetch(`${API_BASE}/create-full-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ topic, niche, autoPost }),
    });
    if (!response.ok) throw new Error('Failed to create video');
    return response.json();
  },

  // ============ Analytics ============
  async getAnalytics() {
    const response = await fetch(`${API_BASE}/analytics/videos`);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  },

  async getBestNiche() {
    const response = await fetch(`${API_BASE}/analytics/best-niche`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get best niche');
    return response.json();
  },

  async getOptimalStrategy() {
    const response = await fetch(`${API_BASE}/analytics/optimal-strategy`);
    if (!response.ok) throw new Error('Failed to get optimal strategy');
    return response.json();
  },

  // ============ Viral Intelligence ============
  async getViralIntelligence() {
    const response = await fetch(`${API_BASE}/analytics/viral-intelligence`);
    if (!response.ok) throw new Error('Failed to get viral intelligence');
    return response.json();
  },

  async getOutliers() {
    const response = await fetch(`${API_BASE}/analytics/outliers`);
    if (!response.ok) throw new Error('Failed to get outliers');
    return response.json();
  },

  async getViralScores() {
    const response = await fetch(`${API_BASE}/analytics/viral-scores`);
    if (!response.ok) throw new Error('Failed to get viral scores');
    return response.json();
  },

  async getRecommendedPattern() {
    const response = await fetch(`${API_BASE}/analytics/recommended-pattern`);
    if (!response.ok) throw new Error('Failed to get recommended pattern');
    return response.json();
  },

  async getKilledPatterns() {
    const response = await fetch(`${API_BASE}/analytics/killed-patterns`);
    if (!response.ok) throw new Error('Failed to get killed patterns');
    return response.json();
  },

  // ============ YouTube ============
  async checkYouTubeStatus() {
    const response = await fetch(`${API_BASE}/youtube-api/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to check YouTube status');
    return response.json();
  },

  async getYouTubeAuthUrl() {
    const response = await fetch(`${API_BASE}/youtube-api/auth`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get YouTube auth URL');
    return response.json();
  },

  async uploadToYouTube(videoPath, topic) {
    const response = await fetch(`${API_BASE}/youtube-api/upload-smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, topic }),
    });
    if (!response.ok) throw new Error('Failed to upload to YouTube');
    return response.json();
  },

  // ============ TikTok ============
  async checkTikTokStatus() {
    const response = await fetch(`${API_BASE}/tiktok-api/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to check TikTok status');
    return response.json();
  },

  async getTikTokAuthUrl() {
    const response = await fetch(`${API_BASE}/tiktok-api/auth`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get TikTok auth URL');
    return response.json();
  },

  async uploadToTikTok(videoPath, topic) {
    const response = await fetch(`${API_BASE}/tiktok-api/upload-smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, topic }),
    });
    if (!response.ok) throw new Error('Failed to upload to TikTok');
    return response.json();
  },

  // ============ Facebook ============
  async checkFacebookStatus() {
    const response = await fetch(`${API_BASE}/facebook-api/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to check Facebook status');
    return response.json();
  },

  async getFacebookAuthUrl() {
    const response = await fetch(`${API_BASE}/facebook-api/auth`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get Facebook auth URL');
    return response.json();
  },

  async uploadToFacebook(videoPath, topic) {
    const response = await fetch(`${API_BASE}/facebook-api/upload-smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, topic }),
    });
    if (!response.ok) throw new Error('Failed to upload to Facebook');
    return response.json();
  },

  // ============ Instagram ============
  async checkInstagramStatus() {
    const response = await fetch(`${API_BASE}/instagram-api/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to check Instagram status');
    return response.json();
  },

  async getInstagramAuthUrl() {
    // Instagram uses Facebook's auth flow
    const response = await fetch(`${API_BASE}/facebook-api/auth`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get Instagram auth URL');
    return response.json();
  },

  // ============ Platform Disconnect ============
  async disconnectPlatform(platform) {
    const response = await fetch(`${API_BASE}/${platform}-api/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) throw new Error(`Failed to disconnect ${platform}`);
    return response.json();
  },

  // ============ Post to All ============
  async postToAll(videoPath, topic) {
    const [youtube, tiktok, facebook] = await Promise.allSettled([
      this.uploadToYouTube(videoPath, topic),
      this.uploadToTikTok(videoPath, topic),
      this.uploadToFacebook(videoPath, topic),
    ]);

    return {
      youtube: youtube.status === 'fulfilled' ? youtube.value : { error: youtube.reason?.message },
      tiktok: tiktok.status === 'fulfilled' ? tiktok.value : { error: tiktok.reason?.message },
      facebook: facebook.status === 'fulfilled' ? facebook.value : { error: facebook.reason?.message },
    };
  },

  // ============ Settings ============
  async getSettings() {
    try {
      const response = await fetch(`${API_BASE}/social/settings`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  },

  async saveSettings(settings) {
    const response = await fetch(`${API_BASE}/social/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to save settings');
    return response.json();
  },

  // ============ Local Videos ============
  async getLocalVideos() {
    const response = await fetch(`${API_BASE}/videos/list`);
    if (!response.ok) throw new Error('Failed to fetch local videos');
    return response.json();
  },

  async getPostingHistory() {
    const response = await fetch(`${API_BASE}/social/history`);
    if (!response.ok) throw new Error('Failed to fetch posting history');
    return response.json();
  },

  // ============ Viral Content Discovery ============
  async discoverVirals(platform = 'tiktok') {
    const response = await fetch(`${API_BASE}/virals/${platform}`);
    if (!response.ok) throw new Error('Failed to discover viral content');
    return response.json();
  },

  async cloneViral(viralId, platform) {
    const response = await fetch(`${API_BASE}/virals/discover-and-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viralId, platform }),
    });
    if (!response.ok) throw new Error('Failed to clone viral');
    return response.json();
  },

  // ============ AI Suggestions (from Analytics) ============
  async getNextSuggestedVideo() {
    const response = await fetch(`${API_BASE}/analytics/next-video`);
    if (!response.ok) throw new Error('Failed to get suggested video');
    return response.json();
  },

  async generateVideoIdeas(count = 5) {
    const response = await fetch(`${API_BASE}/analytics/generate-ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    if (!response.ok) throw new Error('Failed to generate ideas');
    return response.json();
  },

  async runWeeklyAnalysis() {
    const response = await fetch(`${API_BASE}/analytics/weekly-analysis`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to run analysis');
    return response.json();
  },

  // ============ Brand Context ============
  async getBrandContext() {
    const response = await fetch(`${API_BASE}/brand/context`);
    if (!response.ok) throw new Error('Failed to get brand context');
    return response.json();
  },

  async saveBrandContext(context) {
    const response = await fetch(`${API_BASE}/brand/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    });
    if (!response.ok) throw new Error('Failed to save brand context');
    return response.json();
  },

  async saveBrandOnboarding(brandData) {
    const response = await fetch(`${API_BASE}/brand/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandData),
    });
    if (!response.ok) throw new Error('Failed to save brand onboarding');
    return response.json();
  },

  async updateBrandSection(section, data) {
    const response = await fetch(`${API_BASE}/brand/context/${section}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Failed to update ${section}`);
    return response.json();
  },

  async getBrandStatus() {
    const response = await fetch(`${API_BASE}/brand/status`);
    if (!response.ok) throw new Error('Failed to get brand status');
    return response.json();
  },

  async getBrandPromptContext() {
    const response = await fetch(`${API_BASE}/brand/prompt-context`);
    if (!response.ok) throw new Error('Failed to get brand prompt context');
    return response.json();
  },

  async getBrandSummary() {
    const response = await fetch(`${API_BASE}/brand/summary`);
    if (!response.ok) throw new Error('Failed to get brand summary');
    return response.json();
  },

  // ============ Smart YouTube Generation ============
  async getSmartTopic(niche = 'general') {
    const response = await fetch(`${API_BASE}/smart/topic?niche=${niche}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get smart topic');
    return response.json();
  },

  async getSmartPatterns() {
    const response = await fetch(`${API_BASE}/smart/patterns`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get smart patterns');
    return response.json();
  },

  async createSmartVideoForYouTube(niche = 'general', topic = null) {
    const response = await fetch(`${API_BASE}/smart/create-and-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ niche, ...(topic && { topic }) }),
    });
    if (!response.ok) throw new Error('Failed to create smart video');
    return response.json();
  },

  async checkTopicDuplicate(topic) {
    const response = await fetch(`${API_BASE}/smart/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });
    if (!response.ok) throw new Error('Failed to check duplicate');
    return response.json();
  },

  async pullYouTubeAnalytics() {
    const response = await fetch(`${API_BASE}/youtube-api/pull-analytics`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to pull YouTube analytics');
    return response.json();
  },

  // ============ Smart Facebook Generation ============
  async getFacebookSmartTopic(niche = 'general') {
    const response = await fetch(`${API_BASE}/facebook/smart/topic?niche=${niche}`);
    if (!response.ok) throw new Error('Failed to get Facebook smart topic');
    return response.json();
  },

  async getFacebookSmartPatterns() {
    const response = await fetch(`${API_BASE}/facebook/smart/patterns`);
    if (!response.ok) throw new Error('Failed to get Facebook patterns');
    return response.json();
  },

  async createSmartVideoForFacebook(niche = 'general', topic = null) {
    const response = await fetch(`${API_BASE}/facebook/smart/create-and-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ niche, ...(topic && { topic }) }),
    });
    if (!response.ok) throw new Error('Failed to create Facebook smart video');
    return response.json();
  },

  async pullFacebookAnalytics() {
    const response = await fetch(`${API_BASE}/facebook-api/pull-analytics`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to pull Facebook analytics');
    return response.json();
  },

  async pullTikTokAnalytics() {
    const response = await fetch(`${API_BASE}/tiktok-api/pull-analytics`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to pull TikTok analytics');
    return response.json();
  },

  async pullInstagramAnalytics() {
    const response = await fetch(`${API_BASE}/instagram-api/pull-analytics`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to pull Instagram analytics');
    return response.json();
  },

  // ============ Multi-Platform Smart Generation ============

  // NEW: Async job-based generation (preserves progress, user can navigate away)
  async createSmartVideoJob(niche = 'general', platforms = ['youtube'], topic = null) {
    const response = await fetch(`${API_BASE}/smart/create-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        niche,
        topic,
        platforms,
        autoPost: true
      }),
    });
    if (!response.ok) throw new Error('Failed to create video generation job');
    return response.json(); // Returns { success: true, jobId: '...', status: 'queued' }
  },

  // OLD: Synchronous generation (blocks browser, loses progress if navigating away)
  async createSmartVideo(niche = 'general', platforms = ['youtube'], topic = null) {
    const results = {};

    for (const platform of platforms) {
      try {
        if (platform === 'youtube') {
          const response = await fetch(`${API_BASE}/smart/create-and-post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ niche, topic }),
          });
          if (!response.ok) throw new Error('Failed to create YouTube smart video');
          results[platform] = await response.json();
        } else if (platform === 'facebook') {
          const response = await fetch(`${API_BASE}/facebook/smart/create-and-post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ niche, topic }),
          });
          if (!response.ok) throw new Error('Failed to create Facebook smart video');
          results[platform] = await response.json();
        } else if (platform === 'instagram') {
          const response = await fetch(`${API_BASE}/instagram/smart/create-and-post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ niche, topic }),
          });
          if (!response.ok) throw new Error('Failed to create Instagram smart video');
          results[platform] = await response.json();
        } else if (platform === 'tiktok') {
          const response = await fetch(`${API_BASE}/tiktok/smart/create-and-post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ niche, topic }),
          });
          if (!response.ok) throw new Error('Failed to create TikTok smart video');
          results[platform] = await response.json();
        } else {
          results[platform] = {
            status: 'pending',
            message: `${platform} smart generation not available`
          };
        }
      } catch (err) {
        results[platform] = { error: err.message };
      }
    }

    return results;
  },

  async getPlatformAnalytics(platform) {
    const endpoints = {
      youtube: '/youtube-api/pull-analytics',
      tiktok: '/tiktok-api/analytics',
      facebook: '/facebook-api/analytics',
      instagram: '/instagram-api/analytics',
    };

    const endpoint = endpoints[platform];
    if (!endpoint) throw new Error(`Unknown platform: ${platform}`);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
      });
      if (!response.ok) {
        return { available: false, message: `${platform} analytics not available` };
      }
      return { available: true, data: await response.json() };
    } catch (err) {
      return { available: false, message: err.message };
    }
  },

  async getAllPlatformStatus() {
    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'];
    const status = {};

    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const response = await fetch(`${API_BASE}/${platform}-api/status`, {
            headers: getAuthHeaders(),
          });
          status[platform] = response.ok ? await response.json() : { connected: false };
        } catch {
          status[platform] = { connected: false };
        }
      })
    );

    return status;
  },

  // Brand Products
  async addProduct(product) {
    const response = await fetch(`${API_BASE}/brand/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!response.ok) throw new Error('Failed to add product');
    return response.json();
  },

  async updateProduct(productId, updates) {
    const response = await fetch(`${API_BASE}/brand/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update product');
    return response.json();
  },

  async deleteProduct(productId) {
    const response = await fetch(`${API_BASE}/brand/products/${productId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete product');
    return response.json();
  },

  // Brand Templates
  async getCTATemplates(goal) {
    const response = await fetch(`${API_BASE}/brand/templates/cta/${goal}`);
    if (!response.ok) throw new Error('Failed to get CTA templates');
    return response.json();
  },

  async getHookTemplates(industry) {
    const response = await fetch(`${API_BASE}/brand/templates/hooks/${industry}`);
    if (!response.ok) throw new Error('Failed to get hook templates');
    return response.json();
  },

  async getIndustryPreset(industry) {
    const response = await fetch(`${API_BASE}/brand/presets/${industry}`);
    if (!response.ok) throw new Error('Failed to get industry preset');
    return response.json();
  },

  // ============ Batch Variation Engine ============
  async generateBatch(niche = 'general', topic = null) {
    const response = await fetch(`${API_BASE}/batch/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, ...(topic && { topic }) }),
    });
    if (!response.ok) throw new Error('Failed to generate batch');
    return response.json();
  },

  async getBatchQueue() {
    const response = await fetch(`${API_BASE}/batch/queue`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get batch queue');
    return response.json();
  },

  async updateBatchSchedule(settings) {
    const response = await fetch(`${API_BASE}/batch/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update schedule');
    return response.json();
  },

  async processNextBatch(autoPost = true, platform = 'youtube') {
    const response = await fetch(`${API_BASE}/batch/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoPost, platform }),
    });
    if (!response.ok) throw new Error('Failed to process batch');
    return response.json();
  },

  async clearBatchQueue() {
    const response = await fetch(`${API_BASE}/batch/queue`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear queue');
    return response.json();
  },

  async getBatchAnalytics() {
    const response = await fetch(`${API_BASE}/batch/analytics`);
    if (!response.ok) throw new Error('Failed to get batch analytics');
    return response.json();
  },

  // ============ Exploration Config ============
  async getExplorationConfig() {
    const response = await fetch(`${API_BASE}/exploration/config`);
    if (!response.ok) throw new Error('Failed to get exploration config');
    return response.json();
  },

  async getExplorationSummary() {
    const response = await fetch(`${API_BASE}/exploration/summary`);
    if (!response.ok) throw new Error('Failed to get exploration summary');
    return response.json();
  },

  async getPlatformExplorationConfig(platform) {
    const response = await fetch(`${API_BASE}/exploration/platform/${platform}`);
    if (!response.ok) throw new Error('Failed to get platform config');
    return response.json();
  },

  async updateExplorationSetting(path, value) {
    const response = await fetch(`${API_BASE}/exploration/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, value }),
    });
    if (!response.ok) throw new Error('Failed to update setting');
    return response.json();
  },

  async setExplorationRate(rate) {
    const response = await fetch(`${API_BASE}/exploration/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate }),
    });
    if (!response.ok) throw new Error('Failed to set exploration rate');
    return response.json();
  },

  async setStupidHustleConfig({ enabled, maxPerDay }) {
    const response = await fetch(`${API_BASE}/exploration/stupid-hustle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, maxPerDay }),
    });
    if (!response.ok) throw new Error('Failed to update stupid hustle config');
    return response.json();
  },

  async testExploration(platform) {
    const response = await fetch(`${API_BASE}/exploration/test/${platform}`);
    if (!response.ok) throw new Error('Failed to test exploration');
    return response.json();
  },

  async autoAdjustExploration({ viralRate, avgViews, trend }) {
    const response = await fetch(`${API_BASE}/exploration/auto-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viralRate, avgViews, trend }),
    });
    if (!response.ok) throw new Error('Failed to auto-adjust');
    return response.json();
  },

  async resetExplorationConfig() {
    const response = await fetch(`${API_BASE}/exploration/reset`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to reset config');
    return response.json();
  },

  // ============ Product Video Generator ============
  async uploadProductMedia(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch (e) {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', `${API_BASE}/product/upload-media`);
      xhr.send(formData);
    });
  },

  async generateProductVideo(productData) {
    const response = await fetch(`${API_BASE}/product/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate product video');
    }
    return response.json();
  },

  // ============ Training Video Generator ============
  async getTrainingVideoTypes() {
    const response = await fetch(`${API_BASE}/training/video/types`);
    if (!response.ok) throw new Error('Failed to get training video types');
    return response.json();
  },

  async getTrainingTemplateDetails(videoType) {
    const response = await fetch(`${API_BASE}/training/video/template/${videoType}`);
    if (!response.ok) throw new Error('Failed to get template details');
    return response.json();
  },

  async uploadTrainingMedia(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch (e) {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', `${API_BASE}/training/video/upload-media`);
      xhr.send(formData);
    });
  },

  async previewTrainingStoryboard(trainingData) {
    const response = await fetch(`${API_BASE}/training/video/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trainingData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to preview storyboard');
    }
    return response.json();
  },

  async generateTrainingVideo(trainingData) {
    const response = await fetch(`${API_BASE}/training/video/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trainingData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate training video');
    }
    return response.json();
  },

  // ============ AI Avatar Presenter ============
  async checkAvatarStatus() {
    const response = await fetch(`${API_BASE}/avatar/status`);
    if (!response.ok) throw new Error('Failed to check avatar status');
    return response.json();
  },

  async getStockAvatars() {
    const response = await fetch(`${API_BASE}/avatar/stock`);
    if (!response.ok) throw new Error('Failed to get stock avatars');
    return response.json();
  },

  async getAvatarModes() {
    const response = await fetch(`${API_BASE}/avatar/modes`);
    if (!response.ok) throw new Error('Failed to get avatar modes');
    return response.json();
  },

  async previewAvatar(avatarId) {
    const response = await fetch(`${API_BASE}/avatar/preview/${avatarId}`);
    if (!response.ok) throw new Error('Failed to preview avatar');
    return response.json();
  },

  async uploadCustomAvatar(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch (e) {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', `${API_BASE}/avatar/upload`);
      xhr.send(formData);
    });
  },

  async generateAvatarVideo(options) {
    const response = await fetch(`${API_BASE}/avatar/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate avatar video');
    }
    return response.json();
  },

  async generateImageToAvatar(options) {
    const response = await fetch(`${API_BASE}/avatar/image-to-avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to convert image to avatar');
    }
    return response.json();
  },

  // ============ Document to Video ============
  async getSupportedDocuments() {
    const response = await fetch(`${API_BASE}/training/document/supported`);
    if (!response.ok) throw new Error('Failed to get supported documents');
    return response.json();
  },

  async uploadDocument(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch (e) {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', `${API_BASE}/training/document/upload`);
      xhr.send(formData);
    });
  },

  async analyzeDocument(documentPath, videoType) {
    const response = await fetch(`${API_BASE}/training/document/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentPath, videoType }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze document');
    }
    return response.json();
  },

  async convertDocumentToVideo(options) {
    const response = await fetch(`${API_BASE}/training/document/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to convert document to video');
    }
    return response.json();
  },

  // ============ A/B Testing ============
  async getABTestingSummary() {
    const response = await fetch(`${API_BASE}/ab-testing/summary`);
    if (!response.ok) throw new Error('Failed to get A/B testing summary');
    return response.json();
  },

  async getABTestingExperiments(status = 'active', platform = null) {
    let url = `${API_BASE}/ab-testing/experiments?status=${status}`;
    if (platform) url += `&platform=${platform}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get experiments');
    return response.json();
  },

  async createABExperiment(config) {
    const response = await fetch(`${API_BASE}/ab-testing/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create experiment');
    }
    return response.json();
  },

  async createHookExperiment(platform, niche, hooks) {
    const response = await fetch(`${API_BASE}/ab-testing/experiments/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, niche, hooks }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create hook experiment');
    }
    return response.json();
  },

  async createVisualExperiment(platform, themes) {
    const response = await fetch(`${API_BASE}/ab-testing/experiments/visual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, themes }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create visual experiment');
    }
    return response.json();
  },

  async createDurationExperiment(platform, durations) {
    const response = await fetch(`${API_BASE}/ab-testing/experiments/duration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, durations }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create duration experiment');
    }
    return response.json();
  },

  async getNextVariant(experimentId) {
    const response = await fetch(`${API_BASE}/ab-testing/experiments/${experimentId}/next-variant`);
    if (!response.ok) throw new Error('Failed to get next variant');
    return response.json();
  },

  async assignToExperiment(experimentId, videoId, variantId) {
    const response = await fetch(`${API_BASE}/ab-testing/experiments/${experimentId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, variantId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to assign to experiment');
    }
    return response.json();
  },

  async recordABTestResults(experimentId, videoId, views, retention) {
    const response = await fetch(`${API_BASE}/ab-testing/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experimentId, videoId, views, retention }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to record results');
    }
    return response.json();
  },

  async getABTestingWinners(type = null, platform = null) {
    let url = `${API_BASE}/ab-testing/winners`;
    const params = [];
    if (type) params.push(`type=${type}`);
    if (platform) params.push(`platform=${platform}`);
    if (params.length) url += '?' + params.join('&');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get winners');
    return response.json();
  },

  async applyABTestingWinners() {
    const response = await fetch(`${API_BASE}/ab-testing/apply-winners`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to apply winners');
    return response.json();
  },

  async getABTestingRecommendations(platform = 'youtube') {
    const response = await fetch(`${API_BASE}/ab-testing/recommendations?platform=${platform}`);
    if (!response.ok) throw new Error('Failed to get recommendations');
    return response.json();
  },

  // ============ Cross-Platform Intelligence ============
  async getCrossPlatformSummary() {
    const response = await fetch(`${API_BASE}/analytics/cross-platform/summary`);
    if (!response.ok) throw new Error('Failed to get cross-platform summary');
    return response.json();
  },

  async getCrossPlatformRecommendations(niche) {
    const response = await fetch(`${API_BASE}/analytics/cross-platform/recommendations/${niche}`);
    if (!response.ok) throw new Error('Failed to get cross-platform recommendations');
    return response.json();
  },

  async getBestPostingTimes(platform = null) {
    let url = `${API_BASE}/analytics/cross-platform/best-times`;
    if (platform) url += `?platform=${platform}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get best posting times');
    return response.json();
  },

  async getUniversalWinners() {
    const response = await fetch(`${API_BASE}/analytics/cross-platform/universal-winners`);
    if (!response.ok) throw new Error('Failed to get universal winners');
    return response.json();
  },

  async recordCrossPlatformPerformance(videoData) {
    const response = await fetch(`${API_BASE}/analytics/cross-platform/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoData)
    });
    if (!response.ok) throw new Error('Failed to record cross-platform performance');
    return response.json();
  },

  async suggestPlatformForTopic(topic, niche = null) {
    let url = `${API_BASE}/analytics/cross-platform/suggest-platform?topic=${encodeURIComponent(topic)}`;
    if (niche) url += `&niche=${encodeURIComponent(niche)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get platform suggestion');
    return response.json();
  },

  // ============ Retention Optimizer ============
  async getRetentionSummary() {
    const response = await fetch(`${API_BASE}/analytics/retention/summary`);
    if (!response.ok) throw new Error('Failed to get retention summary');
    return response.json();
  },

  async getOptimalDuration(platform) {
    const response = await fetch(`${API_BASE}/analytics/retention/optimal-duration/${platform}`);
    if (!response.ok) throw new Error('Failed to get optimal duration');
    return response.json();
  },

  async getBestRetentionHooks(platform = null) {
    let url = `${API_BASE}/analytics/retention/best-hooks`;
    if (platform) url += `/${platform}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get best hooks');
    return response.json();
  },

  async getRetentionRecommendations(platform) {
    const response = await fetch(`${API_BASE}/analytics/retention/recommendations/${platform}`);
    if (!response.ok) throw new Error('Failed to get retention recommendations');
    return response.json();
  },

  // ============ Monetization ============
  async getPlans() {
    const response = await fetch(`${API_BASE}/monetization/plans`);
    if (!response.ok) throw new Error('Failed to get plans');
    return response.json();
  },

  async getSubscription() {
    const response = await fetch(`${API_BASE}/monetization/subscription`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get subscription');
    return response.json();
  },

  async subscribe(planId, paymentMethodId = null) {
    const response = await fetch(`${API_BASE}/monetization/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ planId, paymentMethodId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Subscription failed');
    }
    return response.json();
  },

  async cancelSubscription() {
    const response = await fetch(`${API_BASE}/monetization/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to cancel subscription');
    return response.json();
  },

  async createCheckout(planId, successUrl = null, cancelUrl = null) {
    const response = await fetch(`${API_BASE}/monetization/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ planId, successUrl, cancelUrl }),
    });
    if (!response.ok) throw new Error('Failed to create checkout session');
    return response.json();
  },

  async openBillingPortal(returnUrl = null) {
    const response = await fetch(`${API_BASE}/monetization/billing-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ returnUrl }),
    });
    if (!response.ok) throw new Error('Failed to open billing portal');
    return response.json();
  },

  async getUsage() {
    const response = await fetch(`${API_BASE}/monetization/usage`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get usage');
    return response.json();
  },

  async checkUsageLimits() {
    const response = await fetch(`${API_BASE}/monetization/check-limits`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to check limits');
    return response.json();
  },

  async trackVideoGeneration(videoData = {}) {
    const response = await fetch(`${API_BASE}/monetization/track-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ videoData }),
    });
    if (!response.ok) throw new Error('Failed to track video');
    return response.json();
  },

  // Affiliate
  async getAffiliate() {
    const response = await fetch(`${API_BASE}/monetization/affiliate`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get affiliate');
    return response.json();
  },

  async createAffiliate(paypalEmail) {
    const response = await fetch(`${API_BASE}/monetization/affiliate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ paypalEmail }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create affiliate');
    }
    return response.json();
  },

  async updateAffiliatePaypal(paypalEmail) {
    const response = await fetch(`${API_BASE}/monetization/affiliate/paypal`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ paypalEmail }),
    });
    if (!response.ok) throw new Error('Failed to update PayPal email');
    return response.json();
  },

  async trackAffiliateReferral(affiliateCode, userId, planId) {
    const response = await fetch(`${API_BASE}/monetization/affiliate/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliateCode, userId, planId }),
    });
    return response.json();
  },

  async requestPayout(amount) {
    const response = await fetch(`${API_BASE}/monetization/affiliate/payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ amount }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to request payout');
    }
    return response.json();
  },

  async getTransactions(limit = 50) {
    const response = await fetch(`${API_BASE}/monetization/transactions?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get transactions');
    return response.json();
  },

  // ============ Generic HTTP Methods ============
  async get(endpoint) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `GET ${endpoint} failed with status ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API GET ${endpoint} error:`, error);
      throw error;
    }
  },

  async post(endpoint, data = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `POST ${endpoint} failed`);
    }
    return response.json();
  },

  async put(endpoint, data = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `PUT ${endpoint} failed`);
    }
    return response.json();
  },

  async delete(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `DELETE ${endpoint} failed`);
    }
    return response.json();
  },

  // ============ Job Queue Management ============
  /**
   * Create a background video generation job
   * @param {Object} params - Job parameters
   * @param {string} params.niche - Video niche
   * @param {string} params.topic - Video topic (optional)
   * @param {boolean} params.autoPost - Whether to auto-post after generation
   * @returns {Promise<Object>} Job creation result with jobId
   */
  async createVideoJob({ niche, topic, autoPost }) {
    const response = await fetch(`${API_BASE}/smart/create-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ niche, topic, autoPost }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create video job');
    }
    return response.json();
  },

  /**
   * Get job status and progress
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status with progress information
   */
  async getJob(jobId) {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get job status');
    }
    return response.json();
  },

  /**
   * List user's jobs
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status (queued, processing, completed, failed)
   * @param {number} options.limit - Maximum number of jobs to return
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Object>} List of jobs
   */
  async listJobs({ status, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await fetch(`${API_BASE}/jobs?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to list jobs');
    }
    return response.json();
  },

  /**
   * Cancel a job
   * @param {string} jobId - Job ID to cancel
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelJob(jobId) {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to cancel job');
    }
    return response.json();
  },

  /**
   * Get user's job statistics
   * @returns {Promise<Object>} Job statistics
   */
  async getJobStats() {
    const response = await fetch(`${API_BASE}/jobs/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get job stats');
    }
    return response.json();
  },

  /**
   * Get global queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats() {
    const response = await fetch(`${API_BASE}/jobs/queue/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get queue stats');
    }
    return response.json();
  },
};

export default api;
