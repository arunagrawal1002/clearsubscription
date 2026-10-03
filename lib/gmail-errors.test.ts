import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyGmailResponse, classifyRefreshFailure, GmailError, gmailErrorResponse, isRetryableGmailResponse } from "@/lib/gmail-errors";
import { shortlistGmailEmails } from "@/lib/gmail";

const googleError = (code: number, reason: string, message = "x") => ({ error: { code, message, errors: [{ reason }] } });

describe("classifyGmailResponse", () => {
  it("treats a rate-limit 403 as rate limiting, not a permission failure", () => {
    expect(classifyGmailResponse(403, googleError(403, "userRateLimitExceeded"))?.kind).toBe("rate_limited");
    expect(classifyGmailResponse(403, googleError(403, "rateLimitExceeded"))?.kind).toBe("rate_limited");
    expect(classifyGmailResponse(429, null)?.kind).toBe("rate_limited");
  });

  it("recognises a token without the Gmail scope", () => {
    expect(classifyGmailResponse(403, googleError(403, "insufficientPermissions"))?.kind).toBe("scope_missing");
    expect(classifyGmailResponse(403, { error: { code: 403, status: "PERMISSION_DENIED", details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } })?.kind).toBe("scope_missing");
  });

  it("recognises the Gmail API being disabled in Google Cloud", () => {
    expect(classifyGmailResponse(403, googleError(403, "accessNotConfigured"))?.kind).toBe("api_disabled");
  });

  it("maps 401 to an invalid token and keeps Google's message", () => {
    const error = classifyGmailResponse(401, googleError(401, "authError", "Invalid Credentials"));
    expect(error?.kind).toBe("token_invalid");
    expect(error?.detail.googleMessage).toBe("Invalid Credentials");
  });

  it("only retries rate limits and server errors", () => {
    expect(isRetryableGmailResponse(403, googleError(403, "userRateLimitExceeded"))).toBe(true);
    expect(isRetryableGmailResponse(503, null)).toBe(true);
    expect(isRetryableGmailResponse(403, googleError(403, "insufficientPermissions"))).toBe(false);
    expect(isRetryableGmailResponse(401, null)).toBe(false);
  });
});

describe("classifyRefreshFailure", () => {
  it("separates an expired grant from bad client credentials", () => {
    expect(classifyRefreshFailure(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }).kind).toBe("token_expired");
    expect(classifyRefreshFailure(401, { error: "invalid_client" }).kind).toBe("oauth_config");
  });
});

describe("gmailErrorResponse", () => {
  it("gives every kind its own code", () => {
    const kinds = ["token_expired", "scope_missing", "api_disabled", "rate_limited", "oauth_config", "forbidden"] as const;
    const codes = kinds.map((kind) => gmailErrorResponse(new GmailError(kind)).code);
    expect(new Set(codes).size).toBe(kinds.length);
  });
});

describe("Gmail fetch during a scan", () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("retries a rate-limited request instead of failing the scan", async () => {
    let listCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/messages?")) {
        listCalls += 1;
        return listCalls === 1 ? json(403, googleError(403, "userRateLimitExceeded")) : json(200, { messages: [] });
      }
      return json(404, {});
    }));
    const result = await shortlistGmailEmails("token");
    expect(listCalls).toBe(2);
    expect(result.candidates).toEqual([]);
  });

  it("stops immediately when the token lacks the Gmail scope", async () => {
    const fetchMock = vi.fn(async () => json(403, googleError(403, "insufficientPermissions")));
    vi.stubGlobal("fetch", fetchMock);
    await expect(shortlistGmailEmails("token")).rejects.toMatchObject({ kind: "scope_missing" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not abort the whole scan when one message stays rate-limited", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/messages?")) return json(200, { messages: [{ id: "a" }, { id: "b" }] });
      if (url.includes("/messages/a?")) return json(429, googleError(429, "rateLimitExceeded"));
      return json(200, { id: "b", internalDate: "0", payload: { headers: [{ name: "From", value: "Promo <news@shop.com>" }, { name: "Subject", value: "Sale" }] } });
    }));
    await expect(shortlistGmailEmails("token")).resolves.toBeDefined();
  }, 20_000);
});
