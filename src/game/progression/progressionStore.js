const KEY = "pixel-arena-progress";

export function loadProgression() {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return { xp: 0, level: 1, palettes: ["blue", "orange"] };
  return JSON.parse(raw);
}

export function awardMatchXp(amount) {
  const progress = loadProgression();
  progress.xp += amount;
  progress.level = 1 + Math.floor(progress.xp / 300);
  if (progress.xp >= 300 && !progress.palettes.includes("violet")) progress.palettes.push("violet");
  window.localStorage.setItem(KEY, JSON.stringify(progress));
  return progress;
}
