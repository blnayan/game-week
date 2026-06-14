import { describe, expect, it } from "vitest";
import { FIGHTER_RENDER_SCALE } from "./renderScale.js";

describe("render scale", () => {
  it("keeps fighters compact enough for the floating arena", () => {
    expect(FIGHTER_RENDER_SCALE).toBe(1.15);
  });
});
