import { describe, expect, it } from "vitest";
import { STAGE } from "../../shared/constants.js";

describe("stage collision geometry", () => {
  it("aligns the main platform with the visible short arena ledge", () => {
    expect(STAGE.platform).toMatchObject({
      x: 200,
      y: 420,
      width: 880
    });
    expect(STAGE.platform.height).toBeGreaterThanOrEqual(32);
  });
});
