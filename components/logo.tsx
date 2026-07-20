import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-bold tracking-tight">
      <span className="grid size-9 place-items-center rounded-full bg-[#35543f] text-sm text-[#d8f36a]">S</span>
      <span className="text-xl">SubScam</span>
    </Link>
  );
}
