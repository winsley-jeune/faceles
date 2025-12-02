import { useState, useEffect } from 'react';
import {
  Building2, Save, Loader2, CheckCircle, AlertCircle, Plus, Trash2,
  ShoppingBag, GraduationCap, Briefcase, TrendingUp, DollarSign, Heart,
  Users, MessageSquare, Package, Target, Mic
} from 'lucide-react';
import api from '../api';

const INDUSTRIES = [
  { id: 'ecommerce', name: 'E-commerce / DTC', icon: ShoppingBag },
  { id: 'coaching', name: 'Coaching / Info Products', icon: GraduationCap },
  { id: 'saas', name: 'SaaS / Tech', icon: Briefcase },
  { id: 'agency', name: 'Agency / Services', icon: TrendingUp },
];

const CONTENT_GOALS = [
  { id: 'brand-awareness', name: 'Brand Awareness', icon: Heart },
  { id: 'lead-generation', name: 'Lead Generation', icon: Users },
  { id: 'direct-sales', name: 'Direct Sales', icon: DollarSign },
  { id: 'engagement', name: 'Engagement', icon: MessageSquare },
];

const BRAND_TONES = [
  { id: 'professional', name: 'Professional' },
  { id: 'friendly', name: 'Friendly' },
  { id: 'bold', name: 'Bold' },
  { id: 'educational', name: 'Educational' },
  { id: 'inspirational', name: 'Inspirational' },
  { id: 'urgent', name: 'Urgent' },
];

