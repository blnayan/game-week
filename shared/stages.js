export const DEFAULT_STAGE_ID = "cosmic-floating";
export const TRI_PLATFORM_STAGE_ID = "tri-platform";
export const TRI_PLATFORM_UNLOCK_LEVEL = 10;

const DEFAULT_PLATFORM = { id: "main", x: 200, y: 420, width: 880, height: 36 };

export const STAGE_DEFINITIONS = Object.freeze({
  [DEFAULT_STAGE_ID]: Object.freeze({
    id: DEFAULT_STAGE_ID,
    name: "Cosmic Floating",
    unlockLevel: 1,
    mainPlatformId: "main",
    platform: DEFAULT_PLATFORM,
    platforms: Object.freeze([DEFAULT_PLATFORM]),
    blastZone: { left: -180, right: 1460, top: -260, bottom: 940 },
    spawnA: { x: 360, y: 330, facing: 1 },
    spawnB: { x: 920, y: 330, facing: -1 }
  }),
  [TRI_PLATFORM_STAGE_ID]: Object.freeze({
    id: TRI_PLATFORM_STAGE_ID,
    name: "Tri Platform",
    unlockLevel: TRI_PLATFORM_UNLOCK_LEVEL,
    mainPlatformId: "main",
    platform: { id: "main", x: 200, y: 540, width: 880, height: 36 },
    platforms: Object.freeze([
      { id: "main", x: 200, y: 540, width: 880, height: 36 },
      { id: "left", x: 150, y: 460, width: 260, height: 28 },
      { id: "top", x: 485, y: 380, width: 310, height: 28 },
      { id: "right", x: 870, y: 460, width: 260, height: 28 }
    ]),
    blastZone: { left: -180, right: 1460, top: -260, bottom: 980 },
    spawnA: { x: 430, y: 450, facing: 1 },
    spawnB: { x: 850, y: 450, facing: -1 }
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
