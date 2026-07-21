import type { CandidateEmail } from "@/lib/types";

/**
 * Rolling scan window. Previously the query had no date filter at all and was
 * capped at the 30 most recent matches, so coverage was arbitrary.
 */
export const SCAN_WINDOW_MONTHS = 25;

/** Ceiling on cheap metadata fetches. Bounds latency - does NOT shrink the window. */
export const MAX_MESSAGES_INSPECTED = 1500;

/** Ceiling on expensive full-body fetches, and therefore on GPT calls. */
export const MAX_BODIES_FETCHED = 120;

/** Bodies fetched per distinct sender domain: newest + oldest. */
export const MAX_EMAILS_PER_SENDER = 2;

/** Gmail's documented maximum page size for users.messages.list. */
const LIST_PAGE_SIZE = 500;

/** Parallel Gmail requests. */
const CONCURRENCY = 10;

/** Headroom inside the 60s Vercel function limit (see maxDuration in the route). */
const TIME_BUDGET_MS = 40_000;

const SEARCH_TERMS = [
  "subscription", "membership", "renewal", '"auto-renew"', "trial", "payment",
  "receipt", "invoice", "billing", "cancelled", '"price increase"',
].join(" OR ");

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailHeaders = Array<{ name: string; value: string }>;
type GmailMessage = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeaders };
};

export type MessageHeader = {
  id: string;
  subject: string;
  sender: string;
  senderDomain: string;
  receivedDate: string;
  receivedAt: number;
};

export type ScanCoverage = {
  windowMonths: number;
  /** ISO date of the oldest message the query could return. */
  windowStart: string;
  /** Gmail's own estimate of how many messages matched. */
  matchedEstimate: number;
  /** How many we pulled headers for. */
  inspectedMessages: number;
  distinctSenders: number;
  /** How many full bodies we downloaded (upper bound on GPT calls). */
  bodiesFetched: number;
  /** True when we stopped early - the UI must not present totals as complete. */
  truncated: boolean;
  truncationReason: "none" | "message_limit" | "body_limit" | "time_budget";
};

export type ShortlistResult = {
  candidates: CandidateEmail[];
  coverage: ScanCoverage;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function decode(data?: string) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "'", ndash: "–", mdash: "—", rupee: "₹",
};

/**
 * Decodes HTML entities. Indian senders commonly write ₹ as &#8377; or &#x20B9;,
 * and without this the currency symbol never survives tag-stripping — which both
 * hides the amount and makes an evidenced currency look unevidenced.
 */
export function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      // Hidden preheader text: invisible in the client, pure noise to the model.
      .replace(/<[^>]+style=("|')[^"']*display\s*:\s*none[^"']*\1[^>]*>[\s\S]*?<\/[^>]+>/gi, " ")
      .replace(/<(br|\/tr|\/p|\/div|\/td)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

/** Collects every readable part rather than returning the first one found. */
function collectText(part: GmailPart | undefined, out: { plain: string[]; html: string[] }) {
  if (!part) return;
  if (part.body?.data) {
    if (part.mimeType === "text/plain") out.plain.push(decode(part.body.data));
    else if (part.mimeType === "text/html") out.html.push(htmlToText(decode(part.body.data)));
  }
  for (const child of part.parts || []) collectText(child, out);
}

/**
 * Picks the richer representation. A multipart/alternative message often carries
 * a stub plaintext part ("view this in your browser") alongside the real HTML,
 * so preferring text/plain unconditionally loses the billing table.
 */
function bodyFromPart(part?: GmailPart): string {
  if (!part) return "";
  const out = { plain: [] as string[], html: [] as string[] };
  collectText(part, out);
  const plain = out.plain.join("\n").trim();
  const html = out.html.join("\n").trim();
  if (plain && html) return html.length > plain.length * 1.2 ? html : plain;
  return plain || html || decodeEntities(decode(part.body?.data));
}

/** Money-like figures and the words that usually sit beside them. */
const MONEY_PATTERN =
  /(?:₹|Rs\.?|INR|USD|\$|£|€|AED|amount|premium|total|paid|charged|payable|MRP|invoice|price)\s*[:\-]?\s*[\d,]*\.?\d{0,2}/gi;

/**
 * Builds the excerpt sent to the model: the opening for context, plus windows
 * centred on money-like matches. Blind truncation dropped the figure whenever a
 * sender front-loaded boilerplate, which is most insurers and telecoms.
 */
export function billingExcerpt(text: string, limit = 4000) {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  if (clean.length <= limit) return clean;

  const head = clean.slice(0, 900);
  const windows: Array<[number, number]> = [];
  for (const match of clean.matchAll(MONEY_PATTERN)) {
    const index = match.index ?? 0;
    if (index < 900) continue;
    const start = Math.max(900, index - 160);
    const end = Math.min(clean.length, index + 260);
    const previous = windows[windows.length - 1];
    if (previous && start <= previous[1] + 40) previous[1] = Math.max(previous[1], end);
    else windows.push([start, end]);
  }

  let excerpt = head;
  for (const [start, end] of windows) {
    if (excerpt.length >= limit) break;
    excerpt += ` … ${clean.slice(start, Math.min(end, start + (limit - excerpt.length)))}`;
  }
  return excerpt.length > 900 ? excerpt.slice(0, limit) : clean.slice(0, limit);
}

export function formatGmailDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function scanWindowStart(now: Date, months = SCAN_WINDOW_MONTHS) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCMonth(start.getUTCMonth() - months);
  return start;
}

