# Pixel Arena Fighter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullscreen browser pixel arena fighter with CPU mode, Socket.IO online rooms, shared combat simulation, custom fighter state machine, progression, and enough animation/effect polish for early submission.

**Architecture:** The shared simulation is the gameplay source of truth. The Node/Socket.IO server advances online matches with that shared simulation, while the Phaser client renders snapshots, captures input, runs CPU mode locally, and owns fullscreen UI overlays.

**Tech Stack:** JavaScript, Vite, Phaser, Node.js, Express, Socket.IO, Vitest.

---

## File Structure

- `package.json`: scripts and dependencies for client build, server start, tests, and dev flow.
- `index.html`: fullscreen browser mount point.
- `vite.config.js`: Vite config that aliases shared modules and proxies Socket.IO during dev.
- `server/index.js`: Express static server plus Socket.IO room lifecycle and online match loop.
- `src/main.js`: Phaser game boot.
- `src/styles.css`: fullscreen page and overlay styling.
- `src/game/scenes/BootScene.js`: create generated pixel textures and boot into menu.
- `src/game/scenes/MenuScene.js`: fullscreen animated menu, CPU launch, online room controls.
- `src/game/scenes/MatchScene.js`: render arena, fighters, effects, CPU mode, and online snapshots.
- `src/game/scenes/HudScene.js`: HUD, debug overlay, room code, ping, stocks, damage, timer.
- `src/game/scenes/ResultsScene.js`: winner, match stats, XP, progression, rematch/menu actions.
- `src/game/render/assetFactory.js`: generate pixel-art sprite sheets and effect textures with Phaser graphics/canvas APIs.
- `src/game/render/animationMap.js`: map shared fighter FSM states to Phaser animation keys.
- `src/game/input/inputMapper.js`: convert keyboard state to compact shared input packets.
- `src/game/net/socketClient.js`: create/join room client, input send loop, snapshot events.
- `src/game/progression/progressionStore.js`: localStorage XP, CPU tier, unlockable palettes.
- `shared/constants.js`: arena dimensions, physics constants, timings, controls, and net tick rate.
- `shared/attacks.js`: attack definitions and hitbox data.
- `shared/fighterState.js`: custom finite state machine and transition helpers.
- `shared/match.js`: match state factory and fixed-step simulation.
- `shared/cpu.js`: CPU input selection by difficulty.
- `shared/rooms.js`: room code and public snapshot helpers shared by server tests and server.
- `test/shared/fighterState.test.js`: FSM tests.
- `test/shared/match.test.js`: combat, stocks, respawn, and match-end tests.
- `test/shared/cpu.test.js`: CPU behavior tests.
- `README.md`: setup, controls, architecture, multiplayer design, CPU behavior, and AI learning notes.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.js`
- Create: `server/index.js`
- Create: `src/main.js`
- Create: `src/styles.css`

- [ ] **Step 1: Create package scripts and dependencies**

Create `package.json`:

```json
{
  "name": "pixel-arena-fighter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite --host 0.0.0.0\" \"nodemon server/index.js\"",
    "build": "vite build",
    "start": "node server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-basic-ssl": "^1.1.0",
    "express": "^4.19.2",
    "phaser": "^3.90.0",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "nodemon": "^3.1.10",
    "vite": "^6.3.5",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and `npm` exits with code 0.

- [ ] **Step 3: Add fullscreen HTML mount**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pixel Arena Fighter</title>
  </head>
  <body>
    <div id="game-root"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Add Vite config**

Create `vite.config.js`:

```js
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      "@shared": "/shared",
      "@game": "/src/game"
    }
  }
});
```

- [ ] **Step 5: Add minimal server**

Create `server/index.js`:

```js
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 3000);
const distPath = path.resolve(__dirname, "../dist");

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pixel-arena-fighter" });
});

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

server.listen(port, () => {
  console.log(`Pixel Arena Fighter server listening on ${port}`);
});
```

- [ ] **Step 6: Add Phaser boot smoke screen**

Create `src/main.js`:

```js
import Phaser from "phaser";
import "./styles.css";

class SmokeScene extends Phaser.Scene {
  constructor() {
    super("smoke");
  }

  create() {
    this.cameras.main.setBackgroundColor("#101820");
    this.add
      .text(40, 40, "Pixel Arena Fighter", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#f8f8f2"
      })
      .setScrollFactor(0);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  pixelArt: true,
  backgroundColor: "#101820",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [SmokeScene]
});
```

Create `src/styles.css`:

```css
html,
body,
#game-root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #05070a;
}

body {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

canvas {
  image-rendering: pixelated;
}
```

- [ ] **Step 7: Verify scaffold**

Run: `npm run build`

Expected: Vite completes and creates `dist/`.

- [ ] **Step 8: Commit scaffold**

```bash
git add package.json package-lock.json index.html vite.config.js server/index.js src/main.js src/styles.css
git commit -m "feat: scaffold Phaser Socket.IO project"
```

## Task 2: Shared Fighter State Machine

**Files:**
- Create: `shared/constants.js`
- Create: `shared/fighterState.js`
- Create: `test/shared/fighterState.test.js`

- [ ] **Step 1: Write failing FSM tests**

Create `test/shared/fighterState.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  FighterStates,
  createFighter,
  applyInputState,
  enterHitstun,
  tickFighterState
} from "../../shared/fighterState.js";

describe("fighter state machine", () => {
  it("starts fighters in idle with stocks and jumps", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    expect(fighter.state).toBe(FighterStates.Idle);
    expect(fighter.stocks).toBe(3);
    expect(fighter.jumpsRemaining).toBe(2);
  });

  it("transitions from idle to run when horizontal input is held", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    applyInputState(fighter, { left: false, right: true, jump: false, down: false });
    expect(fighter.state).toBe(FighterStates.Run);
    expect(fighter.facing).toBe(1);
  });

  it("enters jump and consumes one jump when jump is pressed", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    applyInputState(fighter, { left: false, right: false, jump: true, down: false });
    expect(fighter.state).toBe(FighterStates.Jump);
    expect(fighter.jumpsRemaining).toBe(1);
    expect(fighter.velocity.y).toBeLessThan(0);
  });

  it("hitstun blocks movement transitions until the timer expires", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    enterHitstun(fighter, { x: 12, y: -8 }, 120);
    applyInputState(fighter, { left: true, right: false, jump: true, down: false });
    expect(fighter.state).toBe(FighterStates.Hitstun);
    tickFighterState(fighter, 120);
    expect(fighter.state).toBe(FighterStates.Fall);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/shared/fighterState.test.js`

Expected: FAIL with missing `shared/fighterState.js`.

- [ ] **Step 3: Implement constants and FSM**

Create `shared/constants.js`:

```js
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TICK_RATE = 60;
export const FIXED_DT_MS = 1000 / TICK_RATE;

export const STAGE = {
  platform: { x: 180, y: 520, width: 920, height: 28 },
  blastZone: { left: -180, right: 1460, top: -260, bottom: 940 },
  spawnA: { x: 360, y: 430, facing: 1 },
  spawnB: { x: 920, y: 430, facing: -1 }
};

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
  invulnerableMs: 1800
};
```

Create `shared/fighterState.js`:

```js
import { MATCH, PHYSICS } from "./constants.js";

export const FighterStates = Object.freeze({
  Idle: "Idle",
  Run: "Run",
  Jump: "Jump",
  Fall: "Fall",
  AttackLight: "AttackLight",
  AttackHeavy: "AttackHeavy",
  AttackUp: "AttackUp",
  Special: "Special",
  Dodge: "Dodge",
  Shield: "Shield",
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
    damage: 0,
    stocks: MATCH.startingStocks,
    invulnerableMs: 0,
    attackCooldownMs: 0,
    activeAttack: null,
    stats: { kos: 0, falls: 0, damageDealt: 0 }
  };
}

export function canControl(fighter) {
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

  if (input.jump && fighter.jumpsRemaining > 0) {
    fighter.velocity.y = PHYSICS.jumpVelocity;
    fighter.onGround = false;
    fighter.jumpsRemaining -= 1;
    setFighterState(fighter, FighterStates.Jump);
  }

  if (input.down && !fighter.onGround) {
    fighter.velocity.y = Math.max(fighter.velocity.y, PHYSICS.fastFallSpeed);
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

  if (fighter.state === FighterStates.Hitstun && fighter.stateTimerMs === 0) {
    setFighterState(fighter, fighter.onGround ? FighterStates.Idle : FighterStates.Fall);
  }

  if (!fighter.onGround && fighter.velocity.y > 0 && fighter.state === FighterStates.Jump) {
    setFighterState(fighter, FighterStates.Fall);
  }
}
```

- [ ] **Step 4: Run FSM tests**

Run: `npm test -- test/shared/fighterState.test.js`

Expected: PASS.

- [ ] **Step 5: Commit FSM**

```bash
git add shared/constants.js shared/fighterState.js test/shared/fighterState.test.js
git commit -m "feat: add shared fighter state machine"
```

## Task 3: Shared Match Simulation

**Files:**
- Create: `shared/attacks.js`
- Create: `shared/match.js`
- Create: `test/shared/match.test.js`

- [ ] **Step 1: Write failing match tests**

Create `test/shared/match.test.js`:

```js
import { describe, expect, it } from "vitest";
import { FighterStates } from "../../shared/fighterState.js";
import { createMatch, queueInput, stepMatch } from "../../shared/match.js";

describe("match simulation", () => {
  it("applies damage and knockback when a light attack connects", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p2.x = 548;
    queueInput(match, "p1", { light: true });
    stepMatch(match, 100);
    expect(match.fighters.p2.damage).toBeGreaterThan(0);
    expect(match.fighters.p2.state).toBe(FighterStates.Hitstun);
  });

  it("removes a stock when a fighter crosses the bottom blast zone", () => {
    const match = createMatch("cpu");
    match.fighters.p2.y = 980;
    stepMatch(match, 16.67);
    expect(match.fighters.p2.stocks).toBe(2);
    expect(match.fighters.p2.state).toBe(FighterStates.Respawn);
  });

  it("ends when a fighter has no stocks left", () => {
    const match = createMatch("cpu");
    match.fighters.p2.stocks = 1;
    match.fighters.p2.y = 980;
    stepMatch(match, 16.67);
    expect(match.status).toBe("complete");
    expect(match.winnerId).toBe("p1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/shared/match.test.js`

Expected: FAIL with missing `shared/match.js`.

- [ ] **Step 3: Implement attacks and match simulation**

Create `shared/attacks.js`:

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
```

Create `shared/match.js`:

```js
import { ATTACKS } from "./attacks.js";
import { MATCH, PHYSICS, STAGE } from "./constants.js";
import {
  FighterStates,
  applyInputState,
  createFighter,
  enterHitstun,
  setFighterState,
  tickFighterState
} from "./fighterState.js";

export function createMatch(mode = "cpu") {
  return {
    mode,
    status: "playing",
    winnerId: null,
    elapsedMs: 0,
    effects: [],
    inputs: {
      p1: createEmptyInput(),
      p2: createEmptyInput()
    },
    fighters: {
      p1: createFighter("p1", STAGE.spawnA.x, STAGE.spawnA.y, STAGE.spawnA.facing, "blue"),
      p2: createFighter("p2", STAGE.spawnB.x, STAGE.spawnB.y, STAGE.spawnB.facing, "orange")
    }
  };
}

export function createEmptyInput() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    light: false,
    heavy: false,
    special: false,
    dodge: false,
    shield: false
  };
}

