# Learning Log

This log summarizes the learning path and build process for Pixel Arena Fighter. The original submission was built over a short Game Week timebox, then extended after early submission commit `216503429db57bce0c847c2d479cc36ca590565e` with stage selection, a new arena, stronger online-room behavior, HUD metrics, and more tests.

## Day 1: Scope, Stack Selection, And Core Prototype

- Read the Game Week requirements and chose the browser-based path.
- Compared raw Canvas, Phaser, and heavier 3D approaches with AI assistance.
- Selected Phaser for the client because it provides a practical 2D scene loop, asset loading, animation support, and input handling without requiring a full custom engine.
- Selected Socket.IO for multiplayer because the assignment required real-time interaction and Socket.IO fit the browser/Node stack.
- Defined the initial game target: a small platform fighter with local CPU play and online rooms.
- Designed the split between shared simulation code, Phaser rendering, and the Node/Express server.
- Put core combat and match rules in `shared/` so CPU and online play use the same rules.
- Created Phaser scenes for boot, menu, match, HUD, and results.
- Built the first playable loop with movement, jumping, attacks, stocks, damage, and knockback.

## Day 2: Multiplayer, CPU, Progression, And Testing

- Added Socket.IO room creation and joining.
- Made the server authoritative for online rooms.
- Sent compact input packets from clients and broadcast server match snapshots back to browsers.
- Added disconnect handling and empty-room cleanup.
- Used AI to reason through where state should live so local CPU mode and online mode would not drift apart.
- Added CPU behavior for approaching, attacking, recovering, and diving when airborne.
- Added match results and local XP progression.
- Added a violet palette unlock at 300 XP.
- Built focused tests around shared match rules, fighter state, CPU decisions, room behavior, input mapping, rendering metadata, and progression.

## Day 3: Controls, Sprite Polish, Packaging, And Submission Prep

- Simplified the control scheme to the core moves needed for the game:
  - `A` / `D` movement
  - `Space` jump and double jump
  - `J` light attack
  - `K` heavy attack
  - `S` dive attack while airborne
- Removed extra attacks and movement options that made the game harder to learn quickly.
- Tuned the CPU to use the simplified attack set.
- Rebuilt the fighter sprite sheet around a minimal frame set for idle, running, jumping, light attack, dive attack, heavy attack, and hurt.
- Increased sprite frame size to leave space for attacks while keeping the character's visible size consistent.
- Learned that asking Codex to generate one sprite frame at a time gave a more consistent result than generating a whole sheet at once. Each frame could use the approved idle pose as a reference, then be checked for character height, centering, limb placement, and clipping before adding it to the sheet.
- Iterated frame-by-frame to avoid clipping and size drift, especially for running steps and attack poses where the legs or arms extended farther than the idle stance.
- Added validation for fighter sheet dimensions, visible heights, opaque pixels, and edge clipping.
- Added Docker support for production builds.
- Verified Docker by deploying the game on a VPS.
- Stress tested multiplayer and posted the result with the submission evidence.
- Ran local verification with the sprite validator, test suite, production build, and browser smoke test.
- Prepared submission documentation covering the learning process and AI methodology.

## Post-Submission Iteration: Online Room Stability

After the early submission, the online flow was hardened:

- Fixed room-state lifecycle issues around disconnects, rematches, and result-screen transitions.
- Replayed the latest room status and match snapshot for scenes that subscribe after an event already happened.
- Preserved selected stages through rematch and results flows.
- Added tests for room cleanup, rematch requests, result status text, and snapshot replay.
- Added GitLab-style CI configuration for the unit test suite.

The main learning was that real-time browser games need defensive lifecycle handling. A player can refresh, disconnect, leave during countdown, request a rematch, or arrive from an invite link at awkward times. Those transitions need explicit tests, not just manual playthroughs.

## Post-Submission Iteration: Stage System And Tri Platform

The stage system changed from a single hard-coded platform to a shared stage catalog:

- Added `shared/stages.js` with stage ids, names, unlock levels, platform geometry, spawn points, and blast zones.
- Added a default **Cosmic Floating** stage and an AI-generated **Tri Platform** stage.
- Tuned Tri Platform to one large main platform plus three smaller platforms, with hitboxes aligned to the committed background art.
- Added stage-aware landing, blast-zone, spawn, CPU, and rematch behavior.
- Added a **Select Stage** button that opens a stage-selection submenu with preview cards.
- Locked Tri Platform room creation until level 10.
- Kept invite-link joining permissive so lower-level players can join a room created by someone who has unlocked the stage.

The main learning was that art and gameplay geometry need to be treated as a single contract. The platform visuals looked close before the hitboxes were exact, but even small offsets were noticeable in play.

## Post-Submission Iteration: HUD, Ping, And Match Readability

The match screen gained more player-facing information:

- Added P1/P2 nametags above fighters, then raised them so they do not block the character body.
- Added FPS in the bottom-left corner.
- Added ping in the bottom-right corner.
- Moved FPS/ping to a DOM overlay anchored to the visible canvas so they stay in the correct places when Phaser scales or letterboxes the game.
- Added an app-level `latency:ping` acknowledgement between client and server so online ping is measured directly.
- Displayed local CPU ping as `Ping 0ms`, measured online latency as `Ping Nms`, and sub-millisecond online latency as `Ping <1ms`.
- Kept online HUD ping refreshed even while waiting for another player.

The main learning was that canvas-space coordinates and browser display coordinates are different. Phaser text positions work inside the game camera, but screen-corner metrics are more reliable as DOM elements anchored to the actual canvas rectangle.

## Post-Submission Iteration: Profiling And Verification

The project gained a repeatable multiplayer profiling script:

- `npm run profile:multiplayer` runs `scripts/profile-multiplayer.mjs`.
- The profiler can spawn a local server or target a deployed URL.
- It creates multiple rooms and clients, sends 60 Hz input, records snapshot cadence and payload size, and optionally reads process or Docker stats.
- The README records the June 17, 2026 live profile against 16 rooms and 32 clients.

The test suite also expanded to cover stage geometry, stage selection, CPU fixed stepping, HUD layout, metric overlay positioning, online ping, result/rematch state, and profiler helpers.

## Current Submission Evidence

- The game is deployed and accessible from the VPS deployment.
- Docker has been verified through deployment.
- Multiplayer has been stress tested and profiled.
- The code repository is published to the configured remote.
- Current local verification uses:
  - `npm test`
  - `npm run build`
  - `node scripts/validate-fighter-sprites.mjs`
- Demo video is handled separately from the repository docs.
