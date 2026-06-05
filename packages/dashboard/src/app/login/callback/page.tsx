// ── Login Callback Page — handles PKCE redirect ──

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`);
      return;
    }

    if (!code || !returnedState) {
      setError('Missing authorization code or state parameter');
      return;
    }

    // Process the auth callback — we dispatch from the auth provider
    const processLogin = async () => {
      try {
        // The auth context's handleCallback is stored in a module-level var
        const { processAuthCallback } = await import('@/lib/auth');
        await processAuthCallback(code, returnedState);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    processLogin();
  }, [searchParams]);

  // Redirect when authenticated
  useEffect(() => {
    if (state.isAuthenticated) {
      router.push('/dashboard');
    }
  }, [state.isAuthenticated, router]);

  if (error || state.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md">
          <h2 className="text-lg font-semibold mb-2">Authentication Error</h2>
          <p>{error || state.error}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 text-primary hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
