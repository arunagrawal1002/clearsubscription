import type { Subscription } from "@/lib/types";

function keyFor(item: Subscription) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normalize(item.provider)}::${normalize(item.subscriptionName)}`;
}

export function deduplicateSubscriptions(items: Subscription[]) {
  const groups = new Map<string, Subscription[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return Array.from(groups.values()).map((group) => {
    const sorted = [...group].sort(
      (a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime(),
    );
    const newest = sorted[0];
    return { ...newest, duplicateCount: group.length };
  });
}
