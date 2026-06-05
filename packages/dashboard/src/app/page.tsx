// ── Root Page — Redirect to login or dashboard ──

'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { state } = useAuth();

  useEffect(() => {
    if (!state.isLoading) {
      if (state.isAuthenticated) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/login';
      }
    }
  }, [state.isLoading, state.isAuthenticated]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
