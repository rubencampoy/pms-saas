import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { organizationBilling } from '@/server/db/schema';

export type OrganizationBillingRow = typeof organizationBilling.$inferSelect;

export type OrganizationBillingInput = {
  legalName: string | null;
  taxId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  country: string;
  billingEmail: string | null;
};

export const organizationBillingRepo = {
  async findByOrg(organizationId: string) {
    return db.query.organizationBilling.findFirst({
      where: eq(organizationBilling.organizationId, organizationId),
    });
  },

  async upsert(organizationId: string, values: OrganizationBillingInput) {
    const [row] = await db
      .insert(organizationBilling)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({
        target: organizationBilling.organizationId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
