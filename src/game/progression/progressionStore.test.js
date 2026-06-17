import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID } from "../../../shared/stages.js";

const storage = new Map();

vi.stubGlobal("window", {
  localStorage: {
    getItem: vi.fn((key) => storage.get(key) ?? null),
    setItem: vi.fn((key, value) => storage.set(key, value))
  }
});

const { awardMatchXp, canUseStage, loadProgression, selectPlayerPalette } = await import("./progressionStore.js");

describe("progression store", () => {
  beforeEach(() => {
    storage.clear();
    window.localStorage.getItem.mockClear();
    window.localStorage.setItem.mockClear();
  });

  it("returns defaults when saved progression is malformed", () => {
    storage.set("pixel-arena-progress", "{not json");

    expect(loadProgression()).toEqual({ xp: 0, level: 1, palettes: ["blue", "orange"] });
  });

  it("normalizes partial saved progression before awarding XP", () => {
    storage.set("pixel-arena-progress", JSON.stringify({ xp: 275, palettes: "blue" }));

    const progress = awardMatchXp(50);

    expect(progress).toEqual({ xp: 325, level: 2, palettes: ["blue", "orange", "violet"] });
    expect(JSON.parse(storage.get("pixel-arena-progress"))).toEqual(progress);
  });

  it("normalizes violet unlocks for old saves with enough XP", () => {
    storage.set("pixel-arena-progress", JSON.stringify({ xp: 300 }));

    expect(loadProgression()).toEqual({ xp: 300, level: 2, palettes: ["blue", "orange", "violet"] });
  });

  it("drops saved violet when XP is below the unlock threshold", () => {
    storage.set("pixel-arena-progress", JSON.stringify({ xp: 0, palettes: ["violet"] }));

    expect(loadProgression()).toEqual({ xp: 0, level: 1, palettes: ["blue", "orange"] });
  });

  it("drops unknown saved palette names", () => {
    storage.set("pixel-arena-progress", JSON.stringify({ xp: 300, palettes: ["blue", "debug", "violet"] }));

    expect(loadProgression()).toEqual({ xp: 300, level: 2, palettes: ["blue", "orange", "violet"] });
  });

  it("selects violet as the player palette after unlock", () => {
    expect(selectPlayerPalette({ palettes: ["blue", "orange"] })).toBe("blue");
    expect(selectPlayerPalette({ palettes: ["blue", "orange", "violet"] })).toBe("violet");
  });

  it("allows the default stage at level 1", () => {
    expect(canUseStage(DEFAULT_STAGE_ID, { level: 1 })).toBe(true);
  });

  it("keeps tri-platform locked below level 10", () => {
    expect(canUseStage(TRI_PLATFORM_STAGE_ID, { level: 9 })).toBe(false);
  });

  it("unlocks tri-platform at level 10", () => {
    expect(canUseStage(TRI_PLATFORM_STAGE_ID, { level: 10 })).toBe(true);
  });
});
