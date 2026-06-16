# Websocket Room State Correctness

Date: 2026-06-16

## Purpose

Make online match lifecycle behavior consistent across normal wins, forfeits, rematches, pause/resume, disconnects, and malformed websocket traffic. The current implementation mixes authoritative state with free-text status messages, which has already produced divergent result-screen and rematch behavior.

The finished behavior should be boring in the best way: every client sees the same structured room state, game logic keys off structured fields, and display text is only display text.

## Chosen Approach

Use a structured room state contract and keep the existing socket event surface mostly intact.

The server will continue to emit `room:status` for compatibility, but the payload should consistently include authoritative fields such as `roomCode`, `phase`, `status`, `players`, `pausedBy`, `rematch`, `reason`, and `message`. Clients can still render `message`, but they should stop using message substrings like `"Fight"`, `"paused"`, or `"started a rematch"` to drive gameplay behavior.

This is safer than renaming the websocket protocol in one pass because existing scenes and tests can migrate incrementally. It is also more complete than only patching the rematch freeze, because the same string-driven state split affects result screens, pause overlays, countdowns, and lifecycle snapshots.

## State Contract

Room status payloads should provide these stable fields:

- `roomCode`: the public room identifier.
- `players`: public player metadata for the room.
- `phase`: room lifecycle phase, such as `waiting`, `countdown`, `playing`, or `complete`.
- `status`: match simulation status, such as `waiting`, `playing`, or `complete`.
- `message`: optional human-readable UI text.
- `pausedBy`: player number that currently owns a pause, or `null`.
- `rematch`: optional rematch state showing each player's request.
- `reason`: optional lifecycle reason such as `win`, `forfeit`, `disconnect`, `pause`, `resume`, `countdown`, or `rematch`.

The server should derive public payloads from shared helpers so tests can assert exact behavior without opening a socket.

## Phase Ordering

The server must update authoritative room phase before emitting snapshots or status messages.

When a match completes naturally, set `room.phase = "complete"` before emitting the final `match:snapshot` or `room:status`. Clients should never receive `status: "complete"` with stale `phase: "playing"`.

When both players request a rematch, reset the match and set the room phase to `countdown` before broadcasting the reset snapshot. Clients should never receive `status: "playing"` with stale `phase: "complete"` during rematch setup.

When countdown ends, set `room.phase = "playing"` and emit a structured status payload with `reason: "countdown"` or equivalent. Client gameplay should unlock from `phase === "playing"` rather than from the exact display string.

## Client Behavior

Client scenes should consume structured room status.

`MatchScene` should unlock online round input only from structured state: a playing match and a playing room phase. It should still respect local pause and results state.

Overlay and result-screen code should render messages from `message`, but rematch behavior should not depend on whether a player won naturally or forfeited. Rematch request display should use `rematch` state and player identity, so "opponent requested a rematch" works the same for every result path.

Existing fallback handling for older string-only payloads can remain if it is small and isolated, but new behavior should be covered by structured-payload tests.

## Pause And Resume

The server should track pause ownership with `pausedBy`.

When a player pauses, the room state should record that player and status payloads should include `pausedBy`. Resume behavior should be explicit: either only the pausing player may resume, or the server should deliberately allow either player and report who resumed. For this pass, only the pausing player may resume because it matches the clearest ownership model and avoids one player unexpectedly unpausing another.

Clients should render pause state from `pausedBy` and `reason`, not by searching message text.

## Input Validation And Rate Guard

The server should ignore malformed `match:input` payloads instead of merging arbitrary object shapes into player input.

Accepted input fields should be the known boolean controls used by the shared simulation. Unknown fields should be dropped. Non-boolean values should be coerced only when they are safe booleans; otherwise they should be ignored.

A lightweight per-socket input rate guard should protect the public websocket endpoint without disrupting normal play. The target is to tolerate normal 60 FPS input traffic and brief jitter while dropping clear spam above that range.

This pass does not add user authentication, persistent sessions, or a full abuse-prevention system.

## Disconnect And Cleanup

Disconnect behavior should avoid deleting a room while a remaining player still has meaningful state to observe. During active or complete phases, the remaining player should receive a structured disconnect status and completion snapshot. Empty rooms can still be deleted.

For non-active phases, room deletion should happen only when no players remain. This keeps lifecycle handling consistent and avoids surprising the remaining client during setup/result transitions.

## Testing And Verification

Tests should be written before implementation changes.

Focused tests should cover:

- Public room state payload includes `phase`, `status`, `players`, `pausedBy`, `rematch`, `reason`, and `message`.
- Natural match completion emits or exposes `phase: "complete"` with `status: "complete"`.
- Rematch reset emits or exposes `phase: "countdown"` rather than stale `phase: "complete"`.
- Result-screen rematch request UI works the same after a forfeit and a natural win.
- `MatchScene` unlocks online play from structured playing phase/status instead of the text `"Fight"`.
- Pause ownership records `pausedBy`, rejects resume from the non-pausing player, and clears `pausedBy` on valid resume.
- Malformed input payloads are ignored and unknown fields are dropped.
- Input rate guard accepts normal frame-rate updates and drops spam.
- Disconnect cleanup keeps rooms with remaining players and deletes empty rooms.

Verification should run focused tests first, then the full suite and build:

- `npm test -- test/shared/rooms.test.js src/game/net/socketClient.test.js src/game/scenes/matchOverlayState.test.js`
- `npm test`
- `npm run build`

Manual verification should use the live app or local app to run two-player flows for normal win, forfeit, rematch request, rematch start, pause/resume, and disconnect. The important check is that rematch starts never leave either character frozen.

## Out Of Scope

This change does not introduce authentication, account identity, durable room storage, matchmaking, lobby browsing, or a new websocket event namespace. It does not redesign the game UI except where UI logic needs to read structured state.

## Self-Review

- No placeholders remain.
- The protocol fields are explicit and testable.
- Phase ordering requirements cover both natural completion and rematch reset.
- Client behavior avoids string-driven game logic while preserving display messages.
- Pause ownership has one clear rule for this pass.
- Input hardening is scoped to validation and rate guarding, not a full security model.
- Disconnect cleanup is limited to preserving remaining-player state and deleting empty rooms.
