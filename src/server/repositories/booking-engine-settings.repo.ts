import { db } from '@/server/db';
import { bookingEngineSettings } from '@/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const bookingEngineSettingsRepo = {
  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.bookingEngineSettings.findFirst({
      where: and(
        eq(bookingEngineSettings.organizationId, organizationId),
        eq(bookingEngineSettings.propertyId, propertyId),
      ),
    });
  },

  async upsert(
    organizationId: string,
    propertyId: string,
    data: Partial<{
      availabilityView: string;
      priceFormat: string;
      specificRoom: boolean;
      addonsDisplay: string;
      guestFilter: string;
      defaultAdults: number;
      showUnavailable: boolean;
      autoAssign: boolean;
      limitByType: boolean;
      showRestrictions: boolean;
      showRates: boolean;
      fieldPostalAddress: boolean;
      fieldNationality: boolean;
      fieldGender: boolean;
      fieldIdDocument: boolean;
      fieldCompany: boolean;
      fieldPhone: boolean;
      fieldArrivalTime: boolean;
      fieldTermsAndConditions: boolean;
      autoConfirmEmail: boolean;
      redirectConfirmation: boolean;
      redirectUrl: string;
      requireCvv: boolean;
      language: string;
      analyticsPlatform: string;
      gaTrackingId: string;
      gaDomain: string;
      googleAdsConversionId: string;
      googleAdsConversionLabel: string;
      facebookPixelId: string;
      brandDisplayName: string;
      brandPrimaryColor: string;
      brandLogoUrl: string;
      brandFaviconUrl: string;
      brandCoverImageUrl: string;
      brandHideChamelio: boolean;
      brandPrivacyUrl: string;
      brandTermsUrl: string;
      brandCookiesUrl: string;
      widgetType: string;
      widgetLanguage: string;
      widgetOpenNewWindow: boolean;
    }>,
  ) {
    const existing = await this.findByProperty(organizationId, propertyId);

    if (existing) {
      const [updated] = await db
        .update(bookingEngineSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(bookingEngineSettings.organizationId, organizationId),
            eq(bookingEngineSettings.propertyId, propertyId),
          ),
        )
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(bookingEngineSettings)
      .values({ organizationId, propertyId, ...data })
      .returning();
    return created!;
  },
};
