import { auth, signOut } from "@/auth";
import { Logo } from "@/components/logo";
import Link from "next/link";

export async function SiteNav() {
  const session = await auth();
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Logo />
      <div className="flex items-center gap-3">
        {session?.user ? (
          <>
            <Link href="/dashboard" className="hidden text-sm font-semibold text-[#35543f] sm:block">Dashboard</Link>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button className="rounded-full border border-[#35543f]/20 bg-white/60 px-4 py-2 text-sm font-semibold hover:bg-white">Sign out</button>
            </form>
          </>
        ) : (
          <span className="rounded-full border border-[#35543f]/15 bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#35543f]">Privacy first</span>
        )}
      </div>
    </header>
  );
}
