import type { Subscription } from "@/lib/types";

/** Suffixes where the registrable name is the third-from-last label. */
const TWO_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.in", "net.in", "org.in", "com.au",
  "net.au", "org.au", "co.nz", "co.za", "co.jp", "com.br", "com.mx", "com.sg",
  "com.cn", "com.hk", "com.tr",
]);

/**
 * Registrable domain (eTLD+1) from a From header. Vendors send from many
 * subdomains — replit.com, mail.replit.com, notifications.replit.com — and
 * treating those as separate vendors is what produced duplicate cards.
 */
export function registrableDomain(sender: string) {
  const match = sender.match(/[\w.+-]+@([\w.-]+)/);
  const host = (match?.[1] || sender).toLowerCase().replace(/^www\./, "").trim();
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Two records describe the same thing when they come from the same vendor and
 * one name contains the other — "Replit", "Replit Core" and "Replit
 * Subscription" are one subscription. Requiring containment rather than merging
 * everything from a domain keeps genuinely distinct products apart, so Google
 * Play can still carry both YouTube Premium and Google One.
 */
function sameSubscription(a: Subscription, b: Subscription) {
  if (registrableDomain(a.sender) !== registrableDomain(b.sender)) return false;
  const left = normalize(a.subscriptionName);
  const right = normalize(b.subscriptionName);
  if (!left || !right) return normalize(a.provider) === normalize(b.provider);
  return left === right || left.includes(right) || right.includes(left);
}

export function deduplicateSubscriptions(items: Subscription[]) {
  const groups: Subscription[][] = [];
  for (const item of items) {
    const group = groups.find((candidate) => candidate.some((member) => sameSubscription(member, item)));
    if (group) group.push(item);
    else groups.push([item]);
  }

  return groups.map((group) => {
    const sorted = [...group].sort(
      (a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime(),
    );
    // Keep the newest record, but take facts from whichever sibling actually has
    // them: a recent "your plan renewed" note shouldn't discard the amount an
    // older receipt stated plainly.
    const withAmount = sorted.find((entry) => entry.amount !== null);
    const withRenewal = sorted.find((entry) => entry.renewalDate !== null);
    const withPayment = sorted.find((entry) => entry.paymentDate !== null);
    const withFrequency = sorted.find((entry) => entry.billingFrequency !== "unknown");
    const richestName = [...group].sort((a, b) => b.subscriptionName.length - a.subscriptionName.length)[0];

    return {
      ...sorted[0],
      subscriptionName: richestName.subscriptionName,
      amount: sorted[0].amount ?? withAmount?.amount ?? null,
      currency: sorted[0].currency ?? withAmount?.currency ?? null,
      renewalDate: sorted[0].renewalDate ?? withRenewal?.renewalDate ?? null,
      paymentDate: sorted[0].paymentDate ?? withPayment?.paymentDate ?? null,
      billingFrequency: sorted[0].billingFrequency !== "unknown"
        ? sorted[0].billingFrequency
        : withFrequency?.billingFrequency ?? "unknown",
      duplicateCount: group.length,
    };
  });
}
