import crypto from "node:crypto";
import { auth } from "@/auth";
import { classifyEmail } from "@/lib/classify";
import { deduplicateSubscriptions } from "@/lib/dedupe";
import { demoSubscriptions } from "@/lib/demo-data";
import { SCAN_WINDOW_MONTHS, scanWindowStart, shortlistGmailEmails } from "@/lib/gmail";
import { GMAIL_COOKIE, LEGACY_GMAIL_COOKIE, refreshGmailToken, sealGmailToken, unsealGmailToken } from "@/lib/gmail-token";
import { buildSubscriptionId } from "@/lib/utils";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const maxDuration = 60;

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

    const safetyIdentifier = crypto.createHash("sha256").update(session.user.email || session.user.name || "clearsubscription-user").digest("hex");
    const settled = await Promise.allSettled(candidates.map((email) => classifyEmail(email, safetyIdentifier)));
    let invalidResponses = 0;
    const subscriptions = settled.flatMap((result, index) => {
      if (result.status === "rejected") { invalidResponses += 1; return []; }
      const classification = result.value;
      if (!classification.isSubscriptionEmail) return [];
      const email = candidates[index];
      return [{ ...classification, id: buildSubscriptionId(classification.provider, classification.subscriptionName), sourceEmailId: email.id, subject: email.subject, sender: email.sender, receivedDate: email.receivedDate, userStatus: null, duplicateCount: 1, isDemo: false }];
    });
    if (candidates.length > 0 && invalidResponses === candidates.length) return NextResponse.json({ error: "GPT-5.6 returned no valid structured results. Please retry.", code: "INVALID_GPT_RESPONSE" }, { status: 502 });

    return NextResponse.json({
      subscriptions: deduplicateSubscriptions(subscriptions),
      shortlisted: candidates.length,
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
