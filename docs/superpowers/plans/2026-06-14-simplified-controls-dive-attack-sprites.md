# Simplified Controls, Dive Attack, And Minimal Fighter Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the fighter controls to `A/D`, `Space`, `J`, `K`, and airborne `S`, add a real dive attack, and replace each fighter sheet with a 12-frame 128x128 sheet that keeps the character body near the current visible size.

**Architecture:** Keep the existing shared simulation boundary: `shared/` owns gameplay state, attacks, CPU, and match stepping; Phaser code maps keyboard input and renders shared state. Remove player-facing up/special/dodge/shield behavior from shared combat and rendering, but keep lifecycle states such as hitstun, launched, respawn, KO, and victory. Use AI-generated raster sprite art for the fighter poses, then commit exact 1536x128 PNG sheets after mechanical post-processing and validation.

**Tech Stack:** JavaScript ES modules, Vitest, Phaser 3, Node built-ins (`fs`, `path`, `zlib`), PNG assets under `public/assets/fighters/`.

---

## File Structure

- Modify `src/game/input/inputMapper.test.js`: asserts the new keyboard contract and removed controls.
- Modify `src/game/input/inputMapper.js`: maps only `A`, `D`, `Space`, `J`, `K`, and `S`.
- Modify `src/game/net/onlineInputLatch.test.js`: asserts the reduced edge-input list and live held movement/down fields.
- Modify `src/game/net/onlineInputLatch.js`: latches only `jump`, `light`, and `heavy`; lets `down` pass live for dive input.
- Modify `shared/attacks.js`: keeps `light` and `heavy`, adds `dive`, removes `up` and `special`.
- Modify `shared/fighterState.js`: removes public action states for up/special/dodge/shield, adds `DiveAttack`, removes fast fall behavior.
- Modify `shared/match.js`: removes defense transitions, starts only `light`, `heavy`, and airborne `dive`.
- Modify `test/shared/fighterState.test.js`: covers double jump and grounded `S` no-op behavior.
- Modify `test/shared/match.test.js`: covers dive attack start, hit, cooldown, and removed inputs.
- Modify `shared/cpu.js`: emits only movement, jump, light, heavy, and down/dive.
- Modify `test/shared/cpu.test.js`: asserts the simplified CPU input set.
- Modify `src/game/render/assetManifest.test.js`: asserts 128x128 frames and 1536x128 fighter PNGs.
- Modify `src/game/render/assetManifest.js`: loads 128x128 sheets and 12-frame animation definitions.
- Modify `src/game/render/animationMap.test.js`: add this focused unit test file for state-to-animation mapping.
- Modify `src/game/render/animationMap.js`: maps `DiveAttack` to `dive`, removes old public move mappings.
- Create `tmp/ai-fighter-sprites/`: temporary AI sprite source exports and post-processing workspace, not committed.
- Create `scripts/validate-fighter-sprites.mjs`: PNG dimension and transparency validator only.
- Modify `public/assets/fighters/blue.png`, `public/assets/fighters/orange.png`, `public/assets/fighters/violet.png`: generated 1536x128 sheets.
- Modify `src/game/render/renderScale.test.js` and `src/game/render/renderScale.js`: keep apparent fighter size stable after moving to 128px frames.
- Modify `src/game/scenes/MatchScene.js`: anchor sprites to an internal frame baseline.
- Modify `src/game/scenes/MenuScene.js`: updates visible controls text.
- Modify `README.md`: updates controls and CPU notes.

## Task 1: Keyboard Input Contract

**Files:**
- Modify: `src/game/input/inputMapper.test.js`
- Modify: `src/game/input/inputMapper.js`

- [ ] **Step 1: Write the failing input mapper tests**

Replace `src/game/input/inputMapper.test.js` with:

