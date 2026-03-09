'use client';

import { useCallback, useEffect, useState } from 'react';

export interface Toast {
  id: string;
  variant: 'success' | 'error';
  title: string;
  description?: string;
}

let toastCount = 0;
const listeners = new Set<(t: Toast) => void>();

export function toast(opts: Omit<Toast, 'id'>) {
  const id = String(++toastCount);
  const t: Toast = { ...opts, id };
  for (const listener of listeners) {
    listener(t);
  }
  return id;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Toast) => {
    setToasts((prev) => [...prev, t]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  return { toasts, dismiss };
}