export function queueInput(match, fighterId, input) {
  match.inputs[fighterId] = { ...createEmptyInput(), ...input };
}

export function stepMatch(match, dtMs) {
  if (match.status !== "playing") return match;
  match.elapsedMs += dtMs;
  match.effects = [];

  for (const fighterId of ["p1", "p2"]) {
    const fighter = match.fighters[fighterId];
    const input = match.inputs[fighterId];
    applyInputState(fighter, input);
    tryStartAttack(fighter, input);
  }

  resolveAttack(match, "p1", "p2");
  resolveAttack(match, "p2", "p1");

  for (const fighterId of ["p1", "p2"]) {
    integrateFighter(match.fighters[fighterId], dtMs);
    tickFighterState(match.fighters[fighterId], dtMs);
    handleBlastZone(match, fighterId);
  }

  return match;
}

function tryStartAttack(fighter, input) {
  if (fighter.attackCooldownMs > 0 || fighter.state === FighterStates.Hitstun || fighter.state === FighterStates.Respawn) {
    return;
  }

  const attackKey = input.light ? "light" : input.heavy ? "heavy" : input.up ? "up" : input.special ? "special" : null;
  if (!attackKey) return;

  const attack = ATTACKS[attackKey];
  fighter.activeAttack = { key: attackKey, remainingMs: attack.activeMs, hasHit: false };
  fighter.attackCooldownMs = attack.cooldownMs;
  setFighterState(fighter, attack.state, attack.activeMs);
}

