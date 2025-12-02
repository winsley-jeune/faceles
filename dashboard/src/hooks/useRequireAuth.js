import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to require authentication on a page
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectPath = '/login') {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Store return path
      sessionStorage.setItem('auth_return_path', window.location.pathname);
      navigate(redirectPath);
    }
  }, [isAuthenticated, loading, navigate, redirectPath]);

  return { isAuthenticated, loading };
}

/**
 * Hook to check if onboarding is needed
 */
export function useOnboardingCheck() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      const onboardingComplete = localStorage.getItem('onboarding_complete');
      if (!onboardingComplete) {
        navigate('/onboarding');
      }
    }
  }, [isAuthenticated, loading, navigate]);
}

export default useRequireAuth;
