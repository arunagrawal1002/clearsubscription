import type { CandidateEmail } from "@/lib/types";

const SEARCH_QUERY = [
  "subscription", "membership", "renewal", '"auto-renew"', "trial", "payment",
  "receipt", "invoice", "billing", "cancelled", '"price increase"',
].join(" OR ");

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
};

function decode(data?: string) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function bodyFromPart(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const child of part.parts || []) {
    const body = bodyFromPart(child);
    if (body) return body;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decode(part.body.data).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  return decode(part.body?.data);
}

export function isLikelySubscription(email: Omit<CandidateEmail, "id">) {
  const text = `${email.subject} ${email.sender} ${email.snippet}`.toLowerCase();
  const positive = ["subscription", "membership", "renew", "auto-renew", "trial", "receipt", "invoice", "billing", "payment", "cancel", "price increase", "charged"];
  const promo = ["unsubscribe from marketing", "sale ends", "shop now", "coupon", "newsletter", "weekly digest"];
  const score = positive.filter((term) => text.includes(term)).length - promo.filter((term) => text.includes(term)).length * 2;
  return score >= 1;
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("GMAIL_PERMISSION_DENIED");
  if (!response.ok) throw new Error(`Gmail API failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function shortlistGmailEmails(accessToken: string): Promise<CandidateEmail[]> {
  const list = await gmailFetch<{ messages?: Array<{ id: string }> }>(accessToken, `/messages?q=${encodeURIComponent(SEARCH_QUERY)}&maxResults=30`);
  const messages = await Promise.all((list.messages || []).map(({ id }) => gmailFetch<GmailMessage>(accessToken, `/messages/${id}?format=full`)));
  return messages.map((message) => {
    const header = (name: string) => message.payload?.headers?.find((item) => item.name.toLowerCase() === name)?.value || "";
    const body = bodyFromPart(message.payload).replace(/\s+/g, " ").trim();
    const email = {
      id: message.id,
      subject: header("subject") || "No subject",
      sender: header("from") || "Unknown sender",
      receivedDate: header("date") || new Date(Number(message.internalDate || Date.now())).toISOString(),
      snippet: (body || message.snippet || "").slice(0, 1200),
    };
    return email;
  }).filter(isLikelySubscription);
}
