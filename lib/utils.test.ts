import { describe, expect, it } from "vitest";
import { formatMoneyParts, monthlyEquivalent, totalByCurrency } from "@/lib/utils";
import { demoSubscriptions } from "@/lib/demo-data";
import type { Subscription } from "@/lib/types";

describe("monthlyEquivalent", () => {
  it("normalizes yearly costs", () => {
    const item = demoSubscriptions.find((entry) => entry.sourceEmailId === "demo-designcloud")!;
    expect(monthlyEquivalent(item)).toBe(20);
  });

  it("excludes predicted cancellations", () => {
    const item = demoSubscriptions.find((entry) => entry.sourceEmailId === "demo-cloudbox")!;
    expect(monthlyEquivalent(item)).toBe(0);
  });

  it("normalizes quarterly plans", () => {
    // Indian 90-day plans had no enum slot, fell to "unknown", and silently
    // contributed zero to the monthly total.
    const item = { ...demoSubscriptions[0], amount: 3894, billingFrequency: "quarterly" as const };
    expect(monthlyEquivalent(item)).toBe(1298);
  });
});

describe("formatMoneyParts", () => {
  it("treats an evidenced currency as fact", () => {
    const money = formatMoneyParts(299, "INR");
    expect(money.assumed).toBe(false);
    expect(money.code).toBe("INR");
  });

  it("marks an unevidenced currency as assumed rather than presenting it as fact", () => {
    // Regression: "Total Amount: 4723.00/-" carries no symbol and was rendered
    // as $4,723.00, overstating an Indian invoice by roughly 88x.
    const money = formatMoneyParts(4723, null);
    expect(money.assumed).toBe(true);
    expect(money.text.startsWith("≈")).toBe(true);
  });

  it("still reports unavailable amounts", () => {
    expect(formatMoneyParts(null, "INR").text).toBe("Amount unavailable");
  });
});

describe("totalByCurrency", () => {
  const make = (amount: number, currency: string | null): Subscription => ({
    ...demoSubscriptions[0], id: `t-${amount}-${currency}`, amount, currency,
    billingFrequency: "monthly", possibleStatus: "possibly_active",
  });

  it("never adds different currencies together", () => {
    const result = totalByCurrency([make(100, "INR"), make(200, "INR"), make(50, "USD")]);
    expect(result.code).toBe("INR");
    expect(result.total).toBe(300);
    expect(result.excluded).toBe(1);
  });
});
