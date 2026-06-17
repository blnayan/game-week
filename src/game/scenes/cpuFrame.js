import { chooseCpuInput } from "../../../shared/cpu.js";
import { queueInput, stepMatch } from "../../../shared/match.js";

export const CPU_SIMULATION_STEP_MS = 1000 / 60;
export const CPU_MAX_CATCH_UP_MS = 100;

export function stepCpuMatchFrame(match, playerInput, deltaMs, remainderMs = 0, difficulty = "normal") {
  const numericDelta = Number(deltaMs);
  const safeDelta = Number.isFinite(numericDelta) ? Math.max(0, numericDelta) : 0;
  let accumulatedMs = remainderMs + Math.min(safeDelta, CPU_MAX_CATCH_UP_MS);

  while (accumulatedMs + 0.001 >= CPU_SIMULATION_STEP_MS) {
    queueInput(match, "p1", playerInput);
    queueInput(match, "p2", chooseCpuInput(match, "p2", difficulty));
    stepMatch(match, CPU_SIMULATION_STEP_MS);
    accumulatedMs -= CPU_SIMULATION_STEP_MS;
  }

  return Math.max(0, accumulatedMs);
}
