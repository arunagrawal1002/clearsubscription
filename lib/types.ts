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

export const billingFrequencySchema = z.enum(["monthly", "yearly", "weekly", "unknown"]);
export const predictedStatusSchema = z.enum(["possibly_active", "possibly_cancelled", "needs_review"]);
export const userStatusSchema = z.enum(["active", "cancelled", "not_mine", "not_sure"]);

export const classificationSchema = z.object({
  isSubscriptionEmail: z.boolean(),
  provider: z.string(),
  subscriptionName: z.string(),
  emailType: emailTypeSchema,
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  billingFrequency: billingFrequencySchema,
  paymentDate: z.string().nullable(),
  renewalDate: z.string().nullable(),
  trialEndDate: z.string().nullable(),
  possibleStatus: predictedStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceSnippet: z.string(),
});

export const subscriptionSchema = classificationSchema.extend({
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
