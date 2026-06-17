import { describe, expect, it } from "vitest";
import { DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID } from "../../../shared/stages.js";
import { getMenuButtonLayout, getStageChoiceLayout, isPointInRect } from "./menuLayout.js";

describe("menu layout", () => {
  it("keeps manual join styled like the primary menu buttons", () => {
    const cpu = getMenuButtonLayout("cpu");
    const createRoom = getMenuButtonLayout("createRoom");
    const enterCode = getMenuButtonLayout("enterCode");

    expect(enterCode.label).toBe("Join Online Room (R)");
    expect(enterCode.width).toBe(cpu.width);
    expect(enterCode.height).toBe(cpu.height);
    expect(enterCode.fill).toBe(cpu.fill);
    expect(enterCode.stroke).toBe(cpu.stroke);
    expect(enterCode.y).toBeGreaterThan(createRoom.y);
  });

  it("uses matching visual and pointer bounds for the manual join button", () => {
    const enterCode = getMenuButtonLayout("enterCode");

    expect(isPointInRect({ x: enterCode.x + enterCode.width - 1, y: enterCode.y }, enterCode)).toBe(true);
    expect(isPointInRect({ x: enterCode.x + enterCode.width + 1, y: enterCode.y }, enterCode)).toBe(false);
    expect(isPointInRect({ x: enterCode.x, y: enterCode.y - enterCode.height / 2 - 1 }, enterCode)).toBe(false);
  });

  it("positions the stage picker above the match mode buttons", () => {
    const cpu = getMenuButtonLayout("cpu");
    const createRoom = getMenuButtonLayout("createRoom");
    const cosmic = getStageChoiceLayout(DEFAULT_STAGE_ID);
    const triPlatform = getStageChoiceLayout(TRI_PLATFORM_STAGE_ID);

    expect(cosmic.y + cosmic.height / 2).toBeLessThan(cpu.y - cpu.height / 2);
    expect(triPlatform.y + triPlatform.height / 2).toBeLessThan(cpu.y - cpu.height / 2);
    expect(createRoom.y).toBeGreaterThan(cpu.y);
  });
});