/**
 * Builds the Gmail query. The `after:` clause is what replaces the old
 * maxResults=30 cap: coverage is now bounded by date, not by an arbitrary count.
 */
export function buildSearchQuery(now = new Date(), months = SCAN_WINDOW_MONTHS) {
  return `after:${formatGmailDate(scanWindowStart(now, months))} -in:chats -in:drafts (${SEARCH_TERMS})`;
}

export function senderDomain(sender: string) {
  const match = sender.match(/([^<>\s@]+)@([^<>\s@,;]+)/);
  if (!match) return "unknown";
  const domain = match[2].toLowerCase().replace(/[.>,;]+$/, "");
  // Collapse billing subdomains so email.netflix.com and billing.netflix.com group together.
  return domain.replace(
    /^(?:e?mail|em|mailer|billing|invoice|receipts?|no-?reply|notifications?|news|info|updates?|link|send|smtp\d*|mg)\./,
    "",
  );
}

const HEADER_DENYLIST = new Set([
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "pinterest.com", "quora.com", "medium.com", "meetup.com", "eventbrite.com",
  "glassdoor.com", "indeed.com",
]);

const HEADER_PROMO_PATTERNS = [
  /\b\d{1,3}%\s*off\b/i, /\bsale ends\b/i, /\bshop now\b/i, /\bcoupon\b/i,
  /\bnewsletter\b/i, /\bweekly digest\b/i, /\bblack friday\b/i, /\bwebinar\b/i,
];

/**
 * Cheap header-only triage, run before any body download.
 * Deliberately permissive: isLikelySubscription re-checks with the full body.
 */
export function isLikelyBillingHeader(header: Pick<MessageHeader, "subject" | "senderDomain">) {
  if (HEADER_DENYLIST.has(header.senderDomain)) return false;
  return !HEADER_PROMO_PATTERNS.some((pattern) => pattern.test(header.subject));
}

/** Unchanged from the original implementation - still runs on the full body. */
export function isLikelySubscription(email: Omit<CandidateEmail, "id">) {
  const text = `${email.subject} ${email.sender} ${email.snippet}`.toLowerCase();
  const positive = ["subscription", "membership", "renew", "auto-renew", "trial", "receipt", "invoice", "billing", "payment", "cancel", "price increase", "charged"];
  const promo = ["unsubscribe from marketing", "sale ends", "shop now", "coupon", "newsletter", "weekly digest"];
  const score = positive.filter((term) => text.includes(term)).length - promo.filter((term) => text.includes(term)).length * 2;
  return score >= 1;
}

/**
 * Picks which messages are worth a body download and a GPT call.
 *
 * Newest message per sender carries current pricing; oldest distinguishes a real
 * recurring subscription from a one-off purchase and exposes price rises.
 * Everything between is redundant, so cost scales with vendors, not emails.
 */
export function selectPerSender(headers: MessageHeader[], perSender = MAX_EMAILS_PER_SENDER) {
  const groups = new Map<string, MessageHeader[]>();
  for (const header of headers) {
    groups.set(header.senderDomain, [...(groups.get(header.senderDomain) || []), header]);
  }

  const selected: MessageHeader[] = [];
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
  for (const group of ordered) {
    const sorted = [...group].sort((a, b) => b.receivedAt - a.receivedAt);
    const take = Math.min(perSender, sorted.length);
    selected.push(sorted[0]);
    if (take >= 2) selected.push(sorted[sorted.length - 1]);
    for (let i = 1; i < sorted.length - 1 && selected.length % perSender !== 0 && take > 2; i++) {
      selected.push(sorted[i]);
    }
  }
  return { selected, distinctSenders: groups.size };
}

