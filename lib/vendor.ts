import type { CandidateEmail } from "@/lib/types";

/** Suffixes where the registrable name is the third-from-last label. */
const TWO_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.in", "net.in", "org.in", "com.au",
  "net.au", "org.au", "co.nz", "co.za", "co.jp", "com.br", "com.mx", "com.sg",
  "com.cn", "com.hk", "com.tr",
]);

/** Registrable domain (eTLD+1) from a From header. */
export function registrableDomain(sender: string) {
  const match = sender.match(/[\w.+-]+@([\w.-]+)/);
  const host = (match?.[1] || sender).toLowerCase().replace(/^www\./, "").trim();
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

export type VendorCandidateGroup = {
  key: string;
  vendorDomain: string;
  sourceEmails: CandidateEmail[];
  candidate: CandidateEmail;
};

const SUBJECT_NOISE = new Set([
  "your", "the", "a", "an", "payment", "receipt", "invoice", "billing", "bill", "renewal", "renewed",
  "subscription", "confirmation", "confirmed", "order", "charge", "charged", "paid", "plan", "monthly", "annual",
]);

function productSignature(subject: string) {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !SUBJECT_NOISE.has(word) && !/^\d+$/.test(word))
    .join(" ");
}

function sameProduct(left: string, right: string) {
  if (!left || !right) return left === right;
  return left === right || left.includes(right) || right.includes(left);
}

function combinedCandidate(emails: CandidateEmail[]) {
  const newest = [...emails].sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))[0];
  return {
    ...newest,
    snippet: emails.map((email) => `Subject: ${email.subject}\n${email.snippet}`).join("\n\n"),
  };
}

/**
 * Produces one model input per deterministic vendor-product identity. Domain
 * establishes the vendor; a normalized subject separates explicitly named
 * products sharing a billing sender (for example Google One and YouTube).
 */
export function groupCandidatesByVendor(candidates: CandidateEmail[]): VendorCandidateGroup[] {
  const groups: Array<VendorCandidateGroup & { product: string }> = [];
  for (const email of candidates) {
    const vendorDomain = registrableDomain(email.sender);
    const product = productSignature(email.subject);
    const existing = groups.find((group) => group.vendorDomain === vendorDomain && sameProduct(group.product, product));
    if (existing) {
      existing.sourceEmails.push(email);
      existing.candidate = combinedCandidate(existing.sourceEmails);
      continue;
    }
    groups.push({
      key: `${vendorDomain}:${product || "general"}`,
      vendorDomain,
      product,
      sourceEmails: [email],
      candidate: combinedCandidate([email]),
    });
  }
  return groups.map(({ product: _product, ...group }) => group);
}
