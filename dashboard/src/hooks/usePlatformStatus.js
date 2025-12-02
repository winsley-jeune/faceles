import { useState, useEffect, useCallback } from 'react';
import api from '../api';

/**
 * Hook to track platform connection status across the app
 */
export function usePlatformStatus() {
  const [status, setStatus] = useState({
    youtube: { connected: false, loading: true },
    tiktok: { connected: false, loading: true },
    facebook: { connected: false, loading: true },
    instagram: { connected: false, loading: true },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [youtube, tiktok, facebook, instagram] = await Promise.allSettled([
        api.checkYouTubeStatus(),
        api.checkTikTokStatus(),
        api.checkFacebookStatus(),
        api.checkInstagramStatus(),
      ]);

      setStatus({
        youtube: {
          connected: youtube.status === 'fulfilled' && youtube.value?.connected,
          loading: false,
          ...(youtube.status === 'fulfilled' ? youtube.value : {}),
        },
        tiktok: {
          connected: tiktok.status === 'fulfilled' && tiktok.value?.connected,
          loading: false,
          ...(tiktok.status === 'fulfilled' ? tiktok.value : {}),
        },
        facebook: {
          connected: facebook.status === 'fulfilled' && facebook.value?.connected,
          loading: false,
          ...(facebook.status === 'fulfilled' ? facebook.value : {}),
        },
        instagram: {
          connected: instagram.status === 'fulfilled' && instagram.value?.connected,
          loading: false,
          ...(instagram.status === 'fulfilled' ? instagram.value : {}),
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connectedPlatforms = Object.entries(status)
    .filter(([_, s]) => s.connected)
    .map(([name]) => name);

  const connectedCount = connectedPlatforms.length;
  const hasAnyPlatform = connectedCount > 0;

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
    connectedPlatforms,
    connectedCount,
    hasAnyPlatform,
  };
}

export default usePlatformStatus;