```js
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Input: {
      Keyboard: {
        JustDown: (key) => Boolean(key.justPressed)
      }
    }
  }
}));

const { createKeyboardInput } = await import("./inputMapper.js");

describe("createKeyboardInput", () => {
  it("maps A and D to held horizontal movement", () => {
    const { keys, readInput } = createReader();
    keys.left.isDown = true;
    keys.right.isDown = true;

    expect(readInput()).toMatchObject({
      left: true,
      right: true
    });
  });

  it("maps fresh SPACE presses to jump without using W", () => {
    const spaceReader = createReader();
    spaceReader.keys.jump.isDown = true;
    spaceReader.keys.jump.justPressed = true;

    expect(spaceReader.readInput().jump).toBe(true);

    const wReader = createReader();
    wReader.keys.removedUp.isDown = true;
    wReader.keys.removedUp.justPressed = true;

    expect(wReader.readInput().jump).toBe(false);
  });

  it("maps J and K to fresh light and heavy presses", () => {
    const { keys, readInput } = createReader();
    keys.light.justPressed = true;
    keys.heavy.justPressed = true;

    expect(readInput()).toMatchObject({
      light: true,
      heavy: true
    });
  });

  it("maps held S to down for airborne dive handling", () => {
    const { keys, readInput } = createReader();
    keys.down.isDown = true;

    expect(readInput()).toMatchObject({
      down: true
    });
  });

  it("does not expose removed up special dodge or shield controls", () => {
    const { keys, readInput } = createReader();
    keys.removedUp.isDown = true;
    keys.removedUp.justPressed = true;
    keys.removedSpecial.justPressed = true;
    keys.removedDodge.justPressed = true;
    keys.removedShield.isDown = true;

    expect(readInput()).toEqual({
      left: false,
      right: false,
      down: false,
      jump: false,
      light: false,
      heavy: false
    });
  });
});

function createReader() {
  const keys = {
    left: key(),
    right: key(),
    down: key(),
    jump: key(),
    light: key(),
    heavy: key(),
    removedUp: key(),
    removedSpecial: key(),
    removedDodge: key(),
    removedShield: key()
  };
  const scene = {
    input: {
      keyboard: {
        addKeys: vi.fn(() => keys)
      }
    }
  };

  return {
    keys,
    readInput: createKeyboardInput(scene)
  };
}

function key() {
  return {
    isDown: false,
    justPressed: false
  };
}
```

- [ ] **Step 2: Run the input mapper test to verify it fails**

Run:

```bash
npm test -- src/game/input/inputMapper.test.js
```

Expected: FAIL because the current mapper still maps `W`, `L`, `Shift`, and `I`, and returns removed fields.

- [ ] **Step 3: Implement the simplified input mapper**

Replace `src/game/input/inputMapper.js` with:

```js
import Phaser from "phaser";

const KEY_BINDINGS = {
  left: "A",
  right: "D",
  down: "S",
  jump: "SPACE",
  light: "J",
  heavy: "K",
  removedUp: "W",
  removedSpecial: "L",
  removedDodge: "SHIFT",
  removedShield: "I"
};

export function createKeyboardInput(scene) {
  const keys = scene.input.keyboard.addKeys(KEY_BINDINGS);
  const justDown = Phaser.Input.Keyboard.JustDown;

  return function readKeyboardInput() {
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      down: keys.down.isDown,
      jump: justDown(keys.jump),
      light: justDown(keys.light),
      heavy: justDown(keys.heavy)
    };
  };
}
```

- [ ] **Step 4: Run the input mapper test to verify it passes**

Run:

```bash
npm test -- src/game/input/inputMapper.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the input mapper change**

Run:

```bash
git add src/game/input/inputMapper.test.js src/game/input/inputMapper.js
git commit -m "feat: simplify keyboard controls"
```

## Task 2: Shared Fighter State And Dive Combat

**Files:**
- Modify: `test/shared/fighterState.test.js`
- Modify: `test/shared/match.test.js`
- Modify: `shared/attacks.js`
- Modify: `shared/fighterState.js`
- Modify: `shared/match.js`

- [ ] **Step 1: Add failing fighter state tests**

Append these tests before the final closing `});` in `test/shared/fighterState.test.js`:

```js
  it("does not fast fall or change state from grounded down input", () => {
    const fighter = createFighter("p1", 260, 420, 1);

    applyInputState(fighter, { left: false, right: false, jump: false, down: true });

    expect(fighter.state).toBe(FighterStates.Idle);
    expect(fighter.velocity.y).toBe(0);
  });

  it("keeps double jump available from a fresh second space press", () => {
    const fighter = createFighter("p1", 260, 420, 1);

    applyInputState(fighter, { left: false, right: false, jump: true, down: false });
    applyInputState(fighter, { left: false, right: false, jump: false, down: false });
    applyInputState(fighter, { left: false, right: false, jump: true, down: false });

    expect(fighter.jumpsRemaining).toBe(0);
    expect(fighter.state).toBe(FighterStates.Jump);
    expect(fighter.velocity.y).toBeLessThan(0);
  });
