# Distinct 128px Fighter Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 96x80 shared-silhouette fighter sheets with three distinct original 128x128 fighter sprite sheets and update the Phaser loader/render constants to match.

**Architecture:** Keep the existing combat state machine and animation frame indexes unchanged. Add a deterministic Node asset generator that writes committed transparent PNG sprite sheets, then update the render manifest and tests to consume 128x128 frames with a stable foot baseline.

**Tech Stack:** JavaScript ES modules, Node built-ins (`fs`, `zlib`), Phaser spritesheets, Vitest, PNG files in `public/assets/fighters/`.

---

## File Structure

- Create `scripts/generate-fighter-sprites.mjs`: deterministic PNG sprite-sheet generator using only Node built-ins. It owns palette definitions, frame geometry, per-character silhouettes, pose definitions, and a tiny PNG encoder.
- Modify `public/assets/fighters/blue.png`: generated 4864x128 sheet for the headband martial artist.
- Modify `public/assets/fighters/orange.png`: generated 4864x128 sheet for the bulky power fighter.
- Modify `public/assets/fighters/violet.png`: generated 4864x128 sheet for the agile duelist/ninja.
- Modify `src/game/render/assetManifest.js`: update fighter frame constants to 128x128 and add `FIGHTER_FRAME_BASELINE`.
- Modify `src/game/scenes/MatchScene.js`: anchor sprites to the shared baseline instead of bottom edge.
- Modify `src/game/render/renderScale.js`: adjust fighter scale so 96px body art remains close to the current on-screen size.
- Modify `src/game/render/assetManifest.test.js`: assert 128x128 load options, 38-frame sheet dimensions, and baseline.
- Modify `src/game/render/renderScale.test.js`: assert the new render scale.

## Task 1: Lock The Manifest Test To 128px Frames

**Files:**
- Modify: `src/game/render/assetManifest.test.js`

- [ ] **Step 1: Write the failing test**

Replace the fighter spritesheet expectation block with this code:

```js
for (const name of FIGHTER_SHEETS) {
  const sheet = spritesheets.get(`fighter:${name}`);
  expect(sheet.options).toMatchObject({
    frameWidth: 128,
    frameHeight: 128
  });
  expect(readPngSize(`public${sheet.path}`).width).toBe(FIGHTER_FRAME_WIDTH * 38);
  expect(readPngSize(`public${sheet.path}`).height).toBe(FIGHTER_FRAME_HEIGHT);
}
```

Add this import to the existing import from `./assetManifest.js`:

```js
FIGHTER_FRAME_BASELINE,
```

Add this new test after the fighter sheet test:

```js
it("uses a shared internal foot baseline for 128px fighter frames", () => {
  expect(FIGHTER_FRAME_BASELINE).toBe(116);
  expect(FIGHTER_FRAME_BASELINE).toBeLessThan(FIGHTER_FRAME_HEIGHT);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/game/render/assetManifest.test.js
```

Expected: FAIL because `FIGHTER_FRAME_BASELINE` is not exported and current frame options are `96x80`.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add src/game/render/assetManifest.test.js
git commit -m "test: expect 128px fighter sprite frames"
```

## Task 2: Generate Distinct 128px Fighter Sheets

**Files:**
- Create: `scripts/generate-fighter-sprites.mjs`
- Modify: `public/assets/fighters/blue.png`
- Modify: `public/assets/fighters/orange.png`
- Modify: `public/assets/fighters/violet.png`

- [ ] **Step 1: Create the deterministic sprite generator**

Create `scripts/generate-fighter-sprites.mjs` with this implementation:

```js
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 128;
const FRAME_COUNT = 38;
const BASELINE = 116;
const SHEET_WIDTH = FRAME_WIDTH * FRAME_COUNT;
const OUT_DIR = resolve("public/assets/fighters");

const ANIM_FRAME_POSES = [
  "idleA", "idleB", "idleC",
  "runA", "runB", "runC",
  "jump", "fall",
  "lightWind", "lightHit", "lightRecover",
  "heavyWind", "heavyHit", "heavyFollow", "heavyRecover",
  "upWind", "upHit", "upRecover",
  "specialWind", "specialHit", "specialFollow", "specialRecover",
  "dodgeA", "dodgeB",
  "shieldA", "shieldB",
  "hurtA", "hurtB",
  "launchedA", "launchedB",
  "respawnA", "respawnB", "respawnC",
  "koA", "koB",
  "victoryA", "victoryB", "victoryC"
];

