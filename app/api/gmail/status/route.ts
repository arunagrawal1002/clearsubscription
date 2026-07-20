import { auth } from "@/auth";
import { GMAIL_COOKIE } from "@/lib/gmail-token";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ connected: false }, { status: 401 });
  const token = (await cookies()).get(GMAIL_COOKIE)?.value;
  return NextResponse.json({ connected: Boolean(token) });
}

export async function DELETE() {
  (await cookies()).delete(GMAIL_COOKIE);
  return NextResponse.json({ connected: false });
}
