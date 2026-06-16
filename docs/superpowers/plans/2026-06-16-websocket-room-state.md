# Websocket Room State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make online room lifecycle websocket handling structured, consistent, and resilient so result-screen rematches and rematch starts behave the same after wins and forfeits.

**Architecture:** Keep the existing Socket.IO event names, but centralize public room state and input validation in `shared/rooms.js`. The server emits structured `room:status` payloads from that helper, and client state helpers consume structured fields instead of free-text messages wherever gameplay behavior is involved.

**Tech Stack:** Node.js, Express, Socket.IO, Phaser, Vitest.

---

## File Structure

- Modify `shared/rooms.js`: add public room status helper, pause ownership helpers, input sanitizer, and input rate guard.
- Modify `test/shared/rooms.test.js`: add red/green tests for the new shared helper behavior.
- Modify `server/index.js`: emit structured room statuses, fix phase ordering, enforce pause ownership, validate/rate-limit inputs, and preserve rooms with remaining players on disconnect.
- Modify `src/game/scenes/matchOverlayState.js`: prefer structured room status fields over message parsing.
- Modify `src/game/scenes/matchOverlayState.test.js`: cover structured countdown, pause, waiting, disconnect, and active snapshot behavior.
- Modify `src/game/scenes/resultsState.js`: hide rematch from structured disconnect/players state and ensure rematch request display remains end-reason agnostic.
- Modify `src/game/scenes/resultsState.test.js`: cover structured status equivalents for wins and forfeits.
- Modify `src/game/scenes/ResultsScene.js`: start rematch only from snapshots that are actively moving toward a new round, not any stale `status: "playing"` snapshot.
- Modify `src/game/net/socketClient.js`: make pause and leave use acknowledgements.
- Modify `src/game/net/socketClient.test.js`: update expectations for acked pause/leave.

## Task 1: Shared Room Status Contract

**Files:**
- Modify: `shared/rooms.js`
- Test: `test/shared/rooms.test.js`

- [ ] **Step 1: Write failing shared room status tests**

Add tests proving:

```js
expect(toPublicRoomStatus(room, { message: "Fight", reason: "countdown" })).toEqual({
  message: "Fight",
  reason: "countdown",
  roomCode: "ABCDE",
  players: 2,
  phase: "playing",
  status: "playing",
  pausedBy: null,
  rematch: { requestedBy: null, requested: 0, required: 2 }
});

expect(createRematchRequestStatus(room, "p1", { requested: 1, required: 2 })).toMatchObject({
  reason: "rematch",
  phase: "complete",
  status: "complete",
  rematch: { requestedBy: "p1", requested: 1, required: 2 }
});
```

Also add tests for `canResumeRoomPause`, `sanitizeMatchInput`, and `createInputRateGuard`.

- [ ] **Step 2: Run red tests**

Run:

```bash
npm test -- test/shared/rooms.test.js
```

Expected: FAIL because `toPublicRoomStatus`, `canResumeRoomPause`, `sanitizeMatchInput`, and `createInputRateGuard` are not implemented yet.

- [ ] **Step 3: Implement shared helpers**

Add to `shared/rooms.js`:

```js
const INPUT_FIELDS = [
  "left",
  "right",
  "up",
  "down",
  "jump",
  "light",
  "heavy",
  "special",
  "dodge",
  "shield"
];

export function toPublicRoomStatus(room, { message = "", reason = null, rematch = null } = {}) {
  const requestedBy = rematch?.requestedBy ?? null;
  const requested = rematch?.requested ?? room?.rematchRequests?.size ?? 0;
  const required = rematch?.required ?? room?.players?.size ?? 0;

  return {
    message,
    reason,
    roomCode: room?.code ?? "",
    players: room?.players?.size ?? 0,
    phase: room?.phase ?? null,
    status: room?.match?.status ?? null,
    pausedBy: room?.pausedBy ?? null,
    rematch: {
      requestedBy,
      requested,
      required
    }
  };
}

export function canResumeRoomPause(room, playerId) {
  if (room?.phase !== "paused") return { ok: false, error: "Room is not paused" };
  if (!room.pausedBy) return { ok: true };
  if (room.pausedBy !== playerId) return { ok: false, error: "Only the pausing player can resume" };
  return { ok: true };
}

export function sanitizeMatchInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const sanitized = {};
  for (const field of INPUT_FIELDS) {
    if (typeof input[field] === "boolean") sanitized[field] = input[field];
  }
  return sanitized;
}

export function createInputRateGuard({ limit = 120, windowMs = 1000 } = {}) {
  const buckets = new Map();
  return {
    allow(socketId, now = Date.now()) {
      const bucket = buckets.get(socketId);
      if (!bucket || now - bucket.startedAt >= windowMs) {
        buckets.set(socketId, { startedAt: now, count: 1 });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= limit;
    },
    clear(socketId) {
      buckets.delete(socketId);
    }
  };
}
```

