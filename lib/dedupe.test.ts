import { describe, expect, it } from "vitest";
import { deduplicateSubscriptions, registrableDomain } from "@/lib/dedupe";
import { demoSubscriptions } from "@/lib/demo-data";

describe("deduplicateSubscriptions", () => {
  it("merges subscriptions with normalized provider and plan names", () => {
    const result = deduplicateSubscriptions(demoSubscriptions);
    expect(result).toHaveLength(5);
    const designCloud = result.find((item) => item.provider === "DesignCloud Pro");
    expect(designCloud?.duplicateCount).toBe(2);
    expect(designCloud?.sourceEmailId).toBe("demo-designcloud");
  });
});

describe("registrableDomain", () => {
  it("collapses vendor subdomains to one identity", () => {
    expect(registrableDomain("Replit <noreply@mail.replit.com>")).toBe("replit.com");
    expect(registrableDomain("Replit <billing@notifications.replit.com>")).toBe("replit.com");
    expect(registrableDomain("Acme <no-reply@billing.acme.co.in>")).toBe("acme.co.in");
  });
});

describe("deduplicateSubscriptions — vendor identity", () => {
  const base = {
    isSubscriptionEmail: true, provider: "Replit", emailType: "payment_receipt" as const,
    serviceCategory: "subscription" as const, currency: "USD", billingFrequency: "monthly" as const,
    paymentDate: null, renewalDate: null, trialEndDate: null,
    possibleStatus: "possibly_active" as const, confidence: 0.9, evidenceSnippet: "receipt",
    subject: "s", userStatus: null, duplicateCount: 1, isDemo: false,
  };

  it("merges one vendor's records despite differing names and subdomains", () => {
    // Regression: this produced three separate Replit cards.
    const merged = deduplicateSubscriptions([
      { ...base, id: "a", sourceEmailId: "a", subscriptionName: "Replit", sender: "a@replit.com", receivedDate: "2026-07-01T00:00:00Z", amount: null },
      { ...base, id: "b", sourceEmailId: "b", subscriptionName: "Replit Core", sender: "b@mail.replit.com", receivedDate: "2026-06-01T00:00:00Z", amount: 25 },
      { ...base, id: "c", sourceEmailId: "c", subscriptionName: "Replit Subscription", sender: "c@notifications.replit.com", receivedDate: "2026-05-01T00:00:00Z", amount: 25 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].duplicateCount).toBe(3);
    // The newest record had no amount; an older sibling did.
    expect(merged[0].amount).toBe(25);
  });

  it("keeps distinct products from a shared billing domain apart", () => {
    const merged = deduplicateSubscriptions([
      { ...base, id: "y", sourceEmailId: "y", provider: "Google Play", subscriptionName: "YouTube Premium Family", sender: "x@google.com", receivedDate: "2026-07-01T00:00:00Z", amount: 299 },
      { ...base, id: "g", sourceEmailId: "g", provider: "Google Play", subscriptionName: "Google One 200GB", sender: "x@google.com", receivedDate: "2026-07-02T00:00:00Z", amount: 130 },
    ]);
    expect(merged).toHaveLength(2);
  });
});
