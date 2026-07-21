import { describe, expect, it } from "vitest";
import { classificationSchema } from "@/lib/types";

describe("classificationSchema", () => {
  const valid = {
    isSubscriptionEmail: true, provider: "Example", subscriptionName: "Plan", emailType: "payment_receipt",
    serviceCategory: "subscription", amount: null, currency: null, billingFrequency: "unknown",
    paymentDate: null, renewalDate: null,
    trialEndDate: null, possibleStatus: "needs_review", confidence: 0.7, evidenceSnippet: "Your receipt",
  };

  it("accepts explicit nulls for unavailable facts", () => expect(classificationSchema.parse(valid).amount).toBeNull());
  it("rejects impossible confidence values", () => expect(() => classificationSchema.parse({ ...valid, confidence: 1.4 })).toThrow());
  it("rejects unsupported enum values", () => expect(() => classificationSchema.parse({ ...valid, billingFrequency: "fortnightly" })).toThrow());
  it("accepts quarterly, which Indian 90-day plans need", () => expect(classificationSchema.parse({ ...valid, billingFrequency: "quarterly" }).billingFrequency).toBe("quarterly"));
  it("requires a service category from the model", () => {
    const { serviceCategory: _omitted, ...withoutCategory } = valid;
    expect(() => classificationSchema.parse(withoutCategory)).toThrow();
  });
  it("rejects invented service categories", () => expect(() => classificationSchema.parse({ ...valid, serviceCategory: "telecom" })).toThrow());
});
