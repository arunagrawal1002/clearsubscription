import { Suspense } from "react";
import { ScanExperience } from "@/components/scan-experience";

export default function ScanPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f7f5ee] font-bold">Preparing secure scan…</div>}><ScanExperience /></Suspense>;
}
