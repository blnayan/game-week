import { describe, expect, it } from "vitest";
import { STAGE } from "../../shared/constants.js";
import {
  DEFAULT_STAGE_ID,
  STAGE_DEFINITIONS,
  TRI_PLATFORM_STAGE_ID,
  canCreateStageAtLevel,
  getStageDefinition,
  normalizeStageId
} from "../../shared/stages.js";

describe("stage collision geometry", () => {
  it("keeps the existing default arena geometry available through constants", () => {
    expect(DEFAULT_STAGE_ID).toBe("cosmic-floating");
    expect(STAGE).toBe(getStageDefinition(DEFAULT_STAGE_ID));
    expect(STAGE.platform).toMatchObject({ x: 200, y: 420, width: 880, height: 36 });
    expect(STAGE.platforms).toEqual([STAGE.platform]);
  });

  it("defines the approved tri-platform stage geometry", () => {
    expect(STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID]).toMatchObject({
      id: "tri-platform",
      name: "Tri Platform",
      unlockLevel: 10,
      mainPlatformId: "main"
    });
    expect(STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID].platforms).toEqual([
      { id: "main", x: 200, y: 540, width: 880, height: 36 },
      { id: "left", x: 150, y: 460, width: 260, height: 28 },
      { id: "top", x: 485, y: 380, width: 310, height: 28 },
      { id: "right", x: 870, y: 460, width: 260, height: 28 }
    ]);
  });

  it("uses one shared main platform object for tri-platform compatibility fields", () => {
    const stage = STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID];

    expect(stage.platform).toBe(stage.platforms[0]);
  });

  it("normalizes unknown stage ids back to the default stage", () => {
    expect(normalizeStageId("tri-platform")).toBe("tri-platform");
    expect(normalizeStageId("unknown-stage")).toBe(DEFAULT_STAGE_ID);
    expect(normalizeStageId(null)).toBe(DEFAULT_STAGE_ID);
  });

  it("gates tri-platform creation at level 10 only", () => {
    expect(canCreateStageAtLevel(DEFAULT_STAGE_ID, 1)).toEqual({ ok: true });
    expect(canCreateStageAtLevel(TRI_PLATFORM_STAGE_ID, 9)).toEqual({
      ok: false,
      error: "Stage unlocks at level 10"
    });
    expect(canCreateStageAtLevel(TRI_PLATFORM_STAGE_ID, 10)).toEqual({ ok: true });
  });

  it("freezes nested catalog geometry used across shared systems", () => {
    const defaultStage = STAGE_DEFINITIONS[DEFAULT_STAGE_ID];
    const triPlatformStage = STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID];

    expect(() => {
      defaultStage.platform.x = 1;
    }).toThrow(TypeError);
    expect(() => {
      defaultStage.spawnA.x = 1;
    }).toThrow(TypeError);
    expect(() => {
      defaultStage.blastZone.bottom = 1;
    }).toThrow(TypeError);
    expect(() => {
      triPlatformStage.platforms[1].height = 1;
    }).toThrow(TypeError);
    expect(defaultStage.platform.x).toBe(200);
    expect(defaultStage.spawnA.x).toBe(360);
    expect(defaultStage.blastZone.bottom).toBe(940);
    expect(triPlatformStage.platforms[1].height).toBe(28);
  });
});
