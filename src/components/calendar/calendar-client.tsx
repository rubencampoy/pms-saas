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
import { createRoomBlock, deleteRoomBlock, updateRoomBlock } from '@/server/actions/room-blocks';
import { RoomBlockPopover } from './room-block-popover';
import { RoomBlockEditDialog } from './room-block-edit-dialog';
import { RateOverridePopover } from './rate-override-popover';
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
  minStay: number;
}

export interface RoomBlock {
  id: string;
  unitId: string;
  type: string; // 'maintenance' | 'blocked'
  startDate: string;
  endDate: string;
  reason: string | null;
}

interface CalendarClientProps {
  properties: Property[];
  defaultPropertyId: string;
  roomTypes: RoomType[];
  units: Unit[];
  reservations: Reservation[];
  guests: Guest[];
  rates: Rate[];
  defaultRatePlanId: string | null;
  roomBlocks: RoomBlock[];
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
  defaultRatePlanId,
  roomBlocks,
  initialStartDate,
  initialEndDate,
}: CalendarClientProps) {
  const tCtx = useTranslations('contextMenu');
  const tBlockPopover = useTranslations('roomBlockPopover');
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

  // Drag-to-create reservation state
  const [dragCreate, setDragCreate] = useState<{
    unitId: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const dragCreateMovedRef = useRef(false);

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

  // Persisted selection highlight — stays visible while cellAction popover is open
  const [cellSelection, setCellSelection] = useState<{
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

  // Room block popover state (click on a maintenance/blocked block)
  const [blockPopover, setBlockPopover] = useState<{
    x: number;
    y: number;
    blockId: string;
  } | null>(null);

  // Room block edit dialog
  const [blockEdit, setBlockEdit] = useState<{
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string | null;
  } | null>(null);

  // Price row click-to-select state (two-click: first click = start, second click = end)
  const [priceRowClickStart, setPriceRowClickStart] = useState<{
    roomTypeId: string;
    date: string;
  } | null>(null);
  const [priceRowHoverDate, setPriceRowHoverDate] = useState<string | null>(null);

  // Price row selection + popover state (persists while popover is open)
  const [priceRowSelection, setPriceRowSelection] = useState<{
    roomTypeId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const [rateOverridePopover, setRateOverridePopover] = useState<{
    x: number;
    y: number;
    roomTypeId: string;
    startDate: string;
    endDate: string;
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

  // Rate data lookup (amount + minStay) for popover prefill
  const rateDataMap = useMemo(() => {
    const map = new Map<string, { amount: string; minStay: number }>();
    for (const r of rates) {
      map.set(`${r.roomTypeId}:${r.date}`, { amount: r.amount, minStay: r.minStay });
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

  const blocksByUnit = useMemo(() => {
    const map = new Map<string, RoomBlock[]>();
    for (const b of roomBlocks) {
      const existing = map.get(b.unitId) ?? [];
      existing.push(b);
      map.set(b.unitId, existing);
    }
    return map;
  }, [roomBlocks]);

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
      // Clear rate override popover
      setRateOverridePopover(null);
      setPriceRowSelection(null);
      setPriceRowClickStart(null);
      setPriceRowHoverDate(null);
      const endDate = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
      setCellSelection({ unitId, roomTypeId, startDate: date, endDate });
      setCellAction({ x, y, unitId, roomTypeId, startDate: date, endDate });
    },
    [optimisticReservations],
  );

  // --- New booking from cell ---
  const handleNewBookingFromCell = useCallback(
    (unitId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
      setCellAction(null);
      setCellSelection(null);
      setNewBookingDefaults({
        propertyId: defaultPropertyId,
        roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        unitId,
      });
      setShowNewBooking(true);
    },
    [defaultPropertyId],
  );

  // --- Create room block (maintenance / blocked) ---
  const handleCreateBlock = useCallback(
    async (type: 'maintenance' | 'blocked') => {
      if (!cellAction) return;
      const { unitId, startDate, endDate } = cellAction;
      setCellAction(null);
      setCellSelection(null);

      const result = await createRoomBlock({
        propertyId: defaultPropertyId,
        unitId,
        type,
        startDate,
        endDate,
      });

      if (result.success) {
        toast({
          variant: 'success',
          title: type === 'maintenance' ? 'Mantenimiento creado' : 'Fechas bloqueadas',
        });
        router.refresh();
      } else {
        toast({ variant: 'error', title: result.error });
      }
    },
    [cellAction, defaultPropertyId, router],
  );

  // --- Room block click handler ---
  const handleBlockClick = useCallback(
    (blockId: string, x: number, y: number) => {
      // Close any other open popovers
      setPopoverState(null);
      setCellAction(null);
      setCellSelection(null);
      setContextMenu(null);
      setRateOverridePopover(null);
      setPriceRowSelection(null);
      setPriceRowClickStart(null);
      setPriceRowHoverDate(null);
      setBlockPopover({ x, y, blockId });
    },
    [],
  );

  // Find the clicked block data for popover
  const activeBlock = useMemo(() => {
    if (!blockPopover) return null;
    for (const blocks of blocksByUnit.values()) {
      const found = blocks.find((b) => b.id === blockPopover.blockId);
      if (found) return found;
    }
    return null;
  }, [blockPopover, blocksByUnit]);

  // Find unit name for the active block
  const activeBlockUnitName = useMemo(() => {
    if (!activeBlock) return '';
    const unit = units.find((u) => u.id === activeBlock.unitId);
    return unit?.name ?? '';
  }, [activeBlock, units]);

  // Compute prefill values for the rate override popover
  const rateOverridePrefill = useMemo(() => {
    if (!rateOverridePopover) return {
      price: null as string | null,
      minStay: null as number | null,
      priceRange: null as { min: string; max: string } | null,
      minStayRange: null as { min: number; max: number } | null,
    };

    const { roomTypeId: rtId, startDate: selStart, endDate: selEnd } = rateOverridePopover;
    let commonPrice: string | null = null;
    let commonMinStay: number | null = null;
    let allSamePrice = true;
    let allSameMinStay = true;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let minMinStay = Infinity;
    let maxMinStay = -Infinity;

    const s = parseISO(selStart);
    const e = parseISO(selEnd);
    const dayCount = differenceInDays(e, s);

    for (let i = 0; i < dayCount; i++) {
      const d = addDays(s, i);
      const dayStr = format(d, 'yyyy-MM-dd');
      const data = rateDataMap.get(`${rtId}:${dayStr}`);

      if (data) {
        const amt = parseFloat(data.amount);
        if (amt < minPrice) minPrice = amt;
        if (amt > maxPrice) maxPrice = amt;
        if (data.minStay < minMinStay) minMinStay = data.minStay;
        if (data.minStay > maxMinStay) maxMinStay = data.minStay;
        if (commonPrice === null) commonPrice = data.amount;
        else if (commonPrice !== data.amount) allSamePrice = false;
        if (commonMinStay === null) commonMinStay = data.minStay;
        else if (commonMinStay !== data.minStay) allSameMinStay = false;
      } else {
        if (commonPrice !== null) allSamePrice = false;
        if (commonMinStay !== null) allSameMinStay = false;
      }
    }

    return {
      price: allSamePrice ? commonPrice : null,
      minStay: allSameMinStay ? commonMinStay : null,
      priceRange: !allSamePrice && minPrice !== Infinity
        ? { min: String(minPrice), max: String(maxPrice) }
        : null,
      minStayRange: !allSameMinStay && minMinStay !== Infinity
        ? { min: minMinStay, max: maxMinStay }
        : null,
    };
  }, [rateOverridePopover, rateDataMap]);

  const handleDeleteBlock = useCallback(
    async () => {
      if (!blockPopover) return;
      const blockId = blockPopover.blockId;
      setBlockPopover(null);

      const result = await deleteRoomBlock({ id: blockId });
      if (result.success) {
        toast({
          variant: 'success',
          title: tBlockPopover('deleteSuccess'),
        });
        router.refresh();
      } else {
        toast({ variant: 'error', title: result.error ?? tBlockPopover('deleteFailed') });
      }
    },
    [blockPopover, router, tBlockPopover],
  );

  const handleEditBlockOpen = useCallback(() => {
    if (!activeBlock) return;
    setBlockPopover(null);
    setBlockEdit({
      id: activeBlock.id,
      type: activeBlock.type,
      startDate: activeBlock.startDate,
      endDate: activeBlock.endDate,
      reason: activeBlock.reason,
    });
  }, [activeBlock]);

  const handleEditBlockSave = useCallback(
    async (data: { id: string; type: string; startDate: string; endDate: string; reason: string }) => {
      const result = await updateRoomBlock(data);
      if (result.success) {
        toast({
          variant: 'success',
          title: tBlockPopover('updateSuccess'),
        });
        setBlockEdit(null);
        router.refresh();
      } else {
        toast({ variant: 'error', title: result.error ?? tBlockPopover('updateFailed') });
      }
    },
    [router, tBlockPopover],
  );

  // --- Drag-to-create callbacks ---
  const handleDragCreateStart = useCallback(
    (unitId: string, roomTypeId: string, date: string) => {
      // Clear any previous selection / popover
      setCellSelection(null);
      setCellAction(null);
      setRateOverridePopover(null);
      setPriceRowSelection(null);
      setPriceRowClickStart(null);
      setPriceRowHoverDate(null);
      dragCreateMovedRef.current = false;
      setDragCreate({
        unitId,
        roomTypeId,
        startDate: date,
        endDate: format(addDays(parseISO(date), 1), 'yyyy-MM-dd'),
      });
    },
    [],
  );

  const handleDragCreateMove = useCallback(
    (date: string) => {
      setDragCreate((prev) => {
        if (!prev) return prev;
        // endDate = hovered day itself (checkout date, exclusive upper bound)
        // No +1: the cell the mouse is on IS the checkout day
        const newEnd = date;
        if (newEnd <= prev.startDate) return prev; // don't go backwards past start
        if (newEnd === prev.endDate) return prev;  // no change
        dragCreateMovedRef.current = true;
        return { ...prev, endDate: newEnd };
      });
    },
    [],
  );

  const handleDragCreateEnd = useCallback((mouseX: number, mouseY: number) => {
    const dc = dragCreate;
    if (!dc) return;
    setDragCreate(null);

    if (!dragCreateMovedRef.current) {
      // No drag movement — fall back to cell action popover (click behavior)
      return;
    }

    // Keep selection highlight visible while the popover is open
    setCellSelection({
      unitId: dc.unitId,
      roomTypeId: dc.roomTypeId,
      startDate: dc.startDate,
      endDate: dc.endDate,
    });

    // Show cell action popover with the dragged date range so user can choose action
    setCellAction({
      x: mouseX,
      y: mouseY,
      unitId: dc.unitId,
      roomTypeId: dc.roomTypeId,
      startDate: dc.startDate,
      endDate: dc.endDate,
    });
  }, [dragCreate]);

  const handleDragCreateCancel = useCallback(() => {
    setDragCreate(null);
    dragCreateMovedRef.current = false;
  }, []);

  // --- Price row drag-to-select callbacks ---
  // --- Price row click-to-select handler (two-click) ---
  const handlePriceRowClick = useCallback(
    (roomTypeId: string, dateStr: string, e: React.MouseEvent) => {
      // Clear other popovers
      setCellAction(null);
      setCellSelection(null);
      setBlockPopover(null);

      if (rateOverridePopover) {
        // Popover is open — close it and start fresh
        setRateOverridePopover(null);
        setPriceRowSelection(null);
        setPriceRowClickStart({ roomTypeId, date: dateStr });
        setPriceRowHoverDate(null);
        return;
      }

      if (!priceRowClickStart || priceRowClickStart.roomTypeId !== roomTypeId) {
        // First click (or different room type) — set start
        setPriceRowClickStart({ roomTypeId, date: dateStr });
        setPriceRowSelection(null);
        setPriceRowHoverDate(null);
        return;
      }

      // Second click on same room type — finalize selection & open popover
      const date1 = priceRowClickStart.date;
      const date2 = dateStr;
      const selStart = date1 <= date2 ? date1 : date2;
      const selLast = date1 <= date2 ? date2 : date1;
      // endDate is exclusive (day after last selected night)
      const selEnd = format(addDays(parseISO(selLast), 1), 'yyyy-MM-dd');

      setPriceRowClickStart(null);
      setPriceRowHoverDate(null);
      setPriceRowSelection({ roomTypeId, startDate: selStart, endDate: selEnd });
      setRateOverridePopover({
        x: e.clientX,
        y: e.clientY,
        roomTypeId,
        startDate: selStart,
        endDate: selEnd,
      });
    },
    [priceRowClickStart, rateOverridePopover],
  );

  // Is there an active drag from the timeline (not from panel)?
  const isDragFromTimeline = dragState !== null && dragState.sourceUnitId !== '';


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
    // Don't pan if clicking on a draggable reservation, button, input, or calendar cell (drag-to-create)
    if (target.closest('[draggable="true"]') || target.closest('button') || target.closest('select') || target.closest('input') || target.closest('[data-calendar-cell]') || target.closest('[data-price-cell]')) return;

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

  // Global mouseup to finalize drag-to-create even if mouse leaves grid
  useEffect(() => {
    const handleGlobalMouseUp = (e: globalThis.MouseEvent) => {
      if (dragCreate) {
        handleDragCreateEnd(e.clientX, e.clientY);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragCreate, handleDragCreateEnd]);

  // Escape key cancels price row first click
  useEffect(() => {
    if (!priceRowClickStart) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPriceRowClickStart(null);
        setPriceRowHoverDate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [priceRowClickStart]);

  // Escape key cancels drag-to-create
  useEffect(() => {
    if (!dragCreate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDragCreateCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragCreate, handleDragCreateCancel]);

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
                        <span className={`text-sm font-bold ${
                          today
                            ? 'text-primary dark:text-blue-400'
                            : weekend
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                        }`}>{format(day, 'EEE')}</span>
                        <span className={`text-[11px] ${
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
                        className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center relative"
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
                          className="border-b border-slate-200 dark:border-slate-700 flex flex-col justify-center px-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
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
                          className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-700 h-full relative ${
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
                        {/* Price row — click-to-select for rate overrides */}
                        <div
                          className="flex border-b border-slate-200 dark:border-slate-700 relative z-10 bg-white dark:bg-slate-800"
                          style={{ height: PRICE_ROW_HEIGHT }}
                          onMouseLeave={() => setPriceRowHoverDate(null)}
                        >
                          {days.map((day) => {
                            const weekend = isWeekend(day);
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const price = rateMap.get(`${group.roomType.id}:${dayStr}`);

                            // Determine highlight state
                            let isHighlighted = false;
                            if (priceRowSelection
                              && priceRowSelection.roomTypeId === group.roomType.id
                              && dayStr >= priceRowSelection.startDate
                              && dayStr < priceRowSelection.endDate) {
                              isHighlighted = true; // In finalized selection
                            } else if (priceRowClickStart && priceRowClickStart.roomTypeId === group.roomType.id) {
                              if (priceRowHoverDate && priceRowHoverDate !== priceRowClickStart.date) {
                                // Hover range preview between first click and hover
                                const rangeA = priceRowClickStart.date <= priceRowHoverDate ? priceRowClickStart.date : priceRowHoverDate;
                                const rangeB = priceRowClickStart.date <= priceRowHoverDate ? priceRowHoverDate : priceRowClickStart.date;
                                isHighlighted = dayStr >= rangeA && dayStr <= rangeB;
                              } else {
                                // Just highlight the first clicked cell
                                isHighlighted = dayStr === priceRowClickStart.date;
                              }
                            }

                            return (
                              <div
                                key={`price-${day.toISOString()}`}
                                data-price-cell
                                className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center p-0.5 cursor-pointer select-none transition-colors ${
                                  isHighlighted
                                    ? 'bg-primary/15 dark:bg-primary/25'
                                    : weekend
                                      ? 'bg-amber-50/20 dark:bg-amber-900/5 hover:bg-primary/10 dark:hover:bg-primary/10'
                                      : 'hover:bg-primary/10 dark:hover:bg-primary/10'
                                }`}
                                style={{ width: colWidth }}
                                onClick={(e) => handlePriceRowClick(group.roomType.id, dayStr, e)}
                                onMouseEnter={() => {
                                  if (priceRowClickStart && priceRowClickStart.roomTypeId === group.roomType.id) {
                                    setPriceRowHoverDate(dayStr);
                                  }
                                }}
                              >
                                <span className={`text-xs text-center ${
                                  isHighlighted
                                    ? 'font-bold text-primary dark:text-blue-400'
                                    : price
                                      ? weekend
                                        ? 'font-semibold text-amber-600 dark:text-amber-500'
                                        : 'font-semibold text-slate-700 dark:text-slate-300'
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
                            roomBlocks={blocksByUnit.get(unit.id) ?? []}
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
                            onBlockClick={handleBlockClick}
                            dragCreate={dragCreate}
                            cellSelection={cellSelection}
                            onDragCreateStart={handleDragCreateStart}
                            onDragCreateMove={handleDragCreateMove}
                            onDragCreateEnd={handleDragCreateEnd}
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
          onMaintenance={() => handleCreateBlock('maintenance')}
          onBlockDates={() => handleCreateBlock('blocked')}
          onClose={() => { setCellAction(null); setCellSelection(null); }}
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

      {/* Room block popover */}
      {blockPopover && activeBlock && (
        <RoomBlockPopover
          x={blockPopover.x}
          y={blockPopover.y}
          block={activeBlock}
          unitName={activeBlockUnitName}
          onReleaseDates={handleDeleteBlock}
          onEdit={handleEditBlockOpen}
          onClose={() => setBlockPopover(null)}
        />
      )}

      {/* Room block edit dialog */}
      {blockEdit && (
        <RoomBlockEditDialog
          block={blockEdit}
          onSave={handleEditBlockSave}
          onClose={() => setBlockEdit(null)}
        />
      )}

      {/* Rate override popover */}
      {rateOverridePopover && defaultRatePlanId && (
        <RateOverridePopover
          x={rateOverridePopover.x}
          y={rateOverridePopover.y}
          roomTypeId={rateOverridePopover.roomTypeId}
          roomTypeName={
            roomTypes.find((rt) => rt.id === rateOverridePopover.roomTypeId)?.name ?? ''
          }
          ratePlanId={defaultRatePlanId}
          startDate={rateOverridePopover.startDate}
          endDate={rateOverridePopover.endDate}
          currentPrice={rateOverridePrefill.price}
          currentMinStay={rateOverridePrefill.minStay}
          priceRange={rateOverridePrefill.priceRange}
          minStayRange={rateOverridePrefill.minStayRange}
          onClose={() => {
            setRateOverridePopover(null);
            setPriceRowSelection(null);
            setPriceRowClickStart(null);
            setPriceRowHoverDate(null);
          }}
          onSaved={() => {
            router.refresh();
          }}
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
