# Tri-Platform Stage Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an unlockable level-10 tri-platform online stage whose visible platforms and physics hitboxes share exact geometry, while allowing lower-level players to join that stage by invite.

**Architecture:** Add a shared stage catalog as the source of truth for simulation, server validation, and client rendering. Matches store `stageId`; room creation validates only the creator level, and snapshots/status payloads carry `stageId` to all clients.

**Tech Stack:** JavaScript ES modules, Phaser 3, Socket.IO, Vitest, Vite.

---

## File Structure

- Create `shared/stages.js`: stage ids, unlock levels, platform geometry, lookup helpers, and room creation eligibility.
- Modify `shared/constants.js`: keep `STAGE` compatibility by exporting the default stage from `shared/stages.js`.
- Modify `shared/match.js`: store `stageId`, spawn from the selected stage, and resolve landing against all platforms.
- Modify `shared/cpu.js`: use the active stage main platform for recovery.
- Modify `shared/rooms.js`: include `stageId` in public status/snapshots and export room creation eligibility helpers.
- Modify `server/index.js`: accept `room:create` payload `{ stageId, playerLevel }`, reject locked stage creation, preserve stage on rematch.
- Modify `src/game/progression/progressionStore.js`: expose a stage unlock helper.
- Modify `src/game/net/socketClient.js`: send stage id and player level when creating rooms.
- Create `src/game/scenes/stageSelection.js`: pure menu-stage option and selection helpers.
- Modify `src/game/scenes/MenuScene.js`: add a map selector whose selected stage feeds CPU battle and online room creation while preserving invite auto-join.
- Modify `src/game/scenes/MatchScene.js`: create/render matches with the selected or snapshot stage id; draw platform rectangles from shared geometry.
- Create `public/assets/stage/tri-platform-arena.png`: AI-generated bitmap map art for the tri-platform stage.
- Modify `src/game/render/assetManifest.js`: load the AI-generated tri-platform stage asset.
- Test files: `test/shared/stageGeometry.test.js`, `test/shared/match.test.js`, `test/shared/rooms.test.js`, `src/game/net/socketClient.test.js`, `src/game/progression/progressionStore.test.js`, `src/game/scenes/stageSelection.test.js`, `src/game/scenes/menuLayout.test.js`, and `src/game/render/assetManifest.test.js`.

---

### Task 1: Shared Stage Catalog

**Files:**
- Create: `shared/stages.js`
- Modify: `shared/constants.js`
- Test: `test/shared/stageGeometry.test.js`

- [ ] **Step 1: Write the failing stage catalog tests**

Replace `test/shared/stageGeometry.test.js` with:

```js
import { describe, expect, it } from "vitest";
import { STAGE } from "../../shared/constants.js";
import {
  DEFAULT_STAGE_ID,
  STAGE_DEFINITIONS,
  TRI_PLATFORM_STAGE_ID,
  canCreateStageAtLevel,
  getStageDefinition,
  normalizeStageId
} from "../../shared/stages.js";

describe("stage collision geometry", () => {
  it("keeps the existing default arena geometry available through constants", () => {
    expect(DEFAULT_STAGE_ID).toBe("cosmic-floating");
    expect(STAGE).toBe(getStageDefinition(DEFAULT_STAGE_ID));
    expect(STAGE.platform).toMatchObject({ x: 200, y: 420, width: 880, height: 36 });
    expect(STAGE.platforms).toEqual([STAGE.platform]);
  });

  it("defines the approved tri-platform stage geometry", () => {
    expect(STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID]).toMatchObject({
      id: "tri-platform",
      name: "Tri Platform",
      unlockLevel: 10,
      mainPlatformId: "main"
    });
    expect(STAGE_DEFINITIONS[TRI_PLATFORM_STAGE_ID].platforms).toEqual([
      { id: "main", x: 200, y: 540, width: 880, height: 36 },
      { id: "left", x: 150, y: 460, width: 260, height: 28 },
      { id: "top", x: 485, y: 380, width: 310, height: 28 },
      { id: "right", x: 870, y: 460, width: 260, height: 28 }
    ]);
  });

  it("normalizes unknown stage ids back to the default stage", () => {
    expect(normalizeStageId("tri-platform")).toBe("tri-platform");
    expect(normalizeStageId("unknown-stage")).toBe(DEFAULT_STAGE_ID);
    expect(normalizeStageId(null)).toBe(DEFAULT_STAGE_ID);
  });

  it("gates tri-platform creation at level 10 only", () => {
    expect(canCreateStageAtLevel(DEFAULT_STAGE_ID, 1)).toEqual({ ok: true });
    expect(canCreateStageAtLevel(TRI_PLATFORM_STAGE_ID, 9)).toEqual({
      ok: false,
      error: "Stage unlocks at level 10"
    });
    expect(canCreateStageAtLevel(TRI_PLATFORM_STAGE_ID, 10)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/shared/stageGeometry.test.js
```

