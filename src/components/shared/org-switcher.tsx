'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
}

interface OrgSwitcherProps {
  memberships: OrgMembership[];
  activeOrganizationId: string;
}

export function OrgSwitcher({ memberships, activeOrganizationId }: OrgSwitcherProps) {
  const router = useRouter();
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const active = memberships.find((m) => m.organizationId === activeOrganizationId) ?? memberships[0];
  const hasMultiple = memberships.length > 1;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  function handleSwitch(orgId: string) {
    setOpen(false);
    if (orgId === activeOrganizationId) return;
    startTransition(async () => {
      await update({ activeOrganizationId: orgId });
      router.refresh();
    });
  }

  if (!active) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => hasMultiple && setOpen((p) => !p)}
        className={`w-full flex items-center gap-2 px-5 py-2 transition-colors ${
          hasMultiple ? 'hover:bg-slate-800/50 cursor-pointer' : 'cursor-default'
        }`}
        title={hasMultiple ? 'Cambiar de organización' : active.organizationName}
      >
        <span className="material-icons text-[18px] text-slate-500">business</span>
        <span className="flex-1 min-w-0 text-left text-[12px] font-semibold uppercase tracking-wider text-slate-400 truncate">
          {active.organizationName}
        </span>
        {hasMultiple && (
          <span
            className={`material-icons text-[18px] text-slate-500 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          >
            unfold_more
          </span>
        )}
      </button>

      {open && hasMultiple && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg bg-slate-800 border border-slate-700 shadow-xl overflow-hidden">
          {memberships.map((m) => {
            const isActive = m.organizationId === activeOrganizationId;
            return (
              <button
                key={m.organizationId}
                type="button"
                onClick={() => handleSwitch(m.organizationId)}
                disabled={isPending}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span className="material-icons text-[18px] flex-shrink-0">business</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.organizationName}</p>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">{m.role}</p>
                </div>
                {isActive && <span className="material-icons text-[16px] text-primary">check</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