function resolveAttack(match, attackerId, defenderId) {
  const attacker = match.fighters[attackerId];
  const defender = match.fighters[defenderId];
  if (!attacker.activeAttack || attacker.activeAttack.hasHit || defender.invulnerableMs > 0) return;

  const attack = ATTACKS[attacker.activeAttack.key];
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

function integrateFighter(fighter, dtMs) {
  const dtScale = dtMs / 16.67;
  fighter.velocity.y = Math.min(PHYSICS.maxFallSpeed, fighter.velocity.y + PHYSICS.gravity * dtScale);
  fighter.x += fighter.velocity.x * dtScale;
  fighter.y += fighter.velocity.y * dtScale;

  if (fighter.activeAttack) {
    fighter.activeAttack.remainingMs -= dtMs;
    if (fighter.activeAttack.remainingMs <= 0) fighter.activeAttack = null;
  }

  const platform = STAGE.platform;
  const feet = fighter.y;
  const withinPlatformX = fighter.x > platform.x && fighter.x < platform.x + platform.width;
  if (fighter.velocity.y >= 0 && feet >= platform.y && feet <= platform.y + 30 && withinPlatformX) {
    fighter.y = platform.y;
    fighter.velocity.y = 0;
    fighter.onGround = true;
    fighter.jumpsRemaining = 2;
  } else {
    fighter.onGround = false;
  }
}

function handleBlastZone(match, fighterId) {
  const fighter = match.fighters[fighterId];
  const zone = STAGE.blastZone;
  const outside = fighter.x < zone.left || fighter.x > zone.right || fighter.y < zone.top || fighter.y > zone.bottom;
  if (!outside || fighter.state === FighterStates.Respawn || fighter.state === FighterStates.KO) return;

  fighter.stocks -= 1;
  fighter.stats.falls += 1;
  const opponentId = fighterId === "p1" ? "p2" : "p1";
  match.fighters[opponentId].stats.kos += 1;

  if (fighter.stocks <= 0) {
    fighter.stocks = 0;
    setFighterState(fighter, FighterStates.KO);
    match.status = "complete";
    match.winnerId = opponentId;
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
```

- [ ] **Step 4: Run match tests**

Run: `npm test -- test/shared/match.test.js`

Expected: PASS.

- [ ] **Step 5: Commit match simulation**

```bash
git add shared/attacks.js shared/match.js test/shared/match.test.js
git commit -m "feat: add shared match simulation"
```

## Task 4: CPU Player

**Files:**
- Create: `shared/cpu.js`
- Create: `test/shared/cpu.test.js`

- [ ] **Step 1: Write failing CPU tests**

Create `test/shared/cpu.test.js`:

```js
import { describe, expect, it } from "vitest";
import { createMatch } from "../../shared/match.js";
import { chooseCpuInput } from "../../shared/cpu.js";

describe("CPU input selection", () => {
  it("moves toward the player when far away", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 300;
    match.fighters.p2.x = 900;
    const input = chooseCpuInput(match, "p2", "normal");
    expect(input.left).toBe(true);
    expect(input.right).toBe(false);
  });

  it("uses light attack when close", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 650;
    const input = chooseCpuInput(match, "p2", "normal");
    expect(input.light || input.heavy || input.special).toBe(true);
  });

  it("jumps while recovering below the platform", () => {
    const match = createMatch("cpu");
    match.fighters.p2.y = 650;
    const input = chooseCpuInput(match, "p2", "hard");
    expect(input.jump).toBe(true);
  });
});
```

- [ ] **Step 2: Run CPU test to verify it fails**

Run: `npm test -- test/shared/cpu.test.js`

Expected: FAIL with missing `shared/cpu.js`.

- [ ] **Step 3: Implement CPU input selection**

Create `shared/cpu.js`:

```js
import { STAGE } from "./constants.js";
import { createEmptyInput } from "./match.js";

const DIFFICULTY = {
  easy: { attackRange: 70, specialRange: 150, dodgeChance: 0.02 },
  normal: { attackRange: 86, specialRange: 190, dodgeChance: 0.05 },
  hard: { attackRange: 100, specialRange: 230, dodgeChance: 0.1 }
};

export function chooseCpuInput(match, cpuId = "p2", difficulty = "normal") {
  const cpu = match.fighters[cpuId];
  const player = match.fighters[cpuId === "p1" ? "p2" : "p1"];
  const profile = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  const input = createEmptyInput();
  const dx = player.x - cpu.x;
  const distance = Math.abs(dx);

  if (cpu.y > STAGE.platform.y + 80) {
    input.jump = true;
    input[dx > 0 ? "right" : "left"] = true;
    return input;
  }

  if (distance > profile.attackRange) {
    input[dx > 0 ? "right" : "left"] = true;
  }

  if (distance <= profile.attackRange) {
    input.light = true;
  } else if (distance <= profile.specialRange && difficulty !== "easy") {
    input.special = true;
  }

  if (Math.random() < profile.dodgeChance) {
    input.dodge = true;
    input.light = false;
    input.special = false;
  }

  return input;
}
```

- [ ] **Step 4: Run CPU tests**

Run: `npm test -- test/shared/cpu.test.js`

Expected: PASS.

- [ ] **Step 5: Run all shared tests**

Run: `npm test -- test/shared`

Expected: all shared tests PASS.

- [ ] **Step 6: Commit CPU**

```bash
git add shared/cpu.js test/shared/cpu.test.js
git commit -m "feat: add CPU fighter logic"
```

## Task 5: Socket.IO Online Rooms

**Files:**
- Create: `shared/rooms.js`
- Modify: `server/index.js`

- [ ] **Step 1: Add room helpers**

Create `shared/rooms.js`:

```js
export function createRoomCode(existingCodes = new Set()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  throw new Error("Unable to allocate room code");
}

export function toPublicSnapshot(match) {
  return {
    status: match.status,
    winnerId: match.winnerId,
    elapsedMs: Math.round(match.elapsedMs),
    effects: match.effects,
    fighters: match.fighters
  };
}
```

- [ ] **Step 2: Wire Socket.IO server**

Replace `server/index.js` with:

```js
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { FIXED_DT_MS } from "../shared/constants.js";
import { createMatch, queueInput, stepMatch } from "../shared/match.js";
import { createRoomCode, toPublicSnapshot } from "../shared/rooms.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
const port = Number(process.env.PORT || 3000);
const distPath = path.resolve(__dirname, "../dist");
const rooms = new Map();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pixel-arena-fighter", rooms: rooms.size });
});

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("room:create", (_payload, ack) => {
    const code = createRoomCode(new Set(rooms.keys()));
    const room = createServerRoom(code);
    rooms.set(code, room);
    joinRoom(socket, room, ack);
  });

  socket.on("room:join", ({ code }, ack) => {
    const normalized = String(code || "").trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return ack?.({ ok: false, error: "Room not found" });
    if (room.players.size >= 2 && !room.players.has(socket.id)) return ack?.({ ok: false, error: "Room is full" });
    joinRoom(socket, room, ack);
  });

  socket.on("match:input", ({ roomCode, input }) => {
    const room = rooms.get(roomCode);
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId) return;
    queueInput(room.match, playerId, input);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      if (!room.players.has(socket.id)) continue;
      const playerId = room.players.get(socket.id);
      room.players.delete(socket.id);
      io.to(room.code).emit("room:status", { message: `${playerId} disconnected`, players: room.players.size });
      if (room.players.size === 0) {
        clearInterval(room.interval);
        rooms.delete(room.code);
      }
    }
  });
});

