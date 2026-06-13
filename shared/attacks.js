export const ATTACKS = Object.freeze({
  light: {
    state: "AttackLight",
    damage: 7,
    cooldownMs: 260,
    activeMs: 90,
    hitstunMs: 180,
    knockback: { x: 7.5, y: -4.5 },
    hitbox: { offsetX: 38, offsetY: 10, width: 50, height: 34 }
  },
  heavy: {
    state: "AttackHeavy",
    damage: 14,
    cooldownMs: 620,
    activeMs: 140,
    hitstunMs: 280,
    knockback: { x: 11, y: -7 },
    hitbox: { offsetX: 42, offsetY: 4, width: 62, height: 44 }
  },
  up: {
    state: "AttackUp",
    damage: 10,
    cooldownMs: 520,
    activeMs: 120,
    hitstunMs: 230,
    knockback: { x: 3.5, y: -12 },
    hitbox: { offsetX: -12, offsetY: -54, width: 72, height: 60 }
  },
  special: {
    state: "Special",
    damage: 11,
    cooldownMs: 760,
    activeMs: 180,
    hitstunMs: 260,
    knockback: { x: 9, y: -5.5 },
    hitbox: { offsetX: 48, offsetY: 2, width: 96, height: 38 }
  }
});
