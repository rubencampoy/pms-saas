'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { type DisplayOptions, SUB_ROW_LABELS, SUB_ROW_ICONS, ALL_SUB_ROWS } from './types';

interface DisplayOptionsMenuProps {
  options: DisplayOptions;
  onChange: (opts: Partial<DisplayOptions>) => void;
}

export function DisplayOptionsMenu({ options, onChange }: DisplayOptionsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
          <span className="material-icons text-lg">visibility</span>
          Display
          <span className="material-icons text-lg text-slate-400">expand_more</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[200px] bg-white dark:bg-[#1a2632] rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in-0 zoom-in-95"
        >
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Show rows
          </div>
          {ALL_SUB_ROWS.map((subRow) => {
            const isPrice = subRow === 'price';
            const checked = options[subRow];
            return (
              <DropdownMenu.CheckboxItem
                key={subRow}
                checked={checked}
                disabled={isPrice}
                onCheckedChange={(val) => onChange({ [subRow]: val })}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer outline-none data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
              >
                <span className="material-icons text-lg text-slate-400">
                  {checked ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span className="material-icons text-base text-slate-400">
                  {SUB_ROW_ICONS[subRow]}
                </span>
                {SUB_ROW_LABELS[subRow]}
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
