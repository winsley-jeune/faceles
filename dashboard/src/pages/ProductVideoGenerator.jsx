import { useState, useRef } from 'react';
import { Package, Upload, Loader2, Play, Check, X, Plus, Trash2, FileImage, FileVideo, Sparkles, Target, DollarSign, Phone, Mail, Globe } from 'lucide-react';
import api from '../api';

const CTA_TYPES = [
  { id: 'buy_now', label: 'Buy Now', icon: DollarSign, description: 'Direct purchase call-to-action' },
  { id: 'start_business', label: 'Start Your Business', icon: Target, description: 'Encourage entrepreneurship' },
  { id: 'contact_us', label: 'Contact Us', icon: Phone, description: 'Request for inquiry' },
  { id: 'visit_website', label: 'Visit Website', icon: Globe, description: 'Drive website traffic' },
  { id: 'custom', label: 'Custom CTA', icon: Sparkles, description: 'Write your own call-to-action' },
];

export default function ProductVideoGenerator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Product info
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [specifications, setSpecifications] = useState([{ key: '', value: '' }]);
  const [capabilities, setCapabilities] = useState(['']);
  const [targetAudience, setTargetAudience] = useState('');
  const [businessOpportunity, setBusinessOpportunity] = useState('');

  // Media
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  // CTA
  const [ctaType, setCtaType] = useState('start_business');
  const [customCta, setCustomCta] = useState('');
  const [contactInfo, setContactInfo] = useState({ email: '', phone: '', website: '' });

  // Add/remove specification rows
  const addSpec = () => setSpecifications([...specifications, { key: '', value: '' }]);
  const removeSpec = (index) => setSpecifications(specifications.filter((_, i) => i !== index));
  const updateSpec = (index, field, value) => {
    const updated = [...specifications];
    updated[index][field] = value;
    setSpecifications(updated);
  };

  // Add/remove capability rows
  const addCapability = () => setCapabilities([...capabilities, '']);
  const removeCapability = (index) => setCapabilities(capabilities.filter((_, i) => i !== index));
  const updateCapability = (index, value) => {
    const updated = [...capabilities];
    updated[index] = value;
    setCapabilities(updated);
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.name}. Please use images (JPG, PNG, WebP) or videos (MP4, WebM, MOV)`);
        continue;
      }

      if (file.size > 100 * 1024 * 1024) {
        setError(`File too large: ${file.name}. Maximum size is 100MB`);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null;

      setMediaFiles(prev => [...prev, {
        id,
        file,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        preview,
        uploaded: false,
      }]);
    }
  };

  const removeMedia = (id) => {
    const media = mediaFiles.find(m => m.id === id);
    if (media?.preview) URL.revokeObjectURL(media.preview);
    setMediaFiles(mediaFiles.filter(m => m.id !== id));
  };

  // Upload media files to server
  const uploadMedia = async () => {
    const uploadedFiles = [];

    for (const media of mediaFiles) {
      if (media.uploaded) {
        uploadedFiles.push(media.serverPath);
        continue;
      }

      try {
        setUploadProgress(prev => ({ ...prev, [media.id]: 0 }));

        const formData = new FormData();
        formData.append('file', media.file);
        formData.append('type', media.type);

        const response = await api.uploadProductMedia(formData, (progress) => {
          setUploadProgress(prev => ({ ...prev, [media.id]: progress }));
        });

        setMediaFiles(prev => prev.map(m =>
          m.id === media.id
            ? { ...m, uploaded: true, serverPath: response.path }
            : m
        ));

        uploadedFiles.push(response.path);
        setUploadProgress(prev => ({ ...prev, [media.id]: 100 }));
      } catch (err) {
        setError(`Failed to upload ${media.name}: ${err.message}`);
        throw err;
      }
    }

    return uploadedFiles;
  };

  // Generate video
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      // First upload all media
      const uploadedPaths = await uploadMedia();

      // Prepare product data
      const productData = {
        name: productName,
        description: productDescription,
        specifications: specifications.filter(s => s.key && s.value),
        capabilities: capabilities.filter(c => c.trim()),
        targetAudience,
        businessOpportunity,
        mediaFiles: uploadedPaths,
        cta: {
          type: ctaType,
          customText: ctaType === 'custom' ? customCta : null,
          contactInfo: {
            email: contactInfo.email || null,
            phone: contactInfo.phone || null,
            website: contactInfo.website || null,
          }
        }
      };

      // Generate video
      const response = await api.generateProductVideo(productData);
      setResult(response);
      setStep(4); // Success step
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const canProceedStep1 = productName && productDescription && capabilities.some(c => c.trim());
  const canProceedStep2 = mediaFiles.length > 0;
  const canProceedStep3 = ctaType && (ctaType !== 'custom' || customCta);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          <Package size={28} style={{ marginRight: '12px' }} />
          Product Video Generator
        </h1>
        <p className="page-subtitle">Create promotional videos for your products or machines</p>
      </header>

      <div className="page-content">
        {/* Progress Steps */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', padding: '8px 0' }}>
            {[
              { num: 1, label: 'Product Info' },
              { num: 2, label: 'Media' },
              { num: 3, label: 'Call to Action' },
              { num: 4, label: 'Generate' },
            ].map((s, i) => (
              <div
                key={s.num}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: step >= s.num ? 1 : 0.4
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: step > s.num ? 'var(--success)' : step === s.num ? 'var(--primary)' : 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '14px'
                }}>
                  {step > s.num ? <Check size={16} /> : s.num}
                </div>
                <span style={{ fontWeight: step === s.num ? 600 : 400 }}>{s.label}</span>
                {i < 3 && <div style={{ flex: 1, height: '2px', background: step > s.num ? 'var(--success)' : 'var(--border-color)' }} />}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--error)' }}>
              <X size={20} />
              <span>{error}</span>
              <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setError(null)}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Step 1: Product Information */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Product Information</h3>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Product/Machine Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Industrial Toilet Paper Roll Making Machine"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Description *</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Describe your product/machine and what it does..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Specifications</label>
              {specifications.map((spec, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Specification name"
                    value={spec.key}
                    onChange={(e) => updateSpec(i, 'key', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Value"
                    value={spec.value}
                    onChange={(e) => updateSpec(i, 'value', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {specifications.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => removeSpec(i)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addSpec}>
                <Plus size={16} /> Add Specification
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Key Capabilities *</label>
              {capabilities.map((cap, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Produces 5000 rolls per hour"
                    value={cap}
                    onChange={(e) => updateCapability(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {capabilities.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => removeCapability(i)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addCapability}>
                <Plus size={16} /> Add Capability
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Target Audience</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Entrepreneurs, Factory owners, Investors"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Business Opportunity Description</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Describe the business opportunity (ROI, market potential, etc.)"
                value={businessOpportunity}
                onChange={(e) => setBusinessOpportunity(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
              >
                Next: Add Media
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Media Upload */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Product Media</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Add images or videos of your product
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              style={{ display: 'none' }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '48px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '20px',
                transition: 'all 0.2s'
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files);
                handleFileSelect({ target: { files } });
              }}
            >
              <Upload size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <p style={{ fontWeight: 500, marginBottom: '8px' }}>Click or drag files to upload</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Supports: JPG, PNG, WebP, MP4, WebM, MOV (max 100MB each)
              </p>
            </div>

            {mediaFiles.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {mediaFiles.map((media) => (
                  <div
                    key={media.id}
                    style={{
                      position: 'relative',
                      background: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ aspectRatio: '16/9', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {media.type === 'image' && media.preview ? (
                        <img src={media.preview} alt={media.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : media.type === 'video' ? (
                        <FileVideo size={48} style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <FileImage size={48} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {media.name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatSize(media.size)} - {media.type === 'image' ? 'Image' : 'Video'}
                      </p>
                      {uploadProgress[media.id] !== undefined && uploadProgress[media.id] < 100 && (
                        <div style={{ marginTop: '8px', height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${uploadProgress[media.id]}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }} />
                        </div>
                      )}
                      {media.uploaded && (
                        <span className="badge badge-success" style={{ marginTop: '8px' }}>
                          <Check size={12} /> Uploaded
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeMedia(media.id)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
              >
                Next: Call to Action
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Call to Action */}
        {step === 3 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Call to Action</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                What action should viewers take?
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {CTA_TYPES.map((cta) => {
                const Icon = cta.icon;
                return (
                  <div
                    key={cta.id}
                    onClick={() => setCtaType(cta.id)}
                    style={{
                      padding: '16px',
                      background: ctaType === cta.id ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-secondary)',
                      border: `2px solid ${ctaType === cta.id ? 'var(--primary)' : 'transparent'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={24} style={{ color: ctaType === cta.id ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '8px' }} />
                    <p style={{ fontWeight: 500, marginBottom: '4px' }}>{cta.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cta.description}</p>
                  </div>
                );
              })}
            </div>

            {ctaType === 'custom' && (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Custom CTA Text</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Get your machine today and start earning!"
                  value={customCta}
                  onChange={(e) => setCustomCta(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '16px', fontWeight: 500 }}>Contact Information (Optional)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    <Mail size={14} style={{ marginRight: '6px' }} /> Email
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="sales@company.com"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Phone size={14} style={{ marginRight: '6px' }} /> Phone
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+1 (555) 123-4567"
                    value={contactInfo.phone}
                    onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Globe size={14} style={{ marginRight: '6px' }} /> Website
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://www.company.com"
                    value={contactInfo.website}
                    onChange={(e) => setContactInfo({ ...contactInfo, website: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!canProceedStep3 || loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinning" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Generate Video
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && result && (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <Check size={40} style={{ color: 'var(--success)' }} />
              </div>
              <h2 style={{ marginBottom: '12px' }}>Video Generated Successfully!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                Your product promotional video is ready
              </p>

              {result.videoPath && (
                <div style={{ marginBottom: '24px' }}>
                  <video
                    src={`http://localhost:3000/videos/${result.filename}`}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '12px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.href = '/publish'}
                >
                  <Upload size={16} /> Post to Platforms
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setStep(1);
                    setResult(null);
                    setProductName('');
                    setProductDescription('');
                    setSpecifications([{ key: '', value: '' }]);
                    setCapabilities(['']);
                    setTargetAudience('');
                    setBusinessOpportunity('');
                    setMediaFiles([]);
                    setCtaType('start_business');
                    setCustomCta('');
                    setContactInfo({ email: '', phone: '', website: '' });
                  }}
                >
                  <Plus size={16} /> Create Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .form-label {
          display: flex;
          align-items: center;
          font-weight: 500;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .form-input::placeholder {
          color: var(--text-muted);
        }

        textarea.form-input {
          resize: vertical;
          min-height: 100px;
        }
      `}</style>
    </>
  );
}
