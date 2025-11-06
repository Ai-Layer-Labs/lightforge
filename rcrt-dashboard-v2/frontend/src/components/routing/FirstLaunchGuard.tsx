import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const FIRST_LAUNCH_KEY = 'rcrt-first-launch-completed';

interface FirstLaunchGuardProps {
  children: React.ReactNode;
}

/**
 * FirstLaunchGuard checks if this is the user's first time using RCRT
 * and redirects to Quick Start if needed.
 */
export function FirstLaunchGuard({ children }: FirstLaunchGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't redirect if already on quick-start page
    if (location.pathname === '/quick-start') {
      return;
    }

    // Check if first launch has been completed
    const firstLaunchCompleted = localStorage.getItem(FIRST_LAUNCH_KEY);
    
    if (!firstLaunchCompleted) {
      console.log('🚀 First launch detected, redirecting to Quick Start');
      navigate('/quick-start', { replace: true });
    }
  }, [location.pathname, navigate]);

  return <>{children}</>;
}

/**
 * Mark first launch as completed
 */
export function markFirstLaunchComplete() {
  localStorage.setItem(FIRST_LAUNCH_KEY, 'true');
  console.log('✅ First launch marked as complete');
}

/**
 * Reset first launch status (for testing/demo purposes)
 */
export function resetFirstLaunch() {
  localStorage.removeItem(FIRST_LAUNCH_KEY);
  console.log('🔄 First launch status reset');
}

/**
 * Check if first launch has been completed
 */
export function isFirstLaunchComplete(): boolean {
  return localStorage.getItem(FIRST_LAUNCH_KEY) === 'true';
}