Expected: FAIL because `../../shared/stages.js` does not exist.

- [ ] **Step 3: Add the stage catalog**

Create `shared/stages.js`:

```js
export const DEFAULT_STAGE_ID = "cosmic-floating";
export const TRI_PLATFORM_STAGE_ID = "tri-platform";
export const TRI_PLATFORM_UNLOCK_LEVEL = 10;

const DEFAULT_PLATFORM = { id: "main", x: 200, y: 420, width: 880, height: 36 };

export const STAGE_DEFINITIONS = Object.freeze({
  [DEFAULT_STAGE_ID]: Object.freeze({
    id: DEFAULT_STAGE_ID,
    name: "Cosmic Floating",
    unlockLevel: 1,
    mainPlatformId: "main",
    platform: DEFAULT_PLATFORM,
    platforms: Object.freeze([DEFAULT_PLATFORM]),
    blastZone: { left: -180, right: 1460, top: -260, bottom: 940 },
    spawnA: { x: 360, y: 330, facing: 1 },
    spawnB: { x: 920, y: 330, facing: -1 }
  }),
  [TRI_PLATFORM_STAGE_ID]: Object.freeze({
    id: TRI_PLATFORM_STAGE_ID,
    name: "Tri Platform",
    unlockLevel: TRI_PLATFORM_UNLOCK_LEVEL,
    mainPlatformId: "main",
    platform: { id: "main", x: 200, y: 540, width: 880, height: 36 },
    platforms: Object.freeze([
      { id: "main", x: 200, y: 540, width: 880, height: 36 },
      { id: "left", x: 150, y: 460, width: 260, height: 28 },
      { id: "top", x: 485, y: 380, width: 310, height: 28 },
      { id: "right", x: 870, y: 460, width: 260, height: 28 }
    ]),
    blastZone: { left: -180, right: 1460, top: -260, bottom: 980 },
    spawnA: { x: 430, y: 450, facing: 1 },
    spawnB: { x: 850, y: 450, facing: -1 }
  })
});

export function normalizeStageId(stageId) {
  const id = typeof stageId === "string" ? stageId : "";
  return STAGE_DEFINITIONS[id] ? id : DEFAULT_STAGE_ID;
}

export function getStageDefinition(stageId = DEFAULT_STAGE_ID) {
  return STAGE_DEFINITIONS[normalizeStageId(stageId)];
}

export function getMainPlatform(stageId = DEFAULT_STAGE_ID) {
  const stage = getStageDefinition(stageId);
  return stage.platforms.find((platform) => platform.id === stage.mainPlatformId) ?? stage.platform;
}

export function canCreateStageAtLevel(stageId = DEFAULT_STAGE_ID, level = 1) {
  const stage = getStageDefinition(stageId);
  const numericLevel = Number(level);
  const playerLevel = Number.isFinite(numericLevel) ? Math.floor(numericLevel) : 1;
  if (playerLevel < stage.unlockLevel) {
    return { ok: false, error: `Stage unlocks at level ${stage.unlockLevel}` };
  }
  return { ok: true };
}
```

