'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[ProtectedRoute] State update', {
      isLoading,
      hasUser: Boolean(user),
      userId: user?.id ?? null,
      path: window.location.pathname,
    });
  }, [isLoading, user]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      console.warn('[ProtectedRoute] Still loading after 10s', {
        path: window.location.pathname,
        hasUser: Boolean(user),
      });
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, user]);

  useEffect(() => {
    if (!isLoading && !user) {
      console.log('[ProtectedRoute] Redirecting to /auth/login (no user)');
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#e2e8f0] border-t-[#1e293b] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748b]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
