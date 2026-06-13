import { describe, expect, it } from "vitest";
import { GAME_WIDTH, STAGE } from "../../shared/constants.js";

describe("stage collision geometry", () => {
  it("aligns the main platform with the full-width visible arena ledge", () => {
    expect(STAGE.platform).toMatchObject({
      x: 0,
      y: 520,
      width: GAME_WIDTH
    });
    expect(STAGE.platform.height).toBeGreaterThanOrEqual(32);
  });
});