function createServerRoom(code) {
  const room = {
    code,
    players: new Map(),
    match: createMatch("online"),
    interval: null
  };
  room.interval = setInterval(() => {
    if (room.players.size < 2) return;
    stepMatch(room.match, FIXED_DT_MS);
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match));
  }, FIXED_DT_MS);
  return room;
}

function joinRoom(socket, room, ack) {
  socket.join(room.code);
  const existingSlots = new Set(room.players.values());
  const playerId = existingSlots.has("p1") ? "p2" : "p1";
  room.players.set(socket.id, playerId);
  ack?.({ ok: true, roomCode: room.code, playerId });
  io.to(room.code).emit("room:status", { message: "Player joined", players: room.players.size, roomCode: room.code });
  socket.emit("match:snapshot", toPublicSnapshot(room.match));
}

server.listen(port, () => {
  console.log(`Pixel Arena Fighter server listening on ${port}`);
});
```

- [ ] **Step 3: Verify server imports**

Run: `npm run build`

Expected: PASS.

Run: `npm start`

Expected: console prints `Pixel Arena Fighter server listening on 3000`. Stop with Ctrl-C after confirming.

- [ ] **Step 4: Commit online rooms**

```bash
git add shared/rooms.js server/index.js
git commit -m "feat: add Socket.IO match rooms"
```

## Task 6: Phaser Scenes, Input, and Generated Pixel Assets

**Files:**
- Replace: `src/main.js`
- Create: `src/game/scenes/BootScene.js`
- Create: `src/game/scenes/MenuScene.js`
- Create: `src/game/scenes/MatchScene.js`
- Create: `src/game/scenes/HudScene.js`
- Create: `src/game/scenes/ResultsScene.js`
- Create: `src/game/render/assetFactory.js`
- Create: `src/game/render/animationMap.js`
- Create: `src/game/input/inputMapper.js`

- [ ] **Step 1: Add input mapper**

Create `src/game/input/inputMapper.js`:

```js
import Phaser from "phaser";

