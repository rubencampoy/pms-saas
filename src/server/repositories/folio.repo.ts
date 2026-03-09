import { db } from '@/server/db';
import { folios, folioLineItems, payments } from '@/server/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';

export const folioRepo = {
  async findByReservation(organizationId: string, reservationId: string) {
    return db.query.folios.findFirst({
      where: and(
        eq(folios.organizationId, organizationId),
        eq(folios.reservationId, reservationId),
      ),
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.folios.findFirst({
      where: and(
        eq(folios.organizationId, organizationId),
        eq(folios.id, id),
      ),
    });
  },

  async findAll(
    organizationId: string,
    options?: { status?: string; limit?: number; offset?: number },
  ) {
    const conditions = [eq(folios.organizationId, organizationId)];
    if (options?.status) {
      conditions.push(eq(folios.status, options.status));
    }

    return db
      .select()
      .from(folios)
      .where(and(...conditions))
      .orderBy(desc(folios.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);
  },

  async getNextFolioNumber(organizationId: string) {
    const year = new Date().getFullYear();
    const prefix = `F-${year}-`;

    const lastFolio = await db
      .select({ folioNumber: folios.folioNumber })
      .from(folios)
      .where(
        and(
          eq(folios.organizationId, organizationId),
          sql`${folios.folioNumber} LIKE ${prefix + '%'}`,
        ),
      )
      .orderBy(desc(folios.folioNumber))
      .limit(1);

    if (lastFolio.length === 0 || !lastFolio[0]) {
      return `${prefix}00001`;
    }

    const lastNum = parseInt(lastFolio[0].folioNumber.replace(prefix, ''), 10);
    return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
  },

  async create(
    organizationId: string,
    data: {
      reservationId: string;
      guestId: string;
      folioNumber: string;
      currency?: string;
      notes?: string;
    },
  ) {
    const [folio] = await db
      .insert(folios)
      .values({
        organizationId,
        ...data,
        status: 'open',
        subtotal: '0',
        taxTotal: '0',
        total: '0',
        paidAmount: '0',
        balance: '0',
      })
      .returning();
    return folio!;
  },

  async recalculateTotals(organizationId: string, folioId: string) {
    // Sum charges
    const [chargeResult] = await db
      .select({
        subtotal: sql<string>`COALESCE(SUM(${folioLineItems.amount}), 0)::numeric(10,2)`,
        taxTotal: sql<string>`COALESCE(SUM(${folioLineItems.taxAmount}), 0)::numeric(10,2)`,
      })
      .from(folioLineItems)
      .where(
        and(
          eq(folioLineItems.organizationId, organizationId),
          eq(folioLineItems.folioId, folioId),
        ),
      );

    // Sum payments
    const [paymentResult] = await db
      .select({
        paidAmount: sql<string>`COALESCE(SUM(${payments.amount}), 0)::numeric(10,2)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.folioId, folioId),
        ),
      );

    const subtotal = chargeResult?.subtotal ?? '0';
    const taxTotal = chargeResult?.taxTotal ?? '0';
    const total = (parseFloat(subtotal) + parseFloat(taxTotal)).toFixed(2);
    const paidAmount = paymentResult?.paidAmount ?? '0';
    const balance = (parseFloat(total) - parseFloat(paidAmount)).toFixed(2);

    const [updated] = await db
      .update(folios)
      .set({ subtotal, taxTotal, total, paidAmount, balance, updatedAt: new Date() })
      .where(
        and(
          eq(folios.organizationId, organizationId),
          eq(folios.id, folioId),
        ),
      )
      .returning();

    return updated;
  },

  async close(organizationId: string, folioId: string) {
    const [folio] = await db
      .update(folios)
      .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(folios.organizationId, organizationId),
          eq(folios.id, folioId),
        ),
      )
      .returning();
    return folio;
  },

  async void_(organizationId: string, folioId: string) {
    const [folio] = await db
      .update(folios)
      .set({ status: 'void', updatedAt: new Date() })
      .where(
        and(
          eq(folios.organizationId, organizationId),
          eq(folios.id, folioId),
        ),
      )
      .returning();
    return folio;
  },
};

export const folioLineItemRepo = {
  async findByFolio(organizationId: string, folioId: string) {
    return db
      .select()
      .from(folioLineItems)
      .where(
        and(
          eq(folioLineItems.organizationId, organizationId),
          eq(folioLineItems.folioId, folioId),
        ),
      )
      .orderBy(folioLineItems.date, folioLineItems.createdAt);
  },

  async create(
    organizationId: string,
    data: {
      folioId: string;
      type: string;
      description: string;
      date: string;
      quantity: number;
      unitPrice: string;
      amount: string;
      taxRate: string;
      taxAmount: string;
      createdBy?: string | null;
    },
  ) {
    const [item] = await db
      .insert(folioLineItems)
      .values({ organizationId, ...data })
      .returning();
    return item!;
  },

  async delete(organizationId: string, id: string) {
    const [item] = await db
      .delete(folioLineItems)
      .where(
        and(
          eq(folioLineItems.organizationId, organizationId),
          eq(folioLineItems.id, id),
        ),
      )
      .returning();
    return item;
  },
};

export const paymentRepo = {
  async findByFolio(organizationId: string, folioId: string) {
    return db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.folioId, folioId),
        ),
      )
      .orderBy(payments.processedAt);
  },

  async create(
    organizationId: string,
    data: {
      folioId: string;
      method: string;
      amount: string;
      reference?: string;
      notes?: string;
      processedBy: string;
    },
  ) {
    const [payment] = await db
      .insert(payments)
      .values({ organizationId, ...data })
      .returning();
    return payment!;
  },

  async delete(organizationId: string, id: string) {
    const [payment] = await db
      .delete(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.id, id),
        ),
      )
      .returning();
    return payment;
  },
};
