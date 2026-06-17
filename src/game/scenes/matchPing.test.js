import { describe, expect, it } from "vitest";
import { getMatchPingMs } from "./matchPing.js";

describe("getMatchPingMs", () => {
  it("reports local CPU matches as zero latency", () => {
    expect(getMatchPingMs("cpu")).toBe(0);
  });

  it("uses online socket latency when available", () => {
    expect(getMatchPingMs("online-create", { getPingMs: () => 37.6 })).toBe(37.6);
  });

  it("uses zero until online socket latency is available", () => {
    expect(getMatchPingMs("online-create", { getPingMs: () => null })).toBe(0);
  });
});
