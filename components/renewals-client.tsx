"use client";

import { Logo } from "@/components/logo";
import { bucketUpcomingRenewals } from "@/lib/renewal-calendar";
import { loadSubscriptions, META_KEY } from "@/lib/storage";
import type { Subscription } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function RenewalsClient() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setItems(loadSubscriptions());
    try { setIsDemo(Boolean(JSON.parse(localStorage.getItem(META_KEY) || "{}").demo)); } catch { /* ignored */ }
    setReady(true);
  }, []);

  const calendar = useMemo(() => bucketUpcomingRenewals(items), [items]);
  const upcoming = calendar.days.flatMap((day) => day.subscriptions);
  const chip = (item: Subscription) => <span key={item.id} className="block rounded-lg bg-[#e3eddf] px-2 py-1.5 text-xs font-bold text-[#35543f]">{item.provider} · {formatMoney(item.amount, item.currency)}</span>;

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#f7f5ee]"><p className="font-bold">Loading renewals…</p></main>;
  return <main className="min-h-screen bg-[#f7f5ee]"><header className="border-b border-[#35543f]/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Logo /><Link href="/dashboard" className="rounded-full border border-[#35543f]/15 px-4 py-2 text-sm font-bold">Dashboard</Link></div></header><section className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#35543f]">14-day renewal horizon</p><h1 className="display-font mt-3 text-5xl">What’s coming up</h1><p className="mt-3 max-w-2xl text-[#6d776f]">Based on the subscriptions you confirmed — we may not have found everything.</p>{isDemo && <p className="mt-4 rounded-xl bg-[#fff4c7] p-3 text-sm font-semibold text-[#715817]">Fictional demo renewals. Alerts require sign-in.</p>}<div className="mt-8 hidden grid-cols-7 gap-3 sm:grid">{calendar.days.map((day) => <div key={day.date} className="min-h-36 rounded-2xl border border-[#35543f]/10 bg-white p-3"><p className="text-xs font-bold text-[#6d776f]">{day.label}</p><div className="mt-3 space-y-2">{day.subscriptions.map(chip)}</div></div>)}</div><div className="mt-8 space-y-3 sm:hidden">{calendar.days.map((day) => <div key={day.date} className="rounded-2xl border border-[#35543f]/10 bg-white p-4"><p className="text-sm font-bold">{day.label}</p><div className="mt-3 space-y-2">{day.subscriptions.length ? day.subscriptions.map(chip) : <p className="text-sm text-[#6d776f]">No confirmed renewals found.</p>}</div></div>)}</div>{!upcoming.length && <div className="mt-6 rounded-2xl bg-white p-5"><p className="font-bold">No confirmed renewals fall in the next 14 days.</p><p className="mt-1 text-sm text-[#6d776f]">{calendar.nextBeyondWindow ? `The next dated confirmed renewal is ${calendar.nextBeyondWindow.provider} on ${calendar.nextBeyondWindow.renewalDate}.` : "No later dated confirmed renewal is available."}</p></div>}<div className="mt-6 space-y-1 text-sm text-[#6d776f]">{calendar.undatedConfirmed > 0 && <p>{calendar.undatedConfirmed} confirmed subscription{calendar.undatedConfirmed === 1 ? " has" : "s have"} no renewal date we could determine.</p>}{calendar.awaitingConfirmation > 0 && <p>{calendar.awaitingConfirmation} subscription{calendar.awaitingConfirmation === 1 ? " is" : "s are"} awaiting your confirmation and not shown here.</p>}<p>{upcoming.length} confirmed renewal{upcoming.length === 1 ? "" : "s"} in this 14-day window.</p></div></section></main>;
}
