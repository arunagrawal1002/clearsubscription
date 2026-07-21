import { auth } from "@/auth";
import { GMAIL_COOKIE, LEGACY_GMAIL_COOKIE } from "@/lib/gmail-token";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ connected: false }, { status: 401 });
  const jar = await cookies();
  const token = jar.get(GMAIL_COOKIE)?.value ?? jar.get(LEGACY_GMAIL_COOKIE)?.value;
  return NextResponse.json({ connected: Boolean(token) });
}

export async function DELETE() {
  (await cookies()).delete(GMAIL_COOKIE);
  return NextResponse.json({ connected: false });
}
