export const FIGHTER_SHEETS = ["blue", "orange", "violet"];
export const FIGHTER_FRAME_WIDTH = 128;
export const FIGHTER_FRAME_HEIGHT = 128;
export const FIGHTER_FRAME_BASELINE = 108;

export const FIGHTER_ANIMS = Object.freeze({
  idle: [0, 1],
  run: [2, 3, 4, 5],
  jump: [6],
  fall: [6],
  light: [7],
  dive: [8],
  heavy: [9, 10],
  hurt: [10],
  launched: [6],
  respawn: [6, 0, 1],
  ko: [8],
  victory: [0, 1]
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

const LOOPING_FIGHTER_ANIMS = new Set(["idle", "run", "victory"]);

export function loadGameAssets(scene) {
  for (const name of FIGHTER_SHEETS) {
    scene.load.spritesheet(`fighter:${name}`, `/assets/fighters/${name}.png`, {
      frameWidth: FIGHTER_FRAME_WIDTH,
      frameHeight: FIGHTER_FRAME_HEIGHT
    });
  }

  scene.load.spritesheet("effects", "/assets/effects/effects.png", {
    frameWidth: 48,
    frameHeight: 48
  });
  scene.load.image("stage:cosmic-floating", "/assets/stage/cosmic-floating-arena.png");
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
