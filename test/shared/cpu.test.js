import { describe, expect, it } from "vitest";
import { createMatch } from "../../shared/match.js";
import { chooseCpuInput } from "../../shared/cpu.js";

describe("CPU input selection", () => {
  it("moves toward the player when far away", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 300;
    match.fighters.p2.x = 900;
    const input = chooseCpuInput(match, "p2", "normal");
    expect(input.left).toBe(true);
    expect(input.right).toBe(false);
  });

  it("uses light attack when close", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;
    const input = chooseCpuInput(match, "p2", "normal");
    expect(input.light || input.heavy || input.special).toBe(true);
  });

  it("jumps while recovering below the platform", () => {
    const match = createMatch("cpu");
    match.fighters.p2.y = 650;
    const input = chooseCpuInput(match, "p2", "hard");
    expect(input.jump).toBe(true);
  });
});