Modify `shared/constants.js` to import and export the default stage:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- test/shared/stageGeometry.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/stages.js shared/constants.js test/shared/stageGeometry.test.js
git commit -m "Add shared stage catalog"
```

---

### Task 2: Multi-Platform Match Simulation

**Files:**
- Modify: `shared/match.js`
- Modify: `shared/cpu.js`
- Test: `test/shared/match.test.js`
- Test: `test/shared/cpu.test.js`

- [ ] **Step 1: Write failing simulation tests**

Append these imports in `test/shared/match.test.js`:

```js
import { TRI_PLATFORM_STAGE_ID } from "../../shared/stages.js";
```

Append these tests inside the existing `describe("match simulation", () => { ... })` block:

```js
  it("creates tri-platform matches with stage-specific spawns", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });

    expect(match.stageId).toBe(TRI_PLATFORM_STAGE_ID);
    expect(match.fighters.p1.spawn).toMatchObject({ x: 430, y: 450, facing: 1 });
    expect(match.fighters.p2.spawn).toMatchObject({ x: 850, y: 450, facing: -1 });
  });

  it.each([
    ["left", 280, 460],
    ["top", 640, 380],
    ["right", 1000, 460],
    ["main", 640, 540]
  ])("lands on the %s tri-platform ledge", (_name, x, y) => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    match.fighters.p1.x = x;
    match.fighters.p1.y = y - 24;
    match.fighters.p1.velocity.y = 14;

    stepMatch(match, 16.67);

    expect(match.fighters.p1.y).toBe(y);
    expect(match.fighters.p1.onGround).toBe(true);
    expect(match.fighters.p1.velocity.y).toBe(0);
  });

  it("does not snap to a tri-platform ledge when moving upward from below", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    match.fighters.p1.x = 640;
    match.fighters.p1.y = 410;
    match.fighters.p1.velocity.y = -12;

    stepMatch(match, 16.67);

    expect(match.fighters.p1.y).toBeLessThan(410);
    expect(match.fighters.p1.y).not.toBe(380);
    expect(match.fighters.p1.onGround).toBe(false);
  });
```

In `test/shared/cpu.test.js`, add a test that recovery uses the active tri-platform main ledge:

```js
import { TRI_PLATFORM_STAGE_ID } from "../../shared/stages.js";
```

```js
  it("recovers toward the active stage main platform", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    const input = chooseCpuInput(match, "p2", "normal");

    match.fighters.p2.y = 660;
    match.fighters.p2.x = 100;
    const recovering = chooseCpuInput(match, "p2", "normal");

    expect(input).toEqual(expect.any(Object));
    expect(recovering.right).toBe(true);
    expect(recovering.jump).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- test/shared/match.test.js test/shared/cpu.test.js
```

Expected: FAIL because `createMatch` ignores `stageId`, landing checks only one platform, and CPU reads the default global stage.

- [ ] **Step 3: Implement stage-aware simulation**

In `shared/match.js`, change imports:

```js
import { ATTACKS } from "./attacks.js";
import { MATCH, PHYSICS } from "./constants.js";
import { getStageDefinition, normalizeStageId } from "./stages.js";
```

Replace `createMatch`:

```js
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
```

In `stepMatch`, replace:

```js
    integrateFighter(match.fighters[fighterId], dtMs);
```

with:

```js
    integrateFighter(match, match.fighters[fighterId], dtMs);
```

Replace `integrateFighter`:

```js
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

  const landingPlatform = findLandingPlatform(stage, fighter, previousFeet);
  if (landingPlatform) {
    fighter.y = landingPlatform.y;
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
      const feet = fighter.y;
      const withinPlatformX = fighter.x > platform.x && fighter.x < platform.x + platform.width;
      const crossedTop = previousFeet <= platform.y && feet >= platform.y;
      const withinSnapWindow = feet <= platform.y + 30;
      return withinPlatformX && crossedTop && withinSnapWindow;
    }) ?? null;
}
```

In `handleBlastZone`, replace:

```js
  const zone = STAGE.blastZone;
```

with:

```js
  const zone = getStageDefinition(match.stageId).blastZone;
```

In `shared/cpu.js`, replace the `STAGE` import:

```js
import { getMainPlatform } from "./stages.js";
```

Then inside `chooseCpuInput`, before recovery checks:

```js
  const mainPlatform = getMainPlatform(match.stageId);
```

Replace any `STAGE.platform` reads with `mainPlatform`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- test/shared/match.test.js test/shared/cpu.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/match.js shared/cpu.js test/shared/match.test.js test/shared/cpu.test.js
git commit -m "Support multi-platform stage simulation"
```

---

### Task 3: Room Creation Gating And Public Stage State

**Files:**
- Modify: `shared/rooms.js`
- Modify: `server/index.js`
- Test: `test/shared/rooms.test.js`

- [ ] **Step 1: Write failing room helper tests**

Add imports to `test/shared/rooms.test.js`:

```js
import { DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID } from "../../shared/stages.js";
```

Add `canCreateRoomWithStage` to the imported helpers from `../../shared/rooms.js`.

Append these tests inside `describe("room helpers", () => { ... })`:

