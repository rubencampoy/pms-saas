'use client';

import type { DragEvent } from 'react';

interface ReservationBlockProps {
  id: string;
  status: string;
  confirmationCode: string;
  guestName: string | null;
  left: number;
  width: number;
  height: number;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const STATUS_COLORS: Record<string, { bg: string; hover: string }> = {
  confirmed: { bg: 'bg-primary', hover: 'hover:bg-primary/90' },
  checked_in: { bg: 'bg-green-500', hover: 'hover:bg-green-600' },
  checked_out: { bg: 'bg-slate-400 dark:bg-slate-600', hover: 'hover:bg-slate-500' },
  pending: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600' },
  cancelled: { bg: 'bg-red-400', hover: 'hover:bg-red-500' },
  no_show: { bg: 'bg-red-400', hover: 'hover:bg-red-500' },
};


const DRAGGABLE_STATUSES = new Set(['confirmed', 'checked_in']);

export function ReservationBlock({
  id,
  status,
  confirmationCode,
  guestName,
  left,
  width,
  height,
  isDragging,
  isSelected,
  onDragStart,
  onClick,
  onContextMenu,
}: ReservationBlockProps) {
  const colors = STATUS_COLORS[status] ?? { bg: 'bg-primary', hover: 'hover:bg-primary/90' };
  const isDraggable = DRAGGABLE_STATUSES.has(status);
  const w = Math.max(width, 28);

  return (
    <div
      data-reservation-id={id}
      data-status={status}
      data-draggable={isDraggable ? 'true' : 'false'}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) return;
        onDragStart(e);
      }}
      onClick={onClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e);
        }
      }}
      className={`absolute top-[3px] z-[1] ${colors.bg} text-white rounded-md shadow-sm flex items-center px-2 ${colors.hover} transition-colors select-none ${
        isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : ''} ${
        isSelected ? 'ring-2 ring-inset ring-white shadow-[0_0_0_2px_rgba(0,0,0,0.3)] z-[2]' : ''
      }`}
      style={{
        left,
        width: w,
        height,
      }}
      title={`${confirmationCode} — ${guestName ?? 'Unknown'} (${status})`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate leading-tight">{guestName ?? confirmationCode}</p>
      </div>
    </div>
  );
}