export function createKeyboardInput(scene) {
  const keys = scene.input.keyboard.addKeys({
    left: "A",
    right: "D",
    up: "W",
    down: "S",
    jump: "SPACE",
    light: "J",
    heavy: "K",
    special: "L",
    dodge: "SHIFT",
    shield: "I"
  });

  return function readInput() {
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      up: keys.up.isDown,
      down: keys.down.isDown,
      jump: Phaser.Input.Keyboard.JustDown(keys.jump),
      light: Phaser.Input.Keyboard.JustDown(keys.light),
      heavy: Phaser.Input.Keyboard.JustDown(keys.heavy),
      special: Phaser.Input.Keyboard.JustDown(keys.special),
      dodge: Phaser.Input.Keyboard.JustDown(keys.dodge),
      shield: keys.shield.isDown
    };
  };
}
```

- [ ] **Step 2: Add animation map**

Create `src/game/render/animationMap.js`:

```js
import { FighterStates } from "@shared/fighterState.js";

export const STATE_TO_ANIMATION = {
  [FighterStates.Idle]: "idle",
  [FighterStates.Run]: "run",
  [FighterStates.Jump]: "jump",
  [FighterStates.Fall]: "fall",
  [FighterStates.AttackLight]: "light",
  [FighterStates.AttackHeavy]: "heavy",
  [FighterStates.AttackUp]: "up",
  [FighterStates.Special]: "special",
  [FighterStates.Dodge]: "dodge",
  [FighterStates.Shield]: "shield",
  [FighterStates.Hitstun]: "hurt",
  [FighterStates.Launched]: "launched",
  [FighterStates.Respawn]: "respawn",
  [FighterStates.KO]: "ko",
  [FighterStates.Victory]: "victory"
};

export function animationKey(fighter) {
  return `${fighter.palette}:${STATE_TO_ANIMATION[fighter.state] || "idle"}`;
}
```

- [ ] **Step 3: Generate pixel textures and animations**

Create `src/game/render/assetFactory.js`:

```js
const PALETTES = {
  blue: { body: 0x38bdf8, dark: 0x075985, accent: 0xfacc15 },
  orange: { body: 0xfb923c, dark: 0x7c2d12, accent: 0x22c55e },
  violet: { body: 0xa78bfa, dark: 0x4c1d95, accent: 0xf472b6 }
};

const ANIMS = {
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
};

export function createGeneratedAssets(scene) {
  for (const [name, palette] of Object.entries(PALETTES)) {
    createFighterSheet(scene, name, palette);
    for (const [anim, frames] of Object.entries(ANIMS)) {
      scene.anims.create({
        key: `${name}:${anim}`,
        frames: scene.anims.generateFrameNumbers(`${name}-fighter`, { frames }),
        frameRate: anim === "idle" ? 5 : 12,
        repeat: ["idle", "run", "victory", "shield"].includes(anim) ? -1 : 0
      });
    }
  }

  createEffectTexture(scene, "hitSpark", [0xfef08a, 0xfb7185, 0xffffff]);
  createEffectTexture(scene, "heavyImpact", [0xffffff, 0xf97316, 0xef4444]);
  createEffectTexture(scene, "jumpPuff", [0xe2e8f0, 0x94a3b8, 0xffffff]);
  createEffectTexture(scene, "koStreak", [0xf8fafc, 0x38bdf8, 0xf43f5e]);
}

function createFighterSheet(scene, key, palette) {
  const frameWidth = 64;
  const frameHeight = 80;
  const frames = 38;
  const texture = scene.textures.createCanvas(`${key}-fighter`, frameWidth * frames, frameHeight);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < frames; i += 1) {
    const x = i * frameWidth;
    const bob = i % 2 === 0 ? 0 : 2;
    ctx.fillStyle = color(palette.dark);
    ctx.fillRect(x + 23, 8 + bob, 18, 14);
    ctx.fillStyle = color(palette.body);
    ctx.fillRect(x + 20, 24 + bob, 24, 30);
    ctx.fillStyle = color(palette.accent);
    ctx.fillRect(x + 17, 32 + bob, 8 + (i % 4), 10);
    ctx.fillRect(x + 39 - (i % 3), 32 + bob, 8, 10);
    ctx.fillStyle = color(palette.dark);
    ctx.fillRect(x + 22, 54 + bob, 8, 18);
    ctx.fillRect(x + 35, 54 + bob, 8, 18);
    if (i >= 8 && i <= 21) {
      ctx.fillStyle = "#fff7ad";
      ctx.fillRect(x + 44, 28, 14 + (i % 4) * 4, 8);
    }
    texture.add(i, 0, x, 0, frameWidth, frameHeight);
  }

  texture.refresh();
}

