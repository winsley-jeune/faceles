import { useState, useEffect } from 'react';
import {
  FlaskConical, Plus, Trophy, TrendingUp, Clock, Palette,
  Target, ChevronRight, RefreshCw, Loader2, AlertCircle,
  CheckCircle, BarChart3, Lightbulb, Play, Pause
} from 'lucide-react';
import api from '../api';

export default function ABTesting() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [winners, setWinners] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [applyingWinners, setApplyingWinners] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('youtube');

  // New experiment form state
  const [newExperiment, setNewExperiment] = useState({
    type: 'hook',
    platform: 'youtube',
    niche: 'general',
    variants: []
  });

  useEffect(() => {
    loadData();
  }, [selectedPlatform]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, recommendationsData, winnersData] = await Promise.all([
        api.getABTestingSummary(),
        api.getABTestingRecommendations(selectedPlatform),
        api.getABTestingWinners()
      ]);
      setSummary(summaryData);
      setRecommendations(recommendationsData);
      setWinners(winnersData.winners || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async (recommendation) => {
    setCreating(true);
    try {
      if (recommendation.type === 'hook') {
        await api.createHookExperiment(
          selectedPlatform,
          'general',
          recommendation.suggestedVariants
        );
      } else if (recommendation.type === 'duration') {
        await api.createDurationExperiment(
          selectedPlatform,
          recommendation.suggestedVariants
        );
      } else if (recommendation.type === 'visual') {
        await api.createVisualExperiment(
          selectedPlatform,
          recommendation.suggestedVariants
        );
      }
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleApplyWinners = async () => {
    setApplyingWinners(true);
    try {
      await api.applyABTestingWinners();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingWinners(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'hook': return <Target size={16} />;
      case 'duration': return <Clock size={16} />;
      case 'visual': return <Palette size={16} />;
      default: return <FlaskConical size={16} />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'hook': return '#8b5cf6';
      case 'duration': return '#3b82f6';
      case 'visual': return '#ec4899';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <Loader2 size={32} className="spinning" />
          <p>Loading A/B Testing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1><FlaskConical size={28} /> A/B Testing</h1>
          <p>Run experiments to find what works best for your audience</p>
        </div>
        <div className="header-actions">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="platform-select"
          >
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            New Experiment
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Play size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.active || 0}</span>
            <span className="stat-label">Active Experiments</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.completed || 0}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
            <Trophy size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.winningPatterns || 0}</span>
            <span className="stat-label">Winners Found</span>
          </div>
        </div>
        <div className="stat-card clickable" onClick={handleApplyWinners}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            {applyingWinners ? <Loader2 size={20} className="spinning" /> : <TrendingUp size={20} />}
          </div>
          <div className="stat-content">
            <span className="stat-value">Apply</span>
            <span className="stat-label">Winners to Generation</span>
          </div>
        </div>
      </div>

      <div className="content-grid">
        {/* Active Experiments */}
        <div className="content-section">
          <div className="section-header">
            <h2><FlaskConical size={20} /> Active Experiments</h2>
          </div>
          <div className="experiments-list">
            {summary?.experiments?.length > 0 ? (
              summary.experiments.map((exp) => (
                <div key={exp.id} className="experiment-card">
                  <div className="experiment-header">
                    <div className="experiment-type" style={{ color: getTypeColor(exp.type) }}>
                      {getTypeIcon(exp.type)}
                      <span>{exp.type.toUpperCase()}</span>
                    </div>
                    <span className="experiment-platform">{exp.platform}</span>
                  </div>
                  <h3 className="experiment-name">{exp.name}</h3>
                  <div className="experiment-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: exp.progress, background: getTypeColor(exp.type) }}
                      />
                    </div>
                    <span className="progress-label">{exp.progress} complete</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FlaskConical size={40} />
                <p>No active experiments</p>
                <span>Create one using the recommendations below</span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="content-section">
          <div className="section-header">
            <h2><Lightbulb size={20} /> Recommended Experiments</h2>
          </div>
          <div className="recommendations-list">
            {recommendations?.recommendations?.length > 0 ? (
              recommendations.recommendations.map((rec, idx) => (
                <div key={idx} className="recommendation-card">
                  <div className="recommendation-header">
                    <div className="recommendation-type" style={{ color: getTypeColor(rec.type) }}>
                      {getTypeIcon(rec.type)}
                      <span>{rec.type.charAt(0).toUpperCase() + rec.type.slice(1)} Test</span>
                    </div>
                  </div>
                  <p className="recommendation-reason">{rec.reason}</p>
                  <div className="recommendation-variants">
                    <span className="variants-label">Suggested variants:</span>
                    <div className="variants-list">
                      {rec.suggestedVariants.slice(0, 3).map((v, i) => (
                        <span key={i} className="variant-tag">
                          {typeof v === 'object' ? v.name : v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleQuickCreate(rec)}
                    disabled={creating}
                  >
                    {creating ? <Loader2 size={14} className="spinning" /> : <Plus size={14} />}
                    Quick Create
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <CheckCircle size={40} />
                <p>All experiment types are running!</p>
                <span>Check back once they complete</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Winners Section */}
      {winners.length > 0 && (
        <div className="content-section winners-section">
          <div className="section-header">
            <h2><Trophy size={20} /> Winning Patterns</h2>
            <button className="btn btn-secondary btn-sm" onClick={handleApplyWinners} disabled={applyingWinners}>
              {applyingWinners ? <Loader2 size={14} className="spinning" /> : <TrendingUp size={14} />}
              Apply All Winners
            </button>
          </div>
          <div className="winners-grid">
            {winners.map((winner, idx) => (
              <div key={idx} className="winner-card">
                <div className="winner-badge">
                  <Trophy size={16} />
                </div>
                <div className="winner-content">
                  <div className="winner-type" style={{ color: getTypeColor(winner.type) }}>
                    {getTypeIcon(winner.type)}
                    <span>{winner.type}</span>
                  </div>
                  <h3 className="winner-name">{winner.winner}</h3>
                  <div className="winner-stats">
                    <span className="winner-platform">{winner.platform}</span>
                    <span className="winner-improvement">+{(winner.improvement * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Experiment Modal */}
      {showCreateModal && (
        <CreateExperimentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
          platform={selectedPlatform}
        />
      )}

      <style>{`
        .page-container {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-content h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 28px;
          font-weight: 700;
          margin: 0;
        }

        .header-content p {
          color: var(--text-muted);
          margin: 8px 0 0 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .platform-select {
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .btn-secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          background: var(--bg-tertiary);
        }

        .btn-sm {
          padding: 8px 12px;
          font-size: 13px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          color: #ef4444;
          margin-bottom: 24px;
        }

        .error-banner button {
          margin-left: auto;
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          text-decoration: underline;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        .stat-card.clickable {
          cursor: pointer;
          transition: all 0.2s;
        }

        .stat-card.clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
        }

        .stat-label {
          font-size: 13px;
          color: var(--text-muted);
        }

        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }

        .content-section {
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border-color);
          padding: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .experiments-list, .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .experiment-card, .recommendation-card {
          padding: 16px;
          background: var(--bg-tertiary);
          border-radius: 10px;
          border: 1px solid var(--border-color);
        }

        .experiment-header, .recommendation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .experiment-type, .recommendation-type {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .experiment-platform {
          font-size: 12px;
          color: var(--text-muted);
          background: var(--bg-secondary);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .experiment-name {
          font-size: 15px;
          font-weight: 500;
          margin: 0 0 12px 0;
        }

        .experiment-progress {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: var(--bg-secondary);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s;
        }

        .progress-label {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .recommendation-reason {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0 0 12px 0;
        }

        .recommendation-variants {
          margin-bottom: 12px;
        }

        .variants-label {
          font-size: 12px;
          color: var(--text-muted);
          display: block;
          margin-bottom: 6px;
        }

        .variants-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .variant-tag {
          font-size: 12px;
          padding: 4px 10px;
          background: var(--bg-secondary);
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .empty-state {
          text-align: center;
          padding: 32px;
          color: var(--text-muted);
        }

        .empty-state svg {
          opacity: 0.3;
          margin-bottom: 12px;
        }

        .empty-state p {
          font-weight: 500;
          margin: 0;
        }

        .empty-state span {
          font-size: 13px;
        }

        .winners-section {
          margin-top: 0;
        }

        .winners-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .winner-card {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: var(--bg-tertiary);
          border-radius: 10px;
          border: 1px solid rgba(251, 191, 36, 0.3);
        }

        .winner-badge {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(251, 191, 36, 0.1);
          color: #fbbf24;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .winner-content {
          flex: 1;
        }

        .winner-type {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .winner-name {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .winner-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
        }

        .winner-platform {
          color: var(--text-muted);
        }

        .winner-improvement {
          color: #22c55e;
          font-weight: 600;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: var(--text-muted);
        }

        .loading-state p {
          margin-top: 16px;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .header-actions {
            width: 100%;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

// Create Experiment Modal Component
function CreateExperimentModal({ onClose, onCreated, platform }) {
  const [type, setType] = useState('hook');
  const [niche, setNiche] = useState('general');
  const [variants, setVariants] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (variants.filter(v => v.trim()).length < 2) {
      setError('At least 2 variants are required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const cleanVariants = variants.filter(v => v.trim());

      if (type === 'hook') {
        await api.createHookExperiment(
          platform,
          niche,
          cleanVariants.map(v => ({ name: v, config: { style: v.toLowerCase() } }))
        );
      } else if (type === 'duration') {
        await api.createDurationExperiment(
          platform,
          cleanVariants.map(v => parseInt(v) || 30)
        );
      } else if (type === 'visual') {
        await api.createVisualExperiment(platform, cleanVariants);
      }

      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const addVariant = () => {
    if (variants.length < 4) {
      setVariants([...variants, '']);
    }
  };

  const updateVariant = (index, value) => {
    const newVariants = [...variants];
    newVariants[index] = value;
    setVariants(newVariants);
  };

  const removeVariant = (index) => {
    if (variants.length > 2) {
      setVariants(variants.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Create New Experiment</h2>

        {error && (
          <div className="modal-error">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="form-group">
          <label>Experiment Type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="hook">Hook Style Test</option>
            <option value="duration">Video Duration Test</option>
            <option value="visual">Visual Theme Test</option>
          </select>
        </div>

        <div className="form-group">
          <label>Niche</label>
          <select value={niche} onChange={e => setNiche(e.target.value)}>
            <option value="general">General</option>
            <option value="psychology">Psychology</option>
            <option value="finance">Finance</option>
            <option value="motivation">Motivation</option>
            <option value="secrets">Secrets/Insider</option>
          </select>
        </div>

        <div className="form-group">
          <label>
            Variants (min 2, max 4)
            <span className="hint">
              {type === 'duration' ? 'Enter durations in seconds (e.g., 30, 45, 60)' :
               type === 'hook' ? 'Enter hook styles (e.g., Question, Shock, Story)' :
               'Enter theme names (e.g., cinematic, minimalist)'}
            </span>
          </label>
          {variants.map((v, i) => (
            <div key={i} className="variant-input-row">
              <input
                type={type === 'duration' ? 'number' : 'text'}
                value={v}
                onChange={e => updateVariant(i, e.target.value)}
                placeholder={`Variant ${i + 1}`}
              />
              {variants.length > 2 && (
                <button className="remove-btn" onClick={() => removeVariant(i)}>×</button>
              )}
            </div>
          ))}
          {variants.length < 4 && (
            <button className="add-variant-btn" onClick={addVariant}>
              <Plus size={14} /> Add Variant
            </button>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 size={14} className="spinning" /> : <FlaskConical size={14} />}
            Create Experiment
          </button>
        </div>

        <style>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal-content {
            background: var(--bg-secondary);
            border-radius: 16px;
            padding: 24px;
            width: 100%;
            max-width: 480px;
            max-height: 90vh;
            overflow-y: auto;
          }

          .modal-content h2 {
            margin: 0 0 20px 0;
            font-size: 20px;
          }

          .modal-error {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 8px;
            color: #ef4444;
            font-size: 13px;
            margin-bottom: 16px;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            font-weight: 500;
            margin-bottom: 8px;
            font-size: 14px;
          }

          .form-group .hint {
            display: block;
            font-weight: 400;
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 4px;
          }

          .form-group select,
          .form-group input {
            width: 100%;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            background: var(--bg-tertiary);
            color: var(--text-primary);
            font-size: 14px;
          }

          .variant-input-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }

          .variant-input-row input {
            flex: 1;
          }

          .remove-btn {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            background: var(--bg-tertiary);
            color: var(--text-muted);
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .remove-btn:hover {
            color: #ef4444;
            border-color: #ef4444;
          }

          .add-variant-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border: 1px dashed var(--border-color);
            border-radius: 8px;
            background: transparent;
            color: var(--text-muted);
            font-size: 13px;
            cursor: pointer;
            width: 100%;
            justify-content: center;
          }

          .add-variant-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--border-color);
          }
        `}</style>
      </div>
    </div>
  );
}
