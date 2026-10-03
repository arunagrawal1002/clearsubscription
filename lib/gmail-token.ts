import crypto from "node:crypto";
import { classifyRefreshFailure, GmailError } from "@/lib/gmail-errors";

export const GMAIL_COOKIE = "clearsub_gmail";
/** Pre-rename cookie name, still read so existing sessions aren't forced to re-consent. */
export const LEGACY_GMAIL_COOKIE = "subscam_gmail";

export type GmailToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
};

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

export function sealGmailToken(value: GmailToken) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/**
 * Opens the cookie. A cookie sealed under a previous AUTH_SECRET cannot be
 * decrypted; that is an expired connection, not a server fault.
 */
export function unsealGmailToken(value: string): GmailToken {
  try {
    return unseal(value);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_SECRET is not configured") throw error;
    throw new GmailError("token_expired", { reason: "cookie_unreadable" });
  }
}

function unseal(value: string): GmailToken {
  const data = Buffer.from(value, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as GmailToken;
}

/** Refreshes when close to expiry, or always when `force` is set (after a 401). */
export async function refreshGmailToken(token: GmailToken, { force = false } = {}): Promise<GmailToken> {
  if (!force && token.expiresAt > Date.now() + 60_000) return token;
  if (!token.refreshToken) {
    console.error("[gmail] access token expired and no refresh token is stored");
    throw new GmailError("token_expired", { reason: "no_refresh_token" });
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = classifyRefreshFailure(response.status, body);
    console.error("[gmail] token refresh failed", { kind: error.kind, ...error.detail });
    throw error;
  }
  const data = (await response.json()) as { access_token: string; expires_in: number; scope?: string };
  return {
    accessToken: data.access_token,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope || token.scope,
  };
}
