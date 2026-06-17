# Tri-Platform Stage Unlock

Date: 2026-06-17

## Purpose

Add a new Super Smash Bros.-style stage with one large lower platform and three smaller floating platforms. The visible platform art and physics hitboxes must align exactly. The stage should unlock for room creation at level 10, while lower-level players can still join an existing room through an invitation link.

## Chosen Approach

Use a shared stage catalog consumed by the simulation, server, and Phaser client.

The current game has one global `STAGE.platform`, so collision, spawn placement, CPU recovery, and rendering all assume a single floor. The new stage needs four separate ledges and online clients must render the same map the server simulates. A catalog keyed by `stageId` keeps those decisions in one place and avoids client/server drift.

The default existing stage remains available for all players. The new stage is selectable only by players whose local progression level is at least 10 when they create a room.

## Stage Geometry

The new stage id will be `tri-platform`.

Platform rectangles are expressed in the existing 1280 by 720 game coordinate system. Each rectangle is both the render rectangle and the collision rectangle:

- Main platform: `x: 200`, `y: 540`, `width: 880`, `height: 36`
- Left mini platform: `x: 150`, `y: 460`, `width: 260`, `height: 28`
- Top mini platform: `x: 485`, `y: 380`, `width: 310`, `height: 28`
- Right mini platform: `x: 870`, `y: 460`, `width: 260`, `height: 28`

The layout intentionally keeps 80 pixels of vertical spacing between tiers and leaves clear horizontal gaps between the side platforms and the top platform. Spawns should sit above the main platform, not on the mini platforms, so both players begin in the open central fight area.

## Simulation

`createMatch(mode, options)` should accept a `stageId` option and store the chosen stage id on the match. Invalid or missing ids should fall back to the default stage.

The landing/collision logic should iterate over all platforms in the active stage. A fighter should land on the highest matching platform crossed by their feet during the step. The implementation should keep the current one-way platform behavior: fighters collide only while falling or descending onto the top of a platform.

The CPU recovery helper should use the active stage's main platform rather than the old global platform.

## Rendering

The tri-platform map must use an AI-generated bitmap asset committed in the project. The asset should be saved as `public/assets/stage/tri-platform-arena.png` and loaded by Phaser with a stable key such as `stage:tri-platform`.

The generated art is the visual map backdrop. It should show the same one-large-platform and three-mini-platform layout, but it must not become the source of physics truth because generated images cannot guarantee pixel-perfect geometry. The visible gameplay platforms should not have cast shadows or drop shadows, so there is no confusing shadow offset from the hitbox-aligned surfaces.

The renderer should still draw exact, flat, shadowless platform surfaces directly from the shared rectangle definitions on top of the AI-generated art. This makes "hitboxes align perfectly" testable: there is no second set of hand-tuned visual coordinates. The AI bitmap provides art direction and background, while the shared stage catalog remains the source of truth for hitboxes.

## Online Rooms

Room creation should send a payload with:

- `stageId`: the selected stage id.
- `playerLevel`: the creator's local progression level.

The server should validate room creation. If `stageId` is `tri-platform` and `playerLevel < 10`, the server returns `{ ok: false, error: "Stage unlocks at level 10" }` and does not create a room.

Joining a room should not check player level. A lower-level player joining through an invitation link is allowed into the already-created room, including rooms using `tri-platform`.

Public room status and match snapshots should include the active `stageId` so joining clients can render the same stage as the server.

Rematches should keep the room's current stage id.

## Menu Flow

The menu should expose maps as a pickable selector before the player chooses a match mode. The selector should include `Cosmic Floating` and `Tri Platform`.

A level 1-9 player should still see `Tri Platform`, but it should be locked with level 10 text. Clicking the locked map should keep the current selection on the default map and show a clear menu notice. At level 10 or higher, `Tri Platform` becomes selectable.

The selected map should apply to both `CPU Battle` and `Create Online Room`. `Create Online Room` sends the selected `stageId` and the creator's level to the server. `CPU Battle` starts a local match on the selected stage.

Invite auto-join should remain unchanged: if the URL has a room code, the menu immediately joins that room even when local progression is below level 10.

`Join Online Room` should ignore the local map selector because the server room's `stageId` is authoritative. The joining client should render whatever stage arrives in the room snapshot.

## Progression

Progression already computes level as `1 + floor(xp / 300)`. Level 10 therefore requires at least 2700 XP. This feature does not change XP awards, palette unlocks, or progression storage format.

Add a small progression helper for checking stage unlocks so UI and server payload construction do not duplicate the level threshold.

## Testing And Verification

Tests should be written before implementation.

Focused tests should cover:

- The `tri-platform` catalog entry contains exactly four platform rectangles matching the approved geometry.
- The rendering helper, if extracted, returns platform draw data identical to collision data.
- A fighter can land on the left, center, right, and main platforms.
- A fighter passing through a platform from below does not snap upward.
- `createMatch({ stageId: "tri-platform" })` stores the stage id and uses the new spawn geometry.
- Room creation eligibility allows the default stage below level 10, rejects `tri-platform` below level 10, and allows it at level 10.
- Room join eligibility ignores the joiner's level.
- Public room status and match snapshots include `stageId`.
- Socket client `createRoom` sends `stageId` and `playerLevel`.
- Menu stage selection keeps locked maps visible but unselectable below level 10.
- CPU battle and online room creation use the selected stage id.
- The tri-platform stage loads an AI-generated bitmap from `public/assets/stage/tri-platform-arena.png`.
- Invite auto-join remains available below level 10.

Verification should run focused tests first, then the full suite and build:

- `npm test -- test/shared/stageGeometry.test.js test/shared/match.test.js test/shared/rooms.test.js src/game/net/socketClient.test.js src/game/progression/progressionStore.test.js src/game/scenes/stageSelection.test.js src/game/scenes/menuLayout.test.js`
- `npm test`
- `npm run build`

Manual verification should confirm the menu map picker shows `Cosmic Floating` selected and `Tri Platform` locked below level 10, confirm clicking the locked map keeps the default selected, force or earn level 10, select `Tri Platform`, start CPU Battle on that AI-generated map, create a tri-platform online room, join it from another browser with a lower-level profile through the invite link, and confirm both players stand on each visible platform exactly where it is drawn.

## Out Of Scope

This change does not add accounts, server-side persistent progression, matchmaking, or a dedicated full-screen stage-select scene. It does add the required AI-generated tri-platform stage bitmap.

## Self-Review

- No placeholders remain.
- The unlock rule is explicit: level 10 gates creation only.
- The approved lowered geometry is recorded with exact coordinates.
- The design avoids separate visual and collision coordinates.
- Menu map selection is explicit and applies before choosing CPU or online creation.
- The tri-platform stage explicitly requires a committed AI-generated bitmap asset.
- Joining by invite is explicitly allowed below level 10.
- Rematch stage persistence is covered.
- The test plan covers catalog data, collision behavior, menu stage selection, AI stage art loading, room gating, socket payloads, selected-stage CPU/online starts, and invite joins.
