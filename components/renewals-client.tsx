"use client";

import { Logo } from "@/components/logo";
import { bucketUpcomingRenewals } from "@/lib/renewal-calendar";
import { loadSubscriptions, META_KEY } from "@/lib/storage";
import type { Subscription } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LoadedState = { items: Subscription[]; isDemo: boolean };

function readStoredState(): LoadedState {
  let isDemo = false;
  try {
    isDemo = Boolean(JSON.parse(localStorage.getItem(META_KEY) || "{}").demo);
  } catch {
    // A corrupt or absent meta entry just means "not demo mode".
  }
  return { items: loadSubscriptions(), isDemo };
}

export function RenewalsClient() {
  const [state, setState] = useState<LoadedState | null>(null);

  // localStorage is browser-only, so this cannot be read during SSR or in a lazy
  // useState initializer without breaking hydration. Reading an external store once
  // on mount is the case this rule cannot distinguish from a cascading-render bug.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setState(readStoredState()), []);

  const items = useMemo(() => state?.items ?? [], [state]);
  const calendar = useMemo(() => bucketUpcomingRenewals(items), [items]);
  const upcoming = calendar.days.flatMap((day) => day.subscriptions);

  const chip = (item: Subscription) => (
    <span
      key={item.id}
      className="block rounded-lg bg-[#e3eddf] px-2 py-1.5 text-xs font-bold text-[#35543f]"
    >
      {item.provider} &middot; {formatMoney(item.amount, item.currency)}
    </span>
  );

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f5ee]">
        <p className="font-bold">Loading renewals&hellip;</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ee]">
      <header className="border-b border-[#35543f]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Logo />
          <Link
            href="/dashboard"
            className="rounded-full border border-[#35543f]/15 px-4 py-2 text-sm font-bold"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#35543f]">
          14-day renewal horizon
        </p>
        <h1 className="display-font mt-3 text-5xl">What&rsquo;s coming up</h1>
        <p className="mt-3 max-w-2xl text-[#6d776f]">
          Based on the subscriptions you confirmed &mdash; we may not have found everything.
        </p>

        {state.isDemo && (
          <p className="mt-4 rounded-xl bg-[#fff4c7] p-3 text-sm font-semibold text-[#715817]">
            Fictional demo renewals. Alerts require sign-in.
          </p>
        )}

        {/* Desktop: every day renders, including empty ones. The gaps are the
            information — a cluster of charges on one day is invisible in a list. */}
        <div className="mt-8 hidden grid-cols-7 gap-3 sm:grid">
          {calendar.days.map((day) => (
            <div
              key={day.date}
              className="min-h-36 rounded-2xl border border-[#35543f]/10 bg-white p-3"
            >
              <p className="text-xs font-bold text-[#6d776f]">{day.label}</p>
              <div className="mt-3 space-y-2">{day.subscriptions.map(chip)}</div>
            </div>
          ))}
        </div>

        {/* Mobile: only days with renewals, so the user is not scrolling past
            eleven empty cards to reach the information. */}
        <div className="mt-8 space-y-3 sm:hidden">
          {calendar.days
            .filter((day) => day.subscriptions.length > 0)
            .map((day) => (
              <div
                key={day.date}
                className="rounded-2xl border border-[#35543f]/10 bg-white p-4"
              >
                <p className="text-sm font-bold">{day.label}</p>
                <div className="mt-3 space-y-2">{day.subscriptions.map(chip)}</div>
              </div>
            ))}
        </div>

        {!upcoming.length && (
          <div className="mt-6 rounded-2xl bg-white p-5">
            <p className="font-bold">No confirmed renewals fall in the next 14 days.</p>
            <p className="mt-1 text-sm text-[#6d776f]">
              {calendar.nextBeyondWindow
                ? `The next dated confirmed renewal is ${calendar.nextBeyondWindow.provider} on ${calendar.nextBeyondWindow.renewalDate}.`
                : "No later dated confirmed renewal is available."}
            </p>
          </div>
        )}

        <div className="mt-6 space-y-1 text-sm text-[#6d776f]">
          {calendar.undatedConfirmed > 0 && (
            <p>
              {calendar.undatedConfirmed} confirmed subscription
              {calendar.undatedConfirmed === 1 ? " has" : "s have"} no renewal date we
              could determine.
            </p>
          )}
          {calendar.pastOrInvalidConfirmed > 0 && (
            <p>
              {calendar.pastOrInvalidConfirmed} confirmed subscription
              {calendar.pastOrInvalidConfirmed === 1 ? " has" : "s have"} a renewal date
              that is today, in the past, or no longer usable.
            </p>
          )}
          {calendar.awaitingConfirmation > 0 && (
            <p>
              {calendar.awaitingConfirmation} subscription
              {calendar.awaitingConfirmation === 1 ? " is" : "s are"} awaiting your
              confirmation and not shown here.
            </p>
          )}
          <p>
            {upcoming.length} confirmed renewal{upcoming.length === 1 ? "" : "s"} in this
            14-day window.
          </p>
        </div>
      </section>
    </main>
  );
}
