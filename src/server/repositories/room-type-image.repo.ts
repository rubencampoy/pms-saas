import { db } from '@/server/db';
import { roomTypeImages } from '@/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';

export const roomTypeImageRepo = {
  async findAll(organizationId: string) {
    return db
      .select()
      .from(roomTypeImages)
      .where(eq(roomTypeImages.organizationId, organizationId))
      .orderBy(asc(roomTypeImages.sortOrder));
  },

  async findByRoomType(organizationId: string, roomTypeId: string) {
    return db
      .select()
      .from(roomTypeImages)
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.roomTypeId, roomTypeId),
        ),
      )
      .orderBy(asc(roomTypeImages.sortOrder));
  },

  async findById(organizationId: string, id: string) {
    const results = await db
      .select()
      .from(roomTypeImages)
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.id, id),
        ),
      )
      .limit(1);
    return results[0] ?? null;
  },

  async countByRoomType(organizationId: string, roomTypeId: string) {
    const results = await db
      .select({ id: roomTypeImages.id })
      .from(roomTypeImages)
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.roomTypeId, roomTypeId),
        ),
      );
    return results.length;
  },

  async create(data: {
    organizationId: string;
    roomTypeId: string;
    url: string;
    alt?: string;
    sortOrder: number;
    isCover: boolean;
  }) {
    const [image] = await db.insert(roomTypeImages).values(data).returning();
    return image;
  },

  async delete(organizationId: string, id: string) {
    const [deleted] = await db
      .delete(roomTypeImages)
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.id, id),
        ),
      )
      .returning();
    return deleted ?? null;
  },

  async updateSortOrder(organizationId: string, id: string, sortOrder: number) {
    return db
      .update(roomTypeImages)
      .set({ sortOrder, updatedAt: new Date() })
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.id, id),
        ),
      );
  },

  async clearCover(organizationId: string, roomTypeId: string) {
    return db
      .update(roomTypeImages)
      .set({ isCover: false, updatedAt: new Date() })
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.roomTypeId, roomTypeId),
          eq(roomTypeImages.isCover, true),
        ),
      );
  },

  async setCover(organizationId: string, id: string) {
    return db
      .update(roomTypeImages)
      .set({ isCover: true, updatedAt: new Date() })
      .where(
        and(
          eq(roomTypeImages.organizationId, organizationId),
          eq(roomTypeImages.id, id),
        ),
      );
  },
};
