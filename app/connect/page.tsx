import { auth } from "@/auth";
import { DemoButton } from "@/components/demo-button";
import { SiteNav } from "@/components/site-nav";
import { ArrowRightIcon, CheckIcon, EnvelopeOpenIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";

const scanned = ["Subscription confirmations", "Renewal reminders", "Payment receipts", "Free-trial emails", "Price-increase notices", "Cancellation confirmations"];
const errors: Record<string, string> = {
  permission_denied: "Gmail permission was denied. Nothing was accessed—you can try again when ready.",
  invalid_oauth_state: "The secure Google connection expired. Please start it again.",
  token_exchange_failed: "Google could not complete the connection. Check your OAuth settings or try again.",
  google_not_configured: "Google OAuth is not configured on this deployment. Add the required environment variables or use the demo.",
};

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="min-h-screen paper-grid">
      <SiteNav />
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <div className="grid overflow-hidden rounded-[2rem] border border-[#35543f]/15 bg-white card-shadow lg:grid-cols-[.95fr_1.05fr]">
          <div className="bg-[#35543f] p-8 text-white sm:p-12">
            <div className="grid size-14 place-items-center rounded-2xl bg-[#d8f36a] text-[#17231d]"><EnvelopeOpenIcon className="size-7" /></div>
            <p className="mt-9 text-xs font-bold uppercase tracking-[0.18em] text-[#d8f36a]">Step 2 of 4</p>
            <h1 className="display-font mt-3 text-5xl leading-[1.02]">Connect Gmail, safely.</h1>
            <p className="mt-6 leading-7 text-white/70">SubScam uses a separate, read-only Google permission. It searches for likely billing messages first, so your complete inbox is never sent to AI.</p>
            <div className="mt-9 rounded-2xl border border-white/15 bg-white/7 p-5">
              <div className="flex gap-3"><ShieldCheckIcon className="size-6 shrink-0 text-[#d8f36a]" /><div><p className="font-bold">Strictly read-only</p><p className="mt-1 text-sm leading-6 text-white/65">No sending, deleting, editing, moving, or labelling. Disconnect anytime in your Google Account.</p></div></div>
            </div>
          </div>
          <div className="p-8 sm:p-12">
            <p className="text-sm font-bold text-[#35543f]">Signed in as {session.user.email}</p>
            <h2 className="display-font mt-3 text-4xl">What we’ll look for</h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {scanned.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl bg-[#f7f5ee] p-3.5 text-sm font-semibold"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#d8f36a]"><CheckIcon className="size-4" /></span>{item}</div>)}
            </div>
            {error && <div role="alert" className="mt-6 rounded-xl border border-[#ee765f]/30 bg-[#fff0ec] p-4 text-sm leading-6 text-[#8b3b2d]">{errors[error] || "Google could not be connected. Please try again."}</div>}
            <a href="/api/gmail/authorize" className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#17231d] px-6 py-4 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#35543f]">Connect Gmail and Scan <ArrowRightIcon className="size-4" /></a>
            <div className="mt-3"><DemoButton /></div>
            <p className="mt-5 text-center text-xs leading-5 text-[#7d897f]">By continuing, Google will show the exact permission requested before granting access.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
