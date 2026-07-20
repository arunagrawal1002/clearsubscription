"use client";

import { Logo } from "@/components/logo";
import { saveSubscriptions, META_KEY } from "@/lib/storage";
import { scanCoverageSchema, subscriptionSchema } from "@/lib/types";
import { CheckIcon, ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

const responseSchema = z.object({ subscriptions: z.array(subscriptionSchema), shortlisted: z.number(), invalidResponses: z.number(), demo: z.boolean(), coverage: scanCoverageSchema.optional() });
const stages = ["Finding likely subscription emails", "Removing promotional emails", "Analysing billing details", "Preparing dashboard"];

export function ScanExperience() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = params.get("demo") === "1";
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, 3)), 1250);
    async function scan() {
      try {
        const response = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ demo }), signal: controller.signal });
        const raw = await response.json();
        if (!response.ok) throw Object.assign(new Error(raw.error || "Scan failed"), { code: raw.code || "SCAN_FAILED" });
        const data = responseSchema.parse(raw);
        if (!alive || controller.signal.aborted) return;
        setStage(3);
        saveSubscriptions(data.subscriptions);
        localStorage.setItem(META_KEY, JSON.stringify({ demo: data.demo, shortlisted: data.shortlisted, invalidResponses: data.invalidResponses, coverage: data.coverage ?? null, scannedAt: new Date().toISOString() }));
        window.setTimeout(() => router.push("/dashboard"), 650);
      } catch (cause) {
        if (!alive || controller.signal.aborted) return;
        const value = cause as Error & { code?: string };
        setError({ message: value.message || "We could not complete the scan.", code: value.code || "SCAN_FAILED" });
      } finally { window.clearInterval(timer); }
    }
    const start = window.setTimeout(() => void scan(), 0);
    return () => { alive = false; controller.abort(); window.clearTimeout(start); window.clearInterval(timer); };
  }, [demo, router]);

  return (
    <main className="min-h-screen bg-[#35543f] px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl"><div className="[&_a]:text-white"><Logo /></div></div>
      <section className="mx-auto grid min-h-[78vh] max-w-4xl place-items-center py-12">
        <div className="w-full">
          {demo && <p className="mx-auto mb-5 w-fit rounded-full bg-[#d8f36a] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#17231d]">Fictional demo scan</p>}
          {!error ? (
            <>
              <div className="relative mx-auto h-56 max-w-sm overflow-hidden rounded-[2rem] border border-white/15 bg-white/8 p-6">
                <div className="scan-line absolute inset-x-5 top-5 h-0.5 bg-[#d8f36a] shadow-[0_0_18px_4px_rgba(216,243,106,.55)]" />
                <div className="space-y-3 pt-2">{["Receipt · StreamPlus", "Renewal · DesignCloud", "Trial · LearnNow"].map((item, i) => <div key={item} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 text-sm text-white/75"><div className="grid size-8 place-items-center rounded-lg bg-white/10"><MagnifyingGlassIcon className="size-4" /></div><span className="h-2 flex-1 rounded-full bg-white/15"><span className="block h-full rounded-full bg-[#d8f36a]/50" style={{ width: `${85 - i * 18}%` }} /></span></div>)}</div>
              </div>
              <div className="mx-auto mt-10 max-w-xl text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8f36a]">Step 3 of 4</p><h1 className="display-font mt-3 text-5xl">Untangling your inbox</h1><p className="mt-4 text-white/60">Only shortlisted email fields are analysed. This can take a moment.</p></div>
              <div className="mx-auto mt-9 grid max-w-2xl gap-2 sm:grid-cols-2">{stages.map((item, index) => <div key={item} className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm transition ${index <= stage ? "border-[#d8f36a]/30 bg-[#d8f36a]/10 text-white" : "border-white/10 text-white/35"}`}><span className={`grid size-6 place-items-center rounded-full ${index < stage || stage === 3 ? "bg-[#d8f36a] text-[#17231d]" : index === stage ? "border-2 border-[#d8f36a]" : "border border-white/20"}`}>{index < stage || stage === 3 ? <CheckIcon className="size-4" /> : index + 1}</span>{item}</div>)}</div>
            </>
          ) : (
            <div className="mx-auto max-w-lg rounded-[2rem] bg-white p-8 text-center text-[#17231d] card-shadow sm:p-10">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0ec] text-[#ee765f]"><ExclamationTriangleIcon className="size-7" /></div>
              <h1 className="display-font mt-6 text-4xl">Scan interrupted</h1><p role="alert" className="mt-4 leading-7 text-[#6d776f]">{error.message}</p>
              <div className="mt-7 grid gap-3"><button onClick={() => window.location.reload()} className="rounded-full bg-[#17231d] px-5 py-3.5 font-bold text-white">Try again</button>{(error.code.includes("GMAIL") || error.code === "SIGN_IN_REQUIRED") && <Link href="/connect" className="rounded-full border border-[#35543f]/20 px-5 py-3.5 font-bold">Reconnect Gmail</Link>}<Link href="/scan?demo=1" className="text-sm font-bold text-[#35543f] underline underline-offset-4">Use fictional demo instead</Link></div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
