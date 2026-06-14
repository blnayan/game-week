import { describe, expect, it } from "vitest";
import { FIGHTER_RENDER_SCALE } from "./renderScale.js";

describe("render scale", () => {
  it("keeps 76px source fighters near the previous apparent size", () => {
    expect(FIGHTER_RENDER_SCALE).toBe(1.5);
  });
});