```

- [ ] **Step 2: Add failing match tests for dive and removed moves**

Append these tests before the final closing `});` in `test/shared/match.test.js`:

```js
  it("starts a dive attack from airborne down input", () => {
    const match = createMatch("cpu");
    match.fighters.p1.y = STAGE.platform.y - 120;
    match.fighters.p1.onGround = false;
    match.fighters.p1.velocity.y = 2;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.DiveAttack);
    expect(match.fighters.p1.activeAttack).toMatchObject({ key: "dive", hasHit: false });
    expect(match.fighters.p1.velocity.y).toBeGreaterThan(2);
  });

  it("does not start a dive attack from grounded down input", () => {
    const match = createMatch("cpu");
    match.fighters.p1.y = STAGE.platform.y;
    match.fighters.p1.onGround = true;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.Idle);
    expect(match.fighters.p1.activeAttack).toBeNull();
  });

  it("applies damage when a dive attack overlaps below the attacker", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p1.y = STAGE.platform.y - 84;
    match.fighters.p1.onGround = false;
    match.fighters.p1.velocity.y = 4;
    match.fighters.p2.x = 500;
    match.fighters.p2.y = STAGE.platform.y;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p2.damage).toBeGreaterThan(0);
    expect(match.fighters.p2.state).toBe(FighterStates.Hitstun);
    expect(match.effects).toContainEqual(expect.objectContaining({ type: "hitSpark" }));
  });

  it("ignores removed up special dodge and shield inputs", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p2.x = 548;

    queueInput(match, "p1", { up: true, special: true, dodge: true, shield: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.Idle);
    expect(match.fighters.p1.activeAttack).toBeNull();
    expect(match.fighters.p1.invulnerableMs).toBe(0);
    expect(match.fighters.p2.damage).toBe(0);
  });
```

Delete the existing test whose name is `dodge makes a fighter avoid an overlapping attack` from `test/shared/match.test.js`.

Delete the existing test whose name is `shield absorbs an overlapping attack without entering hitstun` from `test/shared/match.test.js`.

- [ ] **Step 3: Run the shared tests to verify they fail**

Run:

```bash
npm test -- test/shared/fighterState.test.js test/shared/match.test.js
```

Expected: FAIL because `FighterStates.DiveAttack` and `ATTACKS.dive` do not exist, down input still fast-falls, and removed inputs still start old behavior.

- [ ] **Step 4: Implement the reduced attack definitions**

Replace `shared/attacks.js` with:

```js
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
```

- [ ] **Step 5: Implement the reduced fighter state machine**

In `shared/fighterState.js`, update `FighterStates` to:

```js
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
```

Remove `dodgeHeld` from the object returned by `createFighter`.

Update `isTimedActionState` to:

```js
export function isTimedActionState(state) {
  return [
    FighterStates.AttackLight,
    FighterStates.AttackHeavy,
    FighterStates.DiveAttack
  ].includes(state);
}
```

In `applyInputState`, delete this block so `down` no longer fast-falls in the state layer:

```js
  if (input.down && !fighter.onGround) {
    fighter.velocity.y = Math.max(fighter.velocity.y, PHYSICS.fastFallSpeed);
  }
