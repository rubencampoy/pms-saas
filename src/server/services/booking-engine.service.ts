import { bookingEngineRepo } from '@/server/repositories/booking-engine.repo';
import { roomTypeImageRepo } from '@/server/repositories/room-type-image.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { folioRepo, folioLineItemRepo } from '@/server/repositories/folio.repo';
import { reservationService } from '@/server/services/reservation.service';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { differenceInDays } from 'date-fns';
import { DEFAULT_BRAND_COLOR } from '@/lib/validators/booking-engine-settings';
import type {
  SearchResult,
  RatePlanOption,
  NightlyRate,
  AddonOption,
  BookingEngineSettings,
  BookingBranding,
  PropertyInfo,
  BookingSummary,
  BookingSelection,
  CreateBookingInput,
  BookingConfirmation,
  BookingConfirmationItem,
  BookingConfirmationAddon,
} from '@/types/booking-engine';

const DEFAULT_SETTINGS: BookingEngineSettings = {
  availabilityView: 'collapsed',
  priceFormat: 'lowest_night',
  specificRoom: false,
  addonsDisplay: 'before',
  guestFilter: 'full',
  defaultAdults: 2,
  showUnavailable: true,
  autoAssign: true,
  language: 'es',
  fieldPostalAddress: true,
  fieldNationality: true,
  fieldGender: false,
  fieldIdDocument: true,
  fieldCompany: false,
  fieldPhone: true,
  fieldArrivalTime: false,
  fieldTermsAndConditions: true,
  autoConfirmEmail: true,
  redirectConfirmation: false,
  redirectUrl: '',
};

function mapSettings(
  settings: NonNullable<Awaited<ReturnType<typeof bookingEngineRepo.findSettings>>>,
): BookingEngineSettings {
  return {
    availabilityView: settings.availabilityView,
    priceFormat: settings.priceFormat,
    specificRoom: settings.specificRoom,
    addonsDisplay: settings.addonsDisplay,
    guestFilter: settings.guestFilter,
    defaultAdults: settings.defaultAdults,
    showUnavailable: settings.showUnavailable,
    autoAssign: settings.autoAssign,
    language: settings.language,
    fieldPostalAddress: settings.fieldPostalAddress,
    fieldNationality: settings.fieldNationality,
    fieldGender: settings.fieldGender,
    fieldIdDocument: settings.fieldIdDocument,
    fieldCompany: settings.fieldCompany,
    fieldPhone: settings.fieldPhone,
    fieldArrivalTime: settings.fieldArrivalTime,
    fieldTermsAndConditions: settings.fieldTermsAndConditions,
    autoConfirmEmail: settings.autoConfirmEmail,
    redirectConfirmation: settings.redirectConfirmation,
    redirectUrl: settings.redirectUrl ?? '',
  };
}

