'use client';

import { useCallback, useState, useTransition } from 'react';
import { moveReservation, assignUnit, unassignRoom } from '@/server/actions/reservations';
import { toast } from '@/lib/hooks/use-toast';
import { addDays, format } from 'date-fns';

export interface DragState {
  reservationId: string;
  sourceUnitId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  /** Day index within the block where the user grabbed (0 = first day) */
  grabOffsetDays: number;
}

interface UseCalendarDndOptions {
  startDate: Date;
  colWidth: number;
  sidebarWidth: number;
  onOptimisticMove: (reservationId: string, targetUnitId: string, newCheckIn: string, newCheckOut: string, newNights: number) => void;
  onRevert: (reservationId: string, sourceUnitId: string, origCheckIn: string, origCheckOut: string, origNights: number) => void;
  onOptimisticAssign: (reservationId: string, unitId: string) => void;
  onRevertAssign: (reservationId: string) => void;
  onOptimisticUnassign: (reservationId: string) => void;
  onRevertUnassign: (reservationId: string, unitId: string) => void;
}

export function useCalendarDnd({
  startDate,
  colWidth,
  sidebarWidth,
  onOptimisticMove,
  onRevert,
  onOptimisticAssign,
  onRevertAssign,
  onOptimisticUnassign,
  onRevertUnassign,
}: UseCalendarDndOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [, startTransition] = useTransition();

  const handleDragStart = useCallback(
    (
      reservationId: string,
      sourceUnitId: string,
      roomTypeId: string,
      checkInDate: string,
      checkOutDate: string,
      nights: number,
      grabOffsetDays: number,
    ) => {
      setDragState({ reservationId, sourceUnitId, roomTypeId, checkInDate, checkOutDate, nights, grabOffsetDays });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  /** Compute the new check-in date from a drop event's X coordinate */
  const computeNewCheckIn = useCallback(
    (e: React.DragEvent, grabOffsetDays: number): Date => {
      const gridEl = (e.currentTarget as HTMLElement).closest('[data-calendar-grid]');
      if (!gridEl) return startDate;

      const gridRect = gridEl.getBoundingClientRect();
      const scrollLeft = gridEl.scrollLeft;
      const relativeX = e.clientX - gridRect.left + scrollLeft;
      const dayColumn = Math.floor((relativeX - sidebarWidth) / colWidth);
      const newCheckInColumn = Math.max(0, dayColumn - grabOffsetDays);
      return addDays(startDate, newCheckInColumn);
    },
    [startDate, colWidth, sidebarWidth],
  );

  const handleDrop = useCallback(
    (targetUnitId: string, e: React.DragEvent) => {
      if (!dragState) return;
      const { reservationId, sourceUnitId, checkInDate: origCheckIn, checkOutDate: origCheckOut, nights } = dragState;

      // Drag from pending panel → assign (keep original dates)
      if (sourceUnitId === '') {
        onOptimisticAssign(reservationId, targetUnitId);
        setDragState(null);

        startTransition(async () => {
          const result = await assignUnit({ reservationId, unitId: targetUnitId });
          if (result.success) {
            toast({ variant: 'success', title: 'Room assigned' });
          } else {
            onRevertAssign(reservationId);
            toast({ variant: 'error', title: 'Assign failed', description: result.error });
          }
        });
        return;
      }

      // Drag between timeline rows → move
      const newCheckIn = computeNewCheckIn(e, dragState.grabOffsetDays);
      const newCheckOut = addDays(newCheckIn, nights);
      const newCheckInStr = format(newCheckIn, 'yyyy-MM-dd');
      const newCheckOutStr = format(newCheckOut, 'yyyy-MM-dd');

      // No change
      if (targetUnitId === sourceUnitId && newCheckInStr === origCheckIn) {
        setDragState(null);
        return;
      }

      // Optimistic move
      onOptimisticMove(reservationId, targetUnitId, newCheckInStr, newCheckOutStr, nights);
      setDragState(null);

      startTransition(async () => {
        const result = await moveReservation({
          reservationId,
          unitId: targetUnitId,
          checkInDate: newCheckInStr,
          checkOutDate: newCheckOutStr,
        });

        if (result.success) {
          toast({ variant: 'success', title: 'Reservation moved' });
        } else {
          onRevert(reservationId, sourceUnitId, origCheckIn, origCheckOut, nights);
          toast({
            variant: 'error',
            title: 'Move failed',
            description: result.error,
          });
        }
      });
    },
    [dragState, computeNewCheckIn, onOptimisticMove, onRevert, onOptimisticAssign, onRevertAssign, startTransition],
  );

  /** Start dragging from the pending panel */
  const handlePanelDragStart = useCallback(
    (reservationId: string, roomTypeId: string, checkInDate: string, checkOutDate: string, nights: number) => {
      setDragState({
        reservationId,
        sourceUnitId: '',
        roomTypeId,
        checkInDate,
        checkOutDate,
        nights,
        grabOffsetDays: 0,
      });
    },
    [],
  );

  /** Handle dropping a timeline block onto the pending panel (unassign) */
  const handleUnassignDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragState || dragState.sourceUnitId === '') return;

      const { reservationId, sourceUnitId } = dragState;
      onOptimisticUnassign(reservationId);
      setDragState(null);

      startTransition(async () => {
        const result = await unassignRoom({ reservationId });
        if (result.success) {
          toast({ variant: 'success', title: 'Room unassigned' });
        } else {
          onRevertUnassign(reservationId, sourceUnitId);
          toast({ variant: 'error', title: 'Unassign failed', description: result.error });
        }
      });
    },
    [dragState, onOptimisticUnassign, onRevertUnassign, startTransition],
  );

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handlePanelDragStart,
    handleUnassignDrop,
  };
}
