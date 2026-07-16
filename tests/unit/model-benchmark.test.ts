import { describe, expect, it } from "vitest";
import { benchmarkPosition, modelBenchmarkKey } from "$server/domain/model-benchmark";

describe("model benchmarks", () => {
  it("normalizes a motorcycle cohort without user data", () => {
    expect(modelBenchmarkKey("Honda", "Fazer 250", 2024)).toBe("honda:fazer-250:2024");
  });

  it("uses a meaningful range around the cohort average", () => {
    expect(benchmarkPosition(31, 30)).toBe("na média");
    expect(benchmarkPosition(35, 30)).toBe("acima da média");
  });
});
