"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={() => { setLoading(true); void signIn("google", { redirectTo: "/connect" }); }}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-full bg-[#17231d] px-6 py-4 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#35543f] disabled:opacity-70 sm:w-auto"
    >
      <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-[#4285f4]">G</span>
      {loading ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
