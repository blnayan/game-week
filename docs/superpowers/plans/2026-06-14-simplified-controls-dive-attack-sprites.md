# Simplified Controls, Dive Attack, And Minimal Fighter Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the fighter controls to `A/D`, `Space`, `J`, `K`, and airborne `S`, add a real dive attack, and replace each fighter sheet with an 11-frame 128x128 sheet that keeps the character body near the current visible size.

**Architecture:** Keep the existing shared simulation boundary: `shared/` owns gameplay state, attacks, CPU, and match stepping; Phaser code maps keyboard input and renders shared state. Remove player-facing up/special/dodge/shield behavior from shared combat and rendering, but keep lifecycle states such as hitstun, launched, respawn, KO, and victory. Generate committed PNG fighter sheets deterministically from a Node script so the art is reproducible.

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
- Modify `src/game/render/assetManifest.test.js`: asserts 128x128 frames and 1408x128 fighter PNGs.
- Modify `src/game/render/assetManifest.js`: loads 128x128 sheets and 11-frame animation definitions.
- Modify `src/game/render/animationMap.test.js`: add this focused unit test file for state-to-animation mapping.
- Modify `src/game/render/animationMap.js`: maps `DiveAttack` to `dive`, removes old public move mappings.
- Create `scripts/generate-fighter-sprites.mjs`: deterministic 11-frame sprite generator.
- Modify `public/assets/fighters/blue.png`, `public/assets/fighters/orange.png`, `public/assets/fighters/violet.png`: generated 1408x128 sheets.
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

Expected: still FAIL on PNG dimensions until Task 5 generates the 1408x128 fighter sheets; animation map and render scale assertions should pass.

- [ ] **Step 9: Commit render code and tests before generated assets**

Run:

```bash
git add src/game/render/assetManifest.test.js src/game/render/assetManifest.js src/game/render/animationMap.test.js src/game/render/animationMap.js src/game/render/renderScale.test.js src/game/render/renderScale.js src/game/scenes/MatchScene.js
git commit -m "feat: map minimal fighter animations"
```

## Task 5: Deterministic 11-Frame Fighter Sheets

**Files:**
- Create: `scripts/generate-fighter-sprites.mjs`
- Modify: `public/assets/fighters/blue.png`
- Modify: `public/assets/fighters/orange.png`
- Modify: `public/assets/fighters/violet.png`

- [ ] **Step 1: Create the sprite generator**

Create `scripts/generate-fighter-sprites.mjs` with this structure:

