import { ATTACKS } from "./attacks.js";
import { MATCH, PHYSICS } from "./constants.js";
import {
  FighterStates,
  applyInputState,
  canControl,
  createFighter,
  enterHitstun,
  setFighterState,
  tickFighterState
} from "./fighterState.js";
import { getStageDefinition, normalizeStageId } from "./stages.js";

export function createMatch(mode = "cpu", options = {}) {
  const stageId = normalizeStageId(options.stageId);
  const stage = getStageDefinition(stageId);

  return {
    mode,
    stageId,
    status: "playing",
    winnerId: null,
    endReason: null,
    elapsedMs: 0,
    effects: [],
    inputs: {
      p1: createEmptyInput(),
      p2: createEmptyInput()
    },
    fighters: {
      p1: createFighter("p1", stage.spawnA.x, stage.spawnA.y, stage.spawnA.facing, "blue"),
      p2: createFighter("p2", stage.spawnB.x, stage.spawnB.y, stage.spawnB.facing, "orange")
    }
  };
}

export function createEmptyInput() {
  return {
    left: false,
    right: false,
    down: false,
    jump: false,
    light: false,
    heavy: false
  };
}

export function queueInput(match, fighterId, input) {
  match.inputs[fighterId] = { ...createEmptyInput(), ...input };
}

export function forfeitMatch(match, fighterId, reason = "forfeit") {
  if (!match || match.status === "complete" || !match.fighters?.[fighterId]) return match;

  const opponentId = fighterId === "p1" ? "p2" : "p1";
  const forfeitingFighter = match.fighters[fighterId];
  const winningFighter = match.fighters[opponentId];

  forfeitingFighter.stocks = 0;
  forfeitingFighter.activeAttack = null;
  forfeitingFighter.stats.falls += 1;
  winningFighter.stats.kos += 1;
  setFighterState(forfeitingFighter, FighterStates.KO);
  setFighterState(winningFighter, FighterStates.Victory);
  match.status = "complete";
  match.winnerId = opponentId;
  match.endReason = reason;

  return match;
}

export function stepMatch(match, dtMs) {
  if (match.status !== "playing") return match;
  match.elapsedMs += dtMs;
  match.effects = [];

  for (const fighterId of ["p1", "p2"]) {
    const fighter = match.fighters[fighterId];
    const input = match.inputs[fighterId];
    const wasOnGround = fighter.onGround;
    applyInputState(fighter, input);
    tryStartAttack(fighter, input, wasOnGround);
  }

  resolveAttack(match, "p1", "p2");
  resolveAttack(match, "p2", "p1");

  for (const fighterId of ["p1", "p2"]) {
    integrateFighter(match, match.fighters[fighterId], dtMs);
    tickFighterState(match.fighters[fighterId], dtMs);
    handleBlastZone(match, fighterId);
  }

  return match;
}

function tryStartAttack(fighter, input, wasOnGround) {
  const downPressed = Boolean(input.down);
  const freshDownPress = downPressed && !fighter.downHeld;
  fighter.downHeld = downPressed;

  const attackKey = input.light ? "light" : input.heavy ? "heavy" : freshDownPress && !wasOnGround ? "dive" : null;
  const lightOrHeavyPressed = Boolean(input.light || input.heavy);
  const freshAttackPress = attackKey === "dive" || (lightOrHeavyPressed && !fighter.attackHeld);
  fighter.attackHeld = lightOrHeavyPressed;

  if (!freshAttackPress || fighter.attackCooldownMs > 0 || !canControl(fighter)) {
    return;
  }

  const attack = ATTACKS[attackKey];
  fighter.activeAttack = { key: attackKey, remainingMs: attack.activeMs, hasHit: false };
  fighter.attackCooldownMs = attack.cooldownMs;
  if (attackKey === "dive") {
    fighter.velocity.y = Math.max(fighter.velocity.y, attack.diveVelocityY);
  }
  setFighterState(fighter, attack.state, attack.activeMs);
}

