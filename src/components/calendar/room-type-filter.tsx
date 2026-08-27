'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface RoomTypeFilterItem {
  id: string;
  name: string;
  unitCount: number;
}

interface RoomTypeFilterProps {
  roomTypes: RoomTypeFilterItem[];
  hiddenIds: Set<string>;
  collapsedIds: Set<string>;
  onToggleHidden: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onShowAll: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

export function RoomTypeFilter({
  roomTypes,
  hiddenIds,
  collapsedIds,
  onToggleHidden,
  onToggleCollapsed,
  onShowAll,
  onCollapseAll,
  onExpandAll,
}: RoomTypeFilterProps) {
  const t = useTranslations('calendarToolbar');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const hiddenCount = roomTypes.filter((rt) => hiddenIds.has(rt.id)).length;
  const allCollapsed = roomTypes.length > 0 && roomTypes.every((rt) => collapsedIds.has(rt.id));

  const handleToggleAllCollapsed = useCallback(() => {
    if (allCollapsed) onExpandAll();
    else onCollapseAll();
  }, [allCollapsed, onCollapseAll, onExpandAll]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        title={t('roomTypeFilter')}
        className={`px-2 py-1.5 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
          hiddenCount > 0
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        <span className="material-icons text-[16px]">tune</span>
        <span className="hidden lg:inline whitespace-nowrap">{t('roomTypeFilter')}</span>
        {hiddenCount > 0 && (
          <span className="bg-primary text-white rounded-full px-1.5 text-[9px] font-bold leading-4">
            {roomTypes.length - hiddenCount}/{roomTypes.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-[#1a2632] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {t('roomTypes')}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleAllCollapsed}
                className="text-[10px] font-semibold text-slate-500 hover:text-primary px-1.5 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {allCollapsed ? t('expandAll') : t('collapseAll')}
              </button>
              <button
                onClick={onShowAll}
                disabled={hiddenCount === 0}
                className="text-[10px] font-semibold text-slate-500 hover:text-primary px-1.5 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:hover:text-slate-500"
              >
                {t('showAll')}
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {roomTypes.map((rt) => {
              const isHidden = hiddenIds.has(rt.id);
              const isCollapsed = collapsedIds.has(rt.id);
              return (
                <div
                  key={rt.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggleHidden(rt.id)}
                      className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50 accent-[#137fec]"
                    />
                    <span
                      className={`text-xs truncate ${
                        isHidden
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700 dark:text-slate-200 font-medium'
                      }`}
                    >
                      {rt.name}
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                    {t('unitCount', { count: rt.unitCount })}
                  </span>
                  <button
                    onClick={() => onToggleCollapsed(rt.id)}
                    disabled={isHidden}
                    title={isCollapsed ? t('expandGroup') : t('collapseGroup')}
                    className="p-0.5 rounded text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:hover:text-slate-400"
                  >
                    <span className="material-icons text-[16px]">
                      {isCollapsed ? 'unfold_more' : 'unfold_less'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