```js
  it("validates stage unlocks only for room creation", () => {
    expect(canCreateRoomWithStage({ stageId: DEFAULT_STAGE_ID, playerLevel: 1 })).toEqual({
      ok: true,
      stageId: DEFAULT_STAGE_ID
    });
    expect(canCreateRoomWithStage({ stageId: TRI_PLATFORM_STAGE_ID, playerLevel: 9 })).toEqual({
      ok: false,
      error: "Stage unlocks at level 10"
    });
    expect(canCreateRoomWithStage({ stageId: TRI_PLATFORM_STAGE_ID, playerLevel: 10 })).toEqual({
      ok: true,
      stageId: TRI_PLATFORM_STAGE_ID
    });
  });

  it("includes stage id in public room status and snapshots", () => {
    const room = {
      code: "ABCDE",
      phase: "waiting",
      match: { status: "playing", stageId: TRI_PLATFORM_STAGE_ID },
      players: new Map([["socket-a", "p1"]]),
      rematchRequests: new Set()
    };
    const match = {
      stageId: TRI_PLATFORM_STAGE_ID,
      status: "playing",
      winnerId: null,
      endReason: null,
      elapsedMs: 0,
      effects: [],
      fighters: { p1: { id: "p1" }, p2: { id: "p2" } }
    };

    expect(toPublicRoomStatus(room)).toMatchObject({ stageId: TRI_PLATFORM_STAGE_ID });
    expect(toPublicSnapshot(match)).toMatchObject({ stageId: TRI_PLATFORM_STAGE_ID });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- test/shared/rooms.test.js
```

Expected: FAIL because `canCreateRoomWithStage` and public `stageId` fields do not exist.

- [ ] **Step 3: Implement room helper behavior**

In `shared/rooms.js`, add imports:

```js
import { canCreateStageAtLevel, normalizeStageId } from "./stages.js";
```

Add this helper near `createRoomCode`:

```js
export function canCreateRoomWithStage(payload = {}) {
  const stageId = normalizeStageId(payload.stageId);
  const allowed = canCreateStageAtLevel(stageId, payload.playerLevel);
  if (!allowed.ok) return allowed;
  return { ok: true, stageId };
}
```

In `toPublicRoomStatus`, add:

```js
    stageId: room?.match?.stageId ?? null,
```

In `toPublicSnapshot`, add:

```js
    stageId: match.stageId,
```

- [ ] **Step 4: Wire server room creation and rematch preservation**

In `server/index.js`, import `canCreateRoomWithStage` from `../shared/rooms.js`.

Replace the `room:create` handler:

```js
  socket.on("room:create", (payload, ack) => {
    const creation = canCreateRoomWithStage(payload);
    if (!creation.ok) return sendAck(ack, creation);

    const code = createRoomCode(new Set(rooms.keys()));
    const room = createServerRoom(code, creation.stageId);
    releaseSocketFromGameRooms(socket);
    rooms.set(code, room);
    joinRoom(socket, room, ack);
  });
```

Replace `createServerRoom`:

```js
function createServerRoom(code, stageId) {
  const room = {
    code,
    players: new Map(),
    match: createMatch("online", { stageId }),
    phase: "waiting",
    rematchRequests: new Set(),
    countdownTimers: [],
    interval: null
  };
  return room;
}
```

In the rematch handler, replace:

```js
    room.match = createMatch("online");
```

with:

```js
    room.match = createMatch("online", { stageId: room.match.stageId });
```

- [ ] **Step 5: Run tests to verify room helpers pass**

Run:

```bash
npm test -- test/shared/rooms.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/rooms.js server/index.js test/shared/rooms.test.js
git commit -m "Gate tri-platform room creation"
```

---

### Task 4: Client Stage Selection, Socket Payloads, And Rendering

**Files:**
- Modify: `src/game/progression/progressionStore.js`
- Modify: `src/game/progression/progressionStore.test.js`
- Modify: `src/game/net/socketClient.js`
- Modify: `src/game/net/socketClient.test.js`
- Create: `src/game/scenes/stageSelection.js`
- Create: `src/game/scenes/stageSelection.test.js`
- Modify: `src/game/scenes/menuLayout.js`
- Modify: `src/game/scenes/menuLayout.test.js`
- Create: `public/assets/stage/tri-platform-arena.png`
- Modify: `src/game/render/assetManifest.js`
- Modify: `src/game/render/assetManifest.test.js`
- Modify: `src/game/scenes/MenuScene.js`
- Modify: `src/game/scenes/MatchScene.js`

- [ ] **Step 1: Write failing progression, socket, and menu-stage tests**

In `src/game/progression/progressionStore.test.js`, import the new helper:

```js
const { awardMatchXp, canUseStage, loadProgression, selectPlayerPalette } = await import("./progressionStore.js");
```

Append:

