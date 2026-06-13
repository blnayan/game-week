import { STAGE } from "./constants.js";
import { createEmptyInput } from "./match.js";

const DIFFICULTY = {
  easy: { attackRange: 70, specialRange: 150 },
  normal: { attackRange: 86, specialRange: 190 },
  hard: { attackRange: 100, specialRange: 230 }
};

const PULSE_MS = 120;

export function chooseCpuInput(match, cpuId = "p2", difficulty = "normal") {
  const input = createEmptyInput();
  const cpu = match?.fighters?.[cpuId];
  const player = match?.fighters?.[cpuId === "p1" ? "p2" : "p1"];

  if (!hasPosition(cpu) || !hasPosition(player)) {
    return input;
  }

  const profile = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  const dx = player.x - cpu.x;
  const distance = Math.abs(dx);
  const shouldPulse = Math.floor((match.elapsedMs ?? 0) / PULSE_MS) % 2 === 0;

  if (cpu.y > STAGE.platform.y + 80) {
    input.jump = shouldPulse;
    input[dx > 0 ? "right" : "left"] = true;
    return input;
  }

  if (distance > profile.attackRange) {
    input[dx > 0 ? "right" : "left"] = true;
  }

  const canAttack = (cpu.attackCooldownMs ?? 0) === 0 && shouldPulse;

  if (canAttack && distance <= profile.attackRange) {
    input.light = true;
  } else if (canAttack && distance <= profile.specialRange && difficulty !== "easy") {
    input.special = true;
  }

  return input;
}

function hasPosition(fighter) {
  return Number.isFinite(fighter?.x) && Number.isFinite(fighter?.y);
}
