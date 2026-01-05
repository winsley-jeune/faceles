import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Ban,
  Play,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

/**
 * Jobs Dashboard
 * Shows all user's video generation jobs with real-time progress
 * Features: filtering, live updates, job cancellation, retry
 */
export default function Jobs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [newJobId, setNewJobId] = useState(null);

  // Show success message if redirected from CreateVideo page
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      setNewJobId(location.state.newJobId);

      // Clear the message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

      // Clear navigation state to prevent message showing again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    loadJobs();
    loadStats();

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      loadJobs();
      loadStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [filter]);

  const loadJobs = async () => {
    try {
      const statusFilter = filter === 'all' ? undefined : filter;
      const response = await api.listJobs({ status: statusFilter, limit: 100 });
      setJobs(response.jobs || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.getJobStats();
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!confirm('Cancel this job?')) return;

    try {
      await api.cancelJob(jobId);
      loadJobs();
      loadStats();
    } catch (error) {
      alert(`Failed to cancel job: ${error.message}`);
    }
  };

  const handleRetryJob = async (job) => {
    try {
      // Create a new job with the same parameters
      const response = await api.createVideoJob({
        niche: job.inputParams.niche,
        topic: job.inputParams.topic,
        autoPost: job.inputParams.autoPost
      });
      alert(`Job retried! New job ID: ${response.jobId}`);
      loadJobs();
    } catch (error) {
      alert(`Failed to retry job: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Loader2 size={40} className="spin" style={{ margin: '0 auto 20px' }} />
        <p>Loading jobs...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Success Message Banner */}
      {successMessage && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <CheckCircle size={24} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{successMessage}</div>
            <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
              Your video is being generated in the background. You can navigate away - progress is saved!
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>
          Video Generation Jobs
        </h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Track your background video generation jobs in real-time
        </p>

        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <StatCard label="Total" value={stats.total} color="#3b82f6" />
            <StatCard label="Queued" value={stats.queued} color="#f59e0b" />
            <StatCard label="Processing" value={stats.processing} color="#8b5cf6" icon={<Loader2 size={20} className="spin" />} />
            <StatCard label="Completed" value={stats.completed} color="#10b981" />
            <StatCard label="Failed" value={stats.failed} color="#ef4444" />
            <StatCard label="Cancelled" value={stats.cancelled} color="#6b7280" />
          </div>
        )}

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All Jobs
          </FilterButton>
          <FilterButton active={filter === 'queued'} onClick={() => setFilter('queued')}>
            Queued
          </FilterButton>
          <FilterButton active={filter === 'processing'} onClick={() => setFilter('processing')}>
            Processing
          </FilterButton>
          <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>
            Completed
          </FilterButton>
          <FilterButton active={filter === 'failed'} onClick={() => setFilter('failed')}>
            Failed
          </FilterButton>
        </div>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '2px dashed #e5e7eb'
        }}>
          <AlertCircle size={48} style={{ color: '#9ca3af', margin: '0 auto 15px' }} />
          <h3 style={{ fontSize: '18px', color: '#374151', marginBottom: '8px' }}>
            No jobs found
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            {filter === 'all'
              ? 'Create your first video to get started!'
              : `No ${filter} jobs at the moment.`
            }
          </p>
          <button
            onClick={() => navigate('/create')}
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Create Video
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onCancel={handleCancelJob}
              onRetry={handleRetryJob}
              isNew={job.id === newJobId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'white',
      padding: '15px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      {icon || <div style={{ width: '20px', height: '20px', background: color, borderRadius: '4px' }} />}
      <div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{value}</div>
        <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: '6px',
        border: active ? '2px solid #3b82f6' : '1px solid #d1d5db',
        background: active ? '#eff6ff' : 'white',
        color: active ? '#3b82f6' : '#374151',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? '600' : '400',
        transition: 'all 0.2s'
      }}
    >
      {children}
    </button>
  );
}

function JobCard({ job, onCancel, onRetry, isNew }) {
  const statusConfig = {
    queued: { icon: <Clock size={20} />, color: '#f59e0b', bg: '#fef3c7', label: 'Queued' },
    processing: { icon: <Loader2 size={20} className="spin" />, color: '#8b5cf6', bg: '#ede9fe', label: 'Processing' },
    completed: { icon: <CheckCircle size={20} />, color: '#10b981', bg: '#d1fae5', label: 'Completed' },
    failed: { icon: <XCircle size={20} />, color: '#ef4444', bg: '#fee2e2', label: 'Failed' },
    cancelled: { icon: <Ban size={20} />, color: '#6b7280', bg: '#f3f4f6', label: 'Cancelled' }
  };

  const config = statusConfig[job.status] || statusConfig.queued;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getDuration = () => {
    if (!job.startedAt) return null;
    const start = new Date(job.startedAt);
    const end = job.completedAt ? new Date(job.completedAt) : new Date();
    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div style={{
      background: isNew ? 'linear-gradient(135deg, #fef3c7 0%, #fff 100%)' : 'white',
      border: isNew ? '2px solid #f59e0b' : '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      transition: 'all 0.2s',
      cursor: 'pointer',
      boxShadow: isNew ? '0 4px 16px rgba(245, 158, 11, 0.2)' : 'none'
    }}
    onMouseEnter={(e) => e.currentTarget.style.boxShadow = isNew ? '0 6px 20px rgba(245, 158, 11, 0.3)' : '0 4px 12px rgba(0,0,0,0.1)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = isNew ? '0 4px 16px rgba(245, 158, 11, 0.2)' : 'none'}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: config.bg,
            color: config.color,
            padding: '8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center'
          }}>
            {config.icon}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
              {job.jobType.replace('_', ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {formatDate(job.createdAt)}
            </div>
          </div>
        </div>
        <div style={{
          background: config.bg,
          color: config.color,
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {config.label}
        </div>
      </div>

      {/* Topic/Niche */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
          <strong>Niche:</strong> {job.inputParams?.niche || 'N/A'}
        </div>
        {job.inputParams?.topic && (
          <div style={{ fontSize: '14px', color: '#374151' }}>
            <strong>Topic:</strong> {job.inputParams.topic}
          </div>
        )}
      </div>

      {/* Progress Bar (for processing jobs) */}
      {job.status === 'processing' && job.progress && (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{job.progress.message || 'Processing...'}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#8b5cf6' }}>
              {Math.round(job.progress.percentage || 0)}%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${job.progress.percentage || 0}%`,
              height: '100%',
              background: '#8b5cf6',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Step: {job.progress.currentStep || 'Initializing'}
          </div>
        </div>
      )}

      {/* Error Message (for failed jobs) */}
      {job.status === 'failed' && job.error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '15px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>
            Error:
          </div>
          <div style={{ fontSize: '12px', color: '#991b1b' }}>
            {job.error}
          </div>
        </div>
      )}

      {/* Result (for completed jobs) */}
      {job.status === 'completed' && job.result && (
        <div style={{
          background: '#d1fae5',
          border: '1px solid #6ee7b7',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '15px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#047857', marginBottom: '8px' }}>
            Video Generated Successfully!
          </div>
          {job.result.videoPath && (
            <div style={{ fontSize: '12px', color: '#065f46' }}>
              <strong>File:</strong> {job.result.videoPath.split('/').pop()}
            </div>
          )}
          {getDuration() && (
            <div style={{ fontSize: '12px', color: '#065f46', marginTop: '4px' }}>
              <strong>Duration:</strong> {getDuration()}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
        {['queued', 'processing'].includes(job.status) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(job.id);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #ef4444',
              background: 'white',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '500'
            }}
          >
            <Ban size={14} />
            Cancel
          </button>
        )}
        {job.status === 'failed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry(job);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              background: 'white',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '500'
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>

      {/* Job ID (small, for reference) */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #f3f4f6',
        fontSize: '11px',
        color: '#9ca3af',
        fontFamily: 'monospace'
      }}>
        ID: {job.id}
      </div>
    </div>
  );
}

// Add spin animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);