```js
  it("reports tri-platform stage availability at level 10", () => {
    expect(canUseStage("cosmic-floating", { level: 1 })).toBe(true);
    expect(canUseStage("tri-platform", { level: 9 })).toBe(false);
    expect(canUseStage("tri-platform", { level: 10 })).toBe(true);
  });
```

Create `src/game/scenes/stageSelection.test.js`:

```js
import { describe, expect, it } from "vitest";
import { DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID } from "../../../shared/stages.js";
import { getMenuStageOptions, resolveMenuStageSelection } from "./stageSelection.js";

describe("menu stage selection", () => {
  it("shows tri-platform as locked below level 10", () => {
    expect(getMenuStageOptions({ level: 9 }, DEFAULT_STAGE_ID)).toEqual([
      {
        id: DEFAULT_STAGE_ID,
        name: "Cosmic Floating",
        label: "Cosmic Floating",
        locked: false,
        selected: true,
        unlockLevel: 1
      },
      {
        id: TRI_PLATFORM_STAGE_ID,
        name: "Tri Platform",
        label: "Tri Platform - Level 10",
        locked: true,
        selected: false,
        unlockLevel: 10
      }
    ]);
  });

  it("selects tri-platform at level 10", () => {
    expect(resolveMenuStageSelection(TRI_PLATFORM_STAGE_ID, { level: 10 }, DEFAULT_STAGE_ID)).toEqual({
      stageId: TRI_PLATFORM_STAGE_ID,
      notice: ""
    });
  });

  it("keeps the current selection when a locked stage is clicked", () => {
    expect(resolveMenuStageSelection(TRI_PLATFORM_STAGE_ID, { level: 9 }, DEFAULT_STAGE_ID)).toEqual({
      stageId: DEFAULT_STAGE_ID,
      notice: "Stage unlocks at level 10"
    });
  });
});
```

In `src/game/scenes/menuLayout.test.js`, update the import:

```js
import { getMenuButtonLayout, getStageChoiceLayout, isPointInRect } from "./menuLayout.js";
```

Append:

```js
  it("places the map picker above the match mode buttons", () => {
    const cosmic = getStageChoiceLayout("cosmic-floating");
    const triPlatform = getStageChoiceLayout("tri-platform");
    const cpu = getMenuButtonLayout("cpu");

    expect(cosmic.y).toBe(triPlatform.y);
    expect(cosmic.x).toBeLessThan(triPlatform.x);
    expect(cosmic.y).toBeLessThan(cpu.y);
  });
```

In `src/game/net/socketClient.test.js`, add:

```js
  it("creates rooms with selected stage and creator level", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "room:create") ack({ ok: true, roomCode: "ROOM1", playerId: "p1" });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await expect(client.createRoom({ stageId: "tri-platform", playerLevel: 10 })).resolves.toMatchObject({ ok: true });

    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "room:create",
      { stageId: "tri-platform", playerLevel: 10 },
      expect.any(Function)
    );
  });
```

In `src/game/render/assetManifest.test.js`, update the stage image test to cover the AI-generated tri-platform asset:

```js
  it("loads stage backgrounds", () => {
    const images = new Map();
    const scene = {
      load: {
        image: (key, path) => images.set(key, path),
        spritesheet: () => {}
      }
    };

    loadGameAssets(scene);

    expect(images.get("stage:cosmic-floating")).toBe("/assets/stage/cosmic-floating-arena.png");
    expect(images.get("stage:tri-platform")).toBe("/assets/stage/tri-platform-arena.png");
    expect(readPngSize(`public${images.get("stage:tri-platform")}`)).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number)
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/game/progression/progressionStore.test.js src/game/net/socketClient.test.js src/game/scenes/stageSelection.test.js src/game/scenes/menuLayout.test.js src/game/render/assetManifest.test.js
```

Expected: FAIL because `canUseStage`, `stageSelection.js`, `getStageChoiceLayout`, `stage:tri-platform`, and `createRoom` payload options do not exist.

- [ ] **Step 3: Implement progression helper, socket payload, and pure stage-selection helper**

In `src/game/progression/progressionStore.js`, import:

```js
import { canCreateStageAtLevel } from "../../../shared/stages.js";
```

Add:

```js
export function canUseStage(stageId, progress = loadProgression()) {
  return canCreateStageAtLevel(stageId, progress.level).ok;
}
```

In `src/game/net/socketClient.js`, replace:

```js
    createRoom() {
      return emitWithAck(socket, "room:create", {}, ackTimeoutMs, pendingAcks);
    },
```

