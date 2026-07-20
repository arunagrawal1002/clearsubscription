import Link from "next/link";
import { PlayIcon } from "@heroicons/react/20/solid";

export function DemoButton() {
  return (
    <Link href="/scan?demo=1" className="flex w-full items-center justify-center gap-2 rounded-full border border-[#35543f]/25 bg-white px-6 py-4 font-bold transition hover:-translate-y-0.5 hover:border-[#35543f] sm:w-auto">
      <PlayIcon className="size-4" /> Try Demo
    </Link>
  );
}
