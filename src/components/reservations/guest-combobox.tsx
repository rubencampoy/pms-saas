'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { createGuest } from '@/server/actions/guests';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

interface GuestComboboxProps {
  guests: Guest[];
  value: string;
  onChange: (guestId: string) => void;
}

type View = 'search' | 'create';

export function GuestCombobox({ guests, value, onChange }: GuestComboboxProps) {
  const [view, setView] = useState<View>('search');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [localGuests, setLocalGuests] = useState(guests);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick-create form state
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const selectedGuest = localGuests.find((g) => g.id === value);

  const filtered = query.trim()
    ? localGuests.filter((g) => {
        const full = `${g.firstName} ${g.lastName} ${g.email ?? ''}`.toLowerCase();
        return full.includes(query.toLowerCase());
      })
    : localGuests;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setView('search');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(guestId: string) {
    onChange(guestId);
    setQuery('');
    setIsOpen(false);
  }

  function handleInputFocus() {
    setIsOpen(true);
    setView('search');
  }

  function handleCreateSubmit() {
    if (!newFirstName || !newLastName) return;
    setCreateError(null);

    startTransition(async () => {
      const result = await createGuest({
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail || undefined,
        phone: newPhone || undefined,
        vipStatus: 'none',
      });

      if (!result.success) {
        setCreateError(result.error);
        return;
      }

      const newGuest: Guest = {
        id: result.data.id,
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail || null,
      };

      setLocalGuests((prev) => [...prev, newGuest]);
      onChange(newGuest.id);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setQuery('');
      setView('search');
      setIsOpen(false);
    });
  }

  return (
    <div ref={containerRef} className="relative">
      {view === 'search' ? (
        <>
          {/* Search input */}
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              person_search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={isOpen ? query : (selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : '')}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => {
                handleInputFocus();
                setQuery('');
              }}
              placeholder="Search or create guest..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
            />
            {value && !isOpen && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-icons text-lg">close</span>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1a2632] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {/* Create new button */}
              <button
                type="button"
                onClick={() => setView('create')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 dark:hover:bg-primary/10 border-b border-slate-100 dark:border-slate-700 transition-colors"
              >
                <span className="material-icons text-lg">person_add</span>
                Create new guest
              </button>

              {/* Results */}
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-400">
                  No guests found
                </div>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelect(g.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                      g.id === value ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {g.firstName[0]}{g.lastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {g.firstName} {g.lastName}
                      </div>
                      {g.email && (
                        <div className="text-xs text-slate-400 truncate">{g.email}</div>
                      )}
                    </div>
                    {g.id === value && (
                      <span className="material-icons text-primary text-lg ml-auto">check</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        /* Quick-create form */
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-white/5">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              New Guest
            </span>
            <button
              type="button"
              onClick={() => {
                setView('search');
                setCreateError(null);
              }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <span className="material-icons text-lg">close</span>
            </button>
          </div>

          <div className="p-3 space-y-3">
            {createError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <span className="material-icons text-sm">error_outline</span>
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="First name *"
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
              <input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Last name *"
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateSubmit();
                  }
                }}
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isPending || !newFirstName || !newLastName}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <span className="material-icons animate-spin text-sm">progress_activity</span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-icons text-sm">person_add</span>
                  Create & Select
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
