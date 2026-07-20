import { DashboardClient } from "@/components/dashboard-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Subscription dashboard" };
export default function DashboardPage() { return <DashboardClient />; }
