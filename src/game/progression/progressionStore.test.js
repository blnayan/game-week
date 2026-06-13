import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map();

vi.stubGlobal("window", {
  localStorage: {
    getItem: vi.fn((key) => storage.get(key) ?? null),
    setItem: vi.fn((key, value) => storage.set(key, value))
  }
});

const { awardMatchXp, loadProgression } = await import("./progressionStore.js");

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
});