function createEffectTexture(scene, key, colors) {
  const size = 48;
  const texture = scene.textures.createCanvas(key, size * 4, size);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  for (let frame = 0; frame < 4; frame += 1) {
    const x = frame * size;
    ctx.fillStyle = color(colors[frame % colors.length]);
    ctx.fillRect(x + 20 - frame * 4, 22, 8 + frame * 8, 4);
    ctx.fillRect(x + 22, 20 - frame * 4, 4, 8 + frame * 8);
    texture.add(frame, 0, x, 0, size, size);
  }
  texture.refresh();
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
    frameRate: 16,
    repeat: 0
  });
}

function color(value) {
  return `#${value.toString(16).padStart(6, "0")}`;
}
```

- [ ] **Step 4: Add Phaser scenes**

Create scene files with these responsibilities:

`src/game/scenes/BootScene.js`

```js
import { createGeneratedAssets } from "@game/render/assetFactory.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    createGeneratedAssets(this);
    this.scene.start("MenuScene");
  }
}
```

`src/game/scenes/MenuScene.js`

```js
export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#101820");
    this.add.rectangle(640, 520, 920, 28, 0x64748b).setStrokeStyle(4, 0xcbd5e1);
    this.add.text(64, 56, "Pixel Arena Fighter", { fontFamily: "monospace", fontSize: "42px", color: "#f8fafc" });
    this.add.text(68, 118, "Fullscreen platform fighter - CPU and online rooms", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#cbd5e1"
    });
    this.makeButton(88, 220, "Fight CPU", () => this.scene.start("MatchScene", { mode: "cpu", difficulty: "normal" }));
    this.makeButton(88, 292, "Create Online Room", () => this.scene.start("MatchScene", { mode: "online-create" }));
    this.makeButton(88, 364, "Join Online Room", () => {
      const code = window.prompt("Room code");
      if (code) this.scene.start("MatchScene", { mode: "online-join", roomCode: code.trim().toUpperCase() });
    });
    this.add.text(88, 470, "Controls: A/D move, W/Space jump, S fast fall, J light, K heavy, L special, Shift dodge", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f8fafc"
    });
  }

  makeButton(x, y, label, onClick) {
    const text = this.add.text(x, y, label, {
      fontFamily: "monospace",
      fontSize: "26px",
      color: "#101820",
      backgroundColor: "#facc15",
      padding: { x: 18, y: 10 }
    });
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    return text;
  }
}
```

`src/game/scenes/HudScene.js`

```js
export class HudScene extends Phaser.Scene {
  constructor() {
    super("HudScene");
  }

  create() {
    this.left = this.add.text(24, 22, "", { fontFamily: "monospace", fontSize: "24px", color: "#f8fafc" }).setScrollFactor(0);
    this.right = this.add.text(980, 22, "", { fontFamily: "monospace", fontSize: "24px", color: "#f8fafc" }).setScrollFactor(0);
    this.center = this.add.text(530, 22, "", { fontFamily: "monospace", fontSize: "18px", color: "#cbd5e1" }).setScrollFactor(0);
    this.debug = this.add.text(24, 668, "", { fontFamily: "monospace", fontSize: "14px", color: "#94a3b8" }).setScrollFactor(0);
  }

  updateHud(snapshot, meta = {}) {
    const p1 = snapshot.fighters.p1;
    const p2 = snapshot.fighters.p2;
    this.left.setText(`P1 ${Math.round(p1.damage)}%  Stocks ${p1.stocks}`);
    this.right.setText(`P2 ${Math.round(p2.damage)}%  Stocks ${p2.stocks}`);
    this.center.setText(meta.roomCode ? `Room ${meta.roomCode}` : "CPU Match");
    this.debug.setText(`FPS ${Math.round(this.game.loop.actualFps)}  ${meta.status || ""}`);
  }
}
```

`src/game/scenes/ResultsScene.js`

```js
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(data) {
    const winner = data.winnerId?.toUpperCase() || "P1";
    this.cameras.main.setBackgroundColor("#0f172a");
    this.add.text(420, 180, `${winner} Wins`, { fontFamily: "monospace", fontSize: "56px", color: "#facc15" });
    this.add.text(420, 270, `XP +${data.xp || 100}`, { fontFamily: "monospace", fontSize: "26px", color: "#f8fafc" });
    this.add.text(420, 340, "Click to return to menu", { fontFamily: "monospace", fontSize: "22px", color: "#cbd5e1" });
    this.input.once("pointerdown", () => this.scene.start("MenuScene"));
  }
}
```

`src/game/scenes/MatchScene.js`

```js
import { chooseCpuInput } from "@shared/cpu.js";
import { STAGE } from "@shared/constants.js";
import { createMatch, queueInput, stepMatch } from "@shared/match.js";
import { createKeyboardInput } from "@game/input/inputMapper.js";
import { animationKey } from "@game/render/animationMap.js";

export class MatchScene extends Phaser.Scene {
  constructor() {
    super("MatchScene");
  }

