"use client";

import type { Subscription, UserStatus } from "@/lib/types";
import { cn, formatMoney, labelize } from "@/lib/utils";
import { CalendarDaysIcon, ChevronRightIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

const confirmations: Array<{ value: UserStatus; label: string }> = [
  { value: "active", label: "Active" }, { value: "cancelled", label: "Cancelled" },
  { value: "not_mine", label: "Not Mine" }, { value: "not_sure", label: "Not Sure" },
];

const accents = ["#35543f", "#25465c", "#784b77", "#8a553b", "#43586f"];

export function SubscriptionCard({ item, index, onConfirm }: { item: Subscription; index: number; onConfirm: (id: string, status: UserStatus) => void }) {
  const initials = item.provider.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const statusColor = item.possibleStatus === "possibly_active" ? "bg-[#e3eddf] text-[#35543f]" : item.possibleStatus === "possibly_cancelled" ? "bg-[#e8e8e4] text-[#5f665f]" : "bg-[#fff0d5] text-[#815d1e]";
  return (
    <article className="fade-up overflow-hidden rounded-[1.5rem] border border-[#35543f]/12 bg-white card-shadow" style={{ animationDelay: `${index * 55}ms` }}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl font-bold text-white" style={{ backgroundColor: accents[index % accents.length] }}>{initials}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-[#7d897f]">{item.provider}</p><h2 className="mt-1 truncate text-xl font-bold tracking-tight">{item.subscriptionName}</h2></div>
          <Link href={`/subscription/${encodeURIComponent(item.id)}`} aria-label={`View ${item.provider} details`} className="grid size-9 shrink-0 place-items-center rounded-full border border-[#35543f]/12 hover:bg-[#f7f5ee]"><ChevronRightIcon className="size-4" /></Link>
        </div>
        <div className="mt-5 flex items-end justify-between gap-4 border-y border-[#35543f]/10 py-4">
          <div><p className="display-font text-3xl">{formatMoney(item.amount, item.currency)}</p><p className="mt-1 text-xs font-semibold text-[#7d897f]">{labelize(item.billingFrequency)} billing</p></div>
          <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", statusColor)}>{labelize(item.possibleStatus)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-[#626f66]"><EnvelopeIcon className="size-4 shrink-0" /><span className="truncate">{labelize(item.emailType)}</span></div>
          <div className="flex items-center justify-end gap-2 text-right text-[#626f66]"><CalendarDaysIcon className="size-4 shrink-0" /><span>{item.renewalDate || item.trialEndDate || "Date unavailable"}</span></div>
        </div>
        <blockquote className="mt-4 line-clamp-2 rounded-xl bg-[#f7f5ee] p-3.5 text-sm italic leading-6 text-[#5d675f]">“{item.evidenceSnippet}”</blockquote>
        <div className="mt-4 flex items-center justify-between"><span className="text-xs font-bold text-[#7d897f]">AI confidence</span><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e7e8e3]"><div className="h-full rounded-full bg-[#35543f]" style={{ width: `${item.confidence * 100}%` }} /></div><span className="text-xs font-bold">{Math.round(item.confidence * 100)}%</span></div></div>
        {item.duplicateCount > 1 && <p className="mt-3 text-xs font-semibold text-[#35543f]">Merged from {item.duplicateCount} matching emails</p>}
      </div>
      <div className="border-t border-[#35543f]/10 bg-[#faf9f5] p-4 sm:px-6">
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.11em] text-[#7d897f]">Your confirmation</p>{item.userStatus && <span className="text-xs font-bold text-[#35543f]">Saved ✓</span>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{confirmations.map(({ value, label }) => <button key={value} onClick={() => onConfirm(item.id, value)} className={cn("rounded-lg border px-2 py-2 text-xs font-bold transition", item.userStatus === value ? "border-[#35543f] bg-[#35543f] text-white" : "border-[#35543f]/15 bg-white hover:border-[#35543f]/50")}>{label}</button>)}</div>
      </div>
    </article>
  );
}