```

- [ ] **Step 6: Implement simplified attack starting and remove defense transitions**

In `shared/match.js`, update `createEmptyInput` to:

```js
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
```

In `stepMatch`, remove the call to `tryStartDefense(fighter, input);`.

Delete the entire `tryStartDefense` function.

Replace `tryStartAttack` with:

```js
function tryStartAttack(fighter, input) {
  const attackKey = input.light ? "light" : input.heavy ? "heavy" : input.down && !fighter.onGround ? "dive" : null;
  const attackPressed = attackKey !== null;
  const freshAttackPress = attackPressed && !fighter.attackHeld;
  fighter.attackHeld = attackPressed;

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
```

In `resolveAttack`, delete this shield branch:

```js
  if (defender.state === FighterStates.Shield && defender.stateTimerMs > 0) {
    defender.damage += Math.max(1, Math.round(attack.damage * 0.25));
    attacker.activeAttack.hasHit = true;
    match.effects.push({ type: "shieldShimmer", x: defender.x, y: defender.y - 34 });
    return;
  }
```

Update the effect push line to:

```js
  match.effects.push({ type: attack.key === "heavy" ? "heavyImpact" : "hitSpark", x: defender.x, y: defender.y - 30 });
```

Keep `getAttackRect` unchanged; the `dive` hitbox uses a negative `offsetX` so it centers under the fighter independent of facing.

- [ ] **Step 7: Run the shared tests to verify they pass**

Run:

```bash
npm test -- test/shared/fighterState.test.js test/shared/match.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the shared combat change**

Run:

```bash
git add test/shared/fighterState.test.js test/shared/match.test.js shared/attacks.js shared/fighterState.js shared/match.js
git commit -m "feat: add airborne dive attack"
```

## Task 3: CPU And Online Input Latching

**Files:**
- Modify: `test/shared/cpu.test.js`
- Modify: `shared/cpu.js`
- Modify: `src/game/net/onlineInputLatch.test.js`
- Modify: `src/game/net/onlineInputLatch.js`

- [ ] **Step 1: Update CPU tests for the simplified move set**

In `test/shared/cpu.test.js`, replace every assertion of:

```js
input.light || input.heavy || input.special
```

with:

```js
input.light || input.heavy
```

Append this test:

```js
  it("does not emit removed special dodge shield or up inputs", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;

    const input = chooseCpuInput(match, "p2", "hard");

    expect(input).not.toHaveProperty("special");
    expect(input).not.toHaveProperty("dodge");
    expect(input).not.toHaveProperty("shield");
    expect(input).not.toHaveProperty("up");
  });
```

Append this airborne dive test:

```js
  it("uses down for a dive attack when airborne above the player", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p1.y = 420;
    match.fighters.p2.x = 610;
    match.fighters.p2.y = 300;
    match.fighters.p2.onGround = false;
    match.elapsedMs = 0;

    const input = chooseCpuInput(match, "p2", "hard");

    expect(input.down).toBe(true);
  });
```

- [ ] **Step 2: Update online latch tests**

In `src/game/net/onlineInputLatch.test.js`, replace the "keeps held movement and shield live instead of latched" test with:

```js
  it("keeps held movement and down live instead of latched", () => {
    const latch = createOnlineInputLatch();

    expect(latch.read({ left: true, down: true, light: true }, 8)).toMatchObject({
      left: true,
      down: true,
      light: true
    });
    expect(latch.read({ left: false, down: false, light: false }, 8)).toMatchObject({
      left: false,
      down: false,
      light: false
    });
  });
```

If there is no removed-controls test, append:

```js
  it("does not synthesize removed action fields", () => {
    const latch = createOnlineInputLatch();

    expect(latch.read({ special: true, dodge: true, shield: true, up: true }, 8)).toEqual({
      left: false,
      right: false,
      down: false,
      jump: false,
      light: false,
      heavy: false
    });
  });
```

- [ ] **Step 3: Run CPU and latch tests to verify they fail**

Run:

```bash
npm test -- test/shared/cpu.test.js src/game/net/onlineInputLatch.test.js
```

Expected: FAIL because CPU still emits `special` and latch still knows removed edge/live fields.

- [ ] **Step 4: Implement simplified CPU decisions**

Replace `shared/cpu.js` with:

```js
import { STAGE } from "./constants.js";
import { createEmptyInput } from "./match.js";

const DIFFICULTY = {
  easy: { lightRange: 70, heavyRange: 0 },
  normal: { lightRange: 86, heavyRange: 108 },
  hard: { lightRange: 100, heavyRange: 128 }
};

const PULSE_MS = 120;

export function chooseCpuInput(match, cpuId = "p2", difficulty = "normal") {
  const input = createEmptyInput();
  const cpu = match?.fighters?.[cpuId];
  const player = match?.fighters?.[cpuId === "p1" ? "p2" : "p1"];

  if (!hasPosition(cpu) || !hasPosition(player)) {
    return input;
  }

  const profile = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  const dx = player.x - cpu.x;
  const dy = player.y - cpu.y;
  const distance = Math.abs(dx);
  const shouldPulse = Math.floor((match.elapsedMs ?? 0) / PULSE_MS) % 2 === 0;

  if (cpu.y > STAGE.platform.y + 80) {
    input.jump = shouldPulse;
    input[dx > 0 ? "right" : "left"] = true;
    return input;
  }

  if (!cpu.onGround && shouldPulse && Math.abs(dx) <= 70 && dy > 40) {
    input.down = true;
    return input;
  }

  if (distance > profile.lightRange) {
    input[dx > 0 ? "right" : "left"] = true;
  }

  const canAttack = (cpu.attackCooldownMs ?? 0) === 0 && shouldPulse;

  if (canAttack && profile.heavyRange > 0 && distance > profile.lightRange && distance <= profile.heavyRange) {
    input.heavy = true;
  } else if (canAttack && distance <= profile.lightRange) {
    input.light = true;
  }

  return input;
}

function hasPosition(fighter) {
  return Number.isFinite(fighter?.x) && Number.isFinite(fighter?.y);
}
```

- [ ] **Step 5: Implement simplified online input latch**

Replace `src/game/net/onlineInputLatch.js` with:

```js
const EDGE_INPUTS = ["jump", "light", "heavy"];
const LIVE_INPUTS = ["left", "right", "down"];
const LATCH_MS = 120;

export function createOnlineInputLatch() {
  const timers = Object.fromEntries(EDGE_INPUTS.map((key) => [key, 0]));

  return {
    read(input, dtMs) {
      for (const key of EDGE_INPUTS) {
        if (input[key]) timers[key] = LATCH_MS;
      }

      const latched = {};
      for (const key of LIVE_INPUTS) {
        latched[key] = Boolean(input[key]);
      }
      for (const key of EDGE_INPUTS) {
        latched[key] = timers[key] > 0;
        timers[key] = Math.max(0, timers[key] - dtMs);
      }

      return latched;
    }
  };
}
```

- [ ] **Step 6: Run CPU and latch tests to verify they pass**

Run:

```bash
npm test -- test/shared/cpu.test.js src/game/net/onlineInputLatch.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit CPU and latch changes**

Run:

```bash
git add test/shared/cpu.test.js shared/cpu.js src/game/net/onlineInputLatch.test.js src/game/net/onlineInputLatch.js
git commit -m "feat: simplify cpu and online inputs"
```

## Task 4: Render Mapping And Asset Manifest Tests

**Files:**
- Modify: `src/game/render/assetManifest.test.js`
- Modify: `src/game/render/assetManifest.js`
- Create: `src/game/render/animationMap.test.js`
- Modify: `src/game/render/animationMap.js`
- Modify: `src/game/render/renderScale.test.js`
- Modify: `src/game/render/renderScale.js`
- Modify: `src/game/scenes/MatchScene.js`

- [ ] **Step 1: Write failing asset manifest tests**

In `src/game/render/assetManifest.test.js`, update the import to include `FIGHTER_FRAME_BASELINE`:

```js
import {
  FIGHTER_FRAME_BASELINE,
  FIGHTER_FRAME_HEIGHT,
  FIGHTER_FRAME_WIDTH,
  FIGHTER_SHEETS,
  loadGameAssets
} from "./assetManifest.js";
```

In the fighter sheet expectation, change the frame options and PNG size expectations to:

```js
      expect(sheet.options).toMatchObject({
        frameWidth: 128,
        frameHeight: 128
      });
      expect(readPngSize(`public${sheet.path}`).width).toBe(FIGHTER_FRAME_WIDTH * 11);
      expect(readPngSize(`public${sheet.path}`).height).toBe(FIGHTER_FRAME_HEIGHT);
```

Add this test:

```js
  it("uses an internal baseline for the 128px fighter frames", () => {
    expect(FIGHTER_FRAME_BASELINE).toBe(108);
    expect(FIGHTER_FRAME_BASELINE).toBeLessThan(FIGHTER_FRAME_HEIGHT);
  });
```

- [ ] **Step 2: Write the animation map test**

Create `src/game/render/animationMap.test.js` with:

```js
import { describe, expect, it } from "vitest";
import { FighterStates } from "../../../shared/fighterState.js";
import { FIGHTER_ANIMS } from "./assetManifest.js";
import { animationKey } from "./animationMap.js";

describe("animationKey", () => {
  it("maps simplified public action states to minimal animations", () => {
    expect(animationKey({ palette: "blue", state: FighterStates.Idle })).toBe("blue:idle");
    expect(animationKey({ palette: "blue", state: FighterStates.Run })).toBe("blue:run");
    expect(animationKey({ palette: "blue", state: FighterStates.Jump })).toBe("blue:jump");
    expect(animationKey({ palette: "blue", state: FighterStates.AttackLight })).toBe("blue:light");
    expect(animationKey({ palette: "blue", state: FighterStates.AttackHeavy })).toBe("blue:heavy");
    expect(animationKey({ palette: "blue", state: FighterStates.DiveAttack })).toBe("blue:dive");
  });

  it("does not require removed move animations", () => {
    expect(FIGHTER_ANIMS).not.toHaveProperty("up");
    expect(FIGHTER_ANIMS).not.toHaveProperty("special");
    expect(FIGHTER_ANIMS).not.toHaveProperty("dodge");
    expect(FIGHTER_ANIMS).not.toHaveProperty("shield");
  });
});
```

- [ ] **Step 3: Update render scale test**

Replace `src/game/render/renderScale.test.js` with:

```js
import { describe, expect, it } from "vitest";
import { FIGHTER_RENDER_SCALE } from "./renderScale.js";

describe("render scale", () => {
  it("keeps 76px source fighters near the previous apparent size", () => {
    expect(FIGHTER_RENDER_SCALE).toBe(1.5);
  });
});
```

- [ ] **Step 4: Run render tests to verify they fail**

Run:

```bash
npm test -- src/game/render/assetManifest.test.js src/game/render/animationMap.test.js src/game/render/renderScale.test.js
```

Expected: FAIL because frame constants are still 96x80, `FIGHTER_FRAME_BASELINE` is missing, old animations still exist, and `DiveAttack` is not mapped.

- [ ] **Step 5: Implement 128px minimal animation manifest**

In `src/game/render/assetManifest.js`, change the constants and animation map to:

```js
export const FIGHTER_SHEETS = ["blue", "orange", "violet"];
export const FIGHTER_FRAME_WIDTH = 128;
export const FIGHTER_FRAME_HEIGHT = 128;
export const FIGHTER_FRAME_BASELINE = 108;

export const FIGHTER_ANIMS = Object.freeze({
  idle: [0, 1],
  run: [2, 3],
  jump: [4],
  fall: [4],
  light: [5],
  dive: [6],
  heavy: [7, 8],
  hurt: [8],
  launched: [4],
  respawn: [4, 0, 1],
  ko: [6],
  victory: [0, 1]
});
```

Change `LOOPING_FIGHTER_ANIMS` to:

```js
const LOOPING_FIGHTER_ANIMS = new Set(["idle", "run", "victory"]);
```

Keep `loadGameAssets` and `createGameAnimations` structure unchanged.

- [ ] **Step 6: Implement animation key mapping**

Replace `src/game/render/animationMap.js` with:

```js
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
```

- [ ] **Step 7: Keep the render scale stable and anchor to baseline**

Leave `src/game/render/renderScale.js` as:

```js
export const FIGHTER_RENDER_SCALE = 1.5;
export const EFFECT_RENDER_SCALE = 2;
```

In `src/game/scenes/MatchScene.js`, update the import from `assetManifest.js`:

```js
import { FIGHTER_FRAME_BASELINE, FIGHTER_FRAME_HEIGHT } from "../render/assetManifest.js";
```

In `createFighterSprite`, replace:

```js
    sprite.setOrigin(0.5, 1);
```

with:

```js
    sprite.setOrigin(0.5, FIGHTER_FRAME_BASELINE / FIGHTER_FRAME_HEIGHT);
```

- [ ] **Step 8: Run render tests**

Run:

```bash
npm test -- src/game/render/assetManifest.test.js src/game/render/animationMap.test.js src/game/render/renderScale.test.js
```

Expected: still FAIL on PNG dimensions until Task 5 generates the 1536x128 fighter sheets; animation map and render scale assertions should pass.

- [ ] **Step 9: Commit render code and tests before generated assets**

Run:

```bash
git add src/game/render/assetManifest.test.js src/game/render/assetManifest.js src/game/render/animationMap.test.js src/game/render/animationMap.js src/game/render/renderScale.test.js src/game/render/renderScale.js src/game/scenes/MatchScene.js
git commit -m "feat: map minimal fighter animations"
```

## Task 5: AI-Generated 12-Frame Fighter Sheets

**Files:**
- Create: `scripts/validate-fighter-sprites.mjs`
- Modify: `public/assets/fighters/blue.png`
- Modify: `public/assets/fighters/orange.png`
- Modify: `public/assets/fighters/violet.png`

- [ ] **Step 1: Generate AI source sprite sheets with the built-in image tool**

Use the `imagegen` skill with the built-in `image_gen` tool. Generate one AI image at a time and approve each frame before adding the next frame to the sheet. Use the approved blue character sheet as the source of truth for final frame bounds and generate palette variants from the approved art so all fighter sheets share identical silhouettes.

Use this base prompt for each fighter, changing only the character direction and accent color:

```text
Use case: stylized-concept
Asset type: pixel-art fighting game sprite sheet source
Primary request: Create exactly one side-view pixel-art platform-fighter pose on a perfectly flat solid #00ff00 chroma-key background for background removal.
Character scale: each character body should be about 76 px tall after final resizing, with extra transparent room inside a 128x128 game frame.
Approved final pose order: idle fighting stance A, idle fighting stance B, run stride frame 1, run passing-step frame 1, run stride frame 2, run passing-step frame 2 using the other leg, jump from fighting stance, light attack from idle stance, downward dive attack from jump pose, heavy attack windup, heavy attack strike, getting-hit reaction.
Style/medium: crisp original pixel-art game sprites, chunky readable silhouette, limited color palette, strong outline, no antialiasing blur, no text, no labels, no frame numbers.
Composition/framing: one full-body pose only, side-facing toward screen right, consistent character proportions and costume across all poses, generous padding around the pose.
Constraints: background must be one uniform #00ff00 with no shadows, gradients, texture, floor plane, or lighting variation; do not use #00ff00 anywhere in the character; no watermark.
Avoid: photorealism, 3D render, painterly blur, text, labels, UI, weapons that extend outside the pose area.
```

Character-specific directions:

- `blue`: agile martial artist with dark hair, red headband tails, red gloves, red shoes, dark sleeveless gi, blue accent palette.
- `orange`: bulky power fighter with broad shoulders, big gauntlets and boots, orange/gold accent palette, heavy stance.
- `violet`: slim agile duelist/ninja with scarf or sash motion, sharp angled limbs, violet accent palette, fast stance.

Save the generated source images under `tmp/ai-fighter-sprites/` for local processing. These source files are temporary and should not be committed unless needed for debugging.

- [ ] **Step 2: Remove chroma-key backgrounds and assemble exact PNG sheets**

Use local mechanical post-processing only. The post-processing may remove the chroma key, crop each approved generated pose, resize it into a 128x128 frame, align grounded frames to baseline 108, center airborne frames, assemble the final sheets, and create palette variants from the approved art. Do not draw the character poses with deterministic geometry code.

The output files must be:

- `public/assets/fighters/blue.png`
- `public/assets/fighters/orange.png`
- `public/assets/fighters/violet.png`

Each output must be a transparent PNG exactly 1536px wide by 128px high.

Use the installed chroma-key helper for background removal when applicable:

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input tmp/ai-fighter-sprites/<source>.png \
  --out tmp/ai-fighter-sprites/<source>-alpha.png \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```

If a generated frame is clipped, inconsistent in apparent size, or stylistically off, regenerate that single frame before adding the next pose.

- [ ] **Step 3: Create the sprite validator**

Create `scripts/validate-fighter-sprites.mjs`:

```js
import { readFileSync } from "node:fs";

const EXPECTED = {
  width: 1536,
  height: 128,
  signature: "89504e470d0a1a0a"
};

for (const name of ["blue", "orange", "violet"]) {
  const path = `public/assets/fighters/${name}.png`;
  const png = readFileSync(path);
  const signature = png.subarray(0, 8).toString("hex");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];

  if (signature !== EXPECTED.signature) {
    throw new Error(`${path} is not a PNG file`);
  }
  if (width !== EXPECTED.width || height !== EXPECTED.height) {
    throw new Error(`${path} must be ${EXPECTED.width}x${EXPECTED.height}, got ${width}x${height}`);
  }
  if (colorType !== 6 && colorType !== 4) {
    throw new Error(`${path} must include an alpha channel, got PNG color type ${colorType}`);
  }

  console.log(`${path}: ${width}x${height}, alpha color type ${colorType}`);
}
```

- [ ] **Step 4: Validate generated assets and render tests**

Run:

```bash
node scripts/validate-fighter-sprites.mjs
npm test -- src/game/render/assetManifest.test.js src/game/render/animationMap.test.js src/game/render/renderScale.test.js
```

Expected: validator reports all three fighter sheets as 1536x128 PNGs with alpha, approved visible heights, and no frame-edge clipping; render tests pass.

- [ ] **Step 5: Commit AI-generated sprites**

Run:

```bash
git add scripts/validate-fighter-sprites.mjs public/assets/fighters/blue.png public/assets/fighters/orange.png public/assets/fighters/violet.png
git commit -m "feat: add ai-generated fighter sprites"
```

## Task 6: Menu Text, README, And Full Verification

**Files:**
- Modify: `src/game/scenes/MenuScene.js`
- Modify: `README.md`

- [ ] **Step 1: Update visible menu controls**

In `src/game/scenes/MenuScene.js`, ensure the controls line is:

```js
    this.add.text(76, 556, "A/D move  SPACE jump/double jump  J light  K heavy  S dive attack while airborne", {
```

- [ ] **Step 2: Update README controls and CPU description**

In `README.md`, replace the controls block with:

```md
## Controls

- `A` / `D`: move
- `Space`: jump / double jump
- `J`: light attack
- `K`: heavy attack
- `S`: dive attack while airborne
```

Ensure the CPU paragraph is:

```md
The CPU chooses compact input packets from match state. It approaches when far, uses light and heavy attacks in range, dives when airborne above the opponent, and jumps back toward the platform when recovering.
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- src/game/input/inputMapper.test.js test/shared/fighterState.test.js test/shared/match.test.js test/shared/cpu.test.js src/game/net/onlineInputLatch.test.js src/game/render/assetManifest.test.js src/game/render/animationMap.test.js src/game/render/renderScale.test.js
```

Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite build output and no errors.

- [ ] **Step 6: Commit docs and menu updates**

Run:

```bash
git add src/game/scenes/MenuScene.js README.md
git commit -m "docs: document simplified fighter controls"
```

- [ ] **Step 7: Start the local game for visual verification**

Run:

```bash
npm run dev
```

Expected: Vite reports a localhost URL, and the Express/Socket.IO server starts on port 3000.

- [ ] **Step 8: Verify in browser**

Open the Vite localhost URL and start a CPU Battle. Verify:

- `A` and `D` move.
- `Space` jumps and a second fresh `Space` press double jumps.
- `J` starts light attack.
- `K` starts heavy attack.
- `S` starts dive attack only while airborne.
- `W`, `L`, `Shift`, and `I` do not trigger gameplay actions.
- The three fighter sheets render without clipping.
- Fighters remain about the same apparent size as before.
- The two-frame idle, four-frame run, one-frame jump, one-frame light, one-frame dive, two-frame heavy, and one-frame hurt are readable in play.

Stop the dev server after verification.

## Final Self-Review Checklist

- Spec coverage: controls, dive attack, double jump, removed moves, CPU, online inputs, 128x128 sheets, 12 unique frames, docs, and visual verification are each covered by a task.
- Placeholder scan: no task uses placeholder markers, copy-by-reference wording, or unstated implementation work.
- Type consistency: the plan consistently uses `down` as the input field for `S`, `DiveAttack` as the fighter state, `dive` as the attack key and animation name, 128x128 frame constants, and 12 total frames.
