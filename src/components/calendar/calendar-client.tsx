'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addDays, differenceInDays, format, isToday, isWeekend, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { UnitRow } from './unit-row';
import { ReservationPanel } from './reservation-panel';
import { PendingPanel } from './pending-panel';
import { ContextMenu } from './context-menu';
import { CalendarToolbar } from './calendar-toolbar';
import { ReservationPopover } from './reservation-popover';
import { CellActionPopover } from './cell-action-popover';
import { UnassignedPopover } from './unassigned-popover';
import { useCalendarDnd } from './use-calendar-dnd';
import { ReservationFormDialog } from '@/components/reservations/reservation-form-dialog';
import type { ReservationFormDefaults } from '@/components/reservations/reservation-form-dialog';
import { assignUnit, unassignRoom, changeReservationStatus } from '@/server/actions/reservations';
import { VALID_STATUS_TRANSITIONS, ReservationStatus } from '@/lib/constants/reservation';
import { toast } from '@/lib/hooks/use-toast';
import { useTranslations } from 'next-intl';

interface Property {
  id: string;
  name: string;
  code: string;
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

interface Rate {
  roomTypeId: string;
  date: string;
  amount: string;
}

interface CalendarClientProps {
  properties: Property[];
  defaultPropertyId: string;
  roomTypes: RoomType[];
  units: Unit[];
  reservations: Reservation[];
  guests: Guest[];
  rates: Rate[];
  initialStartDate: string;
  initialEndDate: string;
}

const ROW_HEIGHT = 40;
const SIDEBAR_WIDTH = 224;
const HEADER_HEIGHT = 56;
const RT_HEADER_HEIGHT = 24;
const PRICE_ROW_HEIGHT = 24;
const AVAIL_ROW_HEIGHT = 24;
const OCC_ROW_HEIGHT = 24;
const COL_WIDTH = 90;

const ASSIGNABLE_STATUSES = new Set(['confirmed', 'checked_in']);

const HK_BADGE: Record<string, { cls: string; label: string }> = {
  clean: { cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', label: 'Clean' },
  dirty: { cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', label: 'Dirty' },
  cleaning: { cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', label: 'Cleaning' },
  inspected: { cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', label: 'Inspected' },
  maintenance: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', label: 'Maint.' },
};

export function CalendarClient({
  properties,
  defaultPropertyId,
  roomTypes,
  units,
  reservations,
  guests,
  rates,
  initialStartDate,
  initialEndDate,
}: CalendarClientProps) {
  const tCtx = useTranslations('contextMenu');
  const router = useRouter();

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const colWidth = COL_WIDTH;

  const startDate = parseISO(initialStartDate);
  const endDate = parseISO(initialEndDate);
  const totalDays = differenceInDays(endDate, startDate);

  // On mount: scroll to today's column
  const scrolledToToday = useRef(false);
  useEffect(() => {
    if (scrolledToToday.current) return;
    scrolledToToday.current = true;
    const grid = gridContainerRef.current;
    if (!grid) return;
    const todayOffset = differenceInDays(new Date(), startDate);
    if (todayOffset >= 0 && todayOffset < totalDays) {
      // Scroll so today is ~2 columns from the left edge
      grid.scrollLeft = Math.max(0, (todayOffset - 2) * colWidth);
    }
  }, [startDate, totalDays, colWidth]);

  // Scroll to a specific date — if inside loaded window, scroll; if outside, reload page
  const handleScrollToDate = useCallback(
    (date: Date) => {
      const offset = differenceInDays(date, startDate);
      if (offset >= 0 && offset < totalDays) {
        const grid = gridContainerRef.current;
        if (grid) {
          grid.scrollTo({ left: Math.max(0, (offset - 2) * colWidth), behavior: 'smooth' });
        }
      } else {
        // Outside loaded window — reload with new center
        router.push(`/calendar?start=${format(date, 'yyyy-MM-dd')}`);
      }
    },
    [startDate, totalDays, colWidth, router],
  );

  // Optimistic reservations state — initialized from server props
  const [optimisticReservations, setOptimisticReservations] = useState(reservations);

  // Sync when server props change (e.g. after revalidation)
  const [prevReservations, setPrevReservations] = useState(reservations);
  if (reservations !== prevReservations) {
    setPrevReservations(reservations);
    setOptimisticReservations(reservations);
  }

  // Pending panel state
  const [isPendingPanelOpen, setIsPendingPanelOpen] = useState(false);

  // Quick assign state
  const [quickAssignReservationId, setQuickAssignReservationId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; reservationId: string } | null>(null);

  // Popover state (click on reservation block)
  const [popoverState, setPopoverState] = useState<{ x: number; y: number; reservationId: string } | null>(null);

  // Cell action popover state (click on empty cell)
  const [cellAction, setCellAction] = useState<{
    x: number;
    y: number;
    unitId: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  // Unassigned popover state (click on badge in occupancy row)
  const [unassignedPopover, setUnassignedPopover] = useState<{
    x: number;
    y: number;
    date: string;
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // New booking dialog state
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBookingDefaults, setNewBookingDefaults] = useState<ReservationFormDefaults | undefined>(undefined);

  // Transition for quick-assign click
  const [, startTransition] = useTransition();

  // --- Optimistic callbacks ---
  const onOptimisticMove = useCallback(
    (reservationId: string, targetUnitId: string, newCheckIn: string, newCheckOut: string, newNights: number) => {
      setOptimisticReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, unitId: targetUnitId, checkInDate: newCheckIn, checkOutDate: newCheckOut, nights: newNights }
            : r,
        ),
      );
    },
    [],
  );

  const onRevert = useCallback(
    (reservationId: string, sourceUnitId: string, origCheckIn: string, origCheckOut: string, origNights: number) => {
      setOptimisticReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, unitId: sourceUnitId, checkInDate: origCheckIn, checkOutDate: origCheckOut, nights: origNights }
            : r,
        ),
      );
    },
    [],
  );

