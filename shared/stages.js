export const DEFAULT_STAGE_ID = "cosmic-floating";
export const TRI_PLATFORM_STAGE_ID = "tri-platform";
export const TRI_PLATFORM_UNLOCK_LEVEL = 10;

const DEFAULT_MAIN_PLATFORM = Object.freeze({ id: "main", x: 200, y: 420, width: 880, height: 36 });
const TRI_MAIN_PLATFORM = Object.freeze({ id: "main", x: 200, y: 540, width: 880, height: 36 });

export const STAGE_DEFINITIONS = Object.freeze({
  [DEFAULT_STAGE_ID]: Object.freeze({
    id: DEFAULT_STAGE_ID,
    name: "Cosmic Floating",
    unlockLevel: 1,
    mainPlatformId: "main",
    platform: DEFAULT_MAIN_PLATFORM,
    platforms: Object.freeze([DEFAULT_MAIN_PLATFORM]),
    blastZone: Object.freeze({ left: -180, right: 1460, top: -260, bottom: 940 }),
    spawnA: Object.freeze({ x: 360, y: 330, facing: 1 }),
    spawnB: Object.freeze({ x: 920, y: 330, facing: -1 })
  }),
  [TRI_PLATFORM_STAGE_ID]: Object.freeze({
    id: TRI_PLATFORM_STAGE_ID,
    name: "Tri Platform",
    unlockLevel: TRI_PLATFORM_UNLOCK_LEVEL,
    mainPlatformId: "main",
    platform: TRI_MAIN_PLATFORM,
    platforms: Object.freeze([
      TRI_MAIN_PLATFORM,
      Object.freeze({ id: "left", x: 150, y: 460, width: 260, height: 28 }),
      Object.freeze({ id: "top", x: 485, y: 380, width: 310, height: 28 }),
      Object.freeze({ id: "right", x: 870, y: 460, width: 260, height: 28 })
    ]),
    blastZone: Object.freeze({ left: -180, right: 1460, top: -260, bottom: 980 }),
    spawnA: Object.freeze({ x: 430, y: 450, facing: 1 }),
    spawnB: Object.freeze({ x: 850, y: 450, facing: -1 })
  })
});

export function normalizeStageId(stageId) {
  const id = typeof stageId === "string" ? stageId : "";
  return STAGE_DEFINITIONS[id] ? id : DEFAULT_STAGE_ID;
}

export function getStageDefinition(stageId = DEFAULT_STAGE_ID) {
  return STAGE_DEFINITIONS[normalizeStageId(stageId)];
}

export function getMainPlatform(stageId = DEFAULT_STAGE_ID) {
  const stage = getStageDefinition(stageId);
  return stage.platforms.find((platform) => platform.id === stage.mainPlatformId) ?? stage.platform;
}

export function canCreateStageAtLevel(stageId = DEFAULT_STAGE_ID, level = 1) {
  const stage = getStageDefinition(stageId);
  const numericLevel = Number(level);
  const playerLevel = Number.isFinite(numericLevel) ? Math.floor(numericLevel) : 1;
  if (playerLevel < stage.unlockLevel) {
    return { ok: false, error: `Stage unlocks at level ${stage.unlockLevel}` };
  }
  return { ok: true };
}
