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
    expect(STAGE.blastZone).toEqual({ left: -180, right: 1460, top: -260, bottom: 940 });
    expect(STAGE.spawnA).toEqual({ x: 360, y: 330, facing: 1 });
    expect(STAGE.spawnB).toEqual({ x: 920, y: 330, facing: -1 });
  });

  it("defines the approved tri-platform stage geometry", () => {
    const stage = STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID];

    expect(stage).toMatchObject({
      id: "tri-platform",
      name: "Tri Platform",
      unlockLevel: 10,
      mainPlatformId: "main"
    });
    expect(stage.platforms).toEqual([
      { id: "main", x: 100, y: 554, width: 1080, height: 40 },
      { id: "left", x: 140, y: 374, width: 316, height: 40 },
      { id: "top", x: 472, y: 178, width: 336, height: 42 },
      { id: "right", x: 830, y: 374, width: 316, height: 40 }
    ]);
    expect(stage.blastZone).toEqual({ left: -180, right: 1460, top: -260, bottom: 980 });
    expect(stage.spawnA).toEqual({ x: 430, y: 450, facing: 1 });
    expect(stage.spawnB).toEqual({ x: 850, y: 450, facing: -1 });
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
    expect(triPlatformStage.platforms[1].height).toBe(40);
  });
});