```js
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 128;
const FRAME_COUNT = 11;
const SHEET_WIDTH = FRAME_WIDTH * FRAME_COUNT;
const BASELINE = 108;
const OUT_DIR = resolve("public/assets/fighters");

const FRAMES = [
  "idleA",
  "idleB",
  "runA",
  "runB",
  "runC",
  "runD",
  "jump",
  "light",
  "dive",
  "heavyWind",
  "heavyHit"
];

const PALETTES = {
  blue: {
    outline: "#151013",
    hair: "#2d2a2d",
    skin: "#d8894c",
    cloth: "#222124",
    shirt: "#ded5c8",
    accent: "#d22a20",
    sole: "#f1eee8",
    effect: "#ff6a3d",
    width: 24,
    shoulders: 34
  },
  orange: {
    outline: "#17100c",
    hair: "#3a2218",
    skin: "#b96531",
    cloth: "#3a2c22",
    shirt: "#f0c15d",
    accent: "#f07a24",
    sole: "#f7d86b",
    effect: "#ffd25a",
    width: 30,
    shoulders: 42
  },
  violet: {
    outline: "#101023",
    hair: "#221f47",
    skin: "#c98264",
    cloth: "#241b3b",
    shirt: "#d8d3f2",
    accent: "#9a66ff",
    sole: "#c9b8ff",
    effect: "#d36dff",
    width: 21,
    shoulders: 30
  }
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
    const x = x0 + (dx * i) / steps;
    const y = y0 + (dy * i) / steps;
    rect(canvas, x - thickness / 2, y - thickness / 2, thickness, thickness, color);
  }
}

function drawFighter(canvas, frameIndex, pose, palette) {
  const ox = frameIndex * FRAME_WIDTH;
  const cx = ox + 64;
  const footY = BASELINE;
  const idleBob = pose === "idleB" ? -2 : 0;
  const runPhase = ["runA", "runB", "runC", "runD"].indexOf(pose);
  const isRun = runPhase >= 0;
  const isJump = pose === "jump";
  const isDive = pose === "dive";
  const isLight = pose === "light";
  const isHeavyWind = pose === "heavyWind";
  const isHeavyHit = pose === "heavyHit";

  const bodyTop = footY - 60 + idleBob + (isJump ? -6 : 0) + (isDive ? 4 : 0);
  const bodyLean = isRun ? [-5, -2, 5, 2][runPhase] : isDive ? 12 : isHeavyWind ? -8 : isHeavyHit ? 8 : 0;
  const bodyWidth = palette.width;
  const shoulders = palette.shoulders;

  rect(canvas, cx - shoulders / 2 + bodyLean - 3, bodyTop + 16, shoulders + 6, 28, palette.outline);
  rect(canvas, cx - bodyWidth / 2 + bodyLean, bodyTop + 18, bodyWidth, 32, palette.cloth);
  rect(canvas, cx - bodyWidth / 2 + bodyLean + 5, bodyTop + 22, bodyWidth - 10, 14, palette.shirt);
  rect(canvas, cx - 12 + bodyLean, bodyTop - 6, 24, 22, palette.outline);
  rect(canvas, cx - 9 + bodyLean, bodyTop - 3, 18, 16, palette.skin);
  rect(canvas, cx - 13 + bodyLean, bodyTop - 10, 26, 10, palette.hair);

  const leftLegX = cx - 9 + bodyLean;
  const rightLegX = cx + 8 + bodyLean;
  const legSwing = isRun ? [-14, 4, 14, -4][runPhase] : 0;
  const rearSwing = -legSwing;
  line(canvas, leftLegX, bodyTop + 48, leftLegX - legSwing, footY - 8, 8, palette.outline);
  line(canvas, rightLegX, bodyTop + 48, rightLegX - rearSwing, footY - 8, 8, palette.outline);
  line(canvas, leftLegX, bodyTop + 48, leftLegX - legSwing, footY - 8, 5, palette.cloth);
  line(canvas, rightLegX, bodyTop + 48, rightLegX - rearSwing, footY - 8, 5, palette.cloth);
  rect(canvas, leftLegX - legSwing - 8, footY - 8, 16, 6, palette.sole);
  rect(canvas, rightLegX - rearSwing - 8, footY - 8, 16, 6, palette.sole);

  const armY = bodyTop + 24;
  const leftHand = isHeavyWind ? [cx - 42, armY + 18] : isLight || isHeavyHit ? [cx + 52, armY + 2] : isDive ? [cx + 24, armY + 42] : [cx - 26, armY + 16];
  const rightHand = isHeavyWind ? [cx + 28, armY - 2] : isLight || isHeavyHit ? [cx + 42, armY - 8] : isDive ? [cx + 38, armY + 34] : [cx + 25, armY + 14];
  line(canvas, cx - shoulders / 2 + bodyLean, armY, leftHand[0], leftHand[1], 7, palette.outline);
  line(canvas, cx + shoulders / 2 + bodyLean, armY, rightHand[0], rightHand[1], 7, palette.outline);
  line(canvas, cx - shoulders / 2 + bodyLean, armY, leftHand[0], leftHand[1], 4, palette.skin);
  line(canvas, cx + shoulders / 2 + bodyLean, armY, rightHand[0], rightHand[1], 4, palette.skin);
  rect(canvas, leftHand[0] - 5, leftHand[1] - 5, 10, 10, palette.accent);
  rect(canvas, rightHand[0] - 5, rightHand[1] - 5, 10, 10, palette.accent);

  if (isLight) {
    rect(canvas, cx + 48, armY - 12, 30, 8, palette.effect);
  }
  if (isHeavyHit) {
    rect(canvas, cx + 44, armY - 18, 44, 14, palette.effect);
    rect(canvas, cx + 82, armY - 26, 10, 30, palette.effect);
  }
  if (isDive) {
    rect(canvas, cx + 14, footY - 4, 24, 16, palette.effect);
    rect(canvas, cx + 20, footY + 10, 12, 10, palette.effect);
  }
}

function generateSheet(name, palette) {
  const canvas = Buffer.alloc(SHEET_WIDTH * FRAME_HEIGHT * 4);
  FRAMES.forEach((pose, frameIndex) => drawFighter(canvas, frameIndex, pose, palette));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${name}.png`), encodePng(SHEET_WIDTH, FRAME_HEIGHT, canvas));
}

for (const [name, palette] of Object.entries(PALETTES)) {
  generateSheet(name, palette);
}
```

- [ ] **Step 2: Generate the fighter sheets**

Run:

```bash
node scripts/generate-fighter-sprites.mjs
```

Expected: `public/assets/fighters/blue.png`, `orange.png`, and `violet.png` are rewritten as 1408x128 PNG files.

- [ ] **Step 3: Run asset manifest tests**

Run:

```bash
npm test -- src/game/render/assetManifest.test.js src/game/render/animationMap.test.js src/game/render/renderScale.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit generated sprites**

Run:

```bash
git add scripts/generate-fighter-sprites.mjs public/assets/fighters/blue.png public/assets/fighters/orange.png public/assets/fighters/violet.png
git commit -m "feat: generate minimal fighter sprites"
```

## Task 6: Menu Text, README, And Full Verification

**Files:**
- Modify: `src/game/scenes/MenuScene.js`
- Modify: `README.md`

- [ ] **Step 1: Update visible menu controls**

In `src/game/scenes/MenuScene.js`, replace the current controls line:

```js
    this.add.text(76, 556, "A/D move  W/SPACE jump  S fast-fall  J light  W+J up  K heavy  L special  SHIFT dodge  I shield", {
```

with:

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

Replace the CPU paragraph:

```md
The CPU chooses compact input packets from match state. It approaches when far, attacks when close, uses special at medium range on higher difficulties, and jumps back toward the platform when recovering.
```

with:

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
- The two-frame idle, four-frame run, one-frame light, one-frame jump, one-frame dive, and two-frame heavy are readable in play.

Stop the dev server after verification.

## Final Self-Review Checklist

- Spec coverage: controls, dive attack, double jump, removed moves, CPU, online inputs, 128x128 sheets, 11 unique frames, docs, and visual verification are each covered by a task.
- Placeholder scan: no task uses placeholder markers, copy-by-reference wording, or unstated implementation work.
- Type consistency: the plan consistently uses `down` as the input field for `S`, `DiveAttack` as the fighter state, `dive` as the attack key and animation name, 128x128 frame constants, and 11 total frames.