  create(data) {
    this.mode = data.mode;
    this.match = createMatch(this.mode === "cpu" ? "cpu" : "online");
    this.readInput = createKeyboardInput(this);
    this.fighterSprites = {};
    this.effects = [];
    this.cameras.main.setBackgroundColor("#172033");
    this.add.rectangle(640, 520, STAGE.platform.width, STAGE.platform.height, 0x64748b).setStrokeStyle(4, 0xcbd5e1);
    this.fighterSprites.p1 = this.add.sprite(this.match.fighters.p1.x, this.match.fighters.p1.y - 39, "blue-fighter", 0).setScale(2);
    this.fighterSprites.p2 = this.add.sprite(this.match.fighters.p2.x, this.match.fighters.p2.y - 39, "orange-fighter", 0).setScale(2);
    this.scene.launch("HudScene");
    this.hud = this.scene.get("HudScene");
  }

  update(_time, delta) {
    const input = this.readInput();
    queueInput(this.match, "p1", input);
    if (this.mode === "cpu") queueInput(this.match, "p2", chooseCpuInput(this.match, "p2", "normal"));
    stepMatch(this.match, delta);
    this.renderSnapshot(this.match, { status: this.mode });
    if (this.match.status === "complete") {
      this.scene.stop("HudScene");
      this.scene.start("ResultsScene", { winnerId: this.match.winnerId, xp: 100 });
    }
  }

  renderSnapshot(snapshot, meta = {}) {
    for (const id of ["p1", "p2"]) {
      const fighter = snapshot.fighters[id];
      const sprite = this.fighterSprites[id];
      sprite.setPosition(fighter.x, fighter.y - 39);
      sprite.setFlipX(fighter.facing < 0);
      const key = animationKey(fighter);
      if (sprite.anims.currentAnim?.key !== key) sprite.play(key, true);
    }
    for (const effect of snapshot.effects) {
      const sprite = this.add.sprite(effect.x, effect.y, effect.type).setScale(2);
      sprite.play(effect.type);
      sprite.once("animationcomplete", () => sprite.destroy());
      if (effect.type === "heavyImpact") this.cameras.main.shake(90, 0.006);
    }
    this.hud?.updateHud(snapshot, meta);
  }
}
```

- [ ] **Step 5: Replace main boot**

Replace `src/main.js`:

```js
import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "@game/scenes/BootScene.js";
import { HudScene } from "@game/scenes/HudScene.js";
import { MatchScene } from "@game/scenes/MatchScene.js";
import { MenuScene } from "@game/scenes/MenuScene.js";
import { ResultsScene } from "@game/scenes/ResultsScene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  pixelArt: true,
  backgroundColor: "#101820",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [BootScene, MenuScene, MatchScene, HudScene, ResultsScene]
});
```

- [ ] **Step 6: Verify client build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit Phaser client shell**

```bash
git add src/main.js src/game
git commit -m "feat: add fullscreen Phaser game client"
```

## Task 7: Online Client Integration and Progression

**Files:**
- Create: `src/game/net/socketClient.js`
- Create: `src/game/progression/progressionStore.js`
- Modify: `src/game/scenes/MatchScene.js`
- Modify: `src/game/scenes/ResultsScene.js`

- [ ] **Step 1: Add Socket.IO client wrapper**

Create `src/game/net/socketClient.js`:

```js
import { io } from "socket.io-client";

export function createSocketClient() {
  const socket = io();

  return {
    socket,
    createRoom() {
      return emitWithAck(socket, "room:create", {});
    },
    joinRoom(code) {
      return emitWithAck(socket, "room:join", { code });
    },
    sendInput(roomCode, input) {
      socket.emit("match:input", { roomCode, input });
    },
    onSnapshot(handler) {
      socket.on("match:snapshot", handler);
      return () => socket.off("match:snapshot", handler);
    },
    onStatus(handler) {
      socket.on("room:status", handler);
      return () => socket.off("room:status", handler);
    },
    disconnect() {
      socket.disconnect();
    }
  };
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}
```

- [ ] **Step 2: Add progression store**

Create `src/game/progression/progressionStore.js`:

```js
const KEY = "pixel-arena-progress";

export function loadProgression() {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return { xp: 0, level: 1, palettes: ["blue", "orange"] };
  return JSON.parse(raw);
}

export function awardMatchXp(amount) {
  const progress = loadProgression();
  progress.xp += amount;
  progress.level = 1 + Math.floor(progress.xp / 300);
  if (progress.xp >= 300 && !progress.palettes.includes("violet")) progress.palettes.push("violet");
  window.localStorage.setItem(KEY, JSON.stringify(progress));
  return progress;
}
```

- [ ] **Step 3: Update MatchScene online branch**

Modify `src/game/scenes/MatchScene.js` so `create(data)` calls `setupOnline(data)` for online modes and `update()` sends input to the room instead of stepping locally when online:

```js
// Add imports:
import { createSocketClient } from "@game/net/socketClient.js";

// In create(data), after this.hud assignment:
if (this.mode !== "cpu") {
  this.setupOnline(data);
}

// Add method:
async setupOnline(data) {
  this.net = createSocketClient();
  const response = this.mode === "online-create" ? await this.net.createRoom() : await this.net.joinRoom(data.roomCode);
  if (!response.ok) {
    window.alert(response.error);
    this.scene.start("MenuScene");
    return;
  }
  this.roomCode = response.roomCode;
  this.playerId = response.playerId;
  this.net.onSnapshot((snapshot) => {
    this.match = snapshot;
    this.renderSnapshot(snapshot, { roomCode: this.roomCode, status: `You are ${this.playerId}` });
    if (snapshot.status === "complete") {
      this.net.disconnect();
      this.scene.stop("HudScene");
      this.scene.start("ResultsScene", { winnerId: snapshot.winnerId, xp: 120 });
    }
  });
}

