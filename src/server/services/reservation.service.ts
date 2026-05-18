import { ReservationStatus, VALID_STATUS_TRANSITIONS } from '@/lib/constants/reservation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { housekeepingTaskRepo } from '@/server/repositories/housekeeping-task.repo';
import { channelManagerSyncService } from '@/server/services/channel-manager-sync.service';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { differenceInDays, format } from 'date-fns';

export const reservationService = {
  async create(
    organizationId: string,
    input: {
      propertyId: string;
      guestId: string;
      roomTypeId: string;
      unitId?: string;
      source: string;
      checkInDate: string;
      checkOutDate: string;
      adults: number;
      children: number;
      totalAmount: string;
      currency?: string;
      specialRequests?: string;
      internalNotes?: string;
    },
  ) {
    // 1. Check availability
    const availability = await reservationRepo.countAvailableUnits(
      organizationId,
      input.roomTypeId,
      input.checkInDate,
      input.checkOutDate,
    );

    if (availability.availableUnits <= 0) {
      throw new ConflictError(
        `No availability for the selected room type between ${input.checkInDate} and ${input.checkOutDate}. ` +
          `(${availability.totalUnits} total, ${availability.blockedUnits} blocked)`,
      );
    }

    // 2. Generate confirmation code
    const property = await propertyRepo.findById(organizationId, input.propertyId);
    if (!property) {
      throw new NotFoundError('Property', input.propertyId);
    }

    const confirmationCode = await reservationRepo.getNextConfirmationNumber(
      organizationId,
      property.code,
    );

    // 3. Calculate nights
    const nights = differenceInDays(
      new Date(input.checkOutDate),
      new Date(input.checkInDate),
    );
    if (nights <= 0) {
      throw new ValidationError('Check-out date must be after check-in date');
    }

    // 4. Create reservation
    const reservation = await reservationRepo.create(organizationId, {
      ...input,
      confirmationCode,
      nights,
      status: ReservationStatus.CONFIRMED,
    });

    // Fire-and-forget: sync availability to channel managers
    channelManagerSyncService
      .syncAvailability(organizationId, input.propertyId, input.roomTypeId, input.checkInDate, input.checkOutDate)
      .catch((err) => console.error('[ChannelManager] Sync after create failed:', err));

    return reservation;
  },

  async changeStatus(
    organizationId: string,
    reservationId: string,
    newStatus: ReservationStatus,
    reason?: string,
  ) {
    const reservation = await reservationRepo.findById(organizationId, reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    const currentStatus = reservation.status as ReservationStatus;
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

    if (!validTransitions.includes(newStatus)) {
      throw new ConflictError(
        `Cannot transition from '${currentStatus}' to '${newStatus}'. ` +
          `Valid transitions: ${validTransitions.join(', ') || 'none'}`,
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === ReservationStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = reason ?? null;
    }

    const updated = await reservationRepo.update(organizationId, reservationId, updateData as {
      status: string;
      cancelledAt?: Date;
      cancellationReason?: string;
    });

    // Auto-create checkout cleaning task when a reservation is checked out
    if (newStatus === ReservationStatus.CHECKED_OUT && reservation.unitId) {
      const today = format(new Date(), 'yyyy-MM-dd');
      await housekeepingTaskRepo.create(organizationId, {
        propertyId: reservation.propertyId,
        unitId: reservation.unitId,
        type: 'checkout',
        status: 'pending',
        priority: 'high',
        scheduledDate: today,
        notes: `Checkout cleaning — ${reservation.confirmationCode}`,
      });

      // Mark unit as dirty
      await unitRepo.update(organizationId, reservation.unitId, {
        housekeepingStatus: 'dirty',
      });
    }

    // Fire-and-forget: sync availability when status changes affect inventory
    if (
      newStatus === ReservationStatus.CANCELLED ||
      newStatus === ReservationStatus.NO_SHOW ||
      newStatus === ReservationStatus.CHECKED_OUT
    ) {
      channelManagerSyncService
        .syncAvailability(organizationId, reservation.propertyId, reservation.roomTypeId, reservation.checkInDate, reservation.checkOutDate)
        .catch((err) => console.error('[ChannelManager] Sync after status change failed:', err));
    }

    return updated;
  },

  async checkAvailability(
    organizationId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeReservationId?: string,
  ) {
    return reservationRepo.countAvailableUnits(
      organizationId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      excludeReservationId,
    );
  },

  async assignUnit(
    organizationId: string,
    reservationId: string,
    unitId: string,
  ) {
    const reservation = await reservationRepo.findById(organizationId, reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    // Resolve target unit's room type (may differ from reservation's current room type)
    const targetUnit = await unitRepo.findById(organizationId, unitId);
    if (!targetUnit) {
      throw new NotFoundError('Unit', unitId);
    }
    const targetRoomTypeId = targetUnit.roomTypeId;

    // Verify unit is available for the date range
    const availableUnits = await reservationRepo.findAvailableUnits(
      organizationId,
      targetRoomTypeId,
      reservation.checkInDate,
      reservation.checkOutDate,
    );

    const unitIsAvailable = availableUnits.some((u) => u.id === unitId);
    if (!unitIsAvailable) {
      throw new ConflictError('The selected unit is not available for this date range');
    }

    // If cross-category assignment, also update the roomTypeId
    const updateData: { unitId: string; roomTypeId?: string } = { unitId };
    if (targetRoomTypeId !== reservation.roomTypeId) {
      updateData.roomTypeId = targetRoomTypeId;
    }

    return reservationRepo.update(organizationId, reservationId, updateData);
  },

  /**
   * Move a reservation to a different unit and/or date range.
   * Supports cross-room-type moves — resolves the target unit's room type.
   * Validates availability excluding the reservation itself.
   */
  async moveReservation(
    organizationId: string,
    reservationId: string,
    input: { unitId: string; checkInDate: string; checkOutDate: string; newTotalAmount?: string },
  ) {
    const reservation = await reservationRepo.findById(organizationId, reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    // Only confirmed / checked_in can be moved
    if (reservation.status !== 'confirmed' && reservation.status !== 'checked_in') {
      throw new ConflictError(`Cannot move a reservation with status '${reservation.status}'`);
    }

    const nights = differenceInDays(
      new Date(input.checkOutDate),
      new Date(input.checkInDate),
    );
    if (nights <= 0) {
      throw new ValidationError('Check-out date must be after check-in date');
    }

    // Resolve target unit's room type (may differ from reservation's current room type)
    const targetUnit = await unitRepo.findById(organizationId, input.unitId);
    if (!targetUnit) {
      throw new NotFoundError('Unit', input.unitId);
    }
    const targetRoomTypeId = targetUnit.roomTypeId;

    // Check availability for the target room type (excluding self)
    const availability = await this.checkAvailability(
      organizationId,
      targetRoomTypeId,
      input.checkInDate,
      input.checkOutDate,
      reservationId,
    );

    if (availability.availableUnits <= 0) {
      throw new ConflictError('No availability for the selected dates');
    }

    // Verify the specific unit is free
    const availableUnits = await reservationRepo.findAvailableUnitsExcluding(
      organizationId,
      targetRoomTypeId,
      input.checkInDate,
      input.checkOutDate,
      reservationId,
    );

    const unitIsAvailable = availableUnits.some((u) => u.id === input.unitId);
    if (!unitIsAvailable) {
      throw new ConflictError('The selected unit is not available for the new dates');
    }

    const moved = await reservationRepo.update(organizationId, reservationId, {
      unitId: input.unitId,
      roomTypeId: targetRoomTypeId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      nights,
      ...(input.newTotalAmount ? { totalAmount: input.newTotalAmount } : {}),
    });

    // Fire-and-forget: sync availability for both old and new room types/dates
    const syncOld = channelManagerSyncService
      .syncAvailability(organizationId, reservation.propertyId, reservation.roomTypeId, reservation.checkInDate, reservation.checkOutDate)
      .catch((err) => console.error('[ChannelManager] Sync old dates failed:', err));
    const syncNew = channelManagerSyncService
      .syncAvailability(organizationId, reservation.propertyId, targetRoomTypeId, input.checkInDate, input.checkOutDate)
      .catch((err) => console.error('[ChannelManager] Sync new dates failed:', err));
    // Both are fire-and-forget, no await needed
    void syncOld;
    void syncNew;

    return moved;
  },

  async unassignUnit(
    organizationId: string,
    reservationId: string,
  ) {
    const reservation = await reservationRepo.findById(organizationId, reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    if (reservation.status !== 'confirmed' && reservation.status !== 'checked_in') {
      throw new ConflictError(`Cannot unassign a reservation with status '${reservation.status}'`);
    }

    if (!reservation.unitId) {
      throw new ConflictError('Reservation is already unassigned');
    }

    return reservationRepo.update(organizationId, reservationId, { unitId: null });
  },
};