// ---------------------------------------------------------------------------
// Gmail access
// ---------------------------------------------------------------------------

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("GMAIL_PERMISSION_DENIED");
  if (!response.ok) throw new Error(`Gmail API failed (${response.status})`);
  return response.json() as Promise<T>;
}

type ListResponse = {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

/** Pages through every match in the window. This replaces the maxResults=30 cap. */
async function listAllMessageIds(accessToken: string, query: string, deadline: number) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let matchedEstimate = 0;
  let hitLimit = false;

  do {
    if (Date.now() > deadline) return { ids, matchedEstimate, hitLimit: true };
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.max(1, Math.min(LIST_PAGE_SIZE, MAX_MESSAGES_INSPECTED - ids.length))),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const page = await gmailFetch<ListResponse>(accessToken, `/messages?${params.toString()}`);
    matchedEstimate = page.resultSizeEstimate ?? matchedEstimate;
    for (const message of page.messages || []) ids.push(message.id);
    pageToken = page.nextPageToken;
    if (ids.length >= MAX_MESSAGES_INSPECTED) { hitLimit = Boolean(pageToken); break; }
  } while (pageToken);

  return { ids, matchedEstimate, hitLimit };
}

/** Header-only fetch. format=metadata means Gmail never ships the body. */
async function fetchHeaders(accessToken: string, ids: string[]): Promise<MessageHeader[]> {
  const query = "format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";
  const raw = await mapLimit(ids, CONCURRENCY, async (id) => {
    try {
      return await gmailFetch<GmailMessage>(accessToken, `/messages/${id}?${query}`);
    } catch (error) {
      if (error instanceof Error && error.message === "GMAIL_PERMISSION_DENIED") throw error;
      return null; // a single unreadable message must not fail the whole scan
    }
  });

  const headers: MessageHeader[] = [];
  for (const message of raw) {
    if (!message) continue;
    const value = (name: string) =>
      message.payload?.headers?.find((item) => item.name.toLowerCase() === name)?.value || "";
    const sender = value("from") || "Unknown sender";
    const receivedAt = Number(message.internalDate || 0);
    headers.push({
      id: message.id,
      subject: value("subject") || "No subject",
      sender,
      senderDomain: senderDomain(sender),
      receivedDate: value("date") || new Date(receivedAt || Date.now()).toISOString(),
      receivedAt,
    });
  }
  return headers;
}

/** Full-body fetch, only for messages that survived triage. */
async function fetchBodies(accessToken: string, headers: MessageHeader[]): Promise<CandidateEmail[]> {
  const raw = await mapLimit(headers, CONCURRENCY, async (header) => {
    try {
      const message = await gmailFetch<GmailMessage>(accessToken, `/messages/${header.id}?format=full`);
      return { header, message };
    } catch (error) {
      if (error instanceof Error && error.message === "GMAIL_PERMISSION_DENIED") throw error;
      return null;
    }
  });

  const candidates: CandidateEmail[] = [];
  for (const entry of raw) {
    if (!entry) continue;
    const body = bodyFromPart(entry.message.payload).replace(/\s+/g, " ").trim();
    candidates.push({
      id: entry.header.id,
      subject: entry.header.subject,
      sender: entry.header.sender,
      receivedDate: entry.header.receivedDate,
      snippet: billingExcerpt(body || decodeEntities(entry.message.snippet || "")),
    });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function shortlistGmailEmails(
  accessToken: string,
  now = new Date(),
): Promise<ShortlistResult> {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const query = buildSearchQuery(now);

  const { ids, matchedEstimate, hitLimit } = await listAllMessageIds(accessToken, query, deadline);
  const headers = await fetchHeaders(accessToken, ids);
  const triaged = headers.filter(isLikelyBillingHeader);
  const { selected, distinctSenders } = selectPerSender(triaged);

  const budgeted = selected
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, MAX_BODIES_FETCHED);

  const candidates = (await fetchBodies(accessToken, budgeted)).filter(isLikelySubscription);

  const outOfTime = Date.now() > deadline;
  const truncationReason: ScanCoverage["truncationReason"] = outOfTime
    ? "time_budget"
    : hitLimit
      ? "message_limit"
      : selected.length > MAX_BODIES_FETCHED
        ? "body_limit"
        : "none";

  return {
    candidates,
    coverage: {
      windowMonths: SCAN_WINDOW_MONTHS,
      windowStart: scanWindowStart(now).toISOString().slice(0, 10),
      matchedEstimate,
      inspectedMessages: headers.length,
      distinctSenders,
      bodiesFetched: budgeted.length,
      truncated: truncationReason !== "none",
      truncationReason,
    },
  };
}