// Replace update body with:
const input = this.readInput();
if (this.mode === "cpu") {
  queueInput(this.match, "p1", input);
  queueInput(this.match, "p2", chooseCpuInput(this.match, "p2", "normal"));
  stepMatch(this.match, delta);
  this.renderSnapshot(this.match, { status: this.mode });
  if (this.match.status === "complete") {
    this.scene.stop("HudScene");
    this.scene.start("ResultsScene", { winnerId: this.match.winnerId, xp: 100 });
  }
} else if (this.net && this.roomCode) {
  this.net.sendInput(this.roomCode, input);
}
```

- [ ] **Step 4: Update ResultsScene progression**

Modify `src/game/scenes/ResultsScene.js`:

```js
import { awardMatchXp } from "@game/progression/progressionStore.js";

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(data) {
    const progress = awardMatchXp(data.xp || 100);
    const winner = data.winnerId?.toUpperCase() || "P1";
    this.cameras.main.setBackgroundColor("#0f172a");
    this.add.text(420, 160, `${winner} Wins`, { fontFamily: "monospace", fontSize: "56px", color: "#facc15" });
    this.add.text(420, 250, `XP +${data.xp || 100}`, { fontFamily: "monospace", fontSize: "26px", color: "#f8fafc" });
    this.add.text(420, 292, `Level ${progress.level}  Total XP ${progress.xp}`, {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#cbd5e1"
    });
    this.add.text(420, 370, "Click to return to menu", { fontFamily: "monospace", fontSize: "22px", color: "#cbd5e1" });
    this.input.once("pointerdown", () => this.scene.start("MenuScene"));
  }
}
```

- [ ] **Step 5: Verify build and tests**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit online client and progression**

```bash
git add src/game/net src/game/progression src/game/scenes/MatchScene.js src/game/scenes/ResultsScene.js
git commit -m "feat: connect online rooms and progression"
```

## Task 8: README and Manual Verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add README**

Create `README.md`:

```md
# Pixel Arena Fighter

A fullscreen browser platform fighter built for Game Week. It uses Phaser for the 2D client, Node/Express for hosting, Socket.IO for online rooms, and a shared JavaScript combat simulation for CPU and online play.

## Run Locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Open the Vite URL shown in the terminal. The Socket.IO server runs on port 3000.

## Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

Open `http://localhost:3000`.

## Controls

- `A` / `D`: move
- `W` or `Space`: jump / double jump
- `S`: fast fall
- `J`: light attack
- `K`: heavy attack
- `L`: special
- `Shift`: dodge
- `I`: shield-lite

## Modes

- **Fight CPU**: starts a local match against a CPU opponent using the shared simulation.
- **Create Online Room**: creates a Socket.IO room code for another browser to join.
- **Join Online Room**: joins an existing room code.

## Architecture

The shared simulation in `shared/` owns fighter state, combat transitions, attacks, damage, knockback, stocks, CPU input, and match lifecycle. The client renders that state with Phaser. The server is authoritative for online rooms: clients send inputs and the server broadcasts match snapshots.

Phaser Scenes manage app flow: boot, menu, match, HUD, and results. Fighter gameplay uses a custom finite state machine in `shared/fighterState.js`.

## Multiplayer Design

Socket.IO rooms map directly to match rooms. A room has two player slots, one match instance, and a fixed server tick. Disconnects notify the remaining player, and empty rooms are cleaned up.

## CPU Design

The CPU chooses compact input packets from match state. It approaches when far, attacks when close, uses special at medium range on higher difficulties, and jumps back toward the platform when recovering.

## AI-Assisted Learning Notes

The project followed a browser-game pathway from the Game Week brief. AI was used to compare Phaser and raw Canvas, design the network model, define a shared simulation boundary, and plan the state machine so CPU mode and online mode do not diverge.
```

- [ ] **Step 2: Run final automated verification**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: production build PASS.

- [ ] **Step 3: Run local production server**

Run: `npm start`

Expected: server prints `Pixel Arena Fighter server listening on 3000`.

- [ ] **Step 4: Manual browser verification**

Open `http://localhost:3000` and verify:

- Fullscreen canvas fills the browser.
- Menu appears without a landing page.
- Fight CPU starts and can end with a winner.
- HUD shows damage, stocks, FPS, and mode.
- Create Online Room returns a room code.
- A second browser window can join that code.
- Both online players can move and attack.
- Closing one browser shows a disconnect status to the remaining room.
- Results screen awards XP.

- [ ] **Step 5: Commit docs**

```bash
git add README.md
git commit -m "docs: add game setup and architecture guide"
```

## Plan Self-Review

- Spec coverage: CPU mode, online rooms, fullscreen Phaser client, shared state machine, combat simulation, animation mapping, progression, README, and verification commands are covered by Tasks 1-8.
- Scope: This plan implements one polished arena and two generated palette fighters. It does not add ranked matchmaking, accounts, mobile controls, large roster, map editor, or required local same-keyboard play.
- Type consistency: Shared modules use `p1` and `p2`, `FighterStates`, `createMatch`, `queueInput`, `stepMatch`, `chooseCpuInput`, and `toPublicSnapshot` consistently across server and client tasks.
