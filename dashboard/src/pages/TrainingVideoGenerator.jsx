import { useState, useRef, useEffect } from 'react';
import { GraduationCap, Upload, Loader2, Play, Check, X, Plus, Trash2, FileImage, FileVideo, Sparkles, Shield, BookOpen, Users, Cog, ClipboardList, User, Globe, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import api from '../api';

// Video Types
const VIDEO_TYPES = [
  { id: 'training', label: 'General Training', icon: GraduationCap, description: 'Standard training module for any topic' },
  { id: 'safety', label: 'Safety Training', icon: Shield, description: 'Safety procedures and hazard awareness' },
  { id: 'sop', label: 'Standard Operating Procedure', icon: ClipboardList, description: 'Step-by-step operational procedures' },
  { id: 'onboarding', label: 'Employee Onboarding', icon: Users, description: 'Welcome and orientation for new hires' },
  { id: 'equipment_operation', label: 'Equipment Operation', icon: Cog, description: 'How to operate machinery/equipment' },
];

// CTA Types for Training
const TRAINING_CTA_TYPES = [
  { id: 'complete_training', label: 'Complete Training', description: 'Mark training as complete in LMS' },
  { id: 'take_quiz', label: 'Take Assessment', description: 'Proceed to quiz/assessment' },
  { id: 'practice', label: 'Practice Under Supervision', description: 'Apply learning with guidance' },
  { id: 'contact_supervisor', label: 'Contact Supervisor', description: 'Reach out for questions' },
  { id: 'none', label: 'No CTA', description: 'End without call to action' },
];

// Available languages for voiceover
const LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', label: 'French', flag: '🇫🇷' },
  { id: 'de', label: 'German', flag: '🇩🇪' },
  { id: 'it', label: 'Italian', flag: '🇮🇹' },
  { id: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { id: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { id: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { id: 'ko', label: 'Korean', flag: '🇰🇷' },
  { id: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { id: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { id: 'ru', label: 'Russian', flag: '🇷🇺' },
  { id: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { id: 'pl', label: 'Polish', flag: '🇵🇱' },
  { id: 'tr', label: 'Turkish', flag: '🇹🇷' },
  { id: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { id: 'th', label: 'Thai', flag: '🇹🇭' },
];

export default function TrainingVideoGenerator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Video type
  const [videoType, setVideoType] = useState('training');

  // Training info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [company, setCompany] = useState('');
  const [duration, setDuration] = useState(180);

  // Content
  const [steps, setSteps] = useState(['']);
  const [keyPoints, setKeyPoints] = useState(['']);

  // Media
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  // CTA
  const [ctaType, setCtaType] = useState('complete_training');
  const [customCta, setCustomCta] = useState('');

  // Avatar presenter
  const [useAvatar, setUseAvatar] = useState(false);
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [stockAvatars, setStockAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState('professional_female');
  const [customAvatarPath, setCustomAvatarPath] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef(null);

  // Multi-language
  const [selectedLanguages, setSelectedLanguages] = useState(['en']);
  const [voiceGender, setVoiceGender] = useState('female');

  // Document import
  const [importMode, setImportMode] = useState(false);
  const [documentPath, setDocumentPath] = useState(null);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const documentInputRef = useRef(null);

  // Check avatar API status on mount
  useEffect(() => {
    const checkAvatarStatus = async () => {
      try {
        const status = await api.checkAvatarStatus();
        setAvatarEnabled(status.enabled);
        if (status.enabled) {
          const avatarsData = await api.getStockAvatars();
          setStockAvatars(avatarsData.avatars || []);
        }
      } catch (err) {
        console.log('Avatar feature not available');
        setAvatarEnabled(false);
      }
    };
    checkAvatarStatus();
  }, []);

  // Steps management
  const addStep = () => setSteps([...steps, '']);
  const removeStep = (index) => setSteps(steps.filter((_, i) => i !== index));
  const updateStep = (index, value) => {
    const updated = [...steps];
    updated[index] = value;
    setSteps(updated);
  };

  // Key points management
  const addKeyPoint = () => setKeyPoints([...keyPoints, '']);
  const removeKeyPoint = (index) => setKeyPoints(keyPoints.filter((_, i) => i !== index));
  const updateKeyPoint = (index, value) => {
    const updated = [...keyPoints];
    updated[index] = value;
    setKeyPoints(updated);
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.name}. Please use images or videos.`);
        continue;
      }

      if (file.size > 100 * 1024 * 1024) {
        setError(`File too large: ${file.name}. Maximum size is 100MB`);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

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

  // Handle custom avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid avatar file. Please use an image or video.');
      return;
    }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.uploadCustomAvatar(formData);
      setCustomAvatarPath(response.path);
      setSelectedAvatar('custom');
    } catch (err) {
      setError(`Failed to upload avatar: ${err.message}`);
    } finally {
      setAvatarLoading(false);
    }
  };

  // Toggle language selection
  const toggleLanguage = (langId) => {
    if (selectedLanguages.includes(langId)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter(l => l !== langId));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, langId]);
    }
  };

  // Handle document upload for import
  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!validTypes.includes(file.type)) {
      setError('Unsupported file type. Please use PDF, Word, or text files.');
      return;
    }

    setDocumentLoading(true);
    setError(null);

    try {
      // Upload document
      const formData = new FormData();
      formData.append('file', file);

      const uploadResult = await api.uploadDocument(formData);
      setDocumentPath(uploadResult.path);

      // Analyze document
      const analysis = await api.analyzeDocument(uploadResult.path, videoType);

      setDocumentAnalysis(analysis);

      // Pre-fill form with extracted data
      if (analysis.trainingData) {
        setTitle(analysis.trainingData.title || '');
        setDescription(analysis.trainingData.description || '');
        if (analysis.trainingData.steps?.length > 0) {
          setSteps(analysis.trainingData.steps);
        }
        if (analysis.trainingData.keyPoints?.length > 0) {
          setKeyPoints(analysis.trainingData.keyPoints);
        }
      }

      setImportMode(false);
    } catch (err) {
      setError(`Document import failed: ${err.message}`);
    } finally {
      setDocumentLoading(false);
    }
  };

  // Upload media files
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

        const response = await api.uploadTrainingMedia(formData, (progress) => {
          setUploadProgress(prev => ({ ...prev, [media.id]: progress }));
        });

        setMediaFiles(prev => prev.map(m =>
          m.id === media.id ? { ...m, uploaded: true, serverPath: response.path } : m
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
      const uploadedPaths = await uploadMedia();

      const trainingData = {
        videoType,
        title,
        description,
        targetAudience,
        company,
        duration,
        steps: steps.filter(s => s.trim()),
        keyPoints: keyPoints.filter(p => p.trim()),
        mediaFiles: uploadedPaths,
        cta: {
          type: ctaType,
          customText: ctaType === 'custom' ? customCta : null,
        },
        // Avatar presenter options
        avatar: useAvatar ? {
          enabled: true,
          avatarId: selectedAvatar,
          customAvatarPath: customAvatarPath,
          highQuality: true
        } : null,
        // Multi-language options
        languages: selectedLanguages,
        voiceGender: voiceGender
      };

      const response = await api.generateTrainingVideo(trainingData);
      setResult(response);
      setStep(5);
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

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canProceedStep1 = videoType;
  const canProceedStep2 = title && description;
  const canProceedStep3 = steps.some(s => s.trim()) || keyPoints.some(p => p.trim());
  const canProceedStep4 = true;

  const currentVideoType = VIDEO_TYPES.find(v => v.id === videoType);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          <GraduationCap size={28} style={{ marginRight: '12px' }} />
          Training Video Generator
        </h1>
        <p className="page-subtitle">Create professional training and educational videos</p>
      </header>

      <div className="page-content">
        {/* Progress Steps */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', padding: '8px 0' }}>
            {[
              { num: 1, label: 'Video Type' },
              { num: 2, label: 'Details' },
              { num: 3, label: 'Content' },
              { num: 4, label: 'Media & CTA' },
              { num: 5, label: 'Generate' },
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
                <span style={{ fontWeight: step === s.num ? 600 : 400, fontSize: '14px' }}>{s.label}</span>
                {i < 4 && <div style={{ flex: 1, height: '2px', background: step > s.num ? 'var(--success)' : 'var(--border-color)' }} />}
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

        {/* Step 1: Video Type */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Select Training Video Type</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {VIDEO_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.id}
                    onClick={() => setVideoType(type.id)}
                    style={{
                      padding: '20px',
                      background: videoType === type.id ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-secondary)',
                      border: `2px solid ${videoType === type.id ? 'var(--primary)' : 'transparent'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={32} style={{ color: videoType === type.id ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '12px' }} />
                    <p style={{ fontWeight: 600, marginBottom: '4px', fontSize: '16px' }}>{type.label}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{type.description}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next: Training Details
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Training Details */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {currentVideoType?.icon && <currentVideoType.icon size={20} style={{ marginRight: '8px' }} />}
                {currentVideoType?.label} Details
              </h3>
            </div>

            {/* Document Import Option */}
            <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <input
                type="file"
                ref={documentInputRef}
                onChange={handleDocumentUpload}
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '10px',
                  background: documentAnalysis ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {documentLoading ? (
                    <Loader2 size={24} className="spinning" style={{ color: 'var(--primary)' }} />
                  ) : documentAnalysis ? (
                    <Check size={24} style={{ color: 'var(--success)' }} />
                  ) : (
                    <FileText size={24} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: '2px' }}>
                    {documentAnalysis ? 'Document Imported' : 'Import from Document'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {documentAnalysis
                      ? `Extracted: "${documentAnalysis.structure?.title || 'Content'}"`
                      : 'Upload a PDF, Word doc, or text file to auto-fill training content'}
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={documentLoading}
                >
                  {documentLoading ? (
                    <><Loader2 size={16} className="spinning" /> Analyzing...</>
                  ) : documentAnalysis ? (
                    <>Re-import</>
                  ) : (
                    <><Upload size={16} /> Upload Document</>
                  )}
                </button>
              </div>

              {documentAnalysis && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', gap: '24px', color: 'var(--text-muted)' }}>
                    <span>Pages: {documentAnalysis.documentInfo?.pages || 'N/A'}</span>
                    <span>Sections: {documentAnalysis.structure?.sections?.length || 0}</span>
                    <span>Key Points: {documentAnalysis.trainingData?.keyPoints?.length || 0}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Training Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder={`e.g., ${videoType === 'safety' ? 'Forklift Safety Procedures' : videoType === 'sop' ? 'Machine Startup Protocol' : 'New Employee Orientation'}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Description *</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Describe what this training covers and its objectives..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Target Audience</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., New warehouse employees"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company/Department</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., ABC Manufacturing"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Target Duration: {formatDuration(duration)}</label>
              <input
                type="range"
                min="60"
                max="600"
                step="30"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>1 min</span>
                <span>5 min</span>
                <span>10 min</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!canProceedStep2}>
                Next: Content
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Content */}
        {step === 3 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Training Content</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Add steps/procedures and key points to cover
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">
                {videoType === 'sop' || videoType === 'equipment_operation' ? 'Procedure Steps' : 'Training Steps/Sections'}
              </label>
              {steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ width: '30px', textAlign: 'center', paddingTop: '12px', color: 'var(--text-muted)' }}>{i + 1}.</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`${videoType === 'safety' ? 'Identify hazard, wear PPE, etc.' : 'Step description...'}`}
                    value={s}
                    onChange={(e) => updateStep(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {steps.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => removeStep(i)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addStep}>
                <Plus size={16} /> Add Step
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Key Points to Emphasize</label>
              {keyPoints.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Important point to remember..."
                    value={p}
                    onChange={(e) => updateKeyPoint(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {keyPoints.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => removeKeyPoint(i)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addKeyPoint}>
                <Plus size={16} /> Add Key Point
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(4)} disabled={!canProceedStep3}>
                Next: Media & CTA
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Media & CTA */}
        {step === 4 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Media & Call to Action</h3>
            </div>

            {/* Media Upload */}
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Training Media (Optional)</label>
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
                  padding: '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: '16px'
                }}
              >
                <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>Click or drag to upload</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Add images/videos of equipment, procedures, or demonstrations
                </p>
              </div>

              {mediaFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                  {mediaFiles.map((media) => (
                    <div key={media.id} style={{ position: 'relative', background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                        {media.type === 'image' && media.preview ? (
                          <img src={media.preview} alt={media.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <FileVideo size={32} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div style={{ padding: '8px', fontSize: '12px' }}>
                        <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.name}</p>
                        <p style={{ color: 'var(--text-muted)' }}>{formatSize(media.size)}</p>
                      </div>
                      <button
                        onClick={() => removeMedia(media.id)}
                        style={{
                          position: 'absolute', top: '4px', right: '4px', width: '24px', height: '24px',
                          borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Avatar Presenter */}
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">
                <User size={16} style={{ marginRight: '8px' }} />
                AI Avatar Presenter (Optional)
              </label>

              <div
                onClick={() => avatarEnabled && setUseAvatar(!useAvatar)}
                style={{
                  padding: '16px',
                  background: useAvatar ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-secondary)',
                  border: `2px solid ${useAvatar ? 'var(--primary)' : 'transparent'}`,
                  borderRadius: '12px',
                  cursor: avatarEnabled ? 'pointer' : 'not-allowed',
                  opacity: avatarEnabled ? 1 : 0.6,
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: useAvatar ? 'var(--primary)' : 'var(--bg-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <User size={24} style={{ color: useAvatar ? 'white' : 'var(--text-muted)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, marginBottom: '2px' }}>
                      {useAvatar ? 'Avatar Presenter Enabled' : 'Add AI Avatar Presenter'}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {avatarEnabled
                        ? 'Generate a realistic talking avatar using MuseTalk'
                        : 'Requires SIEVE_API_KEY (~$0.14/min)'}
                    </p>
                  </div>
                  {!avatarEnabled && (
                    <span style={{ fontSize: '12px', padding: '4px 8px', background: 'rgba(251, 191, 36, 0.2)', borderRadius: '4px', color: '#fbbf24' }}>
                      Not configured
                    </span>
                  )}
                </div>
              </div>

              {useAvatar && avatarEnabled && (
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                  <p style={{ fontWeight: 500, marginBottom: '12px', fontSize: '14px' }}>Select Avatar</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    {stockAvatars.map((avatar) => (
                      <div
                        key={avatar.id}
                        onClick={() => { setSelectedAvatar(avatar.id); setCustomAvatarPath(null); }}
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          background: selectedAvatar === avatar.id ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-primary)',
                          border: `2px solid ${selectedAvatar === avatar.id ? 'var(--primary)' : 'transparent'}`,
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-secondary)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={24} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: '12px', fontWeight: 500 }}>{avatar.name}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{avatar.gender}</p>
                      </div>
                    ))}
                    {/* Custom avatar upload */}
                    <div
                      onClick={() => avatarInputRef.current?.click()}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        background: selectedAvatar === 'custom' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-primary)',
                        border: `2px dashed ${selectedAvatar === 'custom' ? 'var(--primary)' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="file"
                        ref={avatarInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/*,video/mp4,video/webm"
                        style={{ display: 'none' }}
                      />
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-secondary)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {avatarLoading ? <Loader2 size={24} className="spinning" /> : <Plus size={24} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <p style={{ fontSize: '12px', fontWeight: 500 }}>Custom</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Upload</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Avatar generation costs ~$0.14 per minute of video
                  </p>
                </div>
              )}
            </div>

            {/* Multi-Language Voice */}
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">
                <Globe size={16} style={{ marginRight: '8px' }} />
                Voice & Language Options
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Voice Gender</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['female', 'male'].map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setVoiceGender(gender)}
                        className={`btn ${voiceGender === gender ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, textTransform: 'capitalize' }}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
                Languages (select multiple to generate versions)
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => toggleLanguage(lang.id)}
                    style={{
                      padding: '8px 12px',
                      background: selectedLanguages.includes(lang.id) ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-secondary)',
                      border: `2px solid ${selectedLanguages.includes(lang.id) ? 'var(--primary)' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px'
                    }}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {selectedLanguages.includes(lang.id) && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </button>
                ))}
              </div>
              {selectedLanguages.length > 1 && (
                <p style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '8px' }}>
                  Will generate {selectedLanguages.length} language versions (FREE with Edge-TTS)
                </p>
              )}
            </div>

            {/* CTA Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Closing Call to Action</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {TRAINING_CTA_TYPES.map((cta) => (
                  <div
                    key={cta.id}
                    onClick={() => setCtaType(cta.id)}
                    style={{
                      padding: '12px',
                      background: ctaType === cta.id ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-secondary)',
                      border: `2px solid ${ctaType === cta.id ? 'var(--primary)' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <p style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>{cta.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cta.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <><Loader2 size={16} className="spinning" /> Generating...</>
                ) : (
                  <><Sparkles size={16} /> Generate Training Video</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Result */}
        {step === 5 && result && (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
              }}>
                <Check size={40} style={{ color: 'var(--success)' }} />
              </div>
              <h2 style={{ marginBottom: '12px' }}>Training Video Generated!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                Your {currentVideoType?.label} video is ready
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
                <button className="btn btn-primary" onClick={() => window.location.href = '/publish'}>
                  <Upload size={16} /> Distribute Video
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setStep(1);
                    setResult(null);
                    setTitle('');
                    setDescription('');
                    setSteps(['']);
                    setKeyPoints(['']);
                    setMediaFiles([]);
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

        input[type="range"] {
          -webkit-appearance: none;
          height: 8px;
          background: var(--bg-secondary);
          border-radius: 4px;
          outline: none;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: var(--primary);
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