  const onOptimisticAssign = useCallback(
    (reservationId: string, unitId: string) => {
      // Resolve target unit's room type for cross-category assignment
      const targetUnit = units.find((u) => u.id === unitId);
      setOptimisticReservations((prev) =>
        prev.map((r) => {
          if (r.id !== reservationId) return r;
          const updated: Reservation = { ...r, unitId };
          if (targetUnit && targetUnit.roomTypeId !== r.roomTypeId) {
            updated.roomTypeId = targetUnit.roomTypeId;
          }
          return updated;
        }),
      );
      setQuickAssignReservationId(null);
    },
    [units],
  );

  const onRevertAssign = useCallback(
    (reservationId: string) => {
      setOptimisticReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, unitId: null } : r)),
      );
    },
    [],
  );

  const onOptimisticUnassign = useCallback(
    (reservationId: string) => {
      setOptimisticReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, unitId: null } : r)),
      );
    },
    [],
  );

  const onRevertUnassign = useCallback(
    (reservationId: string, unitId: string) => {
      setOptimisticReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, unitId } : r)),
      );
    },
    [],
  );

  const { dragState, handleDragStart, handleDragEnd, handleDrop, handlePanelDragStart, handleUnassignDrop } =
    useCalendarDnd({
      startDate,
      colWidth,
      sidebarWidth: 0, // Grid columns start at x=0 within the grid container
      onOptimisticMove,
      onRevert,
      onOptimisticAssign,
      onRevertAssign,
      onOptimisticUnassign,
      onRevertUnassign,
    });

  const guestMap = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests],
  );

  // Rate prices lookup: key = "roomTypeId:date" → amount string
  const rateMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rates) {
      map.set(`${r.roomTypeId}:${r.date}`, r.amount);
    }
    return map;
  }, [rates]);

  // Panel selection state
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const handleReservationClick = useCallback((reservationId: string, x: number, y: number) => {
    setPopoverState({ x, y, reservationId });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedReservationId(null);
  }, []);

  // Close panel / context menu / popover / quick assign on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedReservationId(null);
        setContextMenu(null);
        setPopoverState(null);
        setCellAction(null);
        setQuickAssignReservationId(null);
        setUnassignedPopover(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Derive selected reservation and guest
  const selectedReservation = selectedReservationId
    ? optimisticReservations.find((r) => r.id === selectedReservationId) ?? null
    : null;

  const selectedGuest = selectedReservation
    ? guestMap.get(selectedReservation.guestId) ?? null
    : null;

  const selectedRoomTypeName = selectedReservation
    ? roomTypes.find((rt) => rt.id === selectedReservation.roomTypeId)?.name ?? null
    : null;

  const selectedUnitName = selectedReservation?.unitId
    ? units.find((u) => u.id === selectedReservation.unitId)?.name ?? null
    : null;

  const days = Array.from({ length: totalDays }, (_, i) => addDays(startDate, i));

  // Group units by room type — with search filtering
  const groupedUnits = useMemo(() => {
    const sorted = [...roomTypes].sort((a, b) => a.sortOrder - b.sortOrder);
    const query = searchQuery.toLowerCase().trim();

    return sorted.map((rt) => {
      let filteredUnits = units.filter((u) => u.roomTypeId === rt.id).sort((a, b) => a.name.localeCompare(b.name));

      if (query) {
        filteredUnits = filteredUnits.filter((u) => {
          if (u.name.toLowerCase().includes(query)) return true;
          const unitReservations = optimisticReservations.filter((r) => r.unitId === u.id);
          return unitReservations.some((r) => {
            const guest = guestMap.get(r.guestId);
            if (!guest) return false;
            const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
            return fullName.includes(query);
          });
        });
      }

      return { roomType: rt, units: filteredUnits };
    }).filter((g) => g.units.length > 0);
  }, [roomTypes, units, searchQuery, optimisticReservations, guestMap]);

  // Map reservations by unitId for quick lookup
  const resByUnit = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of optimisticReservations) {
      if (!r.unitId) continue;
      const existing = map.get(r.unitId) ?? [];
      existing.push(r);
      map.set(r.unitId, existing);
    }
    return map;
  }, [optimisticReservations]);

  // Pending reservations (no unit, assignable status)
  const pendingReservations = useMemo(
    () => optimisticReservations.filter((r) => !r.unitId && ASSIGNABLE_STATUSES.has(r.status)),
    [optimisticReservations],
  );

  // Availability per room type per day
  const availabilityByRoomTypeDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const rt of roomTypes) {
      const rtUnits = units.filter((u) => u.roomTypeId === rt.id);
      const dayMap = new Map<string, number>();
      for (const day of days) {
        const dayStr = format(day, 'yyyy-MM-dd');
        let available = 0;
        for (const u of rtUnits) {
          const occupied = optimisticReservations.some(
            (r) => r.unitId === u.id && r.checkInDate <= dayStr && r.checkOutDate > dayStr,
          );
          if (!occupied) available++;
        }
        dayMap.set(dayStr, available);
      }
      map.set(rt.id, dayMap);
    }
    return map;
  }, [roomTypes, units, days, optimisticReservations]);

  // Global occupancy percentage per day (all units across all room types)
  const occupancyByDay = useMemo(() => {
    const totalUnits = units.length;
    const map = new Map<string, number>();
    if (totalUnits === 0) return map;
    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');
      let occupied = 0;
      for (const u of units) {
        const isOccupied = optimisticReservations.some(
          (r) => r.unitId === u.id && r.checkInDate <= dayStr && r.checkOutDate > dayStr,
        );
        if (isOccupied) occupied++;
      }
      map.set(dayStr, Math.round((occupied / totalUnits) * 100));
    }
    return map;
  }, [units, days, optimisticReservations]);

  // Unassigned reservations by check-in date (global, all room types)
  const unassignedByDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of optimisticReservations) {
      if (r.unitId !== null) continue;
      if (!ASSIGNABLE_STATUSES.has(r.status)) continue;
      const existing = map.get(r.checkInDate) ?? [];
      existing.push(r);
      map.set(r.checkInDate, existing);
    }
    return map;
  }, [optimisticReservations]);

  // Quick-assign available unit IDs
  const quickAssignAvailableUnitIds = useMemo(() => {
    if (!quickAssignReservationId) return new Set<string>();
    const res = optimisticReservations.find((r) => r.id === quickAssignReservationId);
    if (!res) return new Set<string>();

    const rtUnits = units.filter((u) => u.roomTypeId === res.roomTypeId);
    const available = rtUnits.filter((unit) => {
      const unitRes = optimisticReservations.filter(
        (r) =>
          r.unitId === unit.id &&
          r.id !== res.id &&
          ASSIGNABLE_STATUSES.has(r.status),
      );
      return !unitRes.some(
        (r) => r.checkInDate < res.checkOutDate && r.checkOutDate > res.checkInDate,
      );
    });
    return new Set(available.map((u) => u.id));
  }, [quickAssignReservationId, optimisticReservations, units]);

  // --- Context menu handlers ---
  const handleContextMenu = useCallback((reservationId: string, x: number, y: number) => {
    setContextMenu({ x, y, reservationId });
  }, []);

  const handleUnassign = useCallback(
    (reservationId: string) => {
      setContextMenu(null);
      const res = optimisticReservations.find((r) => r.id === reservationId);
      if (!res?.unitId) return;

      const prevUnitId = res.unitId;
      onOptimisticUnassign(reservationId);

      startTransition(async () => {
        const result = await unassignRoom({ reservationId });
        if (result.success) {
          toast({ variant: 'success', title: tCtx('unassignSuccess') });
        } else {
          onRevertUnassign(reservationId, prevUnitId);
          toast({ variant: 'error', title: tCtx('unassignFailed'), description: result.error });
        }
      });
    },
    [optimisticReservations, onOptimisticUnassign, onRevertUnassign, startTransition, tCtx],
  );

  // --- Status change handler (context menu + popover) ---
  const handleStatusChange = useCallback(
    (reservationId: string, newStatus: ReservationStatus) => {
      setContextMenu(null);
      setPopoverState(null);

      startTransition(async () => {
        const result = await changeReservationStatus({ id: reservationId, status: newStatus });
        if (result.success) {
          toast({ variant: 'success', title: tCtx('statusChangeSuccess') });
        } else {
          toast({ variant: 'error', title: tCtx('statusChangeFailed'), description: result.error });
        }
      });
    },
    [startTransition, tCtx],
  );

  // --- View details handler ---
  const handleViewDetails = useCallback((reservationId: string) => {
    setContextMenu(null);
    setPopoverState(null);
    setSelectedReservationId(reservationId);
  }, []);

  // --- Quick assign click handler ---
  const handleQuickAssignClick = useCallback(
    (unitId: string) => {
      if (!quickAssignReservationId) return;
      const reservationId = quickAssignReservationId;
      onOptimisticAssign(reservationId, unitId);

      startTransition(async () => {
        const result = await assignUnit({ reservationId, unitId });
        if (result.success) {
          toast({ variant: 'success', title: 'Room assigned' });
        } else {
          onRevertAssign(reservationId);
          toast({ variant: 'error', title: 'Assign failed', description: result.error });
        }
      });
    },
    [quickAssignReservationId, onOptimisticAssign, onRevertAssign, startTransition],
  );

  // --- Cell click handler ---
  const handleCellClick = useCallback(
    (unitId: string, roomTypeId: string, date: string, x: number, y: number) => {
      const unitReservations = optimisticReservations.filter(
        (r) => r.unitId === unitId && r.checkInDate <= date && r.checkOutDate > date,
      );
      if (unitReservations.length > 0) return;
      setCellAction({ x, y, unitId, roomTypeId, startDate: date, endDate: format(addDays(parseISO(date), 1), 'yyyy-MM-dd') });
    },
    [optimisticReservations],
  );

  // --- New booking from cell ---
  const handleNewBookingFromCell = useCallback(
    (_unitId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
      setCellAction(null);
      setNewBookingDefaults({
        propertyId: defaultPropertyId,
        roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });
      setShowNewBooking(true);
    },
    [defaultPropertyId],
  );

  // Is there an active drag from the timeline (not from panel)?
  const isDragFromTimeline = dragState !== null && dragState.sourceUnitId !== '';

  // Auto-open panel when there are pending reservations
  useEffect(() => {
    if (pendingReservations.length > 0 && !isPendingPanelOpen) {
      setIsPendingPanelOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive popover reservation
  const popoverReservation = popoverState
    ? optimisticReservations.find((r) => r.id === popoverState.reservationId) ?? null
    : null;

  const popoverGuest = popoverReservation
    ? guestMap.get(popoverReservation.guestId) ?? null
    : null;

  // Outer wrapper ref — controls vertical scroll for sidebar + grid together
  const outerScrollRef = useRef<HTMLDivElement>(null);
  // Grid header ref — synced horizontally with the grid body
  const gridHeaderRef = useRef<HTMLDivElement>(null);

  // Sync grid header horizontal scroll with grid body
  const syncHeaderScroll = useCallback(() => {
    const grid = gridContainerRef.current;
    const header = gridHeaderRef.current;
    if (grid && header) {
      header.scrollLeft = grid.scrollLeft;
    }
  }, []);

  // Listen to grid body scroll to sync header
  useEffect(() => {
    const grid = gridContainerRef.current;
    if (!grid) return;
    grid.addEventListener('scroll', syncHeaderScroll);
    return () => grid.removeEventListener('scroll', syncHeaderScroll);
  }, [syncHeaderScroll]);

  // --- Drag-to-pan (click + drag to scroll horizontally) ---
  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panStartScrollLeftRef = useRef(0);

  const handlePanMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only left-click, ignore if clicking on a reservation block or interactive element
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't pan if clicking on a draggable reservation, button, or input
    if (target.closest('[draggable="true"]') || target.closest('button') || target.closest('select') || target.closest('input')) return;

    const grid = gridContainerRef.current;
    if (!grid) return;

    isPanningRef.current = true;
    panStartXRef.current = e.clientX;
    panStartScrollLeftRef.current = grid.scrollLeft;
    grid.style.cursor = 'grabbing';
    grid.style.userSelect = 'none';
    e.preventDefault();
  }, []);

  const handlePanMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const grid = gridContainerRef.current;
    if (!grid) return;

    const dx = e.clientX - panStartXRef.current;
    grid.scrollLeft = panStartScrollLeftRef.current - dx;
  }, []);

  const handlePanMouseUp = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    const grid = gridContainerRef.current;
    if (grid) {
      grid.style.cursor = '';
      grid.style.userSelect = '';
    }
  }, []);

  // Release pan on mouse leaving the grid area
  const handlePanMouseLeave = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      const grid = gridContainerRef.current;
      if (grid) {
        grid.style.cursor = '';
        grid.style.userSelect = '';
      }
    }
  }, []);

  // Global mouseup to stop panning even if mouse leaves the grid
  useEffect(() => {
    const stopPan = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const grid = gridContainerRef.current;
        if (grid) {
          grid.style.cursor = '';
          grid.style.userSelect = '';
        }
      }
    };
    window.addEventListener('mouseup', stopPan);
    return () => window.removeEventListener('mouseup', stopPan);
  }, []);

  // Shift+Wheel → horizontal scroll
  useEffect(() => {
    const grid = gridContainerRef.current;
    if (!grid) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        grid.scrollLeft += e.deltaY;
      }
    };
    grid.addEventListener('wheel', handleWheel, { passive: false });
    return () => grid.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="flex flex-col h-full" onDragEnd={handleDragEnd}>
      {/* Toolbar */}
      <CalendarToolbar
        currentDate={startDate}
        pendingCount={pendingReservations.length}
        onTogglePendingPanel={() => setIsPendingPanelOpen(!isPendingPanelOpen)}
        onNewBooking={() => {
          setNewBookingDefaults(undefined);
          setShowNewBooking(true);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onScrollToDate={handleScrollToDate}
      />

      {/* Main content: pending panel + calendar area */}
      <div className="flex flex-1 overflow-hidden relative border-t border-slate-200 dark:border-slate-700">
        <PendingPanel
          isOpen={isPendingPanelOpen}
          onToggle={() => setIsPendingPanelOpen(!isPendingPanelOpen)}
          pendingReservations={pendingReservations}
          guestMap={guestMap}
          roomTypes={roomTypes}
          units={units}
          allReservations={optimisticReservations}
          quickAssignReservationId={quickAssignReservationId}
          onQuickAssignStart={setQuickAssignReservationId}
          onQuickAssignCancel={() => setQuickAssignReservationId(null)}
          onDragStart={handlePanelDragStart}
          onOptimisticAssign={onOptimisticAssign}
          onRevertAssign={onRevertAssign}
          isDragActive={isDragFromTimeline}
          onUnassignDrop={handleUnassignDrop}
        />

        {/* ===== Calendar area: sidebar + grid share ONE vertical scroll ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* --- FIXED HEADER ROW (no vertical scroll) --- */}
          <div className="flex flex-shrink-0">
            {/* Sidebar header */}
            <div
              className="flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-30"
              style={{ width: SIDEBAR_WIDTH }}
            >
              <div
                className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center px-4"
                style={{ height: HEADER_HEIGHT }}
              >
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rooms</span>
              </div>
              <div
                className="border-b border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10 flex items-center px-4"
                style={{ height: OCC_ROW_HEIGHT }}
              >
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Occupancy</span>
              </div>
            </div>

            {/* Grid header — horizontally synced with grid body via gridContainerRef */}
            <div
              className="flex-1 overflow-hidden"
              ref={gridHeaderRef}
            >
              <div className="min-w-max">
                {/* Day header row */}
                <div
                  className="flex border-b border-slate-200 dark:border-slate-700"
                  style={{ height: HEADER_HEIGHT }}
                >
                  {days.map((day) => {
                    const today = isToday(day);
                    const weekend = isWeekend(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-600 h-full flex flex-col items-center justify-center relative ${
                          today
                            ? 'bg-primary/5 dark:bg-primary/10'
                            : weekend
                              ? 'bg-amber-50/40 dark:bg-amber-900/10'
                              : ''
                        }`}
                        style={{ width: colWidth }}
                      >
                        <span className={`text-xs font-bold ${
                          today
                            ? 'text-primary dark:text-blue-400'
                            : weekend
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                        }`}>{format(day, 'EEE')}</span>
                        <span className={`text-[9px] ${
                          today
                            ? 'text-primary/70 dark:text-blue-400/70'
                            : weekend
                              ? 'text-amber-500/70 dark:text-amber-500/70'
                              : 'text-slate-400'
                        }`}>{format(day, 'MMM dd')}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Global occupancy row */}
                <div
                  className="flex border-b border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10"
                  style={{ height: OCC_ROW_HEIGHT }}
                >
                  {days.map((day) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const occ = occupancyByDay.get(dayStr) ?? 0;
                    const unassignedList = unassignedByDay.get(dayStr);
                    const unassignedCount = unassignedList?.length ?? 0;
                    return (
                      <div
                        key={`occ-${day.toISOString()}`}
                        className="flex-shrink-0 border-r border-slate-100 dark:border-slate-700/30 flex items-center justify-center relative"
                        style={{ width: colWidth }}
                      >
                        <span className={`text-[10px] font-bold ${
                          occ >= 90
                            ? 'text-red-600 dark:text-red-400'
                            : occ >= 70
                              ? 'text-amber-600 dark:text-amber-400'
                              : occ >= 40
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {occ}%
                        </span>
                        {unassignedCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnassignedPopover({ x: e.clientX, y: e.clientY, date: dayStr });
                            }}
                            className="absolute top-0.5 right-1 w-3.5 h-3.5 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-full text-[8px] font-bold leading-none shadow-sm cursor-pointer transition-colors"
                            title={`${unassignedCount} unassigned check-in(s)`}
                          >
                            {unassignedCount}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* --- SCROLLABLE BODY (vertical scroll shared by sidebar + grid) --- */}
          <div
            ref={outerScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex">
              {/* Sidebar body — scrolls vertically with the grid */}
              <div
                className="flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-30 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]"
                style={{ width: SIDEBAR_WIDTH }}
              >
                {groupedUnits.map((group) => (
                  <div key={group.roomType.id}>
                    <div
                      className="bg-slate-50 dark:bg-slate-900 px-4 flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700"
                      style={{ height: RT_HEADER_HEIGHT }}
                    >
                      {group.roomType.name}
                    </div>
                    <div
                      className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 text-[10px] text-slate-500 font-medium italic"
                      style={{ height: PRICE_ROW_HEIGHT }}
                    >
                      Price
                    </div>
                    <div
                      className="bg-slate-100/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 text-[10px] text-slate-500 font-medium"
                      style={{ height: AVAIL_ROW_HEIGHT }}
                    >
                      Availability
                    </div>
                    {group.units.map((unit) => {
                      const hk = HK_BADGE[unit.housekeepingStatus];
                      return (
                        <div
                          key={unit.id}
                          className="border-b border-slate-100 dark:border-slate-700/50 flex flex-col justify-center px-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                          style={{ height: ROW_HEIGHT }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{unit.name}</span>
                            {hk && (
                              <span className={`text-[9px] px-1 py-0 rounded ${hk.cls}`}>
                                {hk.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="h-20" /> {/* Bottom padding */}
              </div>

              {/* Grid body — drag-to-pan for horizontal, vertical scroll from parent */}
              <div
                className="flex-1 overflow-x-auto bg-white dark:bg-slate-800 cursor-grab [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                data-calendar-grid
                ref={gridContainerRef}
                onMouseDown={handlePanMouseDown}
                onMouseMove={handlePanMouseMove}
                onMouseUp={handlePanMouseUp}
                onMouseLeave={handlePanMouseLeave}
              >
                <div className="min-w-max relative pb-20">
                  {/* Column backgrounds */}
                  <div className="absolute inset-0 flex pointer-events-none h-full z-0">
                    {days.map((day) => {
                      const today = isToday(day);
                      const weekend = isWeekend(day);
                      return (
                        <div
                          key={`bg-${day.toISOString()}`}
                          className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-700/50 h-full relative ${
                            today
                              ? 'bg-primary/5 dark:bg-primary/5'
                              : weekend
                                ? 'bg-amber-50/40 dark:bg-amber-900/10'
                                : ''
                          }`}
                          style={{ width: colWidth }}
                        >
                          <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-slate-200 dark:border-slate-700" />
                          {today && (
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-400/50 z-20">
                              <div className="w-2 h-2 bg-red-400 rounded-full absolute -top-1 -left-[3px]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Room type groups with rows */}
                  {groupedUnits.map((group) => {
                    const rtAvail = availabilityByRoomTypeDay.get(group.roomType.id);
                    return (
                      <div key={group.roomType.id}>
                        <div
                          className="border-b border-slate-200 dark:border-slate-700 relative"
                          style={{ height: RT_HEADER_HEIGHT }}
                        />
                        <div
                          className="flex border-b border-slate-200 dark:border-slate-700 relative z-10 bg-white dark:bg-slate-800"
                          style={{ height: PRICE_ROW_HEIGHT }}
                        >
                          {days.map((day) => {
                            const weekend = isWeekend(day);
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const price = rateMap.get(`${group.roomType.id}:${dayStr}`);
                            return (
                              <div
                                key={`price-${day.toISOString()}`}
                                className={`flex-shrink-0 border-r border-slate-100 dark:border-slate-700/30 flex items-center justify-center p-0.5 ${
                                  weekend ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''
                                }`}
                                style={{ width: colWidth }}
                              >
                                <span className={`text-[10px] text-center ${
                                  price
                                    ? weekend
                                      ? 'font-medium text-amber-600 dark:text-amber-500'
                                      : 'font-medium text-slate-700 dark:text-slate-300'
                                    : 'text-slate-400'
                                }`}>
                                  {price ? `€${parseFloat(price).toFixed(0)}` : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div
                          className="flex border-b border-slate-200 dark:border-slate-700 relative z-10"
                          style={{ height: AVAIL_ROW_HEIGHT }}
                        >
                          {days.map((day) => {
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const avail = rtAvail?.get(dayStr) ?? 0;
                            return (
                              <div
                                key={`avail-${day.toISOString()}`}
                                className="flex-shrink-0 bg-slate-100/50 dark:bg-slate-800/80 flex items-center justify-center text-[10px] font-semibold text-slate-500"
                                style={{ width: colWidth }}
                              >
                                {avail} free
                              </div>
                            );
                          })}
                        </div>
                        {group.units.map((unit) => (
                          <UnitRow
                            key={unit.id}
                            unit={unit}
                            reservations={resByUnit.get(unit.id) ?? []}
                            guestMap={guestMap}
                            days={days}
                            startDate={startDate}
                            totalDays={totalDays}
                            colWidth={colWidth}
                            rowHeight={ROW_HEIGHT}
                            dragState={dragState}
                            selectedReservationId={selectedReservationId}
                            isQuickAssignHighlighted={quickAssignAvailableUnitIds.has(unit.id)}
                            onQuickAssignClick={quickAssignReservationId ? handleQuickAssignClick : null}
                            onDragStart={handleDragStart}
                            onDrop={handleDrop}
                            onReservationClick={handleReservationClick}
                            onContextMenu={handleContextMenu}
                            onCellClick={handleCellClick}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation detail panel */}
      <ReservationPanel
        reservation={selectedReservation}
        guest={selectedGuest}
        roomTypeName={selectedRoomTypeName}
        unitName={selectedUnitName}
        onClose={handlePanelClose}
        onStatusChange={() => {
          setSelectedReservationId(null);
        }}
      />

      {/* Reservation block popover */}
      {popoverState && popoverReservation && (
        <ReservationPopover
          x={popoverState.x}
          y={popoverState.y}
          reservation={popoverReservation}
          guest={popoverGuest}
          onViewDetails={() => handleViewDetails(popoverReservation.id)}
          onCheckIn={
            VALID_STATUS_TRANSITIONS[popoverReservation.status as ReservationStatus]?.includes(ReservationStatus.CHECKED_IN)
              ? () => handleStatusChange(popoverReservation.id, ReservationStatus.CHECKED_IN)
              : undefined
          }
          onCheckOut={
            VALID_STATUS_TRANSITIONS[popoverReservation.status as ReservationStatus]?.includes(ReservationStatus.CHECKED_OUT)
              ? () => handleStatusChange(popoverReservation.id, ReservationStatus.CHECKED_OUT)
              : undefined
          }
          onUnassign={
            popoverReservation.unitId && ASSIGNABLE_STATUSES.has(popoverReservation.status)
              ? () => {
                  setPopoverState(null);
                  handleUnassign(popoverReservation.id);
                }
              : undefined
          }
          onClose={() => setPopoverState(null)}
        />
      )}

      {/* Cell action popover */}
      {cellAction && (
        <CellActionPopover
          x={cellAction.x}
          y={cellAction.y}
          startDate={cellAction.startDate}
          endDate={cellAction.endDate}
          onNewReservation={() =>
            handleNewBookingFromCell(
              cellAction.unitId,
              cellAction.roomTypeId,
              cellAction.startDate,
              cellAction.endDate,
            )
          }
          onClose={() => setCellAction(null)}
        />
      )}

      {/* Unassigned assignment popover */}
      {unassignedPopover && (
        <UnassignedPopover
          x={unassignedPopover.x}
          y={unassignedPopover.y}
          date={unassignedPopover.date}
          reservations={unassignedByDay.get(unassignedPopover.date) ?? []}
          guestMap={guestMap}
          roomTypes={roomTypes}
          units={units}
          allReservations={optimisticReservations}
          onOptimisticAssign={onOptimisticAssign}
          onRevertAssign={onRevertAssign}
          onClose={() => setUnassignedPopover(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          reservationId={contextMenu.reservationId}
          reservationStatus={
            optimisticReservations.find((r) => r.id === contextMenu.reservationId)?.status ?? ''
          }
          hasUnit={!!optimisticReservations.find((r) => r.id === contextMenu.reservationId)?.unitId}
          onViewDetails={() => handleViewDetails(contextMenu.reservationId)}
          onCheckIn={() => handleStatusChange(contextMenu.reservationId, ReservationStatus.CHECKED_IN)}
          onCheckOut={() => handleStatusChange(contextMenu.reservationId, ReservationStatus.CHECKED_OUT)}
          onCancel={() => handleStatusChange(contextMenu.reservationId, ReservationStatus.CANCELLED)}
          onNoShow={() => handleStatusChange(contextMenu.reservationId, ReservationStatus.NO_SHOW)}
          onUnassign={handleUnassign}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* New Booking Dialog */}
      {showNewBooking && (
        <ReservationFormDialog
          properties={properties}
          roomTypes={roomTypes.map((rt) => ({ ...rt, propertyId: defaultPropertyId }))}
          guests={guests}
          defaultValues={newBookingDefaults}
          onClose={() => setShowNewBooking(false)}
        />
      )}
    </div>
  );
}