with:

```js
    createRoom(options = {}) {
      return emitWithAck(socket, "room:create", {
        stageId: options.stageId,
        playerLevel: options.playerLevel
      }, ackTimeoutMs, pendingAcks);
    },
```

Create `src/game/scenes/stageSelection.js`:

```js
import {
  DEFAULT_STAGE_ID,
  TRI_PLATFORM_STAGE_ID,
  canCreateStageAtLevel,
  getStageDefinition,
  normalizeStageId
} from "../../../shared/stages.js";

export const MENU_STAGE_IDS = [DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID];

export function getMenuStageOptions(progress = { level: 1 }, selectedStageId = DEFAULT_STAGE_ID) {
  const selected = normalizeStageId(selectedStageId);
  return MENU_STAGE_IDS.map((stageId) => {
    const stage = getStageDefinition(stageId);
    const allowed = canCreateStageAtLevel(stageId, progress.level);
    return {
      id: stage.id,
      name: stage.name,
      label: allowed.ok ? stage.name : `${stage.name} - Level ${stage.unlockLevel}`,
      locked: !allowed.ok,
      selected: selected === stage.id,
      unlockLevel: stage.unlockLevel
    };
  });
}

export function resolveMenuStageSelection(stageId, progress = { level: 1 }, currentStageId = DEFAULT_STAGE_ID) {
  const normalized = normalizeStageId(stageId);
  const current = normalizeStageId(currentStageId);
  const allowed = canCreateStageAtLevel(normalized, progress.level);
  if (!allowed.ok) {
    return { stageId: current, notice: allowed.error };
  }
  return { stageId: normalized, notice: "" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/game/progression/progressionStore.test.js src/game/net/socketClient.test.js src/game/scenes/stageSelection.test.js
```

Expected: PASS.

- [ ] **Step 5: Add the AI-generated tri-platform stage asset and manifest entry**

Use the `imagegen` skill's built-in image generation path to create a project-bound stage bitmap. Save the final selected PNG at:

```text
public/assets/stage/tri-platform-arena.png
```

Prompt requirements:

```text
Create a game-ready 16:9 2D platform-fighter stage background, no characters and no text. The image should show a bright floating ruins arena in the sky with one wide lower horizontal platform and three smaller floating horizontal platforms in a Battlefield / Super Smash Bros. layout. Place the main platform low in the lower quarter, the left and right mini platforms lower-middle, and the top mini platform above them with open space between all platforms. Style: colorful pixel-art inspired digital painting, crisp clean silhouettes, ancient stone slabs with gold metal trim, moss, subtle cyan energy accents, blue sky, clouds, distant mountains. The platforms must look clean and horizontal so exact hitbox-aligned platform rectangles can be overlaid later. No platform cast shadows, no drop shadows, no contact shadows, no UI, no labels, no watermark, no characters, no logos.
```

Important:
- Do not reference an image from `$HOME/.codex/generated_images` directly in code.
- Move or copy the selected generated PNG into `public/assets/stage/tri-platform-arena.png`.
- The AI bitmap is visual art only. Physics and exact platform overlay still come from `shared/stages.js`.
- Visible gameplay platform overlays must be flat and shadowless, with no cast shadow, drop shadow, or offset shadow effect.

In `src/game/render/assetManifest.js`, add:

```js
  scene.load.image("stage:tri-platform", "/assets/stage/tri-platform-arena.png");
```

- [ ] **Step 6: Run asset manifest tests**

Run:

```bash
npm test -- src/game/render/assetManifest.test.js
```

Expected: PASS.

- [ ] **Step 7: Add menu-stage layout**

In `src/game/scenes/menuLayout.js`, add this `STAGE_CHOICES` object after `BUTTONS`:

```js
const STAGE_CHOICES = {
  "cosmic-floating": {
    x: 104,
    y: 202,
    width: 214,
    height: 48,
    fontSize: "17px"
  },
  "tri-platform": {
    x: 334,
    y: 202,
    width: 246,
    height: 48,
    fontSize: "17px"
  }
};
```

Update the existing button y positions:

```js
  cpu: {
    x: 104,
    y: 292,
```

```js
  createRoom: {
    x: 104,
    y: 366,
```

```js
  enterCode: {
    x: 104,
    y: 440,
```

Add this export:

```js
export function getStageChoiceLayout(stageId) {
  return STAGE_CHOICES[stageId];
}
```

- [ ] **Step 8: Run menu layout tests**

