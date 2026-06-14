import { FighterStates } from "../../../shared/fighterState.js";

const STATE_ANIMS = Object.freeze({
  [FighterStates.Idle]: "idle",
  [FighterStates.Run]: "run",
  [FighterStates.Jump]: "jump",
  [FighterStates.Fall]: "fall",
  [FighterStates.AttackLight]: "light",
  [FighterStates.AttackHeavy]: "heavy",
  [FighterStates.DiveAttack]: "dive",
  [FighterStates.Hitstun]: "hurt",
  [FighterStates.Launched]: "launched",
  [FighterStates.Respawn]: "respawn",
  [FighterStates.KO]: "ko",
  [FighterStates.Victory]: "victory"
});

export function animationKey(fighter) {
  return `${fighter.palette}:${STATE_ANIMS[fighter.state] || "idle"}`;
}
