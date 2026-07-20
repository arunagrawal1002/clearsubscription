import { subscriptionSchema, type Subscription } from "@/lib/types";
import { z } from "zod";

export const STORAGE_KEY = "subscam:subscriptions:v1";
export const META_KEY = "subscam:scan-meta:v1";

export function saveSubscriptions(items: Subscription[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadSubscriptions(): Subscription[] {
  try {
    return z.array(subscriptionSchema).parse(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}
