import { auth } from "@/auth";
import { GMAIL_COOKIE, sealGmailToken } from "@/lib/gmail-token";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const baseUrl = process.env.NEXTAUTH_URL || url.origin;
  if (!session?.user) return NextResponse.redirect(new URL("/?error=signin_required", baseUrl));
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/connect?error=permission_denied", baseUrl));

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("subscam_oauth_state")?.value;
  const verifier = cookieStore.get("subscam_oauth_verifier")?.value;
  const code = url.searchParams.get("code");
  if (!code || !verifier || !expectedState || url.searchParams.get("state") !== expectedState) {
    return NextResponse.redirect(new URL("/connect?error=invalid_oauth_state", baseUrl));
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: `${baseUrl}/api/gmail/callback`,
    }),
    cache: "no-store",
  });

  if (!response.ok) return NextResponse.redirect(new URL("/connect?error=token_exchange_failed", baseUrl));
  const data = (await response.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
  cookieStore.set(GMAIL_COOKIE, sealGmailToken({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
  cookieStore.delete("subscam_oauth_state");
  cookieStore.delete("subscam_oauth_verifier");
  return NextResponse.redirect(new URL("/scan?auto=1", baseUrl));
}
