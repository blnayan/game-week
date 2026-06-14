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
  dive: {
    state: "DiveAttack",
    damage: 9,
    cooldownMs: 520,
    activeMs: 160,
    hitstunMs: 220,
    knockback: { x: 4.5, y: 8 },
    hitbox: { offsetX: -26, offsetY: 62, width: 52, height: 42 },
    diveVelocityY: 17
  }
});
