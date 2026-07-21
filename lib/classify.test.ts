import { describe, expect, it } from "vitest";
import { classificationFixtures } from "@/lib/classify.fixtures";
import { classifyEmailByRules } from "@/lib/classify-rules";

describe("classification policy fixtures", () => {
  it("passes all 15 anonymised examples without calling the model", () => {
    const results = classificationFixtures.map((fixture) => ({
      name: fixture.name,
      actual: classifyEmailByRules(fixture),
      expected: fixture.expected,
    }));

    expect(results.filter(({ actual, expected }) => actual.serviceCategory === expected.serviceCategory && actual.isSubscriptionEmail === expected.isSubscriptionEmail)).toHaveLength(15);
    expect(results).toHaveLength(15); // Baseline pass rate: 15/15 (100%).
  });
});
