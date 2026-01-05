import { useState, useEffect } from 'react';
import {
  Sliders, RefreshCw, TestTube, Zap, AlertTriangle,
  Youtube, Facebook, Instagram, Check, X, Info,
  TrendingUp, TrendingDown, Minus, Play, RotateCcw
} from 'lucide-react';
import api from '../api';

// TikTok icon
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const platformIcons = {
  youtube: <Youtube size={18} />,
  facebook: <Facebook size={18} />,
  instagram: <Instagram size={18} />,
  tiktok: <TikTokIcon size={18} />
};

const platformColors = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  tiktok: '#000000'
};

const strategyDescriptions = {
  'minimax': 'Minimize drop-off, maximize watch time',
  'tit-for-tat': 'Build trust through consistency',
  'nash-equilibrium': 'Balance follower engagement & reach',
  'expected-value': 'High risk, high reward lottery'
};

export default function ExplorationConfig() {
  const [config, setConfig] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, summaryRes] = await Promise.all([
        api.getExplorationConfig(),
        api.getExplorationSummary()
      ]);
      setConfig(configRes.config);
      setSummary(summaryRes.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const updateSetting = async (path, value) => {
    setSaving(true);
    try {
      await api.updateExplorationSetting(path, value);
      await loadConfig();
      showSuccess(`Updated ${path.split('.').pop()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setGlobalRate = async (rate) => {
    setSaving(true);
    try {
      await api.setExplorationRate(rate);
      await loadConfig();
      showSuccess(`Exploration rate set to ${Math.round(rate * 100)}%`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStupidHustle = async (enabled) => {
    setSaving(true);
    try {
      await api.setStupidHustleConfig({ enabled });
      await loadConfig();
      showSuccess(`Stupid Hustle ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const testPlatform = async (platform) => {
    setTesting(prev => ({ ...prev, [platform]: true }));
    try {
      const result = await api.testExploration(platform);
      setTestResults(prev => ({ ...prev, [platform]: result }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [platform]: { error: err.message } }));
    } finally {
      setTesting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const resetConfig = async () => {
    if (!confirm('Reset all exploration settings to defaults?')) return;
    setSaving(true);
    try {
      await api.resetExplorationConfig();
      await loadConfig();
      showSuccess('Config reset to defaults');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="exploration-config">
        <div className="loading-state">
          <RefreshCw className="spinning" size={32} />
          <p>Loading exploration config...</p>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="exploration-config">
        <div className="error-state">
          <AlertTriangle size={32} />
          <p>{error}</p>
          <button onClick={loadConfig}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exploration-config">
      <div className="page-header">
        <div className="header-content">
          <h1><Sliders size={28} /> Exploration Config</h1>
          <p>Control the balance between proven content (exploit) and experimental content (explore)</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadConfig} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <button className="btn-danger" onClick={resetConfig} disabled={saving}>
            <RotateCcw size={16} />
            Reset Defaults
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="success-toast">
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="error-toast">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Global Settings */}
      <section className="config-section">
        <h2>Global Settings</h2>
        <div className="config-cards">
          <div className="config-card highlight">
            <div className="card-header">
              <h3>Exploration Rate</h3>
              <span className="badge">{Math.round((config?.global?.exploration_rate || 0.3) * 100)}%</span>
            </div>
            <p>Percentage of content that will be experimental vs proven patterns</p>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((config?.global?.exploration_rate || 0.3) * 100)}
                onChange={(e) => setGlobalRate(parseInt(e.target.value) / 100)}
                disabled={saving}
              />
              <div className="slider-labels">
                <span>0% (All Exploit)</span>
                <span>100% (All Explore)</span>
              </div>
            </div>
            <div className="rate-visualization">
              <div
                className="exploit-bar"
                style={{ width: `${100 - (config?.global?.exploration_rate || 0.3) * 100}%` }}
              >
                Exploit {Math.round(100 - (config?.global?.exploration_rate || 0.3) * 100)}%
              </div>
              <div
                className="explore-bar"
                style={{ width: `${(config?.global?.exploration_rate || 0.3) * 100}%` }}
              >
                Explore {Math.round((config?.global?.exploration_rate || 0.3) * 100)}%
              </div>
            </div>
          </div>

          <div className="config-card">
            <div className="card-header">
              <h3>Master Switch</h3>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config?.global?.enabled ?? true}
                  onChange={(e) => updateSetting('global.enabled', e.target.checked)}
                  disabled={saving}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <p>Enable or disable exploration globally. When off, all content uses proven patterns.</p>
          </div>
        </div>
      </section>

      {/* Stupid Hustle Section */}
      <section className="config-section stupid-hustle-section">
        <h2><Zap size={20} /> Stupid Hustle Mode</h2>
        <p className="section-desc">Satirical "create the problem, sell the solution" content designed to spark comment wars</p>

        <div className="config-cards">
          <div className="config-card chaos-card">
            <div className="card-header">
              <h3>Enable Stupid Hustle</h3>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config?.stupid_hustle?.enabled ?? true}
                  onChange={(e) => toggleStupidHustle(e.target.checked)}
                  disabled={saving}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <p>When enabled, a portion of exploration content will be absurd hustle satire</p>

            {config?.stupid_hustle?.enabled && (
              <div className="hustle-stats">
                <div className="stat">
                  <span className="stat-label">Max per day</span>
                  <select
                    value={config?.stupid_hustle?.max_per_day || 3}
                    onChange={(e) => updateSetting('stupid_hustle.max_per_day', parseInt(e.target.value))}
                    disabled={saving}
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} videos</option>
                    ))}
                  </select>
                </div>
                <div className="stat">
                  <span className="stat-label">Platforms</span>
                  <span className="stat-value">{Array.isArray(config?.stupid_hustle?.platforms) ? config.stupid_hustle.platforms.join(', ') : 'All'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="config-card">
            <h3>Chaos Levels</h3>
            <div className="chaos-levels">
              {Object.entries(config?.stupid_hustle?.escalation_levels || {}).map(([level, pct]) => (
                <div key={level} className={`chaos-level ${level}`}>
                  <span className="level-name">{level}</span>
                  <div className="level-bar">
                    <div className="level-fill" style={{ width: `${pct * 100}%` }}></div>
                  </div>
                  <span className="level-pct">{Math.round(pct * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform-Specific Settings */}
      <section className="config-section">
        <h2>Platform Strategies</h2>
        <p className="section-desc">Each platform has its own game theory strategy for optimal content mix</p>

        <div className="platform-grid">
          {summary?.platforms?.map((p) => (
            <div key={p.platform} className="platform-card">
              <div className="platform-header" style={{ borderColor: platformColors[p.platform] }}>
                <div className="platform-icon" style={{ background: platformColors[p.platform] }}>
                  {platformIcons[p.platform]}
                </div>
                <div className="platform-info">
                  <h3>{p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}</h3>
                  <span className="strategy-tag">{p.strategy}</span>
                </div>
              </div>

              <div className="platform-stats">
                <div className="stat-row">
                  <span>Exploit (Proven)</span>
                  <span className="exploit-value">{p.exploit}</span>
                </div>
                <div className="stat-row">
                  <span>Explore (New)</span>
                  <span className="explore-value">{p.explore}</span>
                </div>
              </div>

              <p className="strategy-desc">{strategyDescriptions[p.strategy]}</p>

              <div className="platform-actions">
                <button
                  className="test-btn"
                  onClick={() => testPlatform(p.platform)}
                  disabled={testing[p.platform]}
                >
                  {testing[p.platform] ? (
                    <RefreshCw size={14} className="spinning" />
                  ) : (
                    <TestTube size={14} />
                  )}
                  Test Decision
                </button>
              </div>

              {testResults[p.platform] && (
                <div className={`test-result ${testResults[p.platform].exploration?.isExploration ? 'explore' : 'exploit'}`}>
                  {testResults[p.platform].error ? (
                    <span className="error">{testResults[p.platform].error}</span>
                  ) : (
                    <>
                      <div className="result-header">
                        {testResults[p.platform].exploration?.isExploration ? (
                          <><TrendingUp size={14} /> EXPLORE</>
                        ) : (
                          <><Minus size={14} /> EXPLOIT</>
                        )}
                      </div>
                      {testResults[p.platform].exploration?.type && (
                        <span className="result-type">Type: {testResults[p.platform].exploration.type}</span>
                      )}
                      {testResults[p.platform].stupidHustle?.isStupidHustle && (
                        <span className="stupid-hustle-badge">
                          <Zap size={12} /> Stupid Hustle ({testResults[p.platform].stupidHustle.escalationLevel})
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tone Distribution */}
      <section className="config-section">
        <h2>Tone Distribution</h2>
        <p className="section-desc">Controls the emotional tone of variations generated from winning videos</p>

        <div className="tone-distribution">
          <div className="tone-item safe">
            <div className="tone-header">
              <span className="tone-name">Safe</span>
              <span className="tone-pct">{summary?.toneDistribution?.safe || '30%'}</span>
            </div>
            <p>Educational, helpful, mass appeal</p>
            <div className="tone-bar">
              <div className="tone-fill" style={{ width: summary?.toneDistribution?.safe || '30%' }}></div>
            </div>
          </div>

          <div className="tone-item edgy">
            <div className="tone-header">
              <span className="tone-name">Edgy</span>
              <span className="tone-pct">{summary?.toneDistribution?.edgy || '40%'}</span>
            </div>
            <p>Provocative, polarizing, debate-starting</p>
            <div className="tone-bar">
              <div className="tone-fill" style={{ width: summary?.toneDistribution?.edgy || '40%' }}></div>
            </div>
          </div>

          <div className="tone-item controversial">
            <div className="tone-header">
              <span className="tone-name">Controversial</span>
              <span className="tone-pct">{summary?.toneDistribution?.controversial || '30%'}</span>
            </div>
            <p>Outrage-bait, taboo, unpopular opinions</p>
            <div className="tone-bar">
              <div className="tone-fill" style={{ width: summary?.toneDistribution?.controversial || '30%' }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-Adjustment Info */}
      <section className="config-section">
        <h2>Auto-Adjustment</h2>
        <div className="info-card">
          <Info size={20} />
          <div>
            <h4>Automatic Rate Adjustment: {config?.auto_adjust?.enabled ? 'Enabled' : 'Disabled'}</h4>
            <p>
              When enabled, the system automatically adjusts exploration rate based on performance:
            </p>
            <ul>
              <li><TrendingDown size={14} /> If viral rate {'<'} {(config?.auto_adjust?.increase_exploration_if?.viral_rate_below || 0.05) * 100}% → Increase exploration</li>
              <li><TrendingUp size={14} /> If viral rate {'>'} {(config?.auto_adjust?.decrease_exploration_if?.viral_rate_above || 0.15) * 100}% → Decrease exploration</li>
              <li>Min: {(config?.auto_adjust?.min_exploration || 0.1) * 100}% | Max: {(config?.auto_adjust?.max_exploration || 0.6) * 100}%</li>
            </ul>
          </div>
        </div>
      </section>

      <style>{`
        .exploration-config {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .page-header h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 28px;
          margin: 0;
        }

        .page-header p {
          color: var(--text-muted);
          margin: 8px 0 0 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn-secondary, .btn-danger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          background: var(--bg-tertiary);
        }

        .btn-danger {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .success-toast, .error-toast {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          animation: slideIn 0.3s ease;
        }

        .success-toast {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .error-toast {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .error-toast button {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .config-section {
          margin-bottom: 40px;
        }

        .config-section h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          margin-bottom: 8px;
        }

        .section-desc {
          color: var(--text-muted);
          margin-bottom: 20px;
        }

        .config-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .config-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border-color);
        }

        .config-card.highlight {
          border-color: var(--primary);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, var(--bg-secondary) 100%);
        }

        .config-card.chaos-card {
          border-color: #f59e0b;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, var(--bg-secondary) 100%);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .badge {
          background: var(--primary);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .config-card > p {
          color: var(--text-muted);
          font-size: 14px;
          margin: 0 0 16px 0;
        }

        .slider-container {
          margin: 16px 0;
        }

        .slider-container input[type="range"] {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: var(--bg-tertiary);
          -webkit-appearance: none;
          cursor: pointer;
        }

        .slider-container input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary);
          cursor: pointer;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 8px;
        }

        .rate-visualization {
          display: flex;
          height: 32px;
          border-radius: 8px;
          overflow: hidden;
          font-size: 12px;
          font-weight: 500;
        }

        .exploit-bar {
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          min-width: fit-content;
          padding: 0 8px;
        }

        .explore-bar {
          background: linear-gradient(90deg, #8b5cf6, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          min-width: fit-content;
          padding: 0 8px;
        }

        /* Toggle Switch */
        .toggle-switch {
          position: relative;
          width: 48px;
          height: 26px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-tertiary);
          transition: 0.3s;
          border-radius: 26px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background: var(--primary);
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(22px);
        }

        /* Hustle Stats */
        .hustle-stats {
          display: flex;
          gap: 16px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .hustle-stats .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hustle-stats .stat-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .hustle-stats select {
          padding: 6px 10px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          cursor: pointer;
        }

        /* Chaos Levels */
        .chaos-levels {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chaos-level {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .level-name {
          width: 80px;
          font-size: 14px;
          text-transform: capitalize;
        }

        .level-bar {
          flex: 1;
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          overflow: hidden;
        }

        .chaos-level.mild .level-fill {
          background: #22c55e;
        }

        .chaos-level.medium .level-fill {
          background: #f59e0b;
        }

        .chaos-level.extreme .level-fill {
          background: #ef4444;
        }

        .level-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .level-pct {
          width: 40px;
          text-align: right;
          font-size: 14px;
          font-weight: 500;
        }

        /* Platform Grid */
        .platform-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .platform-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border-color);
        }

        .platform-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
          margin-bottom: 16px;
          border-bottom: 2px solid;
        }

        .platform-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .platform-info h3 {
          margin: 0;
          font-size: 18px;
        }

        .strategy-tag {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: capitalize;
        }

        .platform-stats {
          margin-bottom: 12px;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .stat-row:last-child {
          border-bottom: none;
        }

        .exploit-value {
          color: #3b82f6;
          font-weight: 600;
        }

        .explore-value {
          color: #8b5cf6;
          font-weight: 600;
        }

        .strategy-desc {
          font-size: 13px;
          color: var(--text-muted);
          margin: 12px 0;
        }

        .platform-actions {
          margin-top: 16px;
        }

        .test-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          justify-content: center;
          transition: all 0.2s;
        }

        .test-btn:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .test-result {
          margin-top: 12px;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
        }

        .test-result.exploit {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .test-result.explore {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .result-type {
          display: block;
          color: var(--text-muted);
        }

        .stupid-hustle-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          padding: 4px 8px;
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          border-radius: 4px;
          font-size: 12px;
        }

        /* Tone Distribution */
        .tone-distribution {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .tone-item {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          border-left: 4px solid;
        }

        .tone-item.safe {
          border-color: #22c55e;
        }

        .tone-item.edgy {
          border-color: #f59e0b;
        }

        .tone-item.controversial {
          border-color: #ef4444;
        }

        .tone-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .tone-name {
          font-weight: 600;
          font-size: 16px;
        }

        .tone-pct {
          font-weight: 600;
          font-size: 18px;
        }

        .tone-item.safe .tone-pct { color: #22c55e; }
        .tone-item.edgy .tone-pct { color: #f59e0b; }
        .tone-item.controversial .tone-pct { color: #ef4444; }

        .tone-item p {
          color: var(--text-muted);
          font-size: 13px;
          margin: 0 0 12px 0;
        }

        .tone-bar {
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          overflow: hidden;
        }

        .tone-item.safe .tone-fill { background: #22c55e; }
        .tone-item.edgy .tone-fill { background: #f59e0b; }
        .tone-item.controversial .tone-fill { background: #ef4444; }

        .tone-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        /* Info Card */
        .info-card {
          display: flex;
          gap: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border-color);
        }

        .info-card > svg {
          flex-shrink: 0;
          color: var(--primary);
        }

        .info-card h4 {
          margin: 0 0 8px 0;
        }

        .info-card p {
          color: var(--text-muted);
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .info-card ul {
          margin: 0;
          padding-left: 20px;
        }

        .info-card li {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 13px;
          margin-bottom: 4px;
        }

        /* Loading & Error States */
        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: var(--text-muted);
          gap: 16px;
        }

        .error-state button {
          padding: 10px 20px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
