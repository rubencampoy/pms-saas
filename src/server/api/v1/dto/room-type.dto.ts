import type { roomTypes, roomTypeImages } from '@/server/db/schema';

type RoomTypeRow = typeof roomTypes.$inferSelect;
type RoomTypeImageRow = typeof roomTypeImages.$inferSelect;

export interface RoomTypeImageDto {
  url: string;
  alt: string | null;
  isCover: boolean;
  sortOrder: number;
}

/**
 * The public shape of a room type.
 *
 * `images` merges the managed `room_type_images` rows with the legacy
 * `room_types.images` URL array, so a consumer sees one list regardless of
 * which path uploaded a picture. Managed images come first and carry their
 * cover flag; legacy URLs follow.
 *
 * Deliberately withheld: `organizationId`.
 */
export interface RoomTypeDto {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  baseOccupancy: number;
  maxOccupancy: number;
  amenities: string[];
  images: RoomTypeImageDto[];
  sortOrder: number;
  isActive: boolean;
}

export function toRoomTypeDto(
  row: RoomTypeRow,
  images: RoomTypeImageRow[] = [],
): RoomTypeDto {
  const managed = images
    .filter((image) => image.roomTypeId === row.id)
    .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder)
    .map((image) => ({
      url: image.url,
      alt: image.alt,
      isCover: image.isCover,
      sortOrder: image.sortOrder,
    }));

  const managedUrls = new Set(managed.map((image) => image.url));
  const legacy = (row.images ?? [])
    .filter((url) => !managedUrls.has(url))
    .map((url, index) => ({
      url,
      alt: null,
      isCover: false,
      sortOrder: managed.length + index,
    }));

  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    code: row.code,
    description: row.description,
    baseOccupancy: row.baseOccupancy,
    maxOccupancy: row.maxOccupancy,
    amenities: row.amenities ?? [],
    images: [...managed, ...legacy],
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}
