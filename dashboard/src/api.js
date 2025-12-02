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

  async handleOAuthCallback(provider, code) {
    const response = await fetch(`${API_BASE}/auth/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error('OAuth callback failed');
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
      headers: { 'Content-Type': 'application/json' },
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

  // ============ YouTube ============
  async checkYouTubeStatus() {
    const response = await fetch(`${API_BASE}/youtube-api/status`);
    if (!response.ok) throw new Error('Failed to check YouTube status');
    return response.json();
  },

  async getYouTubeAuthUrl() {
    const response = await fetch(`${API_BASE}/youtube-api/auth`);
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
    const response = await fetch(`${API_BASE}/tiktok-api/status`);
    if (!response.ok) throw new Error('Failed to check TikTok status');
    return response.json();
  },

  async getTikTokAuthUrl() {
    const response = await fetch(`${API_BASE}/tiktok-api/auth`);
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
    const response = await fetch(`${API_BASE}/facebook-api/status`);
    if (!response.ok) throw new Error('Failed to check Facebook status');
    return response.json();
  },

  async getFacebookAuthUrl() {
    const response = await fetch(`${API_BASE}/facebook-api/auth`);
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
    const response = await fetch(`${API_BASE}/instagram-api/status`);
    if (!response.ok) throw new Error('Failed to check Instagram status');
    return response.json();
  },

  async getInstagramAuthUrl() {
    // Instagram uses Facebook's auth flow
    const response = await fetch(`${API_BASE}/facebook-api/auth`);
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
    const response = await fetch(`${API_BASE}/smart/topic?niche=${niche}`);
    if (!response.ok) throw new Error('Failed to get smart topic');
    return response.json();
  },

  async getSmartPatterns() {
    const response = await fetch(`${API_BASE}/smart/patterns`);
    if (!response.ok) throw new Error('Failed to get smart patterns');
    return response.json();
  },

  async createSmartVideoForYouTube(niche = 'general') {
    const response = await fetch(`${API_BASE}/smart/create-and-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche }),
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
};

export default api;
