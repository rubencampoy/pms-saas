'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Wrapper that only renders children after hydration on the client.
 * Prevents SSR issues with libraries like Recharts that need a real DOM.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return fallback ?? null;
  return children;
}
