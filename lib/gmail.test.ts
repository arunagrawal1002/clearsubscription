import { describe, expect, it } from "vitest";
import {
  billingExcerpt,
  buildSearchQuery,
  decodeEntities,
  formatGmailDate,
  htmlToText,
  isLikelyBillingHeader,
  isLikelySubscription,
  scanWindowStart,
  selectPerSender,
  senderDomain,
  type MessageHeader,
} from "@/lib/gmail";

describe("body extraction", () => {
  it("decodes the rupee sign written as an HTML entity", () => {
    // Indian senders commonly emit &#8377; / &#x20B9;. Left encoded, the currency
    // looks unevidenced and the amount is unreadable.
    expect(decodeEntities("&#8377;3,894.00")).toBe("₹3,894.00");
    expect(decodeEntities("&#x20B9;499")).toBe("₹499");
  });

  it("drops style and script blocks instead of feeding them to the model", () => {
    const html = "<head><style>.a{color:red}</style></head><body>Premium &#8377;12,500 due</body>";
    const text = htmlToText(html);
    expect(text).toContain("₹12,500");
    expect(text).not.toContain("color:red");
  });

  it("keeps an amount that sits beyond the old 1200-character cutoff", () => {
    // Regression: insurers front-load boilerplate, so blind truncation sent the
    // model a letterhead and no figure, and it correctly returned null.
    const body = `${"Dear customer, thank you for banking with us. ".repeat(60)}Total premium payable: ₹18,450.00 for the policy year.`;
    expect(body.indexOf("18,450")).toBeGreaterThan(1200);
    expect(billingExcerpt(body)).toContain("18,450");
  });

  it("leaves short bodies untouched", () => {
    expect(billingExcerpt("MRP : 3894.00 Speed : 200 Mbps")).toBe("MRP : 3894.00 Speed : 200 Mbps");
  });
});

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
  it("prioritizes billing subjects over newer promotions", () => {
    const messages = [
      header({ id: "offer", subject: "Big summer offer", receivedAt: 5 }),
      header({ id: "update", subject: "Product update", receivedAt: 4 }),
      header({ id: "receipt", subject: "Your payment receipt", receivedAt: 3 }),
      header({ id: "tips", subject: "Weekly tips", receivedAt: 2 }),
      header({ id: "newsletter", subject: "Monthly newsletter", receivedAt: 1 }),
    ];

    expect(selectPerSender(messages).selected.map(({ id }) => id)).toContain("receipt");
  });

  it("collapses many emails from one vendor into the two newest when billing signals tie", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      header({ id: `n${i}`, senderDomain: "netflix.com", receivedAt: i }),
    );
    const { selected, distinctSenders } = selectPerSender(many);
    expect(distinctSenders).toBe(1);
    expect(selected).toHaveLength(2);
    expect(selected[0].id).toBe("n39"); // newest, for current pricing
    expect(selected[1].id).toBe("n38"); // deterministic recency tie-break
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
