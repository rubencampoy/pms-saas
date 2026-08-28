import { describe, it, expect } from 'vitest';
import type {
  properties,
  roomTypes,
  roomTypeImages,
  guests,
  units,
  folios,
  folioLineItems,
  payments,
} from '@/server/db/schema';
import { toPropertyDto } from './property.dto';
import { toRoomTypeDto } from './room-type.dto';
import { toGuestDto } from './guest.dto';
import { toUnitDto } from './unit.dto';
import { toFolioDto } from './folio.dto';

const ORG = '11111111-1111-1111-1111-111111111111';
const STAFF_USER = '99999999-9999-9999-9999-999999999999';

const property: typeof properties.$inferSelect = {
  id: '22222222-2222-2222-2222-222222222222',
  organizationId: ORG,
  name: 'Apartamentos Hotel Guardamar',
  code: 'HGU',
  address: {
    street: 'Av. de Europa 45',
    city: 'Guardamar del Segura',
    state: 'Alicante',
    postalCode: '03140',
    country: 'ES',
  },
  phone: '+34 900 000 000',
  email: 'info@example.com',
  checkInTime: '14:00:00',
  checkOutTime: '11:00:00',
  timezone: 'Europe/Madrid',
  isActive: true,
  plan: 'pro',
  maxUnits: 60,
  ipRestrictionEnabled: true,
  allowedIps: ['203.0.113.7', '198.51.100.0/24'],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('toPropertyDto', () => {
  it('never leaks the IP allowlist or commercial plan data', () => {
    const serialized = JSON.stringify(toPropertyDto(property));

    expect(serialized).not.toContain('203.0.113.7');
    expect(serialized).not.toContain('198.51.100.0/24');
    expect(serialized).not.toContain('allowedIps');
    expect(serialized).not.toContain('ipRestriction');
    expect(serialized).not.toContain('maxUnits');
    expect(serialized).not.toContain(ORG);
  });

  it('exposes exactly the documented fields', () => {
    expect(Object.keys(toPropertyDto(property)).sort()).toEqual([
      'address', 'checkInTime', 'checkOutTime', 'code', 'email',
      'id', 'isActive', 'name', 'phone', 'timezone',
    ]);
  });

  it('normalises the untyped address jsonb field by field', () => {
    const dto = toPropertyDto({
      ...property,
      address: { city: 'Alicante', secretInternalField: 'leak me' },
    });

    expect(dto.address).toEqual({
      street: null, city: 'Alicante', state: null, postalCode: null, country: null,
    });
    expect(JSON.stringify(dto)).not.toContain('leak me');
  });

  it('survives a null or malformed address', () => {
    expect(toPropertyDto({ ...property, address: null }).address.city).toBeNull();
    expect(toPropertyDto({ ...property, address: 'nonsense' }).address.city).toBeNull();
  });
});

const guest: typeof guests.$inferSelect = {
  id: '33333333-3333-3333-3333-333333333333',
  organizationId: ORG,
  firstName: 'Ana',
  lastName: 'Ruiz',
  email: 'ana@example.com',
  phone: '+34 600 000 000',
  documentType: 'dni',
  documentNumber: '12345678Z',
  nationality: 'ES',
  dateOfBirth: '1985-04-12',
  address: { street: 'Calle Falsa 123' },
  vipStatus: 'gold',
  notes: 'Difficult guest — do not upgrade',
  totalStays: 7,
  totalRevenue: '4821.50',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('toGuestDto', () => {
  it('never leaks identity documents, CRM metrics or staff notes', () => {
    const serialized = JSON.stringify(toGuestDto(guest));

    expect(serialized).not.toContain('12345678Z');
    expect(serialized).not.toContain('documentNumber');
    expect(serialized).not.toContain('1985-04-12');
    expect(serialized).not.toContain('Calle Falsa');
    expect(serialized).not.toContain('gold');
    expect(serialized).not.toContain('do not upgrade');
    expect(serialized).not.toContain('4821.50');
    expect(serialized).not.toContain(ORG);
  });

  it('exposes exactly the documented fields', () => {
    expect(Object.keys(toGuestDto(guest)).sort()).toEqual([
      'email', 'firstName', 'id', 'lastName', 'nationality', 'phone',
    ]);
  });
});

const roomType: typeof roomTypes.$inferSelect = {
  id: '44444444-4444-4444-4444-444444444444',
  organizationId: ORG,
  propertyId: property.id,
  name: 'Apartamento 2 dormitorios',
  code: 'A2D',
  description: 'Con terraza',
  baseOccupancy: 2,
  maxOccupancy: 4,
  images: ['https://cdn/legacy.jpg', 'https://cdn/managed.jpg'],
  amenities: ['wifi', 'ac'],
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const image = (over: Partial<typeof roomTypeImages.$inferSelect>) =>
  ({
    id: '55555555-5555-5555-5555-555555555555',
    organizationId: ORG,
    roomTypeId: roomType.id,
    url: 'https://cdn/managed.jpg',
    alt: 'Salón',
    sortOrder: 0,
    isCover: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as typeof roomTypeImages.$inferSelect;

describe('toRoomTypeDto', () => {
  it('does not leak the tenant id', () => {
    expect(JSON.stringify(toRoomTypeDto(roomType, []))).not.toContain(ORG);
  });

  it('puts the cover image first, then sort order', () => {
    const dto = toRoomTypeDto(roomType, [
      image({ id: 'a', url: 'https://cdn/b.jpg', sortOrder: 2 }),
      image({ id: 'b', url: 'https://cdn/cover.jpg', sortOrder: 9, isCover: true }),
      image({ id: 'c', url: 'https://cdn/a.jpg', sortOrder: 1 }),
    ]);

    expect(dto.images.map((i) => i.url)).toEqual([
      'https://cdn/cover.jpg', 'https://cdn/a.jpg', 'https://cdn/b.jpg',
      'https://cdn/legacy.jpg', 'https://cdn/managed.jpg',
    ]);
  });

  it('does not list an image twice when it exists in both sources', () => {
    const dto = toRoomTypeDto(roomType, [image({ url: 'https://cdn/managed.jpg' })]);
    const urls = dto.images.map((i) => i.url);

    expect(urls.filter((u) => u === 'https://cdn/managed.jpg')).toHaveLength(1);
    expect(urls).toEqual(['https://cdn/managed.jpg', 'https://cdn/legacy.jpg']);
  });

  it('ignores images belonging to a different room type', () => {
    const dto = toRoomTypeDto(roomType, [
      image({ url: 'https://cdn/other.jpg', roomTypeId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }),
    ]);

    expect(dto.images.map((i) => i.url)).not.toContain('https://cdn/other.jpg');
  });

  it('copes with null array columns', () => {
    const dto = toRoomTypeDto({ ...roomType, images: null, amenities: null }, []);
    expect(dto.images).toEqual([]);
    expect(dto.amenities).toEqual([]);
  });
});

const folio: typeof folios.$inferSelect = {
  id: '66666666-6666-6666-6666-666666666666',
  organizationId: ORG,
  reservationId: '77777777-7777-7777-7777-777777777777',
  guestId: guest.id,
  folioNumber: 'F-2026-0042',
  status: 'open',
  subtotal: '400.00',
  taxTotal: '40.00',
  total: '440.00',
  paidAmount: '200.00',
  balance: '240.00',
  currency: 'EUR',
  notes: 'Chase this one, card declined twice',
  closedAt: null,
  createdAt: new Date('2026-08-01T09:00:00.000Z'),
  updatedAt: new Date('2026-08-20T14:30:00.000Z'),
};

const lineItem: typeof folioLineItems.$inferSelect = {
  id: '88888888-8888-8888-8888-888888888888',
  organizationId: ORG,
  folioId: folio.id,
  type: 'accommodation',
  description: 'Noche 2026-09-01',
  date: '2026-09-01',
  quantity: 1,
  unitPrice: '100.00',
  amount: '100.00',
  taxRate: '10.00',
  taxAmount: '10.00',
  createdBy: STAFF_USER,
  createdAt: new Date('2026-08-01T09:00:00.000Z'),
};

const payment: typeof payments.$inferSelect = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  organizationId: ORG,
  folioId: folio.id,
  method: 'card',
  amount: '200.00',
  reference: 'auth-8842',
  notes: 'Taken at front desk by Marta',
  processedAt: new Date('2026-08-15T10:00:00.000Z'),
  processedBy: STAFF_USER,
  createdAt: new Date('2026-08-15T10:00:00.000Z'),
};

describe('toFolioDto', () => {
  it('never leaks staff notes or the staff user ids behind each line', () => {
    const serialized = JSON.stringify(
      toFolioDto(folio, { lineItems: [lineItem], payments: [payment] }),
    );

    expect(serialized).not.toContain('card declined twice');
    expect(serialized).not.toContain('Taken at front desk');
    expect(serialized).not.toContain(STAFF_USER);
    expect(serialized).not.toContain('createdBy');
    expect(serialized).not.toContain('processedBy');
    expect(serialized).not.toContain(ORG);
  });

  it('omits the detail arrays entirely when not requested', () => {
    const dto = toFolioDto(folio);
    expect(dto.lineItems).toBeUndefined();
    expect(dto.payments).toBeUndefined();
  });

  it('keeps money as decimal strings, not floats', () => {
    const dto = toFolioDto(folio, { lineItems: [lineItem], payments: [payment] });

    expect(dto.total).toBe('440.00');
    expect(dto.balance).toBe('240.00');
    expect(dto.lineItems?.[0]?.amount).toBe('100.00');
    expect(typeof dto.payments?.[0]?.amount).toBe('string');
  });

  it('exposes exactly the documented fields', () => {
    const dto = toFolioDto(folio, { lineItems: [lineItem], payments: [payment] });

    expect(Object.keys(dto).sort()).toEqual([
      'balance', 'closedAt', 'createdAt', 'currency', 'folioNumber', 'guestId',
      'id', 'lineItems', 'paidAmount', 'payments', 'reservationId', 'status',
      'subtotal', 'taxTotal', 'total', 'updatedAt',
    ]);
    expect(Object.keys(dto.lineItems![0]!).sort()).toEqual([
      'amount', 'createdAt', 'date', 'description', 'id', 'quantity',
      'taxAmount', 'taxRate', 'type', 'unitPrice',
    ]);
    expect(Object.keys(dto.payments![0]!).sort()).toEqual([
      'amount', 'id', 'method', 'processedAt', 'reference',
    ]);
  });
});

const unit: typeof units.$inferSelect = {
  id: '44444444-4444-4444-4444-444444444444',
  organizationId: ORG,
  propertyId: '22222222-2222-2222-2222-222222222222',
  roomTypeId: '55555555-5555-5555-5555-555555555555',
  name: 'A-101',
  floor: '1',
  status: 'occupied',
  housekeepingStatus: 'dirty',
  isActive: true,
  sortOrder: 3,
  notes: 'Lock battery replaced in March',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('toUnitDto', () => {
  it('never leaks housekeeping state, staff notes or inventory bookkeeping', () => {
    const serialized = JSON.stringify(toUnitDto(unit));

    expect(serialized).not.toContain('occupied');
    expect(serialized).not.toContain('dirty');
    expect(serialized).not.toContain('housekeeping');
    expect(serialized).not.toContain('Lock battery');
    expect(serialized).not.toContain('sortOrder');
    expect(serialized).not.toContain('isActive');
    expect(serialized).not.toContain(ORG);
  });

  it('exposes exactly the documented fields', () => {
    expect(Object.keys(toUnitDto(unit)).sort()).toEqual(['floor', 'id', 'name']);
  });

  it('keeps the name, which is what an integration matches a door lock on', () => {
    expect(toUnitDto(unit).name).toBe('A-101');
    expect(toUnitDto({ ...unit, floor: null }).floor).toBeNull();
  });
});
