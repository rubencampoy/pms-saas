'use client';

import { useCallback, useMemo, useState, useTransition, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
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

interface Unit {
  id: string;
  roomTypeId: string;
  name: string;
  floor: string | null;
  housekeepingStatus: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vipStatus: string;
}

interface PendingPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  pendingReservations: Reservation[];
  guestMap: Map<string, Guest>;
  roomTypes: RoomType[];
  units: Unit[];
  allReservations: Reservation[];
  quickAssignReservationId: string | null;
  onQuickAssignStart: (reservationId: string) => void;
  onQuickAssignCancel: () => void;
  onDragStart: (reservationId: string, roomTypeId: string, checkInDate: string, checkOutDate: string, nights: number) => void;
  onOptimisticAssign: (reservationId: string, unitId: string) => void;
  onRevertAssign: (reservationId: string) => void;
  isDragActive: boolean;
  onUnassignDrop: (e: DragEvent) => void;
}

const SOURCE_BADGE: Record<string, string> = {
  direct: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  booking_com: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  expedia: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  airbnb: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  phone: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400',
  walkin: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  website: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

export function PendingPanel({
  isOpen,
  onToggle,
  pendingReservations,
  guestMap,
  roomTypes,
  units,
  allReservations,
  quickAssignReservationId,
  onQuickAssignStart,
  onQuickAssignCancel,
  onDragStart,
  onOptimisticAssign,
  onRevertAssign,
  isDragActive,
  onUnassignDrop,
}: PendingPanelProps) {
  const t = useTranslations('pendingPanel');
  const tSource = useTranslations('source');
  const [isPanelDropTarget, setIsPanelDropTarget] = useState(false);

  // Group pending reservations by room type
  const grouped = useMemo(() => {
    const sorted = [...roomTypes].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted
      .map((rt) => ({
        roomType: rt,
        reservations: pendingReservations.filter((r) => r.roomTypeId === rt.id),
      }))
      .filter((g) => g.reservations.length > 0);
  }, [roomTypes, pendingReservations]);

  // Compute available units for a given reservation (client-side)
  const getAvailableUnits = useCallback(
    (res: Reservation) => {
      const rtUnits = units.filter((u) => u.roomTypeId === res.roomTypeId);
      return rtUnits.filter((unit) => {
        const unitReservations = allReservations.filter(
          (r) =>
            r.unitId === unit.id &&
            r.id !== res.id &&
            (r.status === 'confirmed' || r.status === 'checked_in'),
        );
        // Check for date overlap
        return !unitReservations.some(
          (r) => r.checkInDate < res.checkOutDate && r.checkOutDate > res.checkInDate,
        );
      });
    },
    [units, allReservations],
  );

  // Panel drop handlers for unassign
  const handlePanelDragOver = useCallback(
    (e: DragEvent) => {
      if (!isDragActive) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [isDragActive],
  );

  const handlePanelDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (isDragActive) setIsPanelDropTarget(true);
    },
    [isDragActive],
  );

  const handlePanelDragLeave = useCallback((e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsPanelDropTarget(false);
  }, []);

  const handlePanelDrop = useCallback(
    (e: DragEvent) => {
      setIsPanelDropTarget(false);
      onUnassignDrop(e);
    },
    [onUnassignDrop],
  );

  return (
    <>
      {/* Toggle button — visible when collapsed, shows badge */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute top-20 left-0 z-30 flex items-center gap-1 px-2 py-2 bg-white dark:bg-[#1a2632] border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-lg shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-icons text-lg text-slate-500 dark:text-slate-400">
            chevron_right
          </span>
          {pendingReservations.length > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full">
              {pendingReservations.length}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      <div
        className={`flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden transition-[width] duration-300 ${
          isOpen ? 'w-72' : 'w-0'
        } ${isPanelDropTarget ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
        onDragOver={handlePanelDragOver}
        onDragEnter={handlePanelDragEnter}
        onDragLeave={handlePanelDragLeave}
        onDrop={handlePanelDrop}
      >
        <div className="w-72 h-full flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('title')}
              </h2>
              {pendingReservations.length > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full">
                  {pendingReservations.length}
                </span>
              )}
            </div>
            <button
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons text-lg text-slate-500 dark:text-slate-400">
                chevron_left
              </span>
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="material-icons text-3xl text-green-500 mb-2">check_circle</span>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('noItems')}</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.roomType.id}>
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    {group.roomType.name}
                  </h3>
                  <div className="space-y-2">
                    {group.reservations.map((res) => (
                      <PendingCard
                        key={res.id}
                        reservation={res}
                        guest={guestMap.get(res.guestId) ?? null}
                        availableUnits={getAvailableUnits(res)}
                        isQuickAssigning={quickAssignReservationId === res.id}
                        onQuickAssignStart={() => onQuickAssignStart(res.id)}
                        onQuickAssignCancel={onQuickAssignCancel}
                        onDragStart={() =>
                          onDragStart(res.id, res.roomTypeId, res.checkInDate, res.checkOutDate, res.nights)
                        }
                        onOptimisticAssign={onOptimisticAssign}
                        onRevertAssign={onRevertAssign}
                        tSource={tSource}
                        t={t}
                        sourceBadge={SOURCE_BADGE[res.source] ?? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Drop hint when dragging from timeline */}
            {isDragActive && (
              <div className="border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-lg p-4 text-center">
                <span className="material-icons text-amber-500 text-2xl mb-1">unarchive</span>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t('unassignRoom')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PendingCard({
  reservation: res,
  guest,
  availableUnits,
  isQuickAssigning,
  onQuickAssignStart,
  onQuickAssignCancel,
  onDragStart,
  onOptimisticAssign,
  onRevertAssign,
  tSource,
  t,
  sourceBadge,
}: {
  reservation: Reservation;
  guest: Guest | null;
  availableUnits: Unit[];
  isQuickAssigning: boolean;
  onQuickAssignStart: () => void;
  onQuickAssignCancel: () => void;
  onDragStart: () => void;
  onOptimisticAssign: (reservationId: string, unitId: string) => void;
  onRevertAssign: (reservationId: string) => void;
  tSource: (key: string) => string;
  t: (key: string) => string;
  sourceBadge: string;
}) {
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleAssign = () => {
    if (!selectedUnitId) return;
    onOptimisticAssign(res.id, selectedUnitId);

    startTransition(async () => {
      const result = await assignUnit({ reservationId: res.id, unitId: selectedUnitId });
      if (result.success) {
        toast({ variant: 'success', title: 'Room assigned' });
        setSelectedUnitId('');
      } else {
        onRevertAssign(res.id);
        toast({ variant: 'error', title: 'Assign failed', description: result.error });
      }
    });
  };

  const handleCardDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', res.id);
    requestAnimationFrame(() => {
      onDragStart();
    });
  };

  return (
    <div
      draggable
      onDragStart={handleCardDragStart}
      className={`bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:border-slate-300 dark:hover:border-slate-600 transition-colors ${
        isQuickAssigning ? 'ring-2 ring-green-500' : ''
      }`}
    >
      {/* Guest name + dates */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {guest ? `${guest.firstName} ${guest.lastName}` : res.confirmationCode}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {format(parseISO(res.checkInDate), 'dd MMM')} — {format(parseISO(res.checkOutDate), 'dd MMM')}
          </p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${sourceBadge}`}>
          {tSource(res.source)}
        </span>
      </div>

      {/* Select unit + assign */}
      <div className="flex items-center gap-1.5 mt-2">
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-primary focus:border-primary"
          disabled={isPending}
        >
          <option value="">{t('selectUnit')}</option>
          {availableUnits.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={!selectedUnitId || isPending}
          className="text-xs font-medium px-2.5 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {t('assign')}
        </button>
      </div>

      {/* Quick assign button */}
      <div className="flex items-center gap-1.5 mt-1.5">
        {isQuickAssigning ? (
          <button
            onClick={onQuickAssignCancel}
            className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            <span className="material-icons text-sm">close</span>
            {t('cancelQuickAssign')}
          </button>
        ) : (
          <button
            onClick={onQuickAssignStart}
            className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary"
          >
            <span className="material-icons text-sm">gps_fixed</span>
            {t('quickAssign')}
          </button>
        )}
      </div>
    </div>
  );
}