const PALETTES = {
  blue: {
    outline: "#151013",
    hair: "#2d2a2d",
    hairLight: "#4b454a",
    skin: "#d8894c",
    skinLight: "#f0b078",
    skinShadow: "#8c4b2c",
    cloth: "#222124",
    clothLight: "#3b383c",
    shirt: "#ded5c8",
    accent: "#d22a20",
    accentDark: "#8f1715",
    sole: "#f1eee8",
    effect: "#ff6a3d",
    name: "headband"
  },
  orange: {
    outline: "#17100c",
    hair: "#3a2218",
    hairLight: "#6b3920",
    skin: "#b96531",
    skinLight: "#f0a35b",
    skinShadow: "#7b381f",
    cloth: "#3a2c22",
    clothLight: "#68452a",
    shirt: "#f0c15d",
    accent: "#f07a24",
    accentDark: "#a74018",
    sole: "#f7d86b",
    effect: "#ffd25a",
    name: "power"
  },
  violet: {
    outline: "#101023",
    hair: "#221f47",
    hairLight: "#5c4ca1",
    skin: "#c98264",
    skinLight: "#e0a184",
    skinShadow: "#7a443b",
    cloth: "#241b3b",
    clothLight: "#46316e",
    shirt: "#d8d3f2",
    accent: "#9a66ff",
    accentDark: "#5a37b5",
    sole: "#c9b8ff",
    effect: "#d36dff",
    name: "duelist"
  }
};

const CHARACTER = {
  blue: { bodyWidth: 26, shoulderWidth: 36, headWidth: 20, headHeight: 18, armWidth: 9, legWidth: 10, bulk: 0, lean: 0 },
  orange: { bodyWidth: 34, shoulderWidth: 46, headWidth: 24, headHeight: 18, armWidth: 13, legWidth: 13, bulk: 1, lean: 0 },
  violet: { bodyWidth: 22, shoulderWidth: 30, headWidth: 18, headHeight: 17, armWidth: 7, legWidth: 8, bulk: -1, lean: 1 }
};

function hexToRgba(hex) {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255
  ];
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function makeCanvas() {
  return Buffer.alloc(SHEET_WIDTH * FRAME_HEIGHT * 4);
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= SHEET_WIDTH || y >= FRAME_HEIGHT) return;
  const offset = (Math.floor(y) * SHEET_WIDTH + Math.floor(x)) * 4;
  const rgba = hexToRgba(color);
  canvas[offset] = rgba[0];
  canvas[offset + 1] = rgba[1];
  canvas[offset + 2] = rgba[2];
  canvas[offset + 3] = rgba[3];
}

function rect(canvas, x, y, width, height, color) {
  for (let py = Math.floor(y); py < Math.floor(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.floor(x + width); px += 1) {
      setPixel(canvas, px, py, color);
    }
  }
}

function line(canvas, x0, y0, x1, y1, thickness, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    rect(canvas, x - thickness / 2, y - thickness / 2, thickness, thickness, color);
  }
}

function diamond(canvas, cx, cy, radiusX, radiusY, color) {
  for (let y = -radiusY; y <= radiusY; y += 1) {
    const width = Math.floor(radiusX * (1 - Math.abs(y) / radiusY));
    rect(canvas, cx - width, cy + y, width * 2 + 1, 1, color);
  }
}

