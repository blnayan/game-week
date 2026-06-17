import { createEmptyInput } from "./match.js";
import { getMainPlatform } from "./stages.js";

const DIFFICULTY = {
  easy: { lightRange: 70, heavyRange: 0 },
  normal: { lightRange: 86, heavyRange: 108 },
  hard: { lightRange: 100, heavyRange: 128 }
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
  const dy = player.y - cpu.y;
  const distance = Math.abs(dx);
  const pulseWindow = Math.floor((match.elapsedMs ?? 0) / PULSE_MS);
  const shouldPulse = pulseWindow % 2 === 0;
  const mainPlatform = getMainPlatform(match.stageId);

  if (cpu.y > mainPlatform.y + 80) {
    input.jump = shouldPulse;
    input[dx > 0 ? "right" : "left"] = true;
    return input;
  }

  if (!cpu.onGround && shouldPulse && Math.abs(dx) <= 70 && dy > 40) {
    input.down = true;
    return input;
  }

  if (distance > profile.lightRange) {
    input[dx > 0 ? "right" : "left"] = true;
  }

  const canAttack = (cpu.attackCooldownMs ?? 0) === 0 && shouldPulse;

  if (canAttack && profile.heavyRange > 0 && distance <= profile.heavyRange && pulseWindow % 4 === 2) {
    input.heavy = true;
  } else if (canAttack && distance <= profile.lightRange) {
    input.light = true;
  }

  return input;
}

function hasPosition(fighter) {
  return Number.isFinite(fighter?.x) && Number.isFinite(fighter?.y);
}