export const bookingEngineService = {
  /** Resolve organization + property from URL params */
  async resolveProperty(slug: string, propertyCode?: string) {
    const org = await bookingEngineRepo.findOrganizationBySlug(slug);
    if (!org) {
      throw new NotFoundError('Organization', slug);
    }

    if (!propertyCode) {
      const activeProperties = await bookingEngineRepo.findActiveProperties(org.id);
      return { organization: org, properties: activeProperties, property: null };
    }

    const property = await bookingEngineRepo.findPropertyByCode(org.id, propertyCode);
    if (!property) {
      throw new NotFoundError('Property', propertyCode);
    }

    return { organization: org, properties: [], property };
  },

  /** Search availability for all room types at a property */
  async searchAvailability(
    organizationId: string,
    propertyId: string,
    checkInDate: string,
    checkOutDate: string,
    adults: number,
    children: number,
  ): Promise<SearchResult[]> {
    const nights = differenceInDays(new Date(checkOutDate), new Date(checkInDate));
    if (nights <= 0) return [];

    // 1. Get all active room types
    const activeRoomTypes = await bookingEngineRepo.findActiveRoomTypes(organizationId, propertyId);
    if (activeRoomTypes.length === 0) return [];

    // 2. Get active rate plans
    const activeRatePlans = await bookingEngineRepo.findActiveRatePlans(organizationId, propertyId);

    // 3. Get settings for display preferences
    const settings = await bookingEngineRepo.findSettings(organizationId, propertyId);

    // 3b. Get all room type images for the organization
    const allImages = await roomTypeImageRepo.findAll(organizationId);

    // 4. Process each room type
    const results: SearchResult[] = [];

    for (const rt of activeRoomTypes) {
      // Check occupancy
      const totalGuests = adults + children;
      if (totalGuests > rt.maxOccupancy) continue;

      // Check availability
      const availability = await bookingEngineRepo.countAvailableUnits(
        organizationId,
        rt.id,
        checkInDate,
        checkOutDate,
      );

      // Skip unavailable unless settings say to show them
      if (availability.availableUnits <= 0 && !settings?.showUnavailable) continue;

      // Get rates from all active rate plans
      const ratePlanOptions: RatePlanOption[] = [];

      for (const rp of activeRatePlans) {
        const rateRows = await bookingEngineRepo.findRatesForRoomType(
          organizationId,
          rp.id,
          rt.id,
          checkInDate,
          checkOutDate,
        );

        // Only include rate plan if we have rates for all nights
        if (rateRows.length !== nights) continue;

        // Validate restrictions: minStay, maxStay, closedToArrival, closedToDeparture
        const maxMinStay = Math.max(...rateRows.map((r) => r.minStay));
        if (nights < maxMinStay) continue;

        const minMaxStay = rateRows.some((r) => r.maxStay !== null)
          ? Math.min(...rateRows.filter((r) => r.maxStay !== null).map((r) => r.maxStay!))
          : null;
        if (minMaxStay !== null && nights > minMaxStay) continue;

        // Check closedToArrival on check-in date
        const checkInRate = rateRows.find((r) => r.date === checkInDate);
        if (checkInRate?.closedToArrival) continue;

        // Check closedToDeparture on the last night (night before check-out)
        const lastNightRate = rateRows[rateRows.length - 1];
        if (lastNightRate?.closedToDeparture) continue;

        const nightlyRates: NightlyRate[] = rateRows.map((r) => ({
          date: r.date,
          amount: parseFloat(r.amount),
        }));

        const totalAmount = nightlyRates.reduce((sum, nr) => sum + nr.amount, 0);

        ratePlanOptions.push({
          ratePlanId: rp.id,
          name: rp.name,
          cancellationPolicy: rp.cancellationPolicy,
          cancellationHours: rp.cancellationHours,
          nightlyRates,
          totalAmount,
          currency: rateRows[0]?.currency ?? 'EUR',
        });
      }

      // Skip if no rate plan has rates
      if (ratePlanOptions.length === 0 && availability.availableUnits > 0) continue;

      const lowestPrice =
        ratePlanOptions.length > 0
          ? Math.min(...ratePlanOptions.map((rp) => {
              if (settings?.priceFormat === 'total_stay') return rp.totalAmount;
              return Math.min(...rp.nightlyRates.map((nr) => nr.amount));
            }))
          : 0;

      results.push({
        roomTypeId: rt.id,
        name: rt.name,
        code: rt.code,
        description: rt.description,
        images: allImages
          .filter((img) => img.roomTypeId === rt.id)
          .map((img) => img.url),
        amenities: rt.amenities ?? [],
        baseOccupancy: rt.baseOccupancy,
        maxOccupancy: rt.maxOccupancy,
        availableUnits: availability.availableUnits,
        ratePlans: ratePlanOptions,
        lowestPrice,
        currency: ratePlanOptions[0]?.currency ?? 'EUR',
      });
    }

    // Sort: available first, then by sort order
    results.sort((a, b) => {
      if (a.availableUnits > 0 && b.availableUnits <= 0) return -1;
      if (a.availableUnits <= 0 && b.availableUnits > 0) return 1;
      return 0;
    });

    return results;
  },

  /** Get addons for a property */
  async getAddons(organizationId: string, propertyId: string): Promise<AddonOption[]> {
    const addons = await bookingEngineRepo.findActiveAddons(organizationId, propertyId);
    return addons.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      price: parseFloat(a.price),
      currency: a.currency,
      addonType: a.addonType,
      icon: a.icon,
    }));
  },

  /** Get booking engine settings */
  async getSettings(organizationId: string, propertyId: string): Promise<BookingEngineSettings> {
    const settings = await bookingEngineRepo.findSettings(organizationId, propertyId);
    if (!settings) {
      return { ...DEFAULT_SETTINGS };
    }
    return mapSettings(settings);
  },

  /**
   * Imagen corporativa de una propiedad, con los valores por defecto de Chamelio
   * cuando no se ha configurado nada.
   */
  async getBranding(
    organizationId: string,
    propertyId: string,
    propertyName: string,
  ): Promise<BookingBranding> {
    const settings = await bookingEngineRepo.findSettings(organizationId, propertyId);

    return {
      displayName: settings?.brandDisplayName || propertyName,
      primaryColor: settings?.brandPrimaryColor || DEFAULT_BRAND_COLOR,
      logoUrl: settings?.brandLogoUrl ?? '',
      faviconUrl: settings?.brandFaviconUrl ?? '',
      coverImageUrl: settings?.brandCoverImageUrl ?? '',
      hideChamelio: settings?.brandHideChamelio ?? false,
      privacyUrl: settings?.brandPrivacyUrl ?? '',
      termsUrl: settings?.brandTermsUrl ?? '',
      cookiesUrl: settings?.brandCookiesUrl ?? '',
    };
  },

  /** Get property info for the booking engine header */
  async getPropertyInfo(organizationId: string, propertyId: string): Promise<PropertyInfo | null> {
    const property = await bookingEngineRepo.findPropertyByCode(organizationId, propertyId);
    if (!property) return null;

    return {
      id: property.id,
      name: property.name,
      code: property.code,
      address: (property.address ?? {}) as Record<string, string>,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      timezone: property.timezone,
    };
  },

  /** Calculate price breakdown for selected items + addons */
  calculateSummary(
    selections: BookingSelection[],
    addonIds: string[],
    searchResults: SearchResult[],
    addons: AddonOption[],
    nights: number,
    adults: number,
    children: number,
  ): BookingSummary {
    const items: BookingSummary['items'] = [];
    let subtotal = 0;

    for (const sel of selections) {
      const rt = searchResults.find((r) => r.roomTypeId === sel.roomTypeId);
      if (!rt) continue;

      const rp = rt.ratePlans.find((p) => p.ratePlanId === sel.ratePlanId);
      if (!rp) continue;

      const itemTotal = rp.totalAmount * sel.quantity;
      subtotal += itemTotal;

      items.push({
        roomTypeName: rt.name,
        ratePlanName: rp.name,
        quantity: sel.quantity,
        nightlyTotal: rp.totalAmount,
        total: itemTotal,
      });
    }

    const summaryAddons: BookingSummary['addons'] = [];
    for (const addonId of addonIds) {
      const addon = addons.find((a) => a.id === addonId);
      if (!addon) continue;

      let total = addon.price;
      if (addon.addonType === 'per_night') {
        total = addon.price * nights;
      } else if (addon.addonType === 'per_person') {
        total = addon.price * (adults + children);
      }

      subtotal += total;
      summaryAddons.push({
        name: addon.name,
        addonType: addon.addonType,
        unitPrice: addon.price,
        total,
      });
    }

    return {
      items,
      addons: summaryAddons,
      nights,
      subtotal,
      total: subtotal,
      currency: items[0]?.total ? searchResults[0]?.currency ?? 'EUR' : 'EUR',
    };
  },

  /** Create a booking from the public booking engine */
  async createBooking(
    organizationId: string,
    propertyId: string,
    input: CreateBookingInput,
  ): Promise<BookingConfirmation> {
    const nights = differenceInDays(new Date(input.checkOut), new Date(input.checkIn));
    if (nights <= 0) {
      throw new ConflictError('Check-out date must be after check-in date');
    }

    // 1. Re-check availability for ALL items upfront
    for (const item of input.items) {
      const availability = await bookingEngineRepo.countAvailableUnits(
        organizationId,
        item.roomTypeId,
        input.checkIn,
        input.checkOut,
      );
      if (availability.availableUnits < item.quantity) {
        const rt = await bookingEngineRepo.findActiveRoomTypes(organizationId, propertyId);
        const roomType = rt.find((r) => r.id === item.roomTypeId);
        throw new ConflictError(
          `Not enough availability for ${roomType?.name ?? 'selected room type'}. ` +
            `Requested ${item.quantity}, available ${availability.availableUnits}.`,
        );
      }
    }

    // 2. Re-verify rates exist for each item and collect rate data
    const itemRates: Array<{
      item: (typeof input.items)[0];
      nightlyRates: NightlyRate[];
      totalPerRoom: number;
      currency: string;
      roomTypeName: string;
      ratePlanName: string;
    }> = [];

    for (const item of input.items) {
      const ratePlans = await bookingEngineRepo.findActiveRatePlans(organizationId, propertyId);
      const rp = ratePlans.find((r) => r.id === item.ratePlanId);
      if (!rp) {
        throw new NotFoundError('RatePlan', item.ratePlanId);
      }

      const rateRows = await bookingEngineRepo.findRatesForRoomType(
        organizationId,
        item.ratePlanId,
        item.roomTypeId,
        input.checkIn,
        input.checkOut,
      );

      if (rateRows.length !== nights) {
        throw new ConflictError(
          `Rates not available for all nights for rate plan ${rp.name}`,
        );
      }

      // Validate restrictions
      const maxMinStay = Math.max(...rateRows.map((r) => r.minStay));
      if (nights < maxMinStay) {
        throw new ConflictError(
          `Minimum stay of ${maxMinStay} nights required for rate plan ${rp.name}`,
        );
      }

      const minMaxStay = rateRows.some((r) => r.maxStay !== null)
        ? Math.min(...rateRows.filter((r) => r.maxStay !== null).map((r) => r.maxStay!))
        : null;
      if (minMaxStay !== null && nights > minMaxStay) {
        throw new ConflictError(
          `Maximum stay of ${minMaxStay} nights exceeded for rate plan ${rp.name}`,
        );
      }

      const checkInRate = rateRows.find((r) => r.date === input.checkIn);
      if (checkInRate?.closedToArrival) {
        throw new ConflictError(
          `Arrival not allowed on ${input.checkIn} for rate plan ${rp.name}`,
        );
      }

      const lastNightRate = rateRows[rateRows.length - 1];
      if (lastNightRate?.closedToDeparture) {
        throw new ConflictError(
          `Departure not allowed on ${input.checkOut} for rate plan ${rp.name}`,
        );
      }

      const nightlyRates: NightlyRate[] = rateRows.map((r) => ({
        date: r.date,
        amount: parseFloat(r.amount),
      }));
      const totalPerRoom = nightlyRates.reduce((sum, nr) => sum + nr.amount, 0);

      const roomTypes = await bookingEngineRepo.findActiveRoomTypes(organizationId, propertyId);
      const rt = roomTypes.find((r) => r.id === item.roomTypeId);

      itemRates.push({
        item,
        nightlyRates,
        totalPerRoom,
        currency: rateRows[0]?.currency ?? 'EUR',
        roomTypeName: rt?.name ?? 'Room',
        ratePlanName: rp.name,
      });
    }

    // 3. Find or create guest
    const duplicates = await guestRepo.findDuplicates(
      organizationId,
      input.guest.email,
      input.guest.documentType,
      input.guest.documentNumber,
    );

    let guest;
    if (duplicates.length > 0) {
      guest = duplicates[0]!;
      // Update guest with new info if provided
      await guestRepo.update(organizationId, guest.id, {
        firstName: input.guest.firstName,
        lastName: input.guest.lastName,
        phone: input.guest.phone,
        nationality: input.guest.nationality,
        documentType: input.guest.documentType,
        documentNumber: input.guest.documentNumber,
        address: input.guest.address as Record<string, string> | undefined,
      });
    } else {
      guest = await guestRepo.create(organizationId, {
        firstName: input.guest.firstName,
        lastName: input.guest.lastName,
        email: input.guest.email,
        phone: input.guest.phone,
        nationality: input.guest.nationality,
        documentType: input.guest.documentType,
        documentNumber: input.guest.documentNumber,
        address: input.guest.address as Record<string, string> | undefined,
      });
    }

    // 4. Get addon data
    const addonData: BookingConfirmationAddon[] = [];
    let addonTotal = 0;
    if (input.addonIds.length > 0) {
      const allAddons = await bookingEngineRepo.findActiveAddons(organizationId, propertyId);
      for (const addonId of input.addonIds) {
        const addon = allAddons.find((a) => a.id === addonId);
        if (!addon) continue;

        let total = parseFloat(addon.price);
        if (addon.addonType === 'per_night') {
          total = parseFloat(addon.price) * nights;
        } else if (addon.addonType === 'per_person') {
          total = parseFloat(addon.price) * (input.adults + input.children);
        }

        addonTotal += total;
        addonData.push({ name: addon.name, total });
      }
    }

    // 5. Create reservations — for each item, loop `quantity` times
    const confirmationCodes: string[] = [];
    const confirmationItems: BookingConfirmationItem[] = [];
    let grandTotal = 0;
    let currency = 'EUR';

    for (const ir of itemRates) {
      for (let q = 0; q < ir.item.quantity; q++) {
        const reservation = await reservationService.create(organizationId, {
          propertyId,
          guestId: guest.id,
          roomTypeId: ir.item.roomTypeId,
          source: 'website',
          checkInDate: input.checkIn,
          checkOutDate: input.checkOut,
          adults: input.adults,
          children: input.children,
          totalAmount: ir.totalPerRoom.toFixed(2),
          currency: ir.currency,
          specialRequests: input.guest.specialRequests,
        });

        confirmationCodes.push(reservation.confirmationCode);
        confirmationItems.push({
          roomTypeName: ir.roomTypeName,
          ratePlanName: ir.ratePlanName,
          confirmationCode: reservation.confirmationCode,
          nightlyTotal: ir.totalPerRoom,
        });

        grandTotal += ir.totalPerRoom;
        currency = ir.currency;

        // 6. Create folio + line items per reservation
        const folioNumber = await folioRepo.getNextFolioNumber(organizationId);
        const folio = await folioRepo.create(organizationId, {
          reservationId: reservation.id,
          guestId: guest.id,
          folioNumber,
          currency: ir.currency,
        });

        // Add room_charge line per night
        for (const nr of ir.nightlyRates) {
          await folioLineItemRepo.create(organizationId, {
            folioId: folio.id,
            type: 'room_charge',
            description: `${ir.roomTypeName} — ${ir.ratePlanName}`,
            date: nr.date,
            quantity: 1,
            unitPrice: nr.amount.toFixed(2),
            amount: nr.amount.toFixed(2),
            taxRate: '0',
            taxAmount: '0',
          });
        }

        // Add supplement lines for addons (split equally per reservation)
        if (input.addonIds.length > 0 && q === 0) {
          const allAddons = await bookingEngineRepo.findActiveAddons(organizationId, propertyId);
          for (const addonId of input.addonIds) {
            const addon = allAddons.find((a) => a.id === addonId);
            if (!addon) continue;

            let total = parseFloat(addon.price);
            if (addon.addonType === 'per_night') {
              total = parseFloat(addon.price) * nights;
            } else if (addon.addonType === 'per_person') {
              total = parseFloat(addon.price) * (input.adults + input.children);
            }

            await folioLineItemRepo.create(organizationId, {
              folioId: folio.id,
              type: 'supplement',
              description: addon.name,
              date: input.checkIn,
              quantity: 1,
              unitPrice: total.toFixed(2),
              amount: total.toFixed(2),
              taxRate: '0',
              taxAmount: '0',
            });
          }
        }

        await folioRepo.recalculateTotals(organizationId, folio.id);
      }
    }

    grandTotal += addonTotal;

    // Get property name
    const property = await bookingEngineRepo.findPropertyByCode(organizationId, '');
    const propertyData = await bookingEngineRepo.findActiveProperties(organizationId);
    const prop = propertyData.find((p) => p.id === propertyId);

    return {
      confirmationCodes,
      guestName: `${input.guest.firstName} ${input.guest.lastName}`,
      email: input.guest.email,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      propertyName: prop?.name ?? property?.name ?? '',
      items: confirmationItems,
      addons: addonData,
      totalAmount: grandTotal,
      currency,
    };
  },
};