function poseOffsets(pose, character) {
  const base = {
    lean: 0,
    torsoY: 0,
    headX: 0,
    headY: 0,
    leftArm: [-24, 70, -38, 92],
    rightArm: [24, 70, 38, 90],
    leftLeg: [-10, 92, -25, BASELINE],
    rightLeg: [10, 92, 22, BASELINE],
    trail: 0,
    effect: null,
    crouch: 0,
    armBoost: 0
  };

  const p = { ...base };
  if (pose === "idleB") { p.torsoY = -1; p.trail = 1; }
  if (pose === "idleC") { p.torsoY = 1; p.headX = 1; p.trail = -1; }
  if (pose === "runA") { p.lean = 6; p.leftLeg = [-9, 92, -34, BASELINE]; p.rightLeg = [12, 92, 35, BASELINE - 2]; p.leftArm = [-24, 69, -42, 82]; p.rightArm = [22, 68, 42, 84]; p.trail = -2; }
  if (pose === "runB") { p.lean = 4; p.leftLeg = [-8, 93, -12, BASELINE]; p.rightLeg = [12, 93, 18, BASELINE]; p.leftArm = [-23, 70, -32, 90]; p.rightArm = [24, 69, 34, 86]; }
  if (pose === "runC") { p.lean = 7; p.leftLeg = [-8, 92, 32, BASELINE - 2]; p.rightLeg = [12, 92, -30, BASELINE]; p.leftArm = [-22, 68, -42, 84]; p.rightArm = [24, 69, 42, 80]; p.trail = 2; }
  if (pose === "jump") { p.torsoY = -9; p.leftLeg = [-10, 86, -24, BASELINE - 16]; p.rightLeg = [9, 86, 22, BASELINE - 20]; p.leftArm = [-23, 63, -36, 48]; p.rightArm = [23, 63, 35, 48]; p.trail = 3; }
  if (pose === "fall") { p.torsoY = -3; p.lean = -4; p.leftLeg = [-10, 90, -25, BASELINE - 3]; p.rightLeg = [11, 90, 28, BASELINE - 5]; p.leftArm = [-23, 68, -40, 75]; p.rightArm = [23, 68, 40, 77]; p.trail = -3; }
  if (pose === "lightWind") { p.lean = -4; p.rightArm = [22, 68, 12, 82]; p.leftArm = [-23, 69, -40, 88]; }
  if (pose === "lightHit") { p.lean = 8; p.rightArm = [24, 68, 58, 70]; p.leftArm = [-22, 70, -36, 88]; p.effect = ["slash", 59, 69, 12]; }
  if (pose === "lightRecover") { p.lean = 3; p.rightArm = [22, 69, 38, 80]; }
  if (pose === "heavyWind") { p.lean = -10; p.crouch = 3; p.rightArm = [22, 71, -4, 68]; p.leftArm = [-24, 72, -46, 85]; }
  if (pose === "heavyHit") { p.lean = 11; p.rightArm = [25, 70, 66, 76]; p.leftArm = [-22, 72, -36, 88]; p.effect = ["burst", 67, 76, 16]; p.armBoost = 2; }
  if (pose === "heavyFollow") { p.lean = 9; p.rightArm = [24, 71, 56, 88]; p.effect = ["slash", 55, 88, 14]; }
  if (pose === "heavyRecover") { p.lean = 1; p.crouch = 1; }
  if (pose === "upWind") { p.crouch = 5; p.rightArm = [20, 73, 18, 56]; p.leftArm = [-21, 73, -30, 84]; }
  if (pose === "upHit") { p.torsoY = -3; p.rightArm = [20, 64, 28, 24]; p.leftArm = [-21, 67, -14, 38]; p.effect = ["up", 29, 29, 14]; }
  if (pose === "upRecover") { p.torsoY = -1; p.rightArm = [22, 66, 28, 48]; }
  if (pose === "specialWind") { p.lean = -5; p.rightArm = [23, 69, 8, 69]; }
  if (pose === "specialHit") { p.lean = 7; p.rightArm = [23, 69, 60, 68]; p.effect = ["beam", 60, 68, 28]; }
  if (pose === "specialFollow") { p.lean = 4; p.rightArm = [23, 70, 54, 77]; p.effect = ["spark", 58, 76, 12]; }
  if (pose === "specialRecover") { p.lean = 0; p.rightArm = [24, 70, 33, 88]; }
  if (pose === "dodgeA") { p.crouch = 13; p.lean = -12; p.leftArm = [-20, 79, -38, 95]; p.rightArm = [20, 79, 34, 95]; }
  if (pose === "dodgeB") { p.crouch = 15; p.lean = 12; p.leftArm = [-20, 80, -36, 96]; p.rightArm = [20, 80, 38, 96]; }
  if (pose === "shieldA") { p.crouch = 2; p.rightArm = [21, 70, 43, 78]; p.leftArm = [-21, 70, -39, 78]; p.effect = ["shield", 0, 72, 37]; }
  if (pose === "shieldB") { p.crouch = 1; p.rightArm = [21, 70, 42, 80]; p.leftArm = [-21, 70, -38, 80]; p.effect = ["shield", 0, 72, 40]; }
  if (pose === "hurtA") { p.lean = -10; p.headX = -4; p.rightArm = [20, 70, 42, 80]; p.leftArm = [-22, 70, -46, 78]; }
  if (pose === "hurtB") { p.lean = -14; p.headX = -6; p.crouch = 2; p.rightArm = [19, 72, 38, 90]; p.leftArm = [-23, 72, -45, 88]; }
  if (pose === "launchedA") { p.torsoY = -15; p.lean = -18; p.leftLeg = [-8, 82, -28, 95]; p.rightLeg = [10, 82, 26, 92]; p.leftArm = [-20, 58, -42, 48]; p.rightArm = [20, 58, 42, 50]; }
  if (pose === "launchedB") { p.torsoY = -18; p.lean = 18; p.leftLeg = [-8, 80, -26, 91]; p.rightLeg = [10, 80, 28, 94]; p.leftArm = [-20, 55, -39, 48]; p.rightArm = [20, 55, 40, 46]; }
  if (pose === "respawnA") { p.torsoY = -26; p.effect = ["beamVertical", 0, 72, 40]; }
  if (pose === "respawnB") { p.torsoY = -14; p.effect = ["beamVertical", 0, 76, 32]; }
  if (pose === "respawnC") { p.torsoY = -4; p.effect = ["spark", 0, 100, 18]; }
  if (pose === "koA") { p.crouch = 20; p.lean = -24; p.leftLeg = [-8, 104, -32, BASELINE]; p.rightLeg = [10, 104, 32, BASELINE]; }
  if (pose === "koB") { p.crouch = 28; p.lean = -32; p.leftLeg = [-12, 108, -42, BASELINE]; p.rightLeg = [8, 108, 40, BASELINE]; }
  if (pose === "victoryA") { p.torsoY = -2; p.rightArm = [22, 68, 30, 44]; }
  if (pose === "victoryB") { p.torsoY = -5; p.rightArm = [22, 64, 34, 24]; p.effect = ["spark", 34, 25, 10]; }
  if (pose === "victoryC") { p.torsoY = -3; p.rightArm = [22, 66, 42, 38]; p.effect = ["spark", 43, 38, 8]; }

  if (character.name === "power") {
    p.crouch += 2;
    p.armBoost += 2;
  }
  if (character.name === "duelist") {
    p.lean += character.lean * 2;
  }

  return p;
}

