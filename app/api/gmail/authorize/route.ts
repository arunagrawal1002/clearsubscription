import { auth } from "@/auth";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/?error=signin_required", request.url));
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(new URL("/connect?error=google_not_configured", request.url));

  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("subscam_oauth_state", state, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });
  cookieStore.set("subscam_oauth_verifier", verifier, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });

  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/gmail/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
