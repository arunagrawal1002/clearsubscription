/**
 * Gmail / Google OAuth failure taxonomy.
 *
 * Previously every 401/403 from Gmail, and every failed token refresh, collapsed
 * into one "permission denied or expired" message with nothing logged. Those
 * failures have different causes and different fixes, so they are kept apart
 * here, and Google's own reason string is preserved for the function logs.
 */

export type GmailErrorKind =
  | "token_expired" // refresh token missing, revoked or expired (invalid_grant), or cookie unreadable
  | "token_invalid" // Gmail rejected the access token (401)
  | "scope_missing" // token lacks gmail.readonly (user unticked the box on Google's consent screen)
  | "api_disabled" // Gmail API not enabled in the Google Cloud project
  | "rate_limited" // per-user quota or concurrency limit, still failing after retries
  | "oauth_config" // client id/secret rejected by Google during refresh
  | "forbidden"; // any other 403

export class GmailError extends Error {
  constructor(
    readonly kind: GmailErrorKind,
    readonly detail: { status?: number; reason?: string; googleMessage?: string } = {},
  ) {
    super(`GMAIL_${kind.toUpperCase()}`);
    this.name = "GmailError";
  }
}

type GoogleApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string }>;
    details?: Array<{ reason?: string }>;
  };
};

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "RATE_LIMIT_EXCEEDED"]);
const SCOPE_REASONS = new Set(["insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"]);
const DISABLED_REASONS = new Set(["accessNotConfigured", "SERVICE_DISABLED"]);

/** Pulls every reason string Google put in an error body. */
export function googleReasons(body: unknown): string[] {
  const error = (body as GoogleApiErrorBody | null)?.error;
  if (!error || typeof error !== "object") return [];
  return [
    ...(error.errors ?? []).map((item) => item.reason),
    ...(error.details ?? []).map((item) => item.reason),
    error.status,
  ].filter((reason): reason is string => typeof reason === "string" && reason.length > 0);
}

/** True when the response is worth retrying after a back-off. */
export function isRetryableGmailResponse(status: number, body: unknown): boolean {
  if (status === 429 || status >= 500) return true;
  if (status !== 403) return false;
  return googleReasons(body).some((reason) => RATE_LIMIT_REASONS.has(reason));
}

/** Maps a failed Gmail API response to the error the scan should report. */
export function classifyGmailResponse(status: number, body: unknown): GmailError | null {
  const reasons = googleReasons(body);
  const detail = {
    status,
    reason: reasons[0],
    googleMessage: (body as GoogleApiErrorBody | null)?.error?.message,
  };
  if (status === 401) return new GmailError("token_invalid", detail);
  if (status === 429 || reasons.some((reason) => RATE_LIMIT_REASONS.has(reason))) return new GmailError("rate_limited", detail);
  if (status !== 403) return null;
  if (reasons.some((reason) => SCOPE_REASONS.has(reason))) return new GmailError("scope_missing", detail);
  if (reasons.some((reason) => DISABLED_REASONS.has(reason))) return new GmailError("api_disabled", detail);
  return new GmailError("forbidden", detail);
}

/** Maps a failed https://oauth2.googleapis.com/token refresh to an error. */
export function classifyRefreshFailure(status: number, body: unknown): GmailError {
  const data = (body ?? {}) as { error?: string; error_description?: string };
  const detail = { status, reason: data.error, googleMessage: data.error_description };
  if (data.error === "invalid_client" || data.error === "unauthorized_client") return new GmailError("oauth_config", detail);
  // invalid_grant: revoked, password changed, or — while the consent screen is in
  // Testing mode — Google's 7-day expiry on refresh tokens.
  return new GmailError("token_expired", detail);
}

/** True for failures where reconnecting Gmail is the fix. */
export function reconnectFixes(kind: GmailErrorKind): boolean {
  return kind === "token_expired" || kind === "token_invalid" || kind === "scope_missing" || kind === "forbidden";
}

/** The user-facing response for each failure. */
export function gmailErrorResponse(error: GmailError): { status: number; code: string; error: string } {
  switch (error.kind) {
    case "token_expired":
    case "token_invalid":
      return { status: 401, code: "GMAIL_TOKEN_EXPIRED", error: "Your Gmail connection has expired. Reconnect Gmail and try again." };
    case "scope_missing":
      return { status: 403, code: "GMAIL_SCOPE_MISSING", error: "Gmail read access wasn't granted. Reconnect Gmail and make sure the box allowing ClearSubscription to read your email is ticked." };
    case "api_disabled":
      return { status: 503, code: "GMAIL_API_DISABLED", error: "The Gmail API isn't enabled for this app's Google Cloud project yet. This is on our side — please try again later." };
    case "rate_limited":
      return { status: 503, code: "GMAIL_RATE_LIMITED", error: "Gmail is limiting how fast we can read right now. Wait a minute and try again." };
    case "oauth_config":
      return { status: 503, code: "GMAIL_OAUTH_CONFIG", error: "Google rejected this app's OAuth credentials. This is on our side — please try again later." };
    default:
      return { status: 403, code: "GMAIL_PERMISSION_DENIED", error: "Google denied access to Gmail. Reconnect Gmail and try again." };
  }
}