Run:

```bash
npm test -- src/game/scenes/menuLayout.test.js
```

Expected: PASS.

- [ ] **Step 9: Implement menu picker and match rendering**

In `src/game/scenes/MenuScene.js`, import stage ids:

```js
import { DEFAULT_STAGE_ID } from "../../../shared/stages.js";
```

Import stage selection helpers:

```js
import { getMenuStageOptions, resolveMenuStageSelection } from "./stageSelection.js";
```

Update the menu layout import:

```js
import { getMenuButtonLayout, getStageChoiceLayout, isPointInRect } from "./menuLayout.js";
```

After `this.playerPalette = selectPlayerPalette(progress);`, add:

```js
    this.progress = progress;
    this.selectedStageId = DEFAULT_STAGE_ID;
    this.stageChoiceControls = new Map();
```

After the title and notice setup, call:

```js
    this.createStagePicker();
```

Change the CPU button callback:

```js
      this.scene.start("MatchScene", {
        mode: "cpu",
        playerPalette: this.playerPalette,
        stageId: this.selectedStageId
      });
```

Change the existing create-room button callback:

```js
      this.scene.start("MatchScene", {
        mode: "online-create",
        stageId: this.selectedStageId,
        playerLevel: progress.level
      });
```

Add these methods to `MenuScene`:

```js
  createStagePicker() {
    this.add.text(104, 162, "Map", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f9f5d7",
      stroke: "#07111f",
      strokeThickness: 4
    });

    for (const option of getMenuStageOptions(this.progress, this.selectedStageId)) {
      const layout = getStageChoiceLayout(option.id);
      const control = this.createStageChoice(layout, option);
      this.stageChoiceControls.set(option.id, control);
    }
    this.refreshStagePicker();
  }

  createStageChoice(layout, option) {
    const container = this.add.container(layout.x, layout.y);
    const background = this.add.rectangle(0, 0, layout.width, layout.height, 0x10253a, 0.9).setOrigin(0, 0.5);
    background.setStrokeStyle(2, 0x79d7ff, 0.86);
    const text = this.add.text(16, 0, option.label, {
      fontFamily: "monospace",
      fontSize: layout.fontSize,
      color: "#ffffff"
    }).setOrigin(0, 0.5);
    const hitZone = this.add.zone(0, 0, layout.width, layout.height).setOrigin(0, 0.5).setInteractive({
      useHandCursor: true
    });

    container.add([background, text, hitZone]);
    hitZone.on("pointerdown", () => this.selectStage(option.id));
    return { background, text };
  }

  selectStage(stageId) {
    const selection = resolveMenuStageSelection(stageId, this.progress, this.selectedStageId);
    this.selectedStageId = selection.stageId;
    this.refreshStagePicker();
    if (selection.notice) this.createNotice(selection.notice);
  }

  refreshStagePicker() {
    for (const option of getMenuStageOptions(this.progress, this.selectedStageId)) {
      const control = this.stageChoiceControls.get(option.id);
      if (!control) continue;
      control.text.setText(option.label);
      control.text.setColor(option.locked ? "#aab4bf" : "#ffffff");
      control.background.setFillStyle(option.selected ? 0x24646f : option.locked ? 0x29313a : 0x10253a, 0.94);
      control.background.setStrokeStyle(2, option.selected ? 0xffd166 : 0x79d7ff, option.locked ? 0.42 : 0.9);
    }
  }
```

In `src/game/scenes/MatchScene.js`, import:

```js
import { DEFAULT_STAGE_ID, getStageDefinition } from "../../../shared/stages.js";
```

Set stage id before `createMatch`:

```js
    this.stageId = data.stageId || DEFAULT_STAGE_ID;
    this.match = createMatch(this.mode, { stageId: this.stageId });
```

Replace the hardcoded stage background creation with:

```js
    this.stageBackground = this.add.image(WIDTH / 2, HEIGHT / 2, getStageAssetKey(this.stageId)).setDisplaySize(WIDTH, HEIGHT);
```

When creating online rooms, replace:

```js
      response = this.mode === "online-create" ? await this.net.createRoom() : await this.net.joinRoom(data.roomCode);
```

with:

```js
      response = this.mode === "online-create"
        ? await this.net.createRoom({ stageId: this.stageId, playerLevel: data.playerLevel })
        : await this.net.joinRoom(data.roomCode);
```

When receiving snapshots, preserve stage id:

```js
      this.match = snapshot;
      this.stageId = snapshot.stageId || this.stageId;
      this.stageBackground?.setTexture(getStageAssetKey(this.stageId));
      this.renderStagePlatforms();
```

Add stage platform rendering after the background image is added:

```js
    this.stagePlatformGraphics = this.add.graphics();
    this.renderStagePlatforms();
```

Add method:

```js
  renderStagePlatforms() {
    if (!this.stagePlatformGraphics) return;
    const stage = getStageDefinition(this.match?.stageId || this.stageId);
    this.stagePlatformGraphics.clear();
    for (const platform of stage.platforms) {
      this.stagePlatformGraphics.fillStyle(platform.id === "main" ? 0x2d3b44 : 0x35445f, 0.96);
      this.stagePlatformGraphics.fillRoundedRect(platform.x, platform.y, platform.width, platform.height, 4);
      this.stagePlatformGraphics.lineStyle(3, 0xffd166, 0.98);
      this.stagePlatformGraphics.strokeRoundedRect(platform.x, platform.y, platform.width, platform.height, 4);
    }
  }
```

Add this helper at the bottom of `MatchScene.js`:

```js
function getStageAssetKey(stageId) {
  return stageId === "tri-platform" ? "stage:tri-platform" : "stage:cosmic-floating";
}
```

- [ ] **Step 10: Run focused client tests**

Run:

```bash
npm test -- src/game/progression/progressionStore.test.js src/game/net/socketClient.test.js src/game/scenes/stageSelection.test.js src/game/scenes/menuLayout.test.js src/game/render/assetManifest.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add public/assets/stage/tri-platform-arena.png src/game/progression/progressionStore.js src/game/progression/progressionStore.test.js src/game/net/socketClient.js src/game/net/socketClient.test.js src/game/scenes/stageSelection.js src/game/scenes/stageSelection.test.js src/game/scenes/MenuScene.js src/game/scenes/MatchScene.js src/game/scenes/menuLayout.js src/game/scenes/menuLayout.test.js src/game/render/assetManifest.js src/game/render/assetManifest.test.js
git commit -m "Add tri-platform client selection"
```

---

### Task 5: Verification And Polish

**Files:**
- Modify only files with failures found by verification.
- Test: focused tests, full suite, build.

- [ ] **Step 1: Run the full focused feature suite**

Run:

```bash
npm test -- test/shared/stageGeometry.test.js test/shared/match.test.js test/shared/rooms.test.js src/game/net/socketClient.test.js src/game/progression/progressionStore.test.js src/game/scenes/stageSelection.test.js src/game/scenes/menuLayout.test.js src/game/render/assetManifest.test.js
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite build output and no unresolved imports.

- [ ] **Step 4: Start the local app**

Run:

```bash
npm run dev
```

Expected: Vite and the Node server start. Use the printed local URL.

- [ ] **Step 5: Manual browser checks**

Check these flows:

```text
1. With local storage cleared or below level 10, the map picker shows Cosmic Floating selected and Tri Platform locked.
2. Below level 10, clicking the locked Tri Platform map keeps Cosmic Floating selected and shows the level 10 notice.
3. Below level 10, Create Online Room still creates a Cosmic Floating room.
4. With local storage set to at least {"xp":2700,"level":10}, Tri Platform can be selected in the map picker.
5. After selecting Tri Platform at level 10, CPU Battle starts on the AI-generated tri-platform stage art.
6. After selecting Tri Platform at level 10, Create Online Room creates a tri-platform room using the AI-generated stage art.
7. The invite link for a tri-platform room can be opened in a lower-level browser profile and joins successfully.
8. Both online clients render the same AI-generated tri-platform layout.
9. Fighters land on the main, left, top, and right platforms exactly on the visible ledges.
10. A rematch keeps the tri-platform stage.
```

- [ ] **Step 6: Commit verification fixes**

If verification required fixes, commit them:

```bash
git add shared src test
git commit -m "Polish tri-platform stage verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers shared geometry, collision, AI-generated stage art, rendering, menu map selection for CPU and online creation, room creation unlocks, invite joins below level 10, snapshots/status `stageId`, rematch persistence, tests, and manual verification.
- Placeholder scan: Clear.
- Type consistency: The plan consistently uses `stageId`, `DEFAULT_STAGE_ID`, `TRI_PLATFORM_STAGE_ID`, `getStageDefinition`, `normalizeStageId`, `canCreateStageAtLevel`, `canCreateRoomWithStage`, `canUseStage`, `getMenuStageOptions`, and `resolveMenuStageSelection`.
