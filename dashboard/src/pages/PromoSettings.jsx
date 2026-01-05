import { useState, useEffect } from 'react';
import api from '../api';

export default function PromoSettings() {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/promo/config');
      console.log('Config response:', response);
      if (response && response.success) {
        setConfig(response.config);
        setStats(response.stats);
      } else {
        console.error('Invalid config response:', response);
        showMessage('Failed to load configuration - invalid response', 'error');
      }
    } catch (error) {
      console.error('Error loading promo config:', error);
      showMessage(`Failed to load configuration: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get('/promo/history?limit=10');
      console.log('History response:', response);
      if (response && response.success) {
        setHistory(response.history);
      } else {
        console.error('Invalid history response:', response);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const response = await api.put('/promo/config', config);
      if (response.success) {
        setConfig(response.config);
        showMessage('Configuration saved successfully');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showMessage('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateNow = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/promo/generate', {});
      if (response.success) {
        showMessage(`Promotional video generated: ${response.video.filename}`);
        loadHistory();
        loadConfig();
      }
    } catch (error) {
      console.error('Error generating video:', error);
      showMessage('Failed to generate video', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const endpoint = config.enabled ? '/promo/disable' : '/promo/enable';
      const response = await api.post(endpoint);
      if (response.success) {
        setConfig({ ...config, enabled: !config.enabled });
        showMessage(response.message);
      }
    } catch (error) {
      console.error('Error toggling promo:', error);
      showMessage('Failed to update status', 'error');
    }
  };

  const updateConfig = (field, value) => {
    setConfig({ ...config, [field]: value });
  };

  const updateContentMix = (type, value) => {
    setConfig({
      ...config,
      contentMix: { ...config.contentMix, [type]: parseInt(value) || 0 }
    });
  };

  const updatePlatforms = (platform) => {
    const platforms = config.platforms.includes(platform)
      ? config.platforms.filter(p => p !== platform)
      : [...config.platforms, platform];
    setConfig({ ...config, platforms });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">Failed to load configuration</div>
      </div>
    );
  }

  const contentMixTotal = Object.values(config.contentMix).reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Promotional Content Settings</h1>
        <p className="text-gray-600">
          Automatically generate videos that promote the Viral Faceless Shorts Generator
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded ${
            message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Promotional Content</h2>
            <p className="text-gray-600">
              {config.enabled ? 'Promotional videos will be generated automatically' : 'Promotional content is currently disabled'}
            </p>
          </div>
          <button
            onClick={handleToggleEnabled}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              config.enabled
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
            }`}
          >
            {config.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 mb-1">Total Generated</div>
            <div className="text-3xl font-bold">{stats.totalGenerated}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 mb-1">Total Posted</div>
            <div className="text-3xl font-bold">{stats.totalPosted}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 mb-1">Last Posted</div>
            <div className="text-sm font-semibold">
              {stats.lastPromoPost
                ? new Date(stats.lastPromoPost).toLocaleString()
                : 'Never'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Type: {stats.lastPromoType || 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Mode</h2>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="mode"
              value="mixed"
              checked={config.mode === 'mixed'}
              onChange={(e) => updateConfig('mode', e.target.value)}
              className="mr-3 w-4 h-4"
            />
            <div>
              <div className="font-semibold">Mixed Mode</div>
              <div className="text-sm text-gray-600">
                Mix promotional content with regular content (recommended)
              </div>
            </div>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="mode"
              value="separate"
              checked={config.mode === 'separate'}
              onChange={(e) => updateConfig('mode', e.target.value)}
              className="mr-3 w-4 h-4"
            />
            <div>
              <div className="font-semibold">Separate Mode</div>
              <div className="text-sm text-gray-600">
                Post promotional content on a separate schedule
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Frequency Settings */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Frequency</h2>

        {config.mode === 'mixed' ? (
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-2">
                Promotional Content Percentage: {config.frequency.percentage}%
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={config.frequency.percentage}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    frequency: { ...config.frequency, percentage: parseInt(e.target.value) }
                  })
                }
                className="w-full"
              />
              <div className="text-sm text-gray-600 mt-1">
                {config.frequency.percentage}% of your content will be promotional
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-2">
                Post Interval: Every {config.frequency.interval} days
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={config.frequency.interval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    frequency: { ...config.frequency, interval: parseInt(e.target.value) || 7 }
                  })
                }
                className="px-3 py-2 border rounded w-32"
              />
              <div className="text-sm text-gray-600 mt-1">
                Post promotional content every N days
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="block font-medium mb-2">
            Minimum Hours Between Posts: {config.frequency.minHoursBetween}
          </label>
          <input
            type="number"
            min="1"
            max="168"
            value={config.frequency.minHoursBetween}
            onChange={(e) =>
              setConfig({
                ...config,
                frequency: { ...config.frequency, minHoursBetween: parseInt(e.target.value) || 24 }
              })
            }
            className="px-3 py-2 border rounded w-32"
          />
          <div className="text-sm text-gray-600 mt-1">
            Minimum time between promotional posts
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Platforms</h2>
        <div className="space-y-3">
          {['youtube', 'tiktok', 'instagram', 'facebook'].map((platform) => (
            <label key={platform} className="flex items-center">
              <input
                type="checkbox"
                checked={config.platforms.includes(platform)}
                onChange={() => updatePlatforms(platform)}
                className="mr-3 w-4 h-4"
              />
              <span className="font-medium capitalize">{platform}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Content Mix */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Content Mix</h2>
        <p className="text-sm text-gray-600 mb-4">
          Adjust the percentage of each content type (Total: {contentMixTotal}%)
        </p>

        <div className="space-y-4">
          {Object.entries(config.contentMix).map(([type, value]) => (
            <div key={type}>
              <label className="block font-medium mb-2 capitalize">
                {type.replace(/([A-Z])/g, ' $1').trim()}: {value}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => updateContentMix(type, e.target.value)}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {contentMixTotal !== 100 && (
          <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded">
            Warning: Content mix should total 100% (currently {contentMixTotal}%)
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex gap-4">
          <button
            onClick={handleSaveConfig}
            disabled={saving || contentMixTotal !== 100}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleGenerateNow}
            disabled={generating || !config.enabled}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
          >
            {generating ? 'Generating...' : 'Generate Promo Video Now'}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Promotional Posts</h2>
        {history.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No promotional posts yet</div>
        ) : (
          <div className="space-y-3">
            {history.map((post, index) => (
              <div key={index} className="border rounded p-4">
                <div className="font-semibold">{post.topic}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Type: {post.type} | Posted: {new Date(post.postedAt).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  Platforms: {post.platforms?.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
