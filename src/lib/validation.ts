import { z } from "zod";

export const alertInputSchema = z.object({
  name: z.string().min(2).max(120),
  originAddress: z.string().min(3).max(250),
  destinationAddress: z.string().min(3).max(250),
  enabled: z.boolean().optional(),
  maxDurationMinutes: z.coerce.number().int().positive().max(300).nullable().optional(),
  minDelayMinutes: z.coerce.number().int().nonnegative().max(180).nullable().optional(),
  severeWeatherRequired: z.boolean().optional(),
  incidentKeywordFilter: z.string().max(250).nullable().optional(),
  daysOfWeekCsv: z
    .string()
    .regex(/^[1-7](,[1-7])*$/)
    .optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  cooldownMinutes: z.coerce.number().int().min(1).max(720).optional(),
  minConsecutiveTriggers: z.coerce.number().int().min(1).max(10).optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsPhoneNumber: z.string().max(30).nullable().optional()
});

export const pushSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(20),
    auth: z.string().min(10)
  })
});

export const authSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(120)
});