function drawEffect(canvas, fx, ox, palette) {
  if (!fx) return;
  const [type, x, y, size] = fx;
  const cx = ox + 64 + x;
  const cy = y;
  if (type === "slash") {
    line(canvas, cx - size, cy + size, cx + size, cy - size, 3, palette.effect);
    line(canvas, cx - size + 3, cy + size + 6, cx + size + 4, cy - size + 3, 2, palette.sole);
  }
  if (type === "burst") {
    diamond(canvas, cx, cy, size, Math.floor(size * 0.6), palette.effect);
    diamond(canvas, cx, cy, Math.floor(size * 0.55), Math.floor(size * 0.35), palette.sole);
  }
  if (type === "up") {
    line(canvas, cx - 8, cy + size, cx + 4, cy - size, 3, palette.effect);
    line(canvas, cx + 6, cy + size, cx + 12, cy - size + 6, 2, palette.sole);
  }
  if (type === "beam") {
    rect(canvas, cx, cy - 5, size, 10, palette.effect);
    rect(canvas, cx + 5, cy - 2, size - 8, 4, palette.sole);
  }
  if (type === "spark") {
    line(canvas, cx - size, cy, cx + size, cy, 2, palette.effect);
    line(canvas, cx, cy - size, cx, cy + size, 2, palette.effect);
  }
  if (type === "shield") {
    for (let i = -size; i <= size; i += 4) {
      const h = Math.sqrt(Math.max(0, size * size - i * i));
      setPixel(canvas, ox + 64 + i, y - h, palette.effect);
      setPixel(canvas, ox + 64 + i, y + h, palette.effect);
    }
  }
  if (type === "beamVertical") {
    rect(canvas, ox + 60, 18, 8, size * 2, palette.effect);
    rect(canvas, ox + 63, 18, 2, size * 2, palette.sole);
  }
}

