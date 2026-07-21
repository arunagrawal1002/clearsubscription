import { describe, expect, it } from "vitest";
import { groupCandidatesByVendor } from "@/lib/vendor";

const candidate = (overrides: Partial<{ id: string; subject: string; sender: string; receivedDate: string; snippet: string }> = {}) => ({
  id: "1",
  subject: "Your payment receipt",
  sender: "Vendor <billing@vendor.example>",
  receivedDate: "2026-07-01T00:00:00Z",
  snippet: "Payment received.",
  ...overrides,
});

describe("groupCandidatesByVendor", () => {
  it("makes duplicate cards for one vendor structurally impossible", () => {
    const groups = groupCandidatesByVendor([
      candidate({ id: "a", subject: "Replit payment receipt", sender: "Replit <billing@replit.com>" }),
      candidate({ id: "b", subject: "Your Replit Core renewal", sender: "Replit <receipts@mail.replit.com>" }),
      candidate({ id: "c", subject: "Replit subscription confirmation", sender: "Replit <noreply@notifications.replit.com>" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sourceEmails.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(groups[0].candidate.snippet).toContain("Replit Core renewal");
  });

  it("keeps clearly named products from a shared billing domain separate", () => {
    const groups = groupCandidatesByVendor([
      candidate({ id: "youtube", subject: "YouTube Premium payment receipt", sender: "Google <payments-noreply@google.com>" }),
      candidate({ id: "one", subject: "Google One storage plan renewed", sender: "Google <payments-noreply@google.com>" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map(({ candidate: email }) => email.id).sort()).toEqual(["one", "youtube"]);
  });
});