Update `createRematchRequestStatus` to return `toPublicRoomStatus(room, { message, reason: "rematch", rematch: { requestedBy, requested, required } })`.

- [ ] **Step 4: Run green tests**

Run:

```bash
npm test -- test/shared/rooms.test.js
```

Expected: PASS.

## Task 2: Server Structured Status And Phase Ordering

**Files:**
- Modify: `server/index.js`
- Test: `test/shared/rooms.test.js`

- [ ] **Step 1: Write failing helper tests for lifecycle decision points**

Add shared tests proving:

```js
expect(toPublicRoomStatus({ ...room, phase: "complete", match: { status: "complete" } }, {
  message: "p1 forfeited",
  reason: "forfeit"
})).toMatchObject({ phase: "complete", status: "complete", reason: "forfeit" });

expect(shouldDeleteRoomAfterSocketRemoval({ emptied: false, room: { phase: "waiting" } })).toBe(false);
expect(shouldDeleteRoomAfterSocketRemoval({ emptied: true, room: { phase: "waiting" } })).toBe(true);
```

- [ ] **Step 2: Run red tests**

Run:

```bash
npm test -- test/shared/rooms.test.js
```

Expected: FAIL because `shouldDeleteRoomAfterSocketRemoval` is missing.

- [ ] **Step 3: Implement lifecycle helper**

Add:

```js
export function shouldDeleteRoomAfterSocketRemoval(removal) {
  return Boolean(removal?.emptied);
}
```

- [ ] **Step 4: Update server emissions**

In `server/index.js`:

- Import `toPublicRoomStatus`, `sanitizeMatchInput`, `createInputRateGuard`, `canResumeRoomPause`, and `shouldDeleteRoomAfterSocketRemoval`.
- Create `const inputRateGuard = createInputRateGuard();` next to `rooms`.
- Replace ad hoc `room:status` payloads with `toPublicRoomStatus(room, { message, reason })`.
- In `startRoomInterval`, set `room.phase = "complete"` before emitting the final complete snapshot:

```js
stepMatch(room.match, FIXED_DT_MS);
if (room.match.status === "complete") {
  room.phase = "complete";
  io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
  io.to(room.code).emit("room:status", toPublicRoomStatus(room, { message: "Match complete", reason: room.match.endReason || "win" }));
  stopRoomInterval(room);
  return;
}
io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
```

- In rematch handling, set `room.phase = "countdown"` before emitting the reset snapshot and make `startRoomCountdown` tolerate phase already being `countdown`.
- In `match:input`, return early when `!inputRateGuard.allow(socket.id)`, and call `queueInput(room.match, playerId, sanitizeMatchInput(safePayload.input))`.
- In `disconnect`, call `inputRateGuard.clear(socket.id)`.
- In non-forfeit disconnect handling, delete only when `shouldDeleteRoomAfterSocketRemoval(removal)` is true; otherwise leave the room alive and emit structured disconnect status.

- [ ] **Step 5: Run focused server/helper tests**

Run:

```bash
npm test -- test/shared/rooms.test.js
```

Expected: PASS.

## Task 3: Pause Ownership And Acked Control Actions

**Files:**
- Modify: `server/index.js`
- Modify: `src/game/net/socketClient.js`
- Test: `src/game/net/socketClient.test.js`

- [ ] **Step 1: Write failing socket client tests**

Update tests to expect:

```js
await expect(client.leaveRoom("ROOM1")).resolves.toEqual({ ok: true });
expect(fakeSocket.emit).toHaveBeenCalledWith("match:leave", { roomCode: "ROOM1" }, expect.any(Function));

await expect(client.setPaused("ROOM1", true)).resolves.toEqual({ ok: true });
expect(fakeSocket.emit).toHaveBeenCalledWith("match:pause", { roomCode: "ROOM1", paused: true }, expect.any(Function));
```

- [ ] **Step 2: Run red client tests**

Run:

```bash
npm test -- src/game/net/socketClient.test.js
```

Expected: FAIL because `leaveRoom` and `setPaused` are currently fire-and-forget.

- [ ] **Step 3: Ack client control actions**

In `src/game/net/socketClient.js`, change:

```js
leaveRoom(roomCode) {
  return emitWithAck(socket, "match:leave", { roomCode }, ackTimeoutMs, pendingAcks);
}

setPaused(roomCode, paused) {
  return emitWithAck(socket, "match:pause", { roomCode, paused: Boolean(paused) }, ackTimeoutMs, pendingAcks);
}
```

- [ ] **Step 4: Ack server pause and leave**

In `server/index.js`, accept `ack` for `match:pause` and `match:leave`.

Pause rules:

```js
if (payload?.paused && room.phase === "playing") {
  room.phase = "paused";
  room.pausedBy = playerId;
  stopRoomInterval(room);
  io.to(room.code).emit("room:status", toPublicRoomStatus(room, { message: `${playerId} paused`, reason: "pause" }));
  return sendAck(ack, { ok: true });
}

if (!payload?.paused) {
  const resumable = canResumeRoomPause(room, playerId);
  if (!resumable.ok) return sendAck(ack, resumable);
  room.phase = "playing";
  room.pausedBy = null;
  startRoomInterval(room);
  io.to(room.code).emit("room:status", toPublicRoomStatus(room, { message: "Fight", reason: "resume" }));
  return sendAck(ack, { ok: true });
}
```

Leave should send `{ ok: true }` after emitting the forfeit snapshot/status.

- [ ] **Step 5: Run green client tests**

Run:

```bash
npm test -- src/game/net/socketClient.test.js
```

Expected: PASS.

## Task 4: Client Structured Overlay And Result Behavior

**Files:**
- Modify: `src/game/scenes/matchOverlayState.js`
- Modify: `src/game/scenes/matchOverlayState.test.js`
- Modify: `src/game/scenes/resultsState.js`
- Modify: `src/game/scenes/resultsState.test.js`
- Modify: `src/game/scenes/ResultsScene.js`

- [ ] **Step 1: Write failing overlay/result tests**

Add tests proving:

```js
expect(getOnlineOverlayState({ phase: "waiting", players: 1, reason: "waiting", message: "Waiting for opponent" }, true)).toMatchObject({
  title: "Waiting for opponent",
  canCopyInvite: true
});

expect(getOnlineOverlayState({ phase: "paused", pausedBy: "p1", message: "p1 paused" }, false)).toMatchObject({
  title: "Paused",
  canResume: true
});

expect(shouldHideOnlineRematchOnStatus({ reason: "disconnect", players: 1 })).toBe(true);
expect(shouldHideOnlineRematchOnStatus({ reason: "forfeit", players: 2 })).toBe(false);
```

Add a helper if needed:

```js
expect(isRematchStartSnapshot({ status: "playing", phase: "countdown" })).toBe(true);
expect(isRematchStartSnapshot({ status: "playing", phase: "complete" })).toBe(false);
```

- [ ] **Step 2: Run red tests**

Run:

```bash
npm test -- src/game/scenes/matchOverlayState.test.js src/game/scenes/resultsState.test.js
```

Expected: FAIL for missing structured-state behavior.

- [ ] **Step 3: Implement structured helpers**

Update `getOnlineOverlayState` to check structured fields first:

- waiting: `phase === "waiting"` and `players < 2`.
- disconnected: `reason === "disconnect"` or legacy `"Room disconnected"`.
- rematch/countdown: `phase === "countdown"` or `reason === "rematch"`.
- paused: `phase === "paused"` or `pausedBy`.

Update `shouldHideOnlineRematchOnStatus` to use `reason === "disconnect"` or `players < 2`.

Add and use:

```js
export function isRematchStartSnapshot(snapshot = {}) {
  return snapshot.status === "playing" && ["countdown", "playing"].includes(snapshot.phase);
}
```

In `ResultsScene`, replace `if (snapshot.status !== "playing") return;` with the helper so stale `phase: "complete"` snapshots do not start a frozen rematch.

- [ ] **Step 4: Run green tests**

Run:

```bash
npm test -- src/game/scenes/matchOverlayState.test.js src/game/scenes/resultsState.test.js
```

Expected: PASS.

## Task 5: Full Verification, Commit, Redeploy, Push

**Files:**
- All modified source and test files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- test/shared/rooms.test.js src/game/net/socketClient.test.js src/game/scenes/matchOverlayState.test.js src/game/scenes/resultsState.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

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

Expected: PASS and `dist/` updates if this repo tracks build output.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git status --short
git add server/index.js shared/rooms.js src/game/net/socketClient.js src/game/net/socketClient.test.js src/game/scenes/MatchScene.js src/game/scenes/ResultsScene.js src/game/scenes/matchOverlayState.js src/game/scenes/matchOverlayState.test.js src/game/scenes/resultsState.js src/game/scenes/resultsState.test.js test/shared/rooms.test.js docs/superpowers/plans/2026-06-16-websocket-room-state.md
git commit -m "Fix websocket room state handling"
```

Expected: commit succeeds.

- [ ] **Step 5: Redeploy**

Run from the app or deployment root used by the existing Docker/Caddy setup:

```bash
docker compose up --build -d
docker compose ps
curl -fsS https://pixelarenafighter.nayanbhut.dev/health
```

Expected: service is healthy and reports `service: "pixel-arena-fighter"`.

- [ ] **Step 6: Push**

Run:

```bash
git push
```

Expected: current `main` branch pushes to the configured GitLab remote.

## Self-Review

- The plan covers every requirement in `docs/superpowers/specs/2026-06-16-websocket-room-state-design.md`.
- Tests are introduced before production changes in each task.
- The existing rematch-freeze changes are incorporated instead of reverted.
- The plan avoids a new websocket namespace and keeps protocol migration incremental.
- No placeholders remain.