function drawFighter(canvas, frame, fighterName, poseName) {
  const palette = PALETTES[fighterName];
  const character = CHARACTER[fighterName];
  const pose = poseOffsets(poseName, { ...palette, ...character });
  const ox = frame * FRAME_WIDTH;
  const cx = ox + 64 + pose.lean;
  const torsoTop = 53 + pose.torsoY + pose.crouch;
  const torsoBottom = 91 + pose.torsoY + pose.crouch;
  const shoulderY = torsoTop + 8;
  const headY = torsoTop - character.headHeight + pose.headY;
  const footY = poseName.startsWith("launched") || poseName.startsWith("respawn") ? BASELINE - 20 : BASELINE;

  drawEffect(canvas, pose.effect, ox, palette);

  line(canvas, cx + pose.leftLeg[0], pose.leftLeg[1] + pose.torsoY + pose.crouch, cx + pose.leftLeg[2], Math.min(pose.leftLeg[3], footY), character.legWidth + 4, palette.outline);
  line(canvas, cx + pose.rightLeg[0], pose.rightLeg[1] + pose.torsoY + pose.crouch, cx + pose.rightLeg[2], Math.min(pose.rightLeg[3], footY), character.legWidth + 4, palette.outline);
  line(canvas, cx + pose.leftLeg[0], pose.leftLeg[1] + pose.torsoY + pose.crouch, cx + pose.leftLeg[2], Math.min(pose.leftLeg[3], footY), character.legWidth, palette.cloth);
  line(canvas, cx + pose.rightLeg[0], pose.rightLeg[1] + pose.torsoY + pose.crouch, cx + pose.rightLeg[2], Math.min(pose.rightLeg[3], footY), character.legWidth, palette.clothLight);

  rect(canvas, cx + pose.leftLeg[2] - 10, Math.min(pose.leftLeg[3], footY) - 5, 24, 8, palette.outline);
  rect(canvas, cx + pose.rightLeg[2] - 10, Math.min(pose.rightLeg[3], footY) - 5, 24, 8, palette.outline);
  rect(canvas, cx + pose.leftLeg[2] - 8, Math.min(pose.leftLeg[3], footY) - 7, 20, 6, palette.accent);
  rect(canvas, cx + pose.rightLeg[2] - 8, Math.min(pose.rightLeg[3], footY) - 7, 20, 6, palette.accent);
  rect(canvas, cx + pose.leftLeg[2] - 6, Math.min(pose.leftLeg[3], footY), 18, 3, palette.sole);
  rect(canvas, cx + pose.rightLeg[2] - 6, Math.min(pose.rightLeg[3], footY), 18, 3, palette.sole);

  rect(canvas, cx - character.shoulderWidth / 2, shoulderY - 4, character.shoulderWidth, 13, palette.outline);
  rect(canvas, cx - character.bodyWidth / 2 - 4, torsoTop, character.bodyWidth + 8, torsoBottom - torsoTop, palette.outline);
  rect(canvas, cx - character.bodyWidth / 2, torsoTop + 3, character.bodyWidth, torsoBottom - torsoTop - 5, palette.cloth);
  rect(canvas, cx - character.bodyWidth / 5, torsoTop + 6, Math.max(7, character.bodyWidth / 2), 22, palette.shirt);
  rect(canvas, cx - 3, torsoBottom - 8, 8, 10, palette.accentDark);

  line(canvas, cx + pose.leftArm[0], pose.leftArm[1] + pose.torsoY + pose.crouch, cx + pose.leftArm[2], pose.leftArm[3] + pose.torsoY + pose.crouch, character.armWidth + 5 + pose.armBoost, palette.outline);
  line(canvas, cx + pose.rightArm[0], pose.rightArm[1] + pose.torsoY + pose.crouch, cx + pose.rightArm[2], pose.rightArm[3] + pose.torsoY + pose.crouch, character.armWidth + 5 + pose.armBoost, palette.outline);
  line(canvas, cx + pose.leftArm[0], pose.leftArm[1] + pose.torsoY + pose.crouch, cx + pose.leftArm[2], pose.leftArm[3] + pose.torsoY + pose.crouch, character.armWidth + pose.armBoost, palette.skin);
  line(canvas, cx + pose.rightArm[0], pose.rightArm[1] + pose.torsoY + pose.crouch, cx + pose.rightArm[2], pose.rightArm[3] + pose.torsoY + pose.crouch, character.armWidth + pose.armBoost, palette.skinLight);
  rect(canvas, cx + pose.leftArm[2] - 7, pose.leftArm[3] + pose.torsoY + pose.crouch - 5, 14, 11, palette.outline);
  rect(canvas, cx + pose.rightArm[2] - 7, pose.rightArm[3] + pose.torsoY + pose.crouch - 5, 14, 11, palette.outline);
  rect(canvas, cx + pose.leftArm[2] - 5, pose.leftArm[3] + pose.torsoY + pose.crouch - 4, 10, 9, palette.accent);
  rect(canvas, cx + pose.rightArm[2] - 5, pose.rightArm[3] + pose.torsoY + pose.crouch - 4, 10, 9, palette.accent);

  rect(canvas, cx - character.headWidth / 2 + pose.headX - 3, headY - 7, character.headWidth + 8, character.headHeight + 10, palette.outline);
  rect(canvas, cx - character.headWidth / 2 + pose.headX, headY - 3, character.headWidth, character.headHeight, palette.skin);
  rect(canvas, cx + 2 + pose.headX, headY + 3, 4, 3, palette.outline);
  rect(canvas, cx + 10 + pose.headX, headY + 3, 4, 3, palette.outline);
  rect(canvas, cx - character.headWidth / 2 + pose.headX - 4, headY - 10, character.headWidth + 14, 8, palette.hair);
  rect(canvas, cx - character.headWidth / 2 + pose.headX, headY - 13, character.headWidth + 5, 4, palette.hairLight);

  if (fighterName === "blue") {
    rect(canvas, cx - character.headWidth / 2 + pose.headX - 6, headY - 2, character.headWidth + 15, 4, palette.accent);
    line(canvas, cx - 12 + pose.headX, headY, cx - 34 + pose.trail * 2, headY + 10 + pose.trail, 4, palette.accent);
    line(canvas, cx - 14 + pose.headX, headY + 3, cx - 42 + pose.trail, headY + 20 - pose.trail, 3, palette.accentDark);
  }
  if (fighterName === "orange") {
    rect(canvas, cx - character.headWidth / 2 + pose.headX - 2, headY + character.headHeight - 2, character.headWidth + 4, 4, palette.accent);
    rect(canvas, cx - character.shoulderWidth / 2 - 4, shoulderY, 8, 12, palette.accentDark);
    rect(canvas, cx + character.shoulderWidth / 2 - 4, shoulderY, 8, 12, palette.accentDark);
  }
  if (fighterName === "violet") {
    line(canvas, cx - 8 + pose.headX, headY + 2, cx - 38 - pose.trail * 3, headY + 14 + pose.trail, 3, palette.accent);
    line(canvas, cx + 4, torsoTop + 16, cx + 28 + pose.lean, torsoTop + 34, 3, palette.accent);
  }
}

