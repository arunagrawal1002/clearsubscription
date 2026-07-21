import type { Subscription } from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Region subtag -> ISO currency. Used only when an email evidences an amount
 * but no currency. We never silently assume USD: an unmarked "4723.00/-" in an
 * Indian inbox is not $4,723.
 */
const REGION_CURRENCY: Record<string, string> = {
  IN: "INR", US: "USD", GB: "GBP", AU: "AUD", CA: "CAD", NZ: "NZD", SG: "SGD",
  AE: "AED", SA: "SAR", QA: "QAR", JP: "JPY", CN: "CNY", HK: "HKD", TW: "TWD",
  KR: "KRW", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK",
  HU: "HUF", RO: "RON", ZA: "ZAR", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP",
  CO: "COP", RU: "RUB", UA: "UAH", TR: "TRY", ID: "IDR", MY: "MYR", TH: "THB",
  PH: "PHP", VN: "VND", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", NG: "NGN",
  KE: "KES", GH: "GHS", EG: "EGP", MA: "MAD", IL: "ILS",
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR", DE: "EUR",
  GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR",
  NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR",
};

/** The viewer's locale tag, or null during server rendering. */
export function viewerLocale(): string | null {
  if (typeof navigator === "undefined" || !navigator.language) return null;
  return navigator.language;
}

/** Currency implied by the viewer's locale, or null if we can't tell. */
export function viewerCurrency(): string | null {
  const locale = viewerLocale();
  if (!locale) return null;
  const region = locale.split("-")[1]?.toUpperCase();
  return (region && REGION_CURRENCY[region]) || null;
}

export type MoneyParts = {
  /** Display string, prefixed with "≈" when the currency was assumed. */
  text: string;
  /** True when no currency was evidenced and the viewer's locale was used. */
  assumed: boolean;
  /** Resolved ISO code, or null when the amount is shown bare. */
  code: string | null;
};

/**
 * Formats an amount. When the email evidenced no currency we fall back to the
 * viewer's locale currency and mark the result as assumed, so the interface can
 * say so rather than quietly presenting a guess as a fact.
 */
export function formatMoneyParts(amount: number | null, currency: string | null): MoneyParts {
  if (amount === null) return { text: "Amount unavailable", assumed: false, code: null };

  const locale = viewerLocale() ?? "en-US";
  const evidenced = currency?.trim().toUpperCase() || null;
  const code = evidenced ?? viewerCurrency();
  const assumed = !evidenced && code !== null;

  if (!code) {
    // No evidence and no locale hint: show the bare number rather than invent a symbol.
    return {
      text: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
      assumed: false,
      code: null,
    };
  }

  try {
    const text = new Intl.NumberFormat(locale, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount);
    return { text: assumed ? `≈${text}` : text, assumed, code };
  } catch {
    return { text: `${code} ${amount.toFixed(2)}`, assumed, code };
  }
}

/** Convenience wrapper for call sites that only need the string. */
export function formatMoney(amount: number | null, currency: string | null) {
  return formatMoneyParts(amount, currency).text;
}

export function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function monthlyEquivalent(subscription: Subscription) {
  if (subscription.amount === null || subscription.possibleStatus === "possibly_cancelled") return 0;
  if (subscription.billingFrequency === "yearly") return subscription.amount / 12;
  if (subscription.billingFrequency === "quarterly") return subscription.amount / 3;
  if (subscription.billingFrequency === "weekly") return (subscription.amount * 52) / 12;
  if (subscription.billingFrequency === "monthly") return subscription.amount;
  return 0;
}

/**
 * Records with a known amount but an unknown billing period. They contribute
 * nothing to the monthly figure, so the interface has to say they exist rather
 * than let the total quietly under-report.
 */
export function unpricedByPeriod(items: Subscription[]) {
  return items.filter(
    (item) => item.amount !== null && item.billingFrequency === "unknown" && item.possibleStatus !== "possibly_cancelled",
  ).length;
}

/**
 * Totals are only meaningful within a single currency. We total the most common
 * currency present and report how many records were left out, rather than adding
 * rupees to dollars and labelling the result with whichever appeared first.
 */
export function totalByCurrency(items: Subscription[]) {
  const fallback = viewerCurrency();
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.amount === null) continue;
    const code = item.currency?.trim().toUpperCase() || fallback;
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  let code: string | null = null;
  let best = 0;
  for (const [candidate, count] of counts) {
    if (count > best) {
      code = candidate;
      best = count;
    }
  }

  let total = 0;
  let excluded = 0;
  let assumed = false;
  for (const item of items) {
    const contribution = monthlyEquivalent(item);
    if (contribution === 0) continue;
    const evidenced = item.currency?.trim().toUpperCase() || null;
    const itemCode = evidenced ?? fallback;
    if (itemCode === code) {
      total += contribution;
      if (!evidenced) assumed = true;
    } else {
      excluded += 1;
    }
  }

  return { code, total, excluded, assumed };
}

export function buildSubscriptionId(provider: string, name: string) {
  const base = `${provider}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return base || crypto.randomUUID();
}
