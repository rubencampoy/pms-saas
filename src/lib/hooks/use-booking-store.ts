import { create } from 'zustand';
import type {
  SearchResult,
  AddonOption,
  BookingEngineSettings,
  PropertyInfo,
  BookingSummary,
  BookingConfirmation,
  CheckoutGuestData,
} from '@/types/booking-engine';

interface BookingSelection {
  ratePlanId: string;
  quantity: number;
}

interface SearchParams {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

interface BookingState {
  // Config
  propertyInfo: PropertyInfo | null;
  settings: BookingEngineSettings | null;
  slug: string;
  propertyCode: string;

  // Search
  searchParams: SearchParams;
  isSearching: boolean;
  hasSearched: boolean;

  // Results
  results: SearchResult[];
  addons: AddonOption[];

  // Selections
  selectedItems: Map<string, BookingSelection>;
  selectedAddons: Set<string>;

  // Summary
  summary: BookingSummary | null;

  // Booking
  isBooking: boolean;
  bookingError: string | null;

  // Actions
  init: (config: {
    slug: string;
    propertyCode: string;
    propertyInfo: PropertyInfo;
    settings: BookingEngineSettings;
    addons: AddonOption[];
  }) => void;
  setSearchParams: (params: Partial<SearchParams>) => void;
  search: () => Promise<void>;
  selectRoom: (roomTypeId: string, ratePlanId: string, quantity: number) => void;
  toggleAddon: (addonId: string) => void;
  calculateSummary: () => void;
  createBooking: (guestData: CheckoutGuestData) => Promise<BookingConfirmation | null>;
  clearBookingError: () => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  propertyInfo: null,
  settings: null,
  slug: '',
  propertyCode: '',
  searchParams: {
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0,
  },
  isSearching: false,
  hasSearched: false,
  results: [],
  addons: [],
  selectedItems: new Map(),
  selectedAddons: new Set(),
  summary: null,
  isBooking: false,
  bookingError: null,

  init: (config) => {
    set({
      slug: config.slug,
      propertyCode: config.propertyCode,
      propertyInfo: config.propertyInfo,
      settings: config.settings,
      addons: config.addons,
      searchParams: {
        checkIn: '',
        checkOut: '',
        adults: config.settings.defaultAdults,
        children: 0,
      },
    });
  },

  setSearchParams: (params) => {
    set((state) => ({
      searchParams: { ...state.searchParams, ...params },
    }));
  },

  search: async () => {
    const { slug, propertyCode, searchParams } = get();
    if (!searchParams.checkIn || !searchParams.checkOut) return;

    set({ isSearching: true, selectedItems: new Map(), selectedAddons: new Set(), summary: null });

    try {
      const params = new URLSearchParams({
        checkIn: searchParams.checkIn,
        checkOut: searchParams.checkOut,
        adults: String(searchParams.adults),
        children: String(searchParams.children),
      });

      const res = await fetch(
        `/api/public/properties/${slug}/${propertyCode}/availability?${params}`,
      );
      const data = await res.json() as { results?: SearchResult[] };

      set({
        results: data.results ?? [],
        isSearching: false,
        hasSearched: true,
      });
    } catch {
      set({ results: [], isSearching: false, hasSearched: true });
    }
  },

  selectRoom: (roomTypeId, ratePlanId, quantity) => {
    set((state) => {
      const newItems = new Map(state.selectedItems);
      if (quantity <= 0) {
        newItems.delete(roomTypeId);
      } else {
        newItems.set(roomTypeId, { ratePlanId, quantity });
      }
      return { selectedItems: newItems };
    });
    get().calculateSummary();
  },

  toggleAddon: (addonId) => {
    set((state) => {
      const newAddons = new Set(state.selectedAddons);
      if (newAddons.has(addonId)) {
        newAddons.delete(addonId);
      } else {
        newAddons.add(addonId);
      }
      return { selectedAddons: newAddons };
    });
    get().calculateSummary();
  },

  calculateSummary: () => {
    const { selectedItems, selectedAddons, results, addons, searchParams } = get();

    if (selectedItems.size === 0) {
      set({ summary: null });
      return;
    }

    const checkIn = new Date(searchParams.checkIn);
    const checkOut = new Date(searchParams.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const items: BookingSummary['items'] = [];
    let subtotal = 0;

    for (const [roomTypeId, sel] of selectedItems) {
      const rt = results.find((r) => r.roomTypeId === roomTypeId);
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
    for (const addonId of selectedAddons) {
      const addon = addons.find((a) => a.id === addonId);
      if (!addon) continue;

      let total = addon.price;
      if (addon.addonType === 'per_night') {
        total = addon.price * nights;
      } else if (addon.addonType === 'per_person') {
        total = addon.price * (searchParams.adults + searchParams.children);
      }

      subtotal += total;
      summaryAddons.push({
        name: addon.name,
        addonType: addon.addonType,
        unitPrice: addon.price,
        total,
      });
    }

    const currency = results[0]?.currency ?? 'EUR';

    set({
      summary: {
        items,
        addons: summaryAddons,
        nights,
        subtotal,
        total: subtotal,
        currency,
      },
    });
  },

  createBooking: async (guestData) => {
    const { slug, propertyCode, selectedItems, selectedAddons, searchParams } = get();

    if (selectedItems.size === 0) return null;

    set({ isBooking: true, bookingError: null });

    try {
      const items = Array.from(selectedItems.entries()).map(([roomTypeId, sel]) => ({
        roomTypeId,
        ratePlanId: sel.ratePlanId,
        quantity: sel.quantity,
      }));

      const res = await fetch(
        `/api/public/properties/${slug}/${propertyCode}/book`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest: guestData,
            items,
            addonIds: Array.from(selectedAddons),
            checkIn: searchParams.checkIn,
            checkOut: searchParams.checkOut,
            adults: searchParams.adults,
            children: searchParams.children,
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        const errorMsg = errorData.error ?? 'Booking failed';
        set({ isBooking: false, bookingError: errorMsg });
        return null;
      }

      const confirmation = await res.json() as BookingConfirmation;
      set({ isBooking: false });
      return confirmation;
    } catch {
      set({ isBooking: false, bookingError: 'Booking failed' });
      return null;
    }
  },

  clearBookingError: () => {
    set({ bookingError: null });
  },

  reset: () => {
    set({
      results: [],
      selectedItems: new Map(),
      selectedAddons: new Set(),
      summary: null,
      hasSearched: false,
      isBooking: false,
      bookingError: null,
    });
  },
}));