function resolveAttack(match, attackerId, defenderId) {
  const attacker = match.fighters[attackerId];
  const defender = match.fighters[defenderId];
  if (!attacker.activeAttack || attacker.activeAttack.hasHit || defender.invulnerableMs > 0) return;

  const attack = ATTACKS[attacker.activeAttack.key];
  if (!attack || attacker.state !== attack.state || attacker.stateTimerMs <= 0) {
    attacker.activeAttack = null;
    return;
  }

  if (!rectsOverlap(getAttackRect(attacker, attack), getFighterRect(defender))) return;

  const scale = 1 + defender.damage / 100;
  defender.damage += attack.damage;
  attacker.stats.damageDealt += attack.damage;
  attacker.activeAttack.hasHit = true;
  enterHitstun(
    defender,
    { x: attack.knockback.x * attacker.facing * scale, y: attack.knockback.y * scale },
    attack.hitstunMs
  );
  match.effects.push({ type: attack.key === "heavy" ? "heavyImpact" : "hitSpark", x: defender.x, y: defender.y - 30 });
}

function integrateFighter(match, fighter, dtMs) {
  const stage = getStageDefinition(match.stageId);
  const dtScale = dtMs / 16.67;
  const previousFeet = fighter.y;
  fighter.velocity.y = Math.min(PHYSICS.maxFallSpeed, fighter.velocity.y + PHYSICS.gravity * dtScale);
  fighter.x += fighter.velocity.x * dtScale;
  fighter.y += fighter.velocity.y * dtScale;

  if (fighter.activeAttack) {
    fighter.activeAttack.remainingMs -= dtMs;
    if (fighter.activeAttack.remainingMs <= 0) fighter.activeAttack = null;
  }

  const platform = findLandingPlatform(stage, fighter, previousFeet);
  if (platform) {
    fighter.y = platform.y;
    fighter.velocity.y = 0;
    fighter.onGround = true;
    fighter.jumpsRemaining = 2;
  } else {
    fighter.onGround = false;
  }
}

function findLandingPlatform(stage, fighter, previousFeet) {
  if (fighter.velocity.y < 0) return null;

  return [...stage.platforms]
    .sort((a, b) => a.y - b.y)
    .find((platform) => {
      const withinPlatformX = fighter.x >= platform.x && fighter.x <= platform.x + platform.width;
      const wasAbovePlatform = previousFeet <= platform.y;
      const crossedPlatformTop = fighter.y >= platform.y;
      const withinLandingWindow = fighter.y <= platform.y + 30;
      return withinPlatformX && wasAbovePlatform && crossedPlatformTop && withinLandingWindow;
    });
}

function handleBlastZone(match, fighterId) {
  const fighter = match.fighters[fighterId];
  const zone = getStageDefinition(match.stageId).blastZone;
  const outside = fighter.x < zone.left || fighter.x > zone.right || fighter.y < zone.top || fighter.y > zone.bottom;
  if (!outside || fighter.state === FighterStates.Respawn || fighter.state === FighterStates.KO) return;

  fighter.stocks -= 1;
  fighter.stats.falls += 1;
  fighter.activeAttack = null;
  const opponentId = fighterId === "p1" ? "p2" : "p1";
  match.fighters[opponentId].stats.kos += 1;

  if (fighter.stocks <= 0) {
    fighter.stocks = 0;
    setFighterState(fighter, FighterStates.KO);
    match.status = "complete";
    match.winnerId = opponentId;
    match.endReason = "stocks";
    setFighterState(match.fighters[opponentId], FighterStates.Victory);
    return;
  }

  fighter.x = fighter.spawn.x;
  fighter.y = fighter.spawn.y;
  fighter.velocity.x = 0;
  fighter.velocity.y = 0;
  fighter.damage = 0;
  fighter.invulnerableMs = MATCH.invulnerableMs;
  setFighterState(fighter, FighterStates.Respawn, MATCH.respawnMs);
}

function getFighterRect(fighter) {
  return { x: fighter.x - fighter.width / 2, y: fighter.y - fighter.height, width: fighter.width, height: fighter.height };
}

function getAttackRect(fighter, attack) {
  const box = attack.hitbox;
  const x = fighter.facing === 1 ? fighter.x + box.offsetX : fighter.x - box.offsetX - box.width;
  return { x, y: fighter.y - fighter.height + box.offsetY, width: box.width, height: box.height };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
