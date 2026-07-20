import { describe, expect, it } from "vitest";
import { isLikelySubscription } from "@/lib/gmail";

describe("isLikelySubscription", () => {
  it("keeps billing evidence", () => {
    expect(isLikelySubscription({ subject: "Your renewal receipt", sender: "billing@example.com", receivedDate: "2026-01-01", snippet: "Payment of $12 received" })).toBe(true);
  });

  it("rejects promotional newsletters", () => {
    expect(isLikelySubscription({ subject: "Summer sale ends today", sender: "news@example.com", receivedDate: "2026-01-01", snippet: "Shop now. Unsubscribe from marketing." })).toBe(false);
  });
});
