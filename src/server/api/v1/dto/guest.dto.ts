import type { guests } from '@/server/db/schema';

type GuestRow = typeof guests.$inferSelect;

/**
 * The public shape of a guest.
 *
 * This is the most sensitive DTO in the API: an organization API key can read
 * *every* guest in its scope, so anything exposed here is exposed in bulk.
 * Withheld on purpose:
 *
 *   - `documentType`, `documentNumber`  government ID — never leaves the PMS
 *   - `dateOfBirth`, `address`          personal data the guest-app does not
 *                                       need to display a booking
 *   - `vipStatus`, `notes`              staff-only commercial annotations
 *   - `totalStays`, `totalRevenue`      internal CRM metrics
 *   - `organizationId`                  the caller is already scoped to it
 *
 * If online check-in later needs identity documents, that is a deliberate
 * decision to revisit with its own scope — not a field to quietly add here.
 */
export interface GuestDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
}

export function toGuestDto(row: GuestRow): GuestDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    nationality: row.nationality,
  };
}
