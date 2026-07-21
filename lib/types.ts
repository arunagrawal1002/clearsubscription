import { z } from "zod";

export const emailTypeSchema = z.enum([
  "confirmation",
  "payment_receipt",
  "renewal_reminder",
  "trial_started",
  "trial_ending",
  "price_increase",
  "cancellation",
  "other",
]);

export const billingFrequencySchema = z.enum(["weekly", "monthly", "quarterly", "yearly", "unknown"]);
export const predictedStatusSchema = z.enum(["possibly_active", "possibly_cancelled", "needs_review"]);
export const userStatusSchema = z.enum(["active", "cancelled", "not_mine", "not_sure"]);

/**
 * What kind of spend this is. A recurring charge is not automatically a
 * subscription: broadband, mobile and electricity bills recur but are essential
 * services with no meaningful "cancel and save" decision attached.
 */
export const serviceCategorySchema = z.enum(["subscription", "utility", "one_off", "other"]);

const renewalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Expected a valid YYYY-MM-DD calendar date");

export const classificationSchema = z.object({
  isSubscriptionEmail: z.boolean(),
  provider: z.string(),
  subscriptionName: z.string(),
  emailType: emailTypeSchema,
  serviceCategory: serviceCategorySchema,
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  billingFrequency: billingFrequencySchema,
  paymentDate: z.string().nullable(),
  renewalDate: renewalDateSchema.nullable(),
  trialEndDate: z.string().nullable(),
  possibleStatus: predictedStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceSnippet: z.string(),
});

export const subscriptionSchema = classificationSchema.extend({
  // Defaulted here (but required of the model above) so results stored before
  // this field existed still parse instead of being silently dropped.
  serviceCategory: serviceCategorySchema.default("subscription"),
  // Preserve already-saved browser records while new model output is strict.
  renewalDate: z.string().nullable(),
  id: z.string(),
  sourceEmailId: z.string(),
  subject: z.string(),
  sender: z.string(),
  receivedDate: z.string(),
  userStatus: userStatusSchema.nullable().default(null),
  duplicateCount: z.number().int().min(1).default(1),
  isDemo: z.boolean().default(false),
});

export type Classification = z.infer<typeof classificationSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;

export type CandidateEmail = {
  id: string;
  subject: string;
  sender: string;
  receivedDate: string;
  snippet: string;
};

export const scanCoverageSchema = z.object({
  windowMonths: z.number(),
  windowStart: z.string(),
  matchedEstimate: z.number(),
  inspectedMessages: z.number(),
  distinctSenders: z.number(),
  bodiesFetched: z.number(),
  truncated: z.boolean(),
  truncationReason: z.enum(["none", "message_limit", "body_limit", "time_budget"]),
});

export type ScanCoverage = z.infer<typeof scanCoverageSchema>;
