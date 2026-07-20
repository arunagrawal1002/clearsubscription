import { describe, expect, it } from "vitest";
import { deduplicateSubscriptions } from "@/lib/dedupe";
import { demoSubscriptions } from "@/lib/demo-data";

describe("deduplicateSubscriptions", () => {
  it("merges subscriptions with normalized provider and plan names", () => {
    const result = deduplicateSubscriptions(demoSubscriptions);
    expect(result).toHaveLength(5);
    const designCloud = result.find((item) => item.provider === "DesignCloud Pro");
    expect(designCloud?.duplicateCount).toBe(2);
    expect(designCloud?.sourceEmailId).toBe("demo-designcloud");
  });
});
