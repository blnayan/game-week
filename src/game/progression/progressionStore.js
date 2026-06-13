const KEY = "pixel-arena-progress";
const DEFAULT_PROGRESSION = { xp: 0, level: 1, palettes: ["blue", "orange"] };

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

function normalizeProgression(value = DEFAULT_PROGRESSION) {
  const saved = value && typeof value === "object" ? value : {};
  const savedXp = Number(saved.xp);
  const xp = Number.isFinite(savedXp) && savedXp > 0 ? Math.floor(savedXp) : 0;
  const savedPalettes = Array.isArray(saved.palettes) ? saved.palettes.filter((palette) => typeof palette === "string") : [];
  const palettes = [...new Set([...DEFAULT_PROGRESSION.palettes, ...savedPalettes])];

  return {
    xp,
    level: 1 + Math.floor(xp / 300),
    palettes
  };
}
