import type { Subscription } from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) return "Amount unavailable";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || ""} ${amount.toFixed(2)}`.trim();
  }
}

export function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function monthlyEquivalent(subscription: Subscription) {
  if (subscription.amount === null || subscription.possibleStatus === "possibly_cancelled") return 0;
  if (subscription.billingFrequency === "yearly") return subscription.amount / 12;
  if (subscription.billingFrequency === "weekly") return (subscription.amount * 52) / 12;
  if (subscription.billingFrequency === "monthly") return subscription.amount;
  return 0;
}

export function buildSubscriptionId(provider: string, name: string) {
  const base = `${provider}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return base || crypto.randomUUID();
}
