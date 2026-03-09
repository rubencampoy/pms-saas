'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { useToast } from '@/lib/hooks/use-toast';

const VARIANT_STYLES = {
  success: {
    container:
      'bg-white dark:bg-[#1a2632] border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    iconName: 'check_circle',
  },
  error: {
    container:
      'bg-white dark:bg-[#1a2632] border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    iconName: 'error',
  },
} as const;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {toasts.map((t) => {
        const v = VARIANT_STYLES[t.variant];
        return (
          <ToastPrimitive.Root
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${v.container} animate-in slide-in-from-right fade-in duration-200`}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
          >
            <span className={`material-icons-round text-xl mt-0.5 ${v.icon}`}>
              {v.iconName}
            </span>
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <span className="material-icons-round text-lg">close</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}

      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[380px] max-w-[calc(100vw-2rem)]" />
    </ToastPrimitive.Provider>
  );
}
