import type { Subscription } from "@/lib/types";

export type RenewalDay = { date: string; label: string; subscriptions: Subscription[] };

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Parse a date-only renewal as a local calendar date, never UTC midnight. */
export function parseRenewalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function bucketUpcomingRenewals(subscriptions: Subscription[], today = new Date()) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = addLocalDays(today, index + 1);
    return {
      date: dateKey(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date),
      subscriptions: [] as Subscription[],
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  const active = subscriptions.filter((item) => item.userStatus === "active");
  const undatedConfirmed = active.filter((item) => !item.renewalDate).length;
  const awaitingConfirmation = subscriptions.filter((item) => item.userStatus === null || item.userStatus === "not_sure").length;
  const lastDate = days[days.length - 1].date;
  let nextBeyondWindow: Subscription | null = null;

  for (const item of active) {
    if (!item.renewalDate) continue;
    const day = byDate.get(item.renewalDate);
    if (day) day.subscriptions.push(item);
    else if (item.renewalDate > lastDate && (!nextBeyondWindow || item.renewalDate < nextBeyondWindow.renewalDate!)) nextBeyondWindow = item;
  }

  return { days, undatedConfirmed, awaitingConfirmation, nextBeyondWindow };
}
