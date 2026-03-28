import { z } from 'zod';

export const airbnbReservationWebhookSchema = z.object({
  webhookKey: z.string(),
  token: z.string().optional(),
  channelId: z.number().or(z.string()),
  propertyId: z.string(),
  reservationId: z.string(),
  reservationstatus: z.string(),
});

export const airbnbNotificationWebhookSchema = z.object({
  webhookKey: z.string(),
  channelId: z.number().or(z.string()),
  propertyId: z.string().optional(),
  notificationType: z.number(),
  notificationSubtype: z.number(),
  notificationTypeId: z.string().or(z.number()),
});

export const airbnbAvailabilityCheckWebhookSchema = z.object({
  webhookKey: z.string(),
  channelId: z.number().or(z.string()),
  propertyId: z.string(),
  notificationType: z.literal(3),
  startDate: z.string(),
  nights: z.number(),
});

/**
 * Discriminate between the 3 Airbnb webhook payload types.
 * Priority: availability check (notificationType=3 + startDate) > reservation (has reservationId) > notification
 */
export function classifyAirbnbWebhook(body: Record<string, unknown>): 'availability_check' | 'reservation' | 'notification' {
  if (body.notificationType === 3 && typeof body.startDate === 'string') {
    return 'availability_check';
  }
  if (typeof body.reservationId === 'string') {
    return 'reservation';
  }
  return 'notification';
}

export type AirbnbReservationWebhook = z.infer<typeof airbnbReservationWebhookSchema>;
export type AirbnbNotificationWebhook = z.infer<typeof airbnbNotificationWebhookSchema>;
export type AirbnbAvailabilityCheckWebhook = z.infer<typeof airbnbAvailabilityCheckWebhookSchema>;
