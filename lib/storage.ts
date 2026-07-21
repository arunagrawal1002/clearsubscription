import { subscriptionSchema, type Subscription } from "@/lib/types";
import { z } from "zod";

export const STORAGE_KEY = "clearsubscription:subscriptions:v1";
export const META_KEY = "clearsubscription:scan-meta:v1";

const LEGACY_KEYS: Array<[string, string]> = [
  ["subscam:subscriptions:v1", STORAGE_KEY],
  ["subscam:scan-meta:v1", META_KEY],
];

/** Carries results saved under the pre-rename keys forward, so renaming the
 *  product doesn't silently empty an existing user's dashboard. */
function migrateLegacyKeys() {
  if (typeof localStorage === "undefined") return;
  for (const [legacy, current] of LEGACY_KEYS) {
    const value = localStorage.getItem(legacy);
    if (value !== null && localStorage.getItem(current) === null) localStorage.setItem(current, value);
  }
}

export function saveSubscriptions(items: Subscription[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadSubscriptions(): Subscription[] {
  try {
    migrateLegacyKeys();
    return z.array(subscriptionSchema).parse(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}
