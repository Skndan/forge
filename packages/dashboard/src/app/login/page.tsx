// ── Login Page ──

'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { state, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.isAuthenticated) {
      router.push('/dashboard');
    }
  }, [state.isAuthenticated, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">🔥 Forge</CardTitle>
          <CardDescription>Sign in to your admin dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {state.error}
            </div>
          )}
          <Button
            className="w-full h-12 text-base"
            onClick={login}
            disabled={state.isLoading}
          >
            {state.isLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2" />
            ) : null}
            Sign in with Keycloak
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