function generate(name) {
  const canvas = makeCanvas();
  ANIM_FRAME_POSES.forEach((pose, frame) => drawFighter(canvas, frame, name, pose));
  const png = encodePng(SHEET_WIDTH, FRAME_HEIGHT, canvas);
  mkdirSync(dirname(resolve(OUT_DIR, `${name}.png`)), { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${name}.png`), png);
}

for (const name of Object.keys(PALETTES)) {
  generate(name);
}

console.log(`Generated ${Object.keys(PALETTES).length} fighter sheets: ${SHEET_WIDTH}x${FRAME_HEIGHT}`);
```

- [ ] **Step 2: Run the generator**

Run:

```bash
node scripts/generate-fighter-sprites.mjs
```

Expected output:

```text
Generated 3 fighter sheets: 4864x128
```

- [ ] **Step 3: Verify the PNG dimensions**

Run:

```bash
file public/assets/fighters/blue.png public/assets/fighters/orange.png public/assets/fighters/violet.png
```

Expected output includes `PNG image data, 4864 x 128` for all three files.

- [ ] **Step 4: Inspect the generated sheets visually**

Run:

```bash
open public/assets/fighters/blue.png
open public/assets/fighters/orange.png
open public/assets/fighters/violet.png
```

Expected: the sheets show three visibly different silhouettes. Blue has the headband martial-artist silhouette, orange is broad and heavy, and violet is slim with scarf/sash accents. Frames should have transparent backgrounds and no clipping at the top, sides, or baseline.

- [ ] **Step 5: Commit the generator and generated sheets**

Run:

```bash
git add scripts/generate-fighter-sprites.mjs public/assets/fighters/blue.png public/assets/fighters/orange.png public/assets/fighters/violet.png
git commit -m "feat: generate distinct fighter sprite sheets"
```

## Task 3: Update Runtime Frame Geometry

**Files:**
- Modify: `src/game/render/assetManifest.js`
- Modify: `src/game/scenes/MatchScene.js`
- Modify: `src/game/render/renderScale.js`
- Modify: `src/game/render/renderScale.test.js`

- [ ] **Step 1: Update the asset constants**

In `src/game/render/assetManifest.js`, replace the current frame constants with:

```js
export const FIGHTER_FRAME_WIDTH = 128;
export const FIGHTER_FRAME_HEIGHT = 128;
export const FIGHTER_FRAME_BASELINE = 116;
```

- [ ] **Step 2: Anchor fighter sprites to the shared baseline**

In `src/game/scenes/MatchScene.js`, add this import beside the existing render imports:

```js
import { FIGHTER_FRAME_BASELINE, FIGHTER_FRAME_HEIGHT } from "../render/assetManifest.js";
```

Then replace:

```js
sprite.setOrigin(0.5, 1);
```

with:

```js
sprite.setOrigin(0.5, FIGHTER_FRAME_BASELINE / FIGHTER_FRAME_HEIGHT);
```

- [ ] **Step 3: Update fighter render scale**

In `src/game/render/renderScale.js`, replace:

```js
export const FIGHTER_RENDER_SCALE = 1.5;
```

with:

```js
export const FIGHTER_RENDER_SCALE = 1.15;
```

In `src/game/render/renderScale.test.js`, replace:

```js
expect(FIGHTER_RENDER_SCALE).toBe(1.5);
```

with:

```js
expect(FIGHTER_RENDER_SCALE).toBe(1.15);
```

- [ ] **Step 4: Run the focused render tests**

Run:

```bash
npm test -- src/game/render/assetManifest.test.js src/game/render/renderScale.test.js
```

Expected: PASS. The previously failing manifest test should now pass.

- [ ] **Step 5: Commit runtime geometry changes**

Run:

```bash
git add src/game/render/assetManifest.js src/game/scenes/MatchScene.js src/game/render/renderScale.js src/game/render/renderScale.test.js src/game/render/assetManifest.test.js
git commit -m "feat: load fighters as 128px baseline-aligned sheets"
```

## Task 4: Build And Visual-Verify In Game

**Files:**
- No new source files expected.
- Inspect: `public/assets/fighters/*.png`
- Inspect: local running game in browser.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite completes successfully and writes `dist/`.

- [ ] **Step 3: Start the local dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves the game, usually at `http://localhost:5173/`, and the server process remains running for browser verification.

- [ ] **Step 4: Verify the first match visually**

Open the local Vite URL in the in-app Browser, start `Fight CPU`, and check:

- Blue and CPU fighter feet align with the platform.
- Characters are not clipped during idle, run, jump, or attacks.
- Light attack reads as a quick strike.
- Heavy attack reads as a larger windup and follow-through.
- Blue, orange, and violet silhouettes are distinct when selected from the menu.

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` terminal session with `Ctrl-C`.

- [ ] **Step 6: Commit verification-only fixes if needed**

If visual verification shows clipping, incorrect baseline, or broken scale, adjust only:

- `BASELINE` in `scripts/generate-fighter-sprites.mjs` and regenerate sheets, or
- `FIGHTER_FRAME_BASELINE` in `src/game/render/assetManifest.js`, or
- `FIGHTER_RENDER_SCALE` in `src/game/render/renderScale.js`.

Then rerun:

```bash
node scripts/generate-fighter-sprites.mjs
npm test
npm run build
```

Commit with:

```bash
git add scripts/generate-fighter-sprites.mjs public/assets/fighters/blue.png public/assets/fighters/orange.png public/assets/fighters/violet.png src/game/render/assetManifest.js src/game/render/renderScale.js src/game/render/renderScale.test.js
git commit -m "fix: tune fighter sprite framing"
```

## Self-Review

- Spec coverage: the plan implements 128x128 frames, 38-frame single-row sheets, distinct blue/orange/violet silhouettes, baseline alignment, render scale, committed PNG assets, tests, build verification, and browser visual verification.
- Placeholder scan: no `TBD` markers or incomplete task descriptions remain.
- Type consistency: constants are named `FIGHTER_FRAME_WIDTH`, `FIGHTER_FRAME_HEIGHT`, and `FIGHTER_FRAME_BASELINE` throughout, and all commands use the existing npm scripts from `package.json`.
