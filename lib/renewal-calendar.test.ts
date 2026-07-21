import { describe, expect, it } from "vitest";
import { bucketUpcomingRenewals, parseRenewalDate } from "@/lib/renewal-calendar";
import { demoSubscriptions } from "@/lib/demo-data";

const make = (overrides: Record<string, unknown>) => ({ ...demoSubscriptions[0], userStatus: "active" as const, ...overrides });

describe("bucketUpcomingRenewals", () => {
  const today = new Date(2026, 6, 21, 12);

  it("places matching renewals on their exact local calendar day", () => {
    const result = bucketUpcomingRenewals([
      make({ id: "one", renewalDate: "2026-07-24" }),
      make({ id: "two", renewalDate: "2026-07-24" }),
      make({ id: "later", renewalDate: "2026-08-10" }),
    ], today);

    expect(result.days.find((day) => day.date === "2026-07-24")?.subscriptions.map(({ id }) => id)).toEqual(["one", "two"]);
    expect(result.days.flatMap((day) => day.subscriptions).map(({ id }) => id)).not.toContain("later");
  });

  it("builds exactly fourteen injected-date days through the 14-day alert horizon", () => {
    const result = bucketUpcomingRenewals([], today);
    expect(result.days).toHaveLength(14);
    expect(result.days[0].date).toBe("2026-07-22");
    expect(result.days[13].date).toBe("2026-08-04");
  });

  it("does not shift a YYYY-MM-DD renewal when parsing in a different timezone", () => {
    const date = parseRenewalDate("2026-08-04");
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 8, 4]);
  });

  it("reports confirmed subscriptions without dates and records awaiting ratification", () => {
    const result = bucketUpcomingRenewals([
      make({ id: "undated", renewalDate: null }),
      make({ id: "waiting", userStatus: null, renewalDate: "2026-07-24" }),
    ], today);
    expect(result.undatedConfirmed).toBe(1);
    expect(result.awaitingConfirmation).toBe(1);
  });

  it("counts past or invalid confirmed dates instead of silently dropping them", () => {
    const result = bucketUpcomingRenewals([
      make({ id: "yesterday", renewalDate: "2026-07-20" }),
      make({ id: "today", renewalDate: "2026-07-21" }),
      make({ id: "invalid", renewalDate: "August 3, 2026" }),
    ], today);
    expect(result.pastOrInvalidConfirmed).toBe(3);
  });
});
