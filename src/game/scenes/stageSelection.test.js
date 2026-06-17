import { describe, expect, it } from "vitest";
import { DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID } from "../../../shared/stages.js";
import { getMenuStageOptions, MENU_STAGE_IDS, resolveMenuStageSelection } from "./stageSelection.js";

describe("stage selection", () => {
  it("exposes the supported menu stage ids", () => {
    expect(MENU_STAGE_IDS).toEqual([DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID]);
  });

  it("marks tri-platform locked below level 10", () => {
    const options = getMenuStageOptions({ level: 9 }, DEFAULT_STAGE_ID);

    expect(options).toEqual([
      expect.objectContaining({
        stageId: DEFAULT_STAGE_ID,
        label: "Cosmic Floating",
        selected: true,
        locked: false
      }),
      expect.objectContaining({
        stageId: TRI_PLATFORM_STAGE_ID,
        label: "Tri Platform - Level 10",
        selected: false,
        locked: true,
        notice: "Stage unlocks at level 10",
        unlockLevel: 10
      })
    ]);
  });

  it("allows selecting tri-platform at level 10", () => {
    const selection = resolveMenuStageSelection(TRI_PLATFORM_STAGE_ID, { level: 10 }, DEFAULT_STAGE_ID);

    expect(selection).toEqual({
      selectedStageId: TRI_PLATFORM_STAGE_ID,
      notice: ""
    });
  });

  it("keeps the current stage selected and returns the unlock notice when a locked stage is clicked", () => {
    const selection = resolveMenuStageSelection(TRI_PLATFORM_STAGE_ID, { level: 9 }, DEFAULT_STAGE_ID);

    expect(selection).toEqual({
      selectedStageId: DEFAULT_STAGE_ID,
      notice: "Stage unlocks at level 10"
    });
  });
});
