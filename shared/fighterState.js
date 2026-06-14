import { MATCH, PHYSICS } from "./constants.js";

export const FighterStates = Object.freeze({
  Idle: "Idle",
  Run: "Run",
  Jump: "Jump",
  Fall: "Fall",
  AttackLight: "AttackLight",
  AttackHeavy: "AttackHeavy",
  DiveAttack: "DiveAttack",
  Hitstun: "Hitstun",
  Launched: "Launched",
  Respawn: "Respawn",
  KO: "KO",
  Victory: "Victory"
});

export function createFighter(id, x, y, facing = 1, palette = "blue") {
  return {
    id,
    palette,
    x,
    y,
    spawn: { x, y, facing },
    width: 48,
    height: 78,
    facing,
    velocity: { x: 0, y: 0 },
    state: FighterStates.Idle,
    stateTimerMs: 0,
    onGround: true,
    jumpsRemaining: 2,
    jumpHeld: false,
    attackHeld: false,
    downHeld: false,
    damage: 0,
    stocks: MATCH.startingStocks,
    invulnerableMs: 0,
    attackCooldownMs: 0,
    activeAttack: null,
    stats: { kos: 0, falls: 0, damageDealt: 0 }
  };
}

export function isTimedActionState(state) {
  return [
    FighterStates.AttackLight,
    FighterStates.AttackHeavy,
    FighterStates.DiveAttack
  ].includes(state);
}

export function canControl(fighter) {
  if (isTimedActionState(fighter.state) && fighter.stateTimerMs > 0) {
    return false;
  }

  return ![
    FighterStates.Hitstun,
    FighterStates.Launched,
    FighterStates.Respawn,
    FighterStates.KO,
    FighterStates.Victory
  ].includes(fighter.state);
}

export function setFighterState(fighter, state, durationMs = 0) {
  fighter.state = state;
  fighter.stateTimerMs = durationMs;
}

export function applyInputState(fighter, input) {
  const jumpPressed = Boolean(input.jump);
  const freshJumpPress = jumpPressed && !fighter.jumpHeld;
  fighter.jumpHeld = jumpPressed;

  if (!canControl(fighter)) return;

  const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
  if (horizontal !== 0) {
    fighter.facing = horizontal;
    fighter.velocity.x = horizontal * (fighter.onGround ? PHYSICS.runSpeed : PHYSICS.airSpeed);
    if (fighter.onGround) setFighterState(fighter, FighterStates.Run);
  } else if (fighter.onGround) {
    fighter.velocity.x *= PHYSICS.friction;
    if (Math.abs(fighter.velocity.x) < 0.2) fighter.velocity.x = 0;
    setFighterState(fighter, FighterStates.Idle);
  }

  if (freshJumpPress && fighter.jumpsRemaining > 0) {
    fighter.velocity.y = PHYSICS.jumpVelocity;
    fighter.onGround = false;
    fighter.jumpsRemaining -= 1;
    setFighterState(fighter, FighterStates.Jump);
  }

}

export function enterHitstun(fighter, knockback, durationMs) {
  fighter.velocity.x = knockback.x;
  fighter.velocity.y = knockback.y;
  fighter.onGround = false;
  setFighterState(fighter, FighterStates.Hitstun, durationMs);
}

export function tickFighterState(fighter, dtMs) {
  if (fighter.attackCooldownMs > 0) fighter.attackCooldownMs = Math.max(0, fighter.attackCooldownMs - dtMs);
  if (fighter.invulnerableMs > 0) fighter.invulnerableMs = Math.max(0, fighter.invulnerableMs - dtMs);
  if (fighter.stateTimerMs > 0) fighter.stateTimerMs = Math.max(0, fighter.stateTimerMs - dtMs);

  if (
    [
      FighterStates.Hitstun,
      FighterStates.Respawn
    ].includes(fighter.state) &&
    fighter.stateTimerMs === 0
  ) {
    setFighterState(fighter, fighter.onGround ? FighterStates.Idle : FighterStates.Fall);
  }

  if (isTimedActionState(fighter.state) && fighter.stateTimerMs === 0) {
    setFighterState(fighter, fighter.onGround ? FighterStates.Idle : FighterStates.Fall);
  }

  if (!fighter.onGround && fighter.velocity.y > 0 && fighter.state === FighterStates.Jump) {
    setFighterState(fighter, FighterStates.Fall);
  }
}
