import { z } from 'zod';

const credentialsSchema = z.object({
  apiUser: z.string().min(1, 'API user is required'),
  apiPassword: z.string().min(1, 'API password is required'),
  ccPassword: z.string().optional(),
  hotelId: z.string().min(1, 'Hotel ID is required'),
  endpointUrl: z.string().url('Invalid endpoint URL'),
  accessType: z.enum(['api_call', 'webhook']).default('webhook'),
  zodomusWebhookUrl: z.string().optional(),
  zodomusWebhookKey: z.string().optional(),
  airbnbWebhookUrl: z.string().optional(),
  airbnbWebhookKey: z.string().optional(),
});

export const createIntegrationSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  provider: z.enum(['zodomus']),
  credentials: credentialsSchema,
});

export const updateIntegrationSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
  credentials: credentialsSchema.optional(),
});

export const toggleIntegrationSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
  isActive: z.boolean(),
});

export const roomTypeMappingSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
  mappings: z.array(
    z.object({
      roomTypeId: z.string().uuid('Invalid room type ID'),
      externalRoomTypeId: z.string().min(1, 'External room type ID is required'),
      externalRoomTypeName: z.string().min(1, 'External room type name is required'),
    }),
  ),
});

export const ratePlanMappingSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
  mappings: z.array(
    z.object({
      ratePlanId: z.string().uuid('Invalid rate plan ID'),
      externalRatePlanId: z.string().min(1, 'External rate plan ID is required'),
      externalRatePlanName: z.string().min(1, 'External rate plan name is required'),
      externalRoomTypeId: z.string().optional(),
    }),
  ),
});

export const triggerSyncSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
});

export const integrationLogsSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
  direction: z.enum(['inbound', 'outbound']).optional(),
  status: z.enum(['success', 'error']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const zodomusWebhookSchema = z.object({
  reservationId: z.string().min(1),
  roomTypeId: z.string().min(1),
  ratePlanId: z.string().min(1),
  guest: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().length(3),
  source: z.string().min(1),
  specialRequests: z.string().optional(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
export type ToggleIntegrationInput = z.infer<typeof toggleIntegrationSchema>;
export type RoomTypeMappingInput = z.infer<typeof roomTypeMappingSchema>;
export type RatePlanMappingInput = z.infer<typeof ratePlanMappingSchema>;
export type TriggerSyncInput = z.infer<typeof triggerSyncSchema>;
export type IntegrationLogsInput = z.infer<typeof integrationLogsSchema>;
export type ZodomusWebhookPayload = z.infer<typeof zodomusWebhookSchema>;
