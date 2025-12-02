import { useState, useEffect } from 'react';
import { Save, RefreshCw, Key, Volume2, Palette, Bell, Shield, Server } from 'lucide-react';
import api from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({
    openaiKey: '',
    elevenLabsKey: '',
    pexelsKey: '',
    defaultNiche: 'money',
    defaultVoice: 'nova',
    autoPost: false,
    watermark: false,
    notifyOnComplete: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('api');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'generation', label: 'Video Generation', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System', icon: Server },
  ];

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your Viral Shorts generator</p>
      </header>

      <div className="page-content">
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Settings Tabs */}
          <div style={{ width: '200px', flexShrink: 0 }}>
            <div className="card" style={{ padding: '8px' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Content */}
          <div style={{ flex: 1 }}>
            <div className="card">
              {/* API Keys Tab */}
              {activeTab === 'api' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: '24px' }}>
                    <Key size={20} style={{ marginRight: '8px' }} />
                    API Keys
                  </h3>

                  <div className="form-group">
                    <label className="form-label">OpenAI API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="sk-..."
                      value={settings.openaiKey}
                      onChange={(e) => setSettings({ ...settings, openaiKey: e.target.value })}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Used for script generation with GPT-4
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">ElevenLabs API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter your ElevenLabs key"
                      value={settings.elevenLabsKey}
                      onChange={(e) => setSettings({ ...settings, elevenLabsKey: e.target.value })}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Used for AI voice generation
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pexels API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter your Pexels key"
                      value={settings.pexelsKey}
                      onChange={(e) => setSettings({ ...settings, pexelsKey: e.target.value })}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Used for stock video footage
                    </p>
                  </div>
                </>
              )}

              {/* Video Generation Tab */}
              {activeTab === 'generation' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: '24px' }}>
                    <Palette size={20} style={{ marginRight: '8px' }} />
                    Video Generation Settings
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Default Niche</label>
                    <select
                      className="form-select"
                      value={settings.defaultNiche}
                      onChange={(e) => setSettings({ ...settings, defaultNiche: e.target.value })}
                    >
                      <option value="money">Money & Finance</option>
                      <option value="psychology">Psychology</option>
                      <option value="tech">Technology</option>
                      <option value="health">Health & Wellness</option>
                      <option value="productivity">Productivity</option>
                      <option value="motivation">Motivation</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Default Voice</label>
                    <select
                      className="form-select"
                      value={settings.defaultVoice}
                      onChange={(e) => setSettings({ ...settings, defaultVoice: e.target.value })}
                    >
                      <option value="nova">Nova (Female)</option>
                      <option value="alloy">Alloy (Neutral)</option>
                      <option value="echo">Echo (Male)</option>
                      <option value="fable">Fable (British)</option>
                      <option value="onyx">Onyx (Deep Male)</option>
                      <option value="shimmer">Shimmer (Soft Female)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.autoPost}
                        onChange={(e) => setSettings({ ...settings, autoPost: e.target.checked })}
                      />
                      <div>
                        <span style={{ fontWeight: 500 }}>Auto-post after generation</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          Automatically post to all connected platforms
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.watermark}
                        onChange={(e) => setSettings({ ...settings, watermark: e.target.checked })}
                      />
                      <div>
                        <span style={{ fontWeight: 500 }}>Add watermark</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          Add a subtle branding watermark to videos
                        </p>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: '24px' }}>
                    <Bell size={20} style={{ marginRight: '8px' }} />
                    Notification Settings
                  </h3>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.notifyOnComplete}
                        onChange={(e) => setSettings({ ...settings, notifyOnComplete: e.target.checked })}
                      />
                      <div>
                        <span style={{ fontWeight: 500 }}>Video completion</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          Get notified when video generation completes
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.notifyOnPost}
                        onChange={(e) => setSettings({ ...settings, notifyOnPost: e.target.checked })}
                      />
                      <div>
                        <span style={{ fontWeight: 500 }}>Post success</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          Get notified when videos are posted to platforms
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.notifyOnMilestone}
                        onChange={(e) => setSettings({ ...settings, notifyOnMilestone: e.target.checked })}
                      />
                      <div>
                        <span style={{ fontWeight: 500 }}>View milestones</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          Get notified when videos hit view milestones (1K, 10K, 100K)
                        </p>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* System Tab */}
              {activeTab === 'system' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: '24px' }}>
                    <Server size={20} style={{ marginRight: '8px' }} />
                    System Settings
                  </h3>

                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Backend Status</span>
                      <span className="badge badge-success">Connected</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>API Version</span>
                      <span>v1.0.0</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Videos Folder</span>
                      <span>/app/videos</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <button className="btn btn-secondary" style={{ marginRight: '12px' }}>
                      <RefreshCw size={16} /> Clear Cache
                    </button>
                    <button className="btn btn-secondary">
                      <Shield size={16} /> Check Connections
                    </button>
                  </div>

                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255, 107, 107, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 107, 107, 0.3)' }}>
                    <p style={{ fontWeight: 500, color: 'var(--error)', marginBottom: '8px' }}>Danger Zone</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      These actions are irreversible. Please be careful.
                    </p>
                    <button className="btn" style={{ background: 'var(--error)', color: 'white' }}>
                      Reset All Settings
                    </button>
                  </div>
                </>
              )}

              {/* Save Button */}
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="spinning" /> Saving...
                    </>
                  ) : saved ? (
                    <>
                      <Save size={16} /> Saved!
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
