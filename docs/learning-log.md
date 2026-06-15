# Learning Log

This log summarizes the learning path and build process for Pixel Arena Fighter. The project was built over three days, using AI to move quickly through an unfamiliar game-development stack while still making deliberate technical decisions.

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
- Stress tested multiplayer and posted the result on GitLab.
- Ran local verification with the sprite validator, test suite, production build, and browser smoke test.
- Prepared submission documentation covering the learning process and AI methodology.

## Current Submission Evidence

- The game is deployed and accessible from the VPS deployment.
- Docker has been verified through deployment.
- Multiplayer has been stress tested, with evidence posted on GitLab.
- The code repository is published on GitLab.
- Demo video will be recorded separately.
