import { describe, expect, it } from "vitest";
import {
  buildSearchQuery,
  formatGmailDate,
  isLikelyBillingHeader,
  isLikelySubscription,
  scanWindowStart,
  selectPerSender,
  senderDomain,
  type MessageHeader,
} from "@/lib/gmail";

const header = (over: Partial<MessageHeader> = {}): MessageHeader => ({
  id: "1",
  subject: "Your receipt",
  sender: "Netflix <info@mailer.netflix.com>",
  senderDomain: "netflix.com",
  receivedDate: "2026-01-01",
  receivedAt: 1_700_000_000_000,
  ...over,
});

// --- existing behaviour, unchanged -----------------------------------------

describe("isLikelySubscription", () => {
  it("keeps billing evidence", () => {
    expect(isLikelySubscription({ subject: "Your renewal receipt", sender: "billing@example.com", receivedDate: "2026-01-01", snippet: "Payment of $12 received" })).toBe(true);
  });

  it("rejects promotional newsletters", () => {
    expect(isLikelySubscription({ subject: "Summer sale ends today", sender: "news@example.com", receivedDate: "2026-01-01", snippet: "Shop now. Unsubscribe from marketing." })).toBe(false);
  });
});

// --- new: the scan window replaces the 30-message cap -----------------------

describe("scan window", () => {
  it("looks back 25 months", () => {
    expect(formatGmailDate(scanWindowStart(new Date("2026-07-20T00:00:00Z")))).toBe("2024/06/20");
  });

  it("puts an after: clause in the query", () => {
    const query = buildSearchQuery(new Date("2026-07-20T00:00:00Z"));
    expect(query).toContain("after:2024/06/20");
    expect(query).toContain("subscription");
  });

  it("no longer caps results by count", () => {
    expect(buildSearchQuery()).not.toContain("maxResults");
  });

  it("does not exclude promotions at the Gmail level", () => {
    // Billing mail from smaller vendors often lands in the promotions tab.
    expect(buildSearchQuery()).not.toContain("category:promotions");
  });
});

describe("senderDomain", () => {
  it("extracts the domain", () => {
    expect(senderDomain("Netflix <info@netflix.com>")).toBe("netflix.com");
  });

  it("collapses billing subdomains", () => {
    expect(senderDomain("<no-reply@email.netflix.com>")).toBe("netflix.com");
    expect(senderDomain("<x@billing.coursera.org>")).toBe("coursera.org");
  });

  it("groups a vendor's subdomains together", () => {
    expect(senderDomain("a@email.netflix.com")).toBe(senderDomain("b@billing.netflix.com"));
  });

  it("degrades safely on a malformed header", () => {
    expect(senderDomain("no address here")).toBe("unknown");
  });
});

describe("isLikelyBillingHeader", () => {
  it("keeps a plain receipt", () => {
    expect(isLikelyBillingHeader(header())).toBe(true);
  });

  it("keeps a renewal notice", () => {
    expect(isLikelyBillingHeader(header({ subject: "Your plan renews on 3 August" }))).toBe(true);
  });

  it("drops social senders", () => {
    expect(isLikelyBillingHeader(header({ senderDomain: "linkedin.com" }))).toBe(false);
  });

  it("drops obvious promotions", () => {
    expect(isLikelyBillingHeader(header({ subject: "50% OFF this weekend" }))).toBe(false);
    expect(isLikelyBillingHeader(header({ subject: "Our weekly digest" }))).toBe(false);
  });
});

describe("selectPerSender", () => {
  it("collapses many emails from one vendor into two", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      header({ id: `n${i}`, senderDomain: "netflix.com", receivedAt: i }),
    );
    const { selected, distinctSenders } = selectPerSender(many);
    expect(distinctSenders).toBe(1);
    expect(selected).toHaveLength(2);
    expect(selected[0].id).toBe("n39"); // newest, for current pricing
    expect(selected[1].id).toBe("n0"); // oldest, to prove recurrence
  });

  it("does not duplicate a vendor with a single email", () => {
    expect(selectPerSender([header({ id: "solo" })]).selected).toHaveLength(1);
  });

  it("scales with vendors, not emails", () => {
    const headers: MessageHeader[] = [];
    for (let vendor = 0; vendor < 15; vendor++) {
      for (let i = 0; i < 60; i++) {
        headers.push(header({ id: `${vendor}-${i}`, senderDomain: `vendor${vendor}.com`, receivedAt: i }));
      }
    }
    expect(headers).toHaveLength(900);
    // 900 emails -> 30 body fetches and GPT calls, instead of 900.
    expect(selectPerSender(headers).selected).toHaveLength(30);
  });
});
