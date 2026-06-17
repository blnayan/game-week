import { describe, expect, it } from "vitest";
import { createMatch } from "../../../shared/match.js";
import { stepCpuMatchFrame } from "./cpuFrame.js";

describe("CPU match frame stepping", () => {
  it("catches up simulation time across multiple fixed steps during a low-FPS frame", () => {
    const match = createMatch("cpu");

    const remainder = stepCpuMatchFrame(match, { left: false }, 100, 0);

    expect(match.elapsedMs).toBeCloseTo(100, 1);
    expect(remainder).toBeCloseTo(0, 1);
  });
});
