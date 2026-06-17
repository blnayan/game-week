import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyInput, createMatch } from "../../shared/match.js";
import { chooseCpuInput } from "../../shared/cpu.js";
import { TRI_PLATFORM_STAGE_ID } from "../../shared/stages.js";

describe("CPU input selection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    expect(input.light || input.heavy).toBe(true);
  });

  it("does not use random dodge behavior when attacking close", () => {
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("CPU input should be deterministic");
    });
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;

    const input = chooseCpuInput(match, "p2", "normal");

    expect(input.light || input.heavy).toBe(true);
    expect(input).not.toHaveProperty("dodge");
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it("pulses close-range attacks across elapsed time windows", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;
    match.elapsedMs = 0;

    const attackInput = chooseCpuInput(match, "p2", "normal");
    match.elapsedMs = 120;
    const releaseInput = chooseCpuInput(match, "p2", "normal");

    expect(attackInput.light || attackInput.heavy).toBe(true);
    expect(releaseInput.light || releaseInput.heavy).toBe(false);
  });

  it("uses heavy at close range on hard attack pulses", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;
    match.elapsedMs = 240;

    const input = chooseCpuInput(match, "p2", "hard");

    expect(input.heavy).toBe(true);
    expect(input.light).toBe(false);
  });

  it("jumps while recovering below the platform", () => {
    const match = createMatch("cpu");
    match.fighters.p2.y = 650;
    const input = chooseCpuInput(match, "p2", "hard");
    expect(input.jump).toBe(true);
  });

  it("recovers toward the active stage main platform", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    const input = chooseCpuInput(match, "p2", "normal");

    match.fighters.p2.y = 660;
    match.fighters.p2.x = 100;
    const recovering = chooseCpuInput(match, "p2", "normal");

    expect(input).toEqual(expect.any(Object));
    expect(recovering.right).toBe(true);
    expect(recovering.jump).toBe(true);
  });

  it("pulses recovery jump across elapsed time windows", () => {
    const match = createMatch("cpu");
    match.fighters.p2.y = 650;
    match.elapsedMs = 0;

    const jumpInput = chooseCpuInput(match, "p2", "hard");
    match.elapsedMs = 120;
    const releaseInput = chooseCpuInput(match, "p2", "hard");

    expect(jumpInput.jump).toBe(true);
    expect(releaseInput.jump).toBe(false);
  });

  it("returns neutral input for invalid cpu ids", () => {
    const match = createMatch("cpu");

    expect(() => chooseCpuInput(match, "missing", "normal")).not.toThrow();
    expect(chooseCpuInput(match, "missing", "normal")).toEqual(createEmptyInput());
  });

  it("does not emit removed special dodge shield or up inputs", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;

    const input = chooseCpuInput(match, "p2", "hard");

    expect(input).not.toHaveProperty("special");
    expect(input).not.toHaveProperty("dodge");
    expect(input).not.toHaveProperty("shield");
    expect(input).not.toHaveProperty("up");
  });

  it("uses down for a dive attack when airborne above the player", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p1.y = 420;
    match.fighters.p2.x = 610;
    match.fighters.p2.y = 300;
    match.fighters.p2.onGround = false;
    match.elapsedMs = 0;

    const input = chooseCpuInput(match, "p2", "hard");

    expect(input.down).toBe(true);
  });
});
