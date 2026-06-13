export const FIGHTER_SHEETS = ["blue", "orange", "violet"];

export const FIGHTER_ANIMS = Object.freeze({
  idle: [0, 1, 0, 2],
  run: [3, 4, 5, 4],
  jump: [6],
  fall: [7],
  light: [8, 9, 10],
  heavy: [11, 12, 13, 14],
  up: [15, 16, 17],
  special: [18, 19, 20, 21],
  dodge: [22, 23],
  shield: [24, 25],
  hurt: [26, 27],
  launched: [28, 29],
  respawn: [30, 31, 32],
  ko: [33, 34],
  victory: [35, 36, 37, 36]
});

export const EFFECT_ANIMS = Object.freeze({
  hitSpark: 0,
  heavyImpact: 1,
  jumpPuff: 2,
  projectileTrail: 3,
  shieldShimmer: 4,
  respawnBurst: 5,
  koStreak: 6
});

const LOOPING_FIGHTER_ANIMS = new Set(["idle", "run", "victory", "shield"]);

export function loadGameAssets(scene) {
  for (const name of FIGHTER_SHEETS) {
    scene.load.spritesheet(`fighter:${name}`, `/assets/fighters/${name}.png`, {
      frameWidth: 64,
      frameHeight: 80
    });
  }

  scene.load.spritesheet("effects", "/assets/effects/effects.png", {
    frameWidth: 48,
    frameHeight: 48
  });
  scene.load.image("stage:city-beach", "/assets/stage/city-beach.png");
  scene.load.spritesheet("ui:portraits", "/assets/ui/portraits.png", {
    frameWidth: 64,
    frameHeight: 64
  });
}

export function createGameAnimations(scene) {
  for (const palette of FIGHTER_SHEETS) {
    for (const [name, frames] of Object.entries(FIGHTER_ANIMS)) {
      const key = `${palette}:${name}`;
      if (scene.anims.exists(key)) continue;

      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(`fighter:${palette}`, { frames }),
        frameRate: frames.length <= 1 ? 1 : 10,
        repeat: LOOPING_FIGHTER_ANIMS.has(name) ? -1 : 0
      });
    }
  }

  for (const [name, row] of Object.entries(EFFECT_ANIMS)) {
    const key = `effect:${name}`;
    if (scene.anims.exists(key)) continue;

    const firstFrame = row * 4;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers("effects", {
        frames: [firstFrame, firstFrame + 1, firstFrame + 2, firstFrame + 3]
      }),
      frameRate: 14,
      repeat: 0
    });
  }
}
