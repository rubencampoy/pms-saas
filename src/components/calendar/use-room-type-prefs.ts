'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface RoomTypePrefs {
  /** Room type ids rendered as header-only (unit rows hidden). */
  collapsed: string[];
  /** Room type ids removed from the timeline entirely. */
  hidden: string[];
}

const EMPTY_PREFS: RoomTypePrefs = { collapsed: [], hidden: [] };

const listeners = new Set<() => void>();
/** Cache keyed by storage key so getSnapshot returns a stable reference. */
const snapshotCache = new Map<string, { raw: string | null; value: RoomTypePrefs }>();

function parsePrefs(raw: string | null): RoomTypePrefs {
  if (!raw) return EMPTY_PREFS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_PREFS;
    const { collapsed, hidden } = parsed as { collapsed?: unknown; hidden?: unknown };
    const toIds = (value: unknown) =>
      Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    return { collapsed: toIds(collapsed), hidden: toIds(hidden) };
  } catch {
    return EMPTY_PREFS;
  }
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getSnapshot(key: string): RoomTypePrefs {
  const raw = readRaw(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = parsePrefs(raw);
  snapshotCache.set(key, { raw, value });
  return value;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

/**
 * Room type collapse/visibility preferences, persisted per property in localStorage.
 * Uses useSyncExternalStore so the server snapshot stays neutral and hydration is safe.
 */
export function useRoomTypePrefs(key: string) {
  const prefs = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key),
    () => EMPTY_PREFS,
  );

  const setPrefs = useCallback(
    (updater: (prev: RoomTypePrefs) => RoomTypePrefs) => {
      const next = updater(getSnapshot(key));
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode / quota) — keep the value in memory only
      }
      snapshotCache.set(key, { raw: readRaw(key), value: next });
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [prefs, setPrefs] as const;
}
