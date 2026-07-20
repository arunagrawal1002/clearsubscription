import { describe, expect, it } from "vitest";
import { monthlyEquivalent } from "@/lib/utils";
import { demoSubscriptions } from "@/lib/demo-data";

describe("monthlyEquivalent", () => {
  it("normalizes yearly costs", () => {
    const item = demoSubscriptions.find((entry) => entry.sourceEmailId === "demo-designcloud")!;
    expect(monthlyEquivalent(item)).toBe(20);
  });

  it("excludes predicted cancellations", () => {
    const item = demoSubscriptions.find((entry) => entry.sourceEmailId === "demo-cloudbox")!;
    expect(monthlyEquivalent(item)).toBe(0);
  });
});
