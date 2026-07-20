import { DemoButton } from "@/components/demo-button";
import { GoogleButton } from "@/components/google-button";
import { SiteNav } from "@/components/site-nav";
import { CheckCircleIcon, EnvelopeIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/24/outline";

const trust = [
  [LockClosedIcon, "Read-only Gmail access", "We can read shortlisted messages—nothing else."],
  [EnvelopeIcon, "Your inbox stays untouched", "Emails are never deleted, edited, or labelled."],
  [CheckCircleIcon, "You make the final call", "Confirm every subscription the AI detects."],
] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <SiteNav />
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:pb-28 lg:pt-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#35543f]/15 bg-white/70 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#35543f]">
            <SparklesIcon className="size-4" /> Your inbox, decoded
          </div>
          <h1 className="display-font max-w-3xl text-[3.45rem] leading-[0.95] sm:text-7xl lg:text-[5.5rem]">
            Find forgotten <span className="relative inline-block italic text-[#35543f]">subscriptions<span className="absolute -bottom-2 left-0 h-3 w-full -rotate-1 rounded-full bg-[#d8f36a]/70 -z-10" /></span> hiding in your inbox.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#526158]">
            SubScam safely shortlists receipts, renewals and trials, then uses GPT-5.6 to turn inbox clutter into one calm, confirmable dashboard.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <GoogleButton />
            <DemoButton />
          </div>
          <p className="mt-4 text-xs text-[#6d776f]">Demo mode needs no account or API credentials.</p>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
          <div className="absolute -left-10 -top-8 size-32 rounded-full bg-[#d8f36a]/60 blur-2xl" />
          <div className="float card-shadow relative rotate-1 rounded-[2rem] border border-[#35543f]/15 bg-white p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-[#35543f]/10 pb-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7d897f]">Monthly snapshot</p><p className="display-font mt-1 text-3xl">Your subscriptions</p></div>
              <div className="grid size-12 place-items-center rounded-2xl bg-[#d8f36a]"><EnvelopeIcon className="size-6" /></div>
            </div>
            <div className="mt-5 space-y-3">
              {[["SP", "StreamPlus", "$15.99", "Renews Sep 12", "#17231d"], ["DC", "DesignCloud", "$23.00", "Needs review", "#ee765f"], ["CB", "CloudBox", "$8.99", "Possibly active", "#35543f"]].map(([initials, name, price, meta, color], index) => (
                <div key={name} className="flex items-center gap-3 rounded-2xl bg-[#f7f5ee] p-3.5" style={{ animationDelay: `${index * 120}ms` }}>
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl font-bold text-white" style={{ background: color }}>{initials}</div>
                  <div className="min-w-0 flex-1"><p className="font-bold">{name}</p><p className="text-xs text-[#7d897f]">{meta}</p></div>
                  <p className="font-bold">{price}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end justify-between rounded-2xl bg-[#35543f] p-5 text-white">
              <div><p className="text-xs text-white/65">Estimated monthly</p><p className="display-font mt-1 text-4xl">$47.98</p></div>
              <div className="rounded-full bg-[#d8f36a] px-3 py-1.5 text-xs font-bold text-[#17231d]">3 found</div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-3 -rotate-3 rounded-xl border border-[#35543f]/15 bg-[#fff4df] px-4 py-3 text-sm font-bold shadow-lg">Nothing changed without you ✓</div>
        </div>
      </section>

      <section className="border-y border-[#35543f]/10 bg-white/55">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-3">
          {trust.map(([Icon, title, copy]) => <div key={title} className="flex gap-4"><Icon className="size-6 shrink-0 text-[#35543f]" /><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-[#6d776f]">{copy}</p></div></div>)}
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-[#7d897f] sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© 2026 SubScam. Built for consumer clarity.</p><p>Read-only by design · User-confirmed by default</p></footer>
    </main>
  );
}
