'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { format, parseISO } from 'date-fns';
import { assignUnit } from '@/server/actions/reservations';
import { toast } from '@/lib/hooks/use-toast';

interface Reservation {
  id: string;
  guestId: string;
  roomTypeId: string;
  unitId: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationCode: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  source: string;
  specialRequests: string | null;
  internalNotes: string | null;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vipStatus: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

interface Unit {
  id: string;
  roomTypeId: string;
  name: string;
  floor: string | null;
  housekeepingStatus: string;
}

interface UnassignedPopoverProps {
  x: number;
  y: number;
  date: string;
  reservations: Reservation[];
  guestMap: Map<string, Guest>;
  roomTypes: RoomType[];
  units: Unit[];
  allReservations: Reservation[];
  onOptimisticAssign: (reservationId: string, unitId: string) => void;
  onRevertAssign: (reservationId: string) => void;
  onClose: () => void;
}

const ASSIGNABLE_STATUSES = new Set(['confirmed', 'checked_in']);

export function UnassignedPopover({
  x,
  y,
  date,
  reservations,
  guestMap,
  roomTypes,
  units,
  allReservations,
  onOptimisticAssign,
  onRevertAssign,
  onClose,
}: UnassignedPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedResId, setSelectedResId] = useState<string | null>(
    reservations.length === 1 ? reservations[0]!.id : null,
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Position the popover — make sure it fits within the viewport
  const [pos, setPos] = useState({ left: x, top: y });
  useEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y + 8;
    if (left + rect.width > vw - 16) left = vw - rect.width - 16;
    if (left < 16) left = 16;
    if (top + rect.height > vh - 16) top = y - rect.height - 8;
    if (top < 16) top = 16;
    setPos({ left, top });
  }, [x, y]);

  const selectedRes = selectedResId
    ? reservations.find((r) => r.id === selectedResId) ?? null
    : null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80 max-h-[420px] overflow-hidden flex flex-col"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-center gap-2">
          <span className="material-icons text-amber-500 text-base">warning</span>
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
            Unassigned — {format(parseISO(date), 'dd MMM yyyy')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          <span className="material-icons text-sm text-amber-600 dark:text-amber-400">close</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Reservation list — if more than one, let user pick */}
        {!selectedRes ? (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
              Select a reservation to assign
            </p>
            {reservations.map((res) => {
              const guest = guestMap.get(res.guestId);
              const rtName = roomTypes.find((rt) => rt.id === res.roomTypeId)?.name ?? '—';
              return (
                <button
                  key={res.id}
                  onClick={() => setSelectedResId(res.id)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {guest ? `${guest.firstName} ${guest.lastName}` : res.confirmationCode}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                      {rtName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {format(parseISO(res.checkInDate), 'dd MMM')} — {format(parseISO(res.checkOutDate), 'dd MMM')} · {res.nights}N
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <AssignPanel
            reservation={selectedRes}
            guest={guestMap.get(selectedRes.guestId) ?? null}
            roomTypes={roomTypes}
            units={units}
            allReservations={allReservations}
            onOptimisticAssign={onOptimisticAssign}
            onRevertAssign={onRevertAssign}
            onClose={onClose}
            onBack={reservations.length > 1 ? () => setSelectedResId(null) : undefined}
          />
        )}
      </div>
    </div>
  );
}

function AssignPanel({
  reservation: res,
  guest,
  roomTypes,
  units,
  allReservations,
  onOptimisticAssign,
  onRevertAssign,
  onClose,
  onBack,
}: {
  reservation: Reservation;
  guest: Guest | null;
  roomTypes: RoomType[];
  units: Unit[];
  allReservations: Reservation[];
  onOptimisticAssign: (reservationId: string, unitId: string) => void;
  onRevertAssign: (reservationId: string) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showCategoryWarning, setShowCategoryWarning] = useState<{
    unitId: string;
    unitName: string;
    targetRtName: string;
  } | null>(null);

  const currentRtName = roomTypes.find((rt) => rt.id === res.roomTypeId)?.name ?? '—';

  // Get available units across ALL room types, grouped by room type
  const availableByRoomType = useMemo(() => {
    const sorted = [...roomTypes].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted
      .map((rt) => {
        const rtUnits = units.filter((u) => u.roomTypeId === rt.id);
        const available = rtUnits.filter((unit) => {
          const unitReservations = allReservations.filter(
            (r) =>
              r.unitId === unit.id &&
              r.id !== res.id &&
              ASSIGNABLE_STATUSES.has(r.status),
          );
          return !unitReservations.some(
            (r) => r.checkInDate < res.checkOutDate && r.checkOutDate > res.checkInDate,
          );
        });
        return { roomType: rt, units: available, isCurrent: rt.id === res.roomTypeId };
      })
      .filter((g) => g.units.length > 0);
  }, [roomTypes, units, allReservations, res]);

  const handleAssignClick = useCallback(
    (unitId: string, unitName: string, roomType: RoomType) => {
      if (roomType.id !== res.roomTypeId) {
        // Cross-category — show warning
        setShowCategoryWarning({ unitId, unitName, targetRtName: roomType.name });
        return;
      }
      performAssign(unitId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [res.roomTypeId],
  );

  const performAssign = useCallback(
    (unitId: string) => {
      onOptimisticAssign(res.id, unitId);
      onClose();

      startTransition(async () => {
        const result = await assignUnit({ reservationId: res.id, unitId });
        if (result.success) {
          toast({ variant: 'success', title: 'Room assigned' });
        } else {
          onRevertAssign(res.id);
          toast({ variant: 'error', title: 'Assign failed', description: result.error });
        }
      });
    },
    [res.id, onOptimisticAssign, onRevertAssign, onClose, startTransition],
  );

  // Category change confirmation modal
  if (showCategoryWarning) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <span className="material-icons text-lg">swap_horiz</span>
          <span className="text-sm font-bold">Category change</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          This reservation is booked as{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{currentRtName}</span>.
          You are assigning it to{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{showCategoryWarning.unitName}</span> ({' '}
          <span className="font-bold text-amber-600 dark:text-amber-400">{showCategoryWarning.targetRtName}</span>
          ).
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-500">
          The reservation category will be updated to match the assigned room.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setShowCategoryWarning(null)}
            className="flex-1 text-xs font-medium px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={() => performAssign(showCategoryWarning.unitId)}
            disabled={isPending}
            className="flex-1 text-xs font-medium px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            Confirm change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {/* Reservation info */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
          >
            <span className="material-icons text-sm text-slate-400">arrow_back</span>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
            {guest ? `${guest.firstName} ${guest.lastName}` : res.confirmationCode}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {format(parseISO(res.checkInDate), 'dd MMM')} — {format(parseISO(res.checkOutDate), 'dd MMM')} · {res.nights}N · {currentRtName}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-slate-700" />

      {/* Available units grouped by room type */}
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
        Available rooms
      </p>
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {availableByRoomType.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2 text-center">
            No rooms available for these dates
          </p>
        ) : (
          availableByRoomType.map((group) => (
            <div key={group.roomType.id}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {group.roomType.name}
                </span>
                {!group.isCurrent && (
                  <span className="text-[9px] px-1 py-0 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                    Different category
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {group.units.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => handleAssignClick(unit.id, unit.name, group.roomType)}
                    disabled={isPending}
                    className={`text-xs font-medium px-2 py-1.5 rounded-lg border transition-colors text-center ${
                      group.isCurrent
                        ? 'border-primary/30 bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20'
                        : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                    } disabled:opacity-40`}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
