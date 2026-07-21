"use client";

import { DemoButton } from "@/components/demo-button";
import { Logo } from "@/components/logo";
import { SubscriptionCard } from "@/components/subscription-card";
import { bucketUpcomingRenewals } from "@/lib/renewal-calendar";
import { loadSubscriptions, META_KEY, saveSubscriptions } from "@/lib/storage";
import type { Subscription, UserStatus } from "@/lib/types";
import { formatMoney, totalByCurrency, unpricedByPeriod } from "@/lib/utils";
import { ArrowPathIcon, CheckBadgeIcon, ClockIcon, ExclamationCircleIcon, MagnifyingGlassIcon, SparklesIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Filter = "all" | "possibly_active" | "possibly_cancelled" | "needs_review";
type Category = "all" | "subscription" | "utility" | "one_off" | "other";

export function DashboardClient() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItems(loadSubscriptions());
      try { setIsDemo(Boolean(JSON.parse(localStorage.getItem(META_KEY) || "{}").demo)); } catch { /* ignored */ }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const confirm = (id: string, status: UserStatus) => {
    setItems((current) => {
      const updated = current.map((item) => item.id === id ? { ...item, userStatus: status } : item);
      saveSubscriptions(updated);
      return updated;
    });
  };

  const visible = useMemo(() => items.filter((item) =>
    (filter === "all" || item.possibleStatus === filter) &&
    (category === "all" || item.serviceCategory === category) &&
    `${item.provider} ${item.subscriptionName}`.toLowerCase().includes(search.toLowerCase())
  ), [category, filter, items, search]);

  // The headline figure is discretionary subscription spend. Utilities recur but
  // cancelling them isn't a saving decision, so counting them here would inflate
  // the number the user is being asked to act on.
  const countable = items.filter((item) => item.userStatus !== "not_mine" && item.userStatus !== "cancelled");
  const subscriptionItems = countable.filter((item) => item.serviceCategory === "subscription");
  const spend = totalByCurrency(subscriptionItems);
  const unpriced = unpricedByPeriod(subscriptionItems);
  const unconfirmedPredictions = subscriptionItems.filter((item) => item.userStatus === null || item.userStatus === "not_sure").length;
  const upcomingCount = bucketUpcomingRenewals(items).days.flatMap((day) => day.subscriptions).length;

  const metrics = {
    total: items.length,
    active: items.filter((item) => item.possibleStatus === "possibly_active").length,
    cancelled: items.filter((item) => item.possibleStatus === "possibly_cancelled").length,
    review: items.filter((item) => item.possibleStatus === "needs_review").length,
    utilities: items.filter((item) => item.serviceCategory === "utility").length,
  };
  const categories: Array<[Category, string, number]> = [
    ["all", "All types", items.length],
    ["subscription", "Subscriptions", items.filter((item) => item.serviceCategory === "subscription").length],
    ["utility", "Utilities & bills", metrics.utilities],
    ["one_off", "One-off", items.filter((item) => item.serviceCategory === "one_off").length],
    ["other", "Other", items.filter((item) => item.serviceCategory === "other").length],
  ];
  const confirmed = items.filter((item) => item.userStatus).length;

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#f7f5ee]"><p className="font-bold">Loading your dashboard…</p></main>;
  if (!items.length) return <main className="min-h-screen bg-[#f7f5ee]"><div className="mx-auto max-w-7xl px-5 py-6 sm:px-8"><Logo /></div><section className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#d8f36a]"><MagnifyingGlassIcon className="size-8" /></div><h1 className="display-font mt-6 text-5xl">No scan results yet</h1><p className="mt-4 leading-7 text-[#6d776f]">Connect Gmail for a live scan, or explore the complete fictional demo without credentials.</p><div className="mt-7 grid gap-3"><Link href="/connect" className="rounded-full bg-[#17231d] px-6 py-4 font-bold text-white">Connect Gmail</Link><DemoButton /></div></div></section></main>;

  const filters: Array<[Filter, string, number]> = [["all", "All", metrics.total], ["possibly_active", "Possibly active", metrics.active], ["possibly_cancelled", "Cancelled", metrics.cancelled], ["needs_review", "Needs review", metrics.review]];
  return (
    <main className="min-h-screen bg-[#f7f5ee]">
      <header className="border-b border-[#35543f]/10 bg-white/70 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Logo /><div className="flex gap-2"><Link href={isDemo ? "/scan?demo=1" : "/scan?auto=1"} className="flex items-center gap-2 rounded-full border border-[#35543f]/15 bg-white px-4 py-2 text-sm font-bold hover:border-[#35543f]/40"><ArrowPathIcon className="size-4" /><span className="hidden sm:inline">Scan again</span></Link><Link href="/" className="rounded-full bg-[#17231d] px-4 py-2 text-sm font-bold text-white">Home</Link></div></div></header>
      {isDemo && <div className="border-b border-[#e1be46]/30 bg-[#fff4c7] px-5 py-2.5 text-center text-xs font-bold text-[#715817]">Fictional demo data — no real inbox or API was used.</div>}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#35543f]"><SparklesIcon className="size-4" /> Scan complete</div><h1 className="display-font mt-3 text-5xl sm:text-6xl">Your subscription picture</h1><p className="mt-3 max-w-2xl text-[#6d776f]">AI predictions are a starting point. Confirm each card to make the dashboard yours.</p><Link href="/dashboard/renewals" className="mt-4 inline-flex rounded-full bg-[#d8f36a] px-4 py-2 text-sm font-bold text-[#17231d]">{upcomingCount} charge{upcomingCount === 1 ? "" : "s"} in the next 14 days →</Link></div>
          <div className="min-w-64 rounded-2xl bg-[#35543f] p-5 text-white"><div className="flex justify-between text-xs font-bold"><span>Review progress</span><span>{confirmed}/{items.length}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d8f36a] transition-all" style={{ width: `${items.length ? confirmed / items.length * 100 : 0}%` }} /></div></div>
        </div>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { Icon: CheckBadgeIcon, label: "Billing records found", value: metrics.total, color: "bg-[#d8f36a]" },
            { Icon: ClockIcon, label: "Possibly active", value: metrics.active, color: "bg-[#dfeadf]" },
            { Icon: XCircleIcon, label: "Cancelled", value: metrics.cancelled, color: "bg-[#e7e7e2]" },
            { Icon: ExclamationCircleIcon, label: "Needs review", value: metrics.review, color: "bg-[#ffe6b4]" },
          ].map(({ Icon, label, value, color }) => <div key={label} className="rounded-2xl border border-[#35543f]/10 bg-white p-5"><div className={`grid size-9 place-items-center rounded-xl ${color}`}><Icon className="size-5" /></div><p className="display-font mt-5 text-4xl">{value}</p><p className="mt-1 text-xs font-bold text-[#7d897f]">{label}</p></div>)}
          <div className="rounded-2xl bg-[#17231d] p-5 text-white"><p className="text-xs font-bold text-white/55">Estimated subscriptions / month</p><p className="display-font mt-6 text-4xl text-[#d8f36a]">{formatMoney(spend.total, spend.code)}</p><p className="mt-1 text-[11px] text-white/50">{[unconfirmedPredictions ? `Estimated — includes ${unconfirmedPredictions} unconfirmed prediction${unconfirmedPredictions === 1 ? "" : "s"}` : "Based on confirmed subscriptions", metrics.utilities ? `excludes ${metrics.utilities} utility ${metrics.utilities === 1 ? "bill" : "bills"}` : "known active-like amounts", unpriced ? `${unpriced} with unknown billing period` : null, spend.excluded ? `${spend.excluded} in other currencies` : null, spend.assumed ? "includes assumed currency" : null].filter(Boolean).join(" · ")}</p></div>
        </div>
        <div className="mt-9 flex flex-col gap-4 border-y border-[#35543f]/10 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1">{filters.map(([value, label, count]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-[#35543f] text-white" : "border border-[#35543f]/12 bg-white"}`}>{label} <span className="ml-1 opacity-60">{count}</span></button>)}</div>
            <div className="flex gap-2 overflow-x-auto pb-1">{categories.filter(([, , count], index) => index === 0 || count > 0).map(([value, label, count]) => <button key={value} onClick={() => setCategory(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${category === value ? "bg-[#d8f36a] text-[#17231d]" : "border border-[#35543f]/12 bg-white text-[#5d675f]"}`}>{label} <span className="ml-1 opacity-60">{count}</span></button>)}</div>
          </div>
          <label className="flex min-w-64 items-center gap-2 rounded-full border border-[#35543f]/12 bg-white px-4 py-2.5"><MagnifyingGlassIcon className="size-4 text-[#7d897f]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search providers" className="w-full bg-transparent text-sm outline-none" /></label>
        </div>
        {visible.length ? <div className="mt-7 grid gap-5 lg:grid-cols-2">{visible.map((item, index) => <SubscriptionCard key={item.id} item={item} index={index} onConfirm={confirm} />)}</div> : <div className="py-20 text-center"><p className="display-font text-3xl">No matching subscriptions</p><button onClick={() => { setFilter("all"); setSearch(""); }} className="mt-3 text-sm font-bold text-[#35543f] underline">Clear filters</button></div>}
      </section>
    </main>
  );
}
