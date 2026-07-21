import crypto from "node:crypto";
import { auth } from "@/auth";
import { classifyEmail } from "@/lib/classify";
import { deduplicateSubscriptions } from "@/lib/dedupe";
import { demoSubscriptions } from "@/lib/demo-data";
import { SCAN_WINDOW_MONTHS, scanWindowStart, shortlistGmailEmails } from "@/lib/gmail";
import { GMAIL_COOKIE, LEGACY_GMAIL_COOKIE, refreshGmailToken, sealGmailToken, unsealGmailToken } from "@/lib/gmail-token";
import type { CandidateEmail, Classification } from "@/lib/types";
import { buildSubscriptionId } from "@/lib/utils";
import { groupCandidatesByVendor } from "@/lib/vendor";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Classify at most this many emails at once. Firing every shortlisted email in
// parallel bursts straight past a fresh key's per-minute limit, which returns
// 429 for the whole batch and surfaces as "no valid structured results".
const CLASSIFY_CONCURRENCY = 5;
// One retry (two attempts total) for transient upstream failures.
const CLASSIFY_ATTEMPTS = 2;

type OpenAIErrorShape = { status?: number; code?: string; message?: string };

function errShape(error: unknown): OpenAIErrorShape {
  const e = (error ?? {}) as OpenAIErrorShape;
  return { status: e.status, code: e.code, message: error instanceof Error ? error.message : String(error) };
}

// Retry only failures that a retry can actually help: rate limits (but not an
// empty balance) and upstream 5xx. Auth/quota/model errors fail fast.
async function classifyWithRetry(candidate: CandidateEmail, safetyIdentifier: string): Promise<Classification> {
  let lastError: unknown;
  for (let attempt = 0; attempt < CLASSIFY_ATTEMPTS; attempt++) {
    try {
      return await classifyEmail(candidate, safetyIdentifier);
    } catch (error) {
      lastError = error;
      const { status, code } = errShape(error);
      const retryable = (status === 429 && code !== "insufficient_quota") || (typeof status === "number" && status >= 500);
      if (!retryable || attempt === CLASSIFY_ATTEMPTS - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt + Math.floor(Math.random() * 250)));
    }
  }
  throw lastError;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;
  async function worker() {
    for (let index = cursor++; index < items.length; index = cursor++) {
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Turn the collected classify failures into an accurate, actionable response
// instead of always blaming the model.
function describeScanFailure(reasons: unknown[]): { status: number; code: string; error: string; log: Record<string, unknown> } {
  const first = (reasons.map(errShape).find((r) => typeof r.status === "number") ?? errShape(reasons[0]));
  const { status, code } = first;
  if (status === 401) return { status: 502, code: "OPENAI_AUTH", error: "OpenAI rejected the API key (401). Verify OPENAI_API_KEY is a current, valid key.", log: { status, code } };
  if (status === 429 && code === "insufficient_quota") return { status: 502, code: "OPENAI_QUOTA", error: "OpenAI has no remaining credit on this account. Add billing credit, then retry.", log: { status, code } };
  if (status === 429) return { status: 502, code: "OPENAI_RATE_LIMIT", error: "Hit OpenAI's rate limit. Wait a moment and retry.", log: { status, code } };
  if (status === 403) return { status: 502, code: "OPENAI_ACCESS", error: "OpenAI denied access to gpt-5.6 (403) for this key.", log: { status, code } };
  if (typeof status === "number" && status >= 500) return { status: 502, code: "OPENAI_UPSTREAM", error: "OpenAI returned a server error. Retry shortly.", log: { status, code } };
  return { status: 502, code: "INVALID_GPT_RESPONSE", error: "gpt-5.6 returned no valid structured results. Please retry.", log: { status, code } };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { demo?: boolean };
  if (body.demo) {
    return NextResponse.json({
      subscriptions: deduplicateSubscriptions(demoSubscriptions),
      shortlisted: demoSubscriptions.length,
      invalidResponses: 0,
      demo: true,
      coverage: {
        windowMonths: SCAN_WINDOW_MONTHS,
        windowStart: scanWindowStart(new Date()).toISOString().slice(0, 10),
        matchedEstimate: demoSubscriptions.length,
        inspectedMessages: demoSubscriptions.length,
        distinctSenders: demoSubscriptions.length,
        bodiesFetched: demoSubscriptions.length,
        truncated: false,
        truncationReason: "none" as const,
      },
    });
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in before scanning Gmail.", code: "SIGN_IN_REQUIRED" }, { status: 401 });
  const cookieStore = await cookies();
  const sealed = cookieStore.get(GMAIL_COOKIE)?.value ?? cookieStore.get(LEGACY_GMAIL_COOKIE)?.value;
  if (!sealed) return NextResponse.json({ error: "Connect Gmail before scanning.", code: "GMAIL_NOT_CONNECTED" }, { status: 403 });

  try {
    const token = await refreshGmailToken(unsealGmailToken(sealed));
    cookieStore.set(GMAIL_COOKIE, sealGmailToken(token), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });

    const { candidates, coverage } = await shortlistGmailEmails(token.accessToken);
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI is not configured. Add OPENAI_API_KEY or use demo mode.", code: "OPENAI_NOT_CONFIGURED" }, { status: 503 });

    const vendorGroups = groupCandidatesByVendor(candidates);
    const safetyIdentifier = crypto.createHash("sha256").update(session.user.email || session.user.name || "clearsubscription-user").digest("hex");
    const settled = await mapWithConcurrency(vendorGroups, CLASSIFY_CONCURRENCY, ({ candidate }) => classifyWithRetry(candidate, safetyIdentifier));
    let invalidResponses = 0;
    const failureReasons: unknown[] = [];
    const subscriptions = settled.flatMap((result, index) => {
      if (result.status === "rejected") {
        invalidResponses += 1;
        failureReasons.push(result.reason);
        // Log the real reason each classify failed — previously discarded, which
        // is why the upstream OpenAI error never reached the function logs.
        console.error("[scan] classifyEmail failed", { vendor: vendorGroups[index]?.key, ...errShape(result.reason) });
        return [];
      }
      const classification = result.value;
      if (!classification.isSubscriptionEmail) return [];
      const group = vendorGroups[index];
      const email = group.candidate;
      return [{ ...classification, id: buildSubscriptionId(group.key, group.key), sourceEmailId: email.id, subject: email.subject, sender: email.sender, receivedDate: email.receivedDate, userStatus: null, duplicateCount: group.sourceEmails.length, isDemo: false }];
    });
    if (vendorGroups.length > 0 && invalidResponses === vendorGroups.length) {
      const failure = describeScanFailure(failureReasons);
      console.error("[scan] every classification failed", { attempted: vendorGroups.length, ...failure.log });
      return NextResponse.json({ error: failure.error, code: failure.code }, { status: failure.status });
    }

    return NextResponse.json({
      subscriptions,
      shortlisted: vendorGroups.length,
      invalidResponses,
      demo: false,
      coverage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    if (message.includes("GMAIL_PERMISSION_DENIED") || message.includes("Gmail access expired")) return NextResponse.json({ error: "Gmail permission was denied or expired. Reconnect Gmail and try again.", code: "GMAIL_PERMISSION_DENIED" }, { status: 403 });
    return NextResponse.json({ error: "We could not complete the scan. Please try again.", code: "SCAN_FAILED" }, { status: 500 });
  }
}
