import { getStageDefinition } from "./stages.js";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TICK_RATE = 60;
export const FIXED_DT_MS = 1000 / TICK_RATE;

export const STAGE = getStageDefinition();

export const PHYSICS = {
  gravity: 0.75,
  runSpeed: 5.8,
  airSpeed: 4.4,
  jumpVelocity: -15.5,
  fastFallSpeed: 16,
  friction: 0.82,
  airFriction: 0.96,
  maxFallSpeed: 18
};

export const MATCH = {
  startingStocks: 3,
  matchSeconds: 180,
  respawnMs: 1200,
  invulnerableMs: 1800,
  dodgeMs: 180,
  shieldMs: 140
};
