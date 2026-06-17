import { canCreateStageAtLevel } from "../../../shared/stages.js";

const KEY = "pixel-arena-progress";
const DEFAULT_PROGRESSION = { xp: 0, level: 1, palettes: ["blue", "orange"] };
const VIOLET_UNLOCK_XP = 300;

export function loadProgression() {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return normalizeProgression();

  try {
    return normalizeProgression(JSON.parse(raw));
  } catch {
    return normalizeProgression();
  }
}

export function awardMatchXp(amount) {
  const progress = loadProgression();
  const gained = Number(amount);
  progress.xp += Number.isFinite(gained) && gained > 0 ? Math.floor(gained) : 0;
  progress.level = 1 + Math.floor(progress.xp / 300);
  if (progress.xp >= 300 && !progress.palettes.includes("violet")) progress.palettes.push("violet");
  window.localStorage.setItem(KEY, JSON.stringify(progress));
  return progress;
}

export function selectPlayerPalette(progress = loadProgression()) {
  return progress.palettes.includes("violet") ? "violet" : "blue";
}

export function canUseStage(stageId, progress = loadProgression()) {
  return canCreateStageAtLevel(stageId, progress.level).ok;
}

function normalizeProgression(value = DEFAULT_PROGRESSION) {
  const saved = value && typeof value === "object" ? value : {};
  const savedXp = Number(saved.xp);
  const xp = Number.isFinite(savedXp) && savedXp > 0 ? Math.floor(savedXp) : 0;
  const palettes = [...DEFAULT_PROGRESSION.palettes];
  if (xp >= VIOLET_UNLOCK_XP) palettes.push("violet");

  return {
    xp,
    level: 1 + Math.floor(xp / 300),
    palettes
  };
}
