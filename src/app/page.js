'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Fallback redirect if session status takes too long to respond
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'loading') {
        router.replace('/login');
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [status, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-purple border-t-transparent"></div>
        <p className="text-sm font-medium text-muted-text">Initializing Stack Shift...</p>
      </div>
    </div>
  );
}
