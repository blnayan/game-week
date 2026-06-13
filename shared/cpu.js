import { STAGE } from "./constants.js";
import { createEmptyInput } from "./match.js";

const DIFFICULTY = {
  easy: { attackRange: 70, specialRange: 150, dodgeChance: 0.02 },
  normal: { attackRange: 86, specialRange: 190, dodgeChance: 0.05 },
  hard: { attackRange: 100, specialRange: 230, dodgeChance: 0.1 }
};

export function chooseCpuInput(match, cpuId = "p2", difficulty = "normal") {
  const cpu = match.fighters[cpuId];
  const player = match.fighters[cpuId === "p1" ? "p2" : "p1"];
  const profile = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  const input = createEmptyInput();
  const dx = player.x - cpu.x;
  const distance = Math.abs(dx);

  if (cpu.y > STAGE.platform.y + 80) {
    input.jump = true;
    input[dx > 0 ? "right" : "left"] = true;
    return input;
  }

  if (distance > profile.attackRange) {
    input[dx > 0 ? "right" : "left"] = true;
  }

  if (distance <= profile.attackRange) {
    input.light = true;
  } else if (distance <= profile.specialRange && difficulty !== "easy") {
    input.special = true;
  }

  if (Math.random() < profile.dodgeChance) {
    input.dodge = true;
    input.light = false;
    input.special = false;
  }

  return input;
}
