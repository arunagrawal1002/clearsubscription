"use client";

import { Logo } from "@/components/logo";
import { loadSubscriptions, saveSubscriptions } from "@/lib/storage";
import type { Subscription, UserStatus } from "@/lib/types";
import { formatMoney, labelize } from "@/lib/utils";
import { ArrowLeftIcon, CalendarDaysIcon, EnvelopeIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const statuses: Array<[UserStatus, string]> = [["active", "Active"], ["cancelled", "Cancelled"], ["not_mine", "Not Mine"], ["not_sure", "Not Sure"]];

export function SubscriptionDetail() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<Subscription | null | undefined>(undefined);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setItem(loadSubscriptions().find((entry) => entry.id === decodeURIComponent(params.id))));
    return () => window.cancelAnimationFrame(frame);
  }, [params.id]);
  const confirm = (status: UserStatus) => {
    const all = loadSubscriptions().map((entry) => entry.id === item?.id ? { ...entry, userStatus: status } : entry);
    saveSubscriptions(all); setItem((current) => current ? { ...current, userStatus: status } : current);
  };
  if (item === undefined) return <main className="grid min-h-screen place-items-center">Loading details…</main>;
  if (!item) return <main className="grid min-h-screen place-items-center px-5 text-center"><div><h1 className="display-font text-4xl">Subscription not found</h1><Link href="/dashboard" className="mt-5 inline-block font-bold underline">Return to dashboard</Link></div></main>;
  const fields = [["Provider", item.provider], ["Subscription", item.subscriptionName], ["Amount", formatMoney(item.amount, item.currency)], ["Currency", item.currency || "Unavailable"], ["Billing frequency", labelize(item.billingFrequency)], ["Payment date", item.paymentDate || "Unavailable"], ["Renewal date", item.renewalDate || "Unavailable"], ["Trial end date", item.trialEndDate || "Unavailable"], ["Email type", labelize(item.emailType)], ["Received", new Date(item.receivedDate).toLocaleString()]];
  return (
    <main className="min-h-screen bg-[#f7f5ee]">
      <header className="border-b border-[#35543f]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><Logo /><Link href="/dashboard" className="flex items-center gap-2 rounded-full border border-[#35543f]/15 px-4 py-2 text-sm font-bold"><ArrowLeftIcon className="size-4" /> Dashboard</Link></div></header>
      {item.isDemo && <div className="border-b border-[#e1be46]/30 bg-[#fff4c7] px-5 py-2.5 text-center text-xs font-bold text-[#715817]">Fictional demo email and extraction</div>}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="grid gap-7 lg:grid-cols-[1.05fr_.95fr]">
          <div><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-[#35543f]"><ArrowLeftIcon className="size-4" /> Back to all subscriptions</Link><p className="mt-10 text-xs font-bold uppercase tracking-[0.15em] text-[#7d897f]">{item.provider}</p><h1 className="display-font mt-2 text-5xl sm:text-6xl">{item.subscriptionName}</h1><div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full bg-[#e3eddf] px-3 py-2 text-xs font-bold text-[#35543f]">AI: {labelize(item.possibleStatus)}</span><span className="rounded-full bg-white px-3 py-2 text-xs font-bold">Confidence {Math.round(item.confidence * 100)}%</span>{item.userStatus && <span className="rounded-full bg-[#35543f] px-3 py-2 text-xs font-bold text-white">You: {labelize(item.userStatus)}</span>}</div>
            <div className="mt-9 overflow-hidden rounded-2xl border border-[#35543f]/12 bg-white"><div className="grid sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="border-b border-[#35543f]/10 p-4 last:border-0 sm:odd:border-r"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a938c]">{label}</p><p className="mt-1.5 font-semibold">{value}</p></div>)}</div></div>
          </div>
          <div className="space-y-5">
            <div className="rounded-[1.5rem] bg-[#35543f] p-6 text-white sm:p-8"><div className="flex items-center gap-3"><EnvelopeIcon className="size-6 text-[#d8f36a]" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">Source email</p><p className="mt-1 font-bold">{item.subject}</p></div></div><p className="mt-6 text-sm text-white/55">From {item.sender}</p><blockquote className="mt-4 rounded-xl bg-white/10 p-5 text-sm italic leading-7 text-white/85">“{item.evidenceSnippet}”</blockquote><div className="mt-5 flex items-center gap-2 text-xs text-white/50"><ShieldCheckIcon className="size-4" /> Read-only source; never modified</div></div>
            <div className="rounded-[1.5rem] border border-[#35543f]/12 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7d897f]">Confirm this subscription</p><p className="mt-2 text-sm leading-6 text-[#6d776f]">Your answer stays separate from the AI prediction.</p><div className="mt-5 grid grid-cols-2 gap-2">{statuses.map(([value, label]) => <button key={value} onClick={() => confirm(value)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${item.userStatus === value ? "border-[#35543f] bg-[#35543f] text-white" : "border-[#35543f]/15 hover:border-[#35543f]"}`}>{label}</button>)}</div></div>
            <div className="flex gap-3 rounded-2xl bg-[#fff4df] p-5 text-sm leading-6 text-[#6b552e]"><CalendarDaysIcon className="size-5 shrink-0" /><p>Dates and costs only appear when the source email supports them. Missing details remain unavailable.</p></div>
          </div>
        </div>
      </section>
    </main>
  );
}