export default function BrandSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [brandData, setBrandData] = useState({
    business: {
      name: '',
      industry: '',
      description: '',
      uniqueValue: '',
      website: '',
    },
    targetAudience: {
      demographics: '',
      painPoints: [],
      desires: [],
    },
    brandVoice: {
      tone: 'professional',
      personality: [],
      keywords: [],
      avoidWords: [],
    },
    contentGoals: {
      primary: 'brand-awareness',
      secondary: [],
      callToActions: [],
    },
    products: [],
  });

  // Form state for adding items
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newDesire, setNewDesire] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newAvoidWord, setNewAvoidWord] = useState('');
  const [newCTA, setNewCTA] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', description: '', benefits: '' });

  useEffect(() => {
    loadBrandContext();
  }, []);

  const loadBrandContext = async () => {
    setLoading(true);
    try {
      const data = await api.getBrandContext();
      setBrandData({
        business: data.business || brandData.business,
        targetAudience: data.targetAudience || brandData.targetAudience,
        brandVoice: data.brandVoice || brandData.brandVoice,
        contentGoals: data.contentGoals || brandData.contentGoals,
        products: data.products || [],
      });
    } catch (err) {
      console.error('Failed to load brand context:', err);
      setError('Failed to load brand settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveBrandContext(brandData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save brand settings');
    } finally {
      setSaving(false);
    }
  };

  const updateBusiness = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      business: { ...prev.business, [field]: value }
    }));
  };

  const updateAudience = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      targetAudience: { ...prev.targetAudience, [field]: value }
    }));
  };

  const updateVoice = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      brandVoice: { ...prev.brandVoice, [field]: value }
    }));
  };

  const updateGoals = (field, value) => {
    setBrandData(prev => ({
      ...prev,
      contentGoals: { ...prev.contentGoals, [field]: value }
    }));
  };

  const addToArray = (section, field, value, setter) => {
    if (!value.trim()) return;
    setBrandData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: [...(prev[section][field] || []), value.trim()]
      }
    }));
    setter('');
  };

  const removeFromArray = (section, field, index) => {
    setBrandData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: prev[section][field].filter((_, i) => i !== index)
      }
    }));
  };

  const addProduct = () => {
    if (!newProduct.name.trim()) return;
    const product = {
      id: Date.now().toString(),
      name: newProduct.name,
      description: newProduct.description,
      benefits: newProduct.benefits.split(',').map(b => b.trim()).filter(Boolean),
    };
    setBrandData(prev => ({
      ...prev,
      products: [...prev.products, product]
    }));
    setNewProduct({ name: '', description: '', benefits: '' });
  };

  const removeProduct = (productId) => {
    setBrandData(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== productId)
    }));
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <Loader2 size={32} className="spinning" />
          <p>Loading brand settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1><Building2 size={28} /> Brand Settings</h1>
          <p>Configure your brand identity for AI-powered content generation</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <><Loader2 size={18} className="spinning" /> Saving...</>
          ) : saved ? (
            <><CheckCircle size={18} /> Saved!</>
          ) : (
            <><Save size={18} /> Save Changes</>
          )}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="brand-settings-grid">
        {/* Business Info */}
        <section className="settings-card">
          <h2><Building2 size={20} /> Business Information</h2>

          <div className="form-group">
            <label>Brand / Business Name</label>
            <input
              type="text"
              value={brandData.business.name}
              onChange={(e) => updateBusiness('name', e.target.value)}
              placeholder="Your brand name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Industry</label>
            <div className="option-grid cols-2">
              {INDUSTRIES.map((industry) => {
                const Icon = industry.icon;
                const isSelected = brandData.business.industry === industry.id;
                return (
                  <div
                    key={industry.id}
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => updateBusiness('industry', industry.id)}
                  >
                    <Icon size={20} />
                    <span>{industry.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Business Description</label>
            <textarea
              value={brandData.business.description}
              onChange={(e) => updateBusiness('description', e.target.value)}
              placeholder="What does your business do?"
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Unique Value Proposition</label>
            <textarea
              value={brandData.business.uniqueValue}
              onChange={(e) => updateBusiness('uniqueValue', e.target.value)}
              placeholder="What makes you different from competitors?"
              className="form-textarea"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Website</label>
            <input
              type="text"
              value={brandData.business.website}
              onChange={(e) => updateBusiness('website', e.target.value)}
              placeholder="https://yoursite.com"
              className="form-input"
            />
          </div>
        </section>

        {/* Target Audience */}
        <section className="settings-card">
          <h2><Target size={20} /> Target Audience</h2>

          <div className="form-group">
            <label>Ideal Customer Demographics</label>
            <textarea
              value={brandData.targetAudience.demographics}
              onChange={(e) => updateAudience('demographics', e.target.value)}
              placeholder="Describe your ideal customer (age, gender, location, interests...)"
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Pain Points</label>
            <div className="tag-input-container">
              <div className="tags-list">
                {brandData.targetAudience.painPoints?.map((point, i) => (
                  <span key={i} className="tag">
                    {point}
                    <button onClick={() => removeFromArray('targetAudience', 'painPoints', i)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input
                  type="text"
                  value={newPainPoint}
                  onChange={(e) => setNewPainPoint(e.target.value)}
                  placeholder="Add a pain point..."
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && addToArray('targetAudience', 'painPoints', newPainPoint, setNewPainPoint)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addToArray('targetAudience', 'painPoints', newPainPoint, setNewPainPoint)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Desires / Goals</label>
            <div className="tag-input-container">
              <div className="tags-list">
                {brandData.targetAudience.desires?.map((desire, i) => (
                  <span key={i} className="tag tag-success">
                    {desire}
                    <button onClick={() => removeFromArray('targetAudience', 'desires', i)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input
                  type="text"
                  value={newDesire}
                  onChange={(e) => setNewDesire(e.target.value)}
                  placeholder="Add a desire/goal..."
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && addToArray('targetAudience', 'desires', newDesire, setNewDesire)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addToArray('targetAudience', 'desires', newDesire, setNewDesire)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Voice */}
        <section className="settings-card">
          <h2><Mic size={20} /> Brand Voice</h2>

          <div className="form-group">
            <label>Tone</label>
            <div className="option-grid cols-3">
              {BRAND_TONES.map((tone) => (
                <div
                  key={tone.id}
                  className={`option-card small ${brandData.brandVoice.tone === tone.id ? 'selected' : ''}`}
                  onClick={() => updateVoice('tone', tone.id)}
                >
                  <span>{tone.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Keywords to Use</label>
            <div className="tag-input-container">
              <div className="tags-list">
                {brandData.brandVoice.keywords?.map((keyword, i) => (
                  <span key={i} className="tag tag-primary">
                    {keyword}
                    <button onClick={() => removeFromArray('brandVoice', 'keywords', i)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add a keyword..."
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && addToArray('brandVoice', 'keywords', newKeyword, setNewKeyword)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addToArray('brandVoice', 'keywords', newKeyword, setNewKeyword)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Words to Avoid</label>
            <div className="tag-input-container">
              <div className="tags-list">
                {brandData.brandVoice.avoidWords?.map((word, i) => (
                  <span key={i} className="tag tag-error">
                    {word}
                    <button onClick={() => removeFromArray('brandVoice', 'avoidWords', i)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input
                  type="text"
                  value={newAvoidWord}
                  onChange={(e) => setNewAvoidWord(e.target.value)}
                  placeholder="Add a word to avoid..."
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && addToArray('brandVoice', 'avoidWords', newAvoidWord, setNewAvoidWord)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addToArray('brandVoice', 'avoidWords', newAvoidWord, setNewAvoidWord)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Content Goals */}
        <section className="settings-card">
          <h2><Target size={20} /> Content Goals</h2>

          <div className="form-group">
            <label>Primary Goal</label>
            <div className="option-grid cols-2">
              {CONTENT_GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = brandData.contentGoals.primary === goal.id;
                return (
                  <div
                    key={goal.id}
                    className={`option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => updateGoals('primary', goal.id)}
                  >
                    <Icon size={20} />
                    <span>{goal.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Custom CTAs</label>
            <div className="tag-input-container">
              <div className="tags-list">
                {brandData.contentGoals.callToActions?.map((cta, i) => (
                  <span key={i} className="tag tag-success">
                    {cta}
                    <button onClick={() => removeFromArray('contentGoals', 'callToActions', i)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-row">
                <input
                  type="text"
                  value={newCTA}
                  onChange={(e) => setNewCTA(e.target.value)}
                  placeholder="Add a custom CTA..."
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && addToArray('contentGoals', 'callToActions', newCTA, setNewCTA)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addToArray('contentGoals', 'callToActions', newCTA, setNewCTA)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="settings-card full-width">
          <h2><Package size={20} /> Products / Services</h2>

          <div className="products-grid">
            {brandData.products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-header">
                  <h4>{product.name}</h4>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => removeProduct(product.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p>{product.description}</p>
                {product.benefits?.length > 0 && (
                  <div className="product-benefits">
                    {product.benefits.map((b, i) => (
                      <span key={i} className="benefit-tag">{b}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="add-product-card">
              <h4>Add Product / Service</h4>
              <input
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Product name"
                className="form-input"
              />
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                className="form-textarea"
                rows={2}
              />
              <input
                type="text"
                value={newProduct.benefits}
                onChange={(e) => setNewProduct(prev => ({ ...prev, benefits: e.target.value }))}
                placeholder="Benefits (comma-separated)"
                className="form-input"
              />
              <button className="btn btn-primary" onClick={addProduct}>
                <Plus size={16} /> Add Product
              </button>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .page-container {
          padding: 32px;
          max-width: 1400px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .page-header h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 28px;
          margin-bottom: 8px;
        }

        .page-header p {
          color: var(--text-muted);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: var(--error);
          margin-bottom: 24px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 0;
          color: var(--text-muted);
        }

        .brand-settings-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .settings-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
        }

        .settings-card.full-width {
          grid-column: 1 / -1;
        }

        .settings-card h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--primary);
        }

        .form-textarea {
          resize: vertical;
          min-height: 70px;
        }

        .option-grid {
          display: grid;
          gap: 10px;
        }

        .option-grid.cols-2 {
          grid-template-columns: repeat(2, 1fr);
        }

        .option-grid.cols-3 {
          grid-template-columns: repeat(3, 1fr);
        }

        .option-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px;
          background: var(--bg-primary);
          border: 2px solid var(--border-color);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .option-card:hover {
          border-color: var(--primary);
        }

        .option-card.selected {
          border-color: var(--primary);
          background: rgba(139, 92, 246, 0.1);
        }

        .option-card.small {
          padding: 10px;
          justify-content: center;
        }

        .tag-input-container {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .tag {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          font-size: 13px;
        }

        .tag button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
          font-size: 16px;
        }

        .tag.tag-primary {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .tag.tag-success {
          background: rgba(34, 197, 94, 0.2);
          color: var(--success);
        }

        .tag.tag-error {
          background: rgba(239, 68, 68, 0.2);
          color: var(--error);
        }

        .tag-input-row {
          display: flex;
          gap: 8px;
        }

        .tag-input-row .form-input {
          flex: 1;
        }

        .btn-sm {
          padding: 8px 12px;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .product-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
        }

        .product-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .product-header h4 {
          font-size: 15px;
          font-weight: 600;
        }

        .product-card p {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .product-benefits {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .benefit-tag {
          padding: 2px 8px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 4px;
          font-size: 11px;
          color: var(--success);
        }

        .add-product-card {
          background: var(--bg-primary);
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .add-product-card h4 {
          font-size: 14px;
          color: var(--text-muted);
        }

        .btn-icon {
          padding: 6px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-muted);
        }

        .btn-icon:hover {
          background: var(--bg-secondary);
        }

        .btn-icon.btn-danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .brand-settings-grid {
            grid-template-columns: 1fr;
          }

          .option-grid.cols-3 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
