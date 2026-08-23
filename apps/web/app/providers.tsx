"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { mutate as swrMutate } from 'swr';
import { useCurrentUserQuery } from '@/lib/queries/auth.queries';
import { useAuthStore } from '@/lib/auth/auth-store';

function AuthSyncBridge() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: currentUser } = useCurrentUserQuery(accessToken);

  useEffect(() => {
    if (!currentUser) return;

    const existing = useAuthStore.getState();
    const nextUser = {
      ...(existing.user || {}),
      id: currentUser.id,
      email: currentUser.email,
      fullName: currentUser.fullName,
      tenantId: currentUser.tenantId,
      roles: currentUser.roles,
      permissions: currentUser.permissions,
      mustChangePassword: currentUser.mustChangePassword,
    };

    const isSame =
      existing.user?.id === nextUser.id &&
      existing.user?.email === nextUser.email &&
      existing.user?.fullName === nextUser.fullName &&
      existing.user?.tenantId === nextUser.tenantId &&
      JSON.stringify(existing.user?.roles || []) === JSON.stringify(nextUser.roles || []) &&
      JSON.stringify(existing.user?.permissions || []) === JSON.stringify(nextUser.permissions || []) &&
      existing.user?.mustChangePassword === nextUser.mustChangePassword;

    if (!isSame) {
      useAuthStore.setState({
        ...existing,
        user: nextUser,
        isAuthenticated: true,
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const handleSessionRestored = () => {
      void queryClient.invalidateQueries();
      void swrMutate(() => true, undefined, { revalidate: true });
    };

    window.addEventListener('homeland:auth-session-restored', handleSessionRestored as EventListener);
    return () => window.removeEventListener('homeland:auth-session-restored', handleSessionRestored as EventListener);
  }, [queryClient]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSyncBridge />
      <Toaster
        position="top-right"
        containerStyle={{ zIndex: 100000 }}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '16px',
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.12)',
            padding: '14px 16px',
            fontSize: '13px',
            fontWeight: 700,
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
      {children}
    </QueryClientProvider>
  );
}
