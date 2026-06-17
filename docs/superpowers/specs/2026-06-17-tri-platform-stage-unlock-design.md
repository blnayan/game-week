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

The Phaser client should render the active stage from the same stage definition used by physics. For the new stage, simple platform sprites or rectangles are acceptable because exact hitbox alignment matters more than decorative art in this pass.

The renderer should draw each platform directly from its rectangle. This makes "hitboxes align perfectly" testable: there is no second set of hand-tuned visual coordinates.

The existing background image can remain behind the platforms unless a separate background asset is already trivial to add.

## Online Rooms

Room creation should send a payload with:

- `stageId`: the selected stage id.
- `playerLevel`: the creator's local progression level.

The server should validate room creation. If `stageId` is `tri-platform` and `playerLevel < 10`, the server returns `{ ok: false, error: "Stage unlocks at level 10" }` and does not create a room.

Joining a room should not check player level. A lower-level player joining through an invitation link is allowed into the already-created room, including rooms using `tri-platform`.

Public room status and match snapshots should include the active `stageId` so joining clients can render the same stage as the server.

Rematches should keep the room's current stage id.

## Menu Flow

The menu should expose the new stage as an online room creation choice after level 10. A level 1-9 player should still see that the stage exists and is locked at level 10, but attempting to create a room with it should be disabled or should show a clear menu notice.

The existing "Create Online Room" flow can continue to create the default stage. The tri-platform stage can be added as a second create-room button or a compact stage selector, whichever fits the existing menu layout with minimal disruption.

Invite auto-join should remain unchanged: if the URL has a room code, the menu immediately joins that room even when local progression is below level 10.

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
- Invite auto-join remains available below level 10.

Verification should run focused tests first, then the full suite and build:

- `npm test -- test/shared/stageGeometry.test.js test/shared/match.test.js test/shared/rooms.test.js src/game/net/socketClient.test.js src/game/progression/progressionStore.test.js`
- `npm test`
- `npm run build`

Manual verification should create a default room below level 10, confirm tri-platform room creation is blocked below level 10, force or earn level 10, create a tri-platform room, join it from another browser with a lower-level profile through the invite link, and confirm both players stand on each visible platform exactly where it is drawn.

## Out Of Scope

This change does not add accounts, server-side persistent progression, matchmaking, a full stage-select screen for CPU mode, or custom art beyond what is needed to make the platforms visible and aligned.

## Self-Review

- No placeholders remain.
- The unlock rule is explicit: level 10 gates creation only.
- The approved lowered geometry is recorded with exact coordinates.
- The design avoids separate visual and collision coordinates.
- Joining by invite is explicitly allowed below level 10.
- Rematch stage persistence is covered.
- The test plan covers catalog data, collision behavior, room gating, socket payloads, and invite joins.
