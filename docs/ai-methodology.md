# AI Methodology

Pixel Arena Fighter used AI as a learning and engineering partner rather than as a replacement for technical judgment. The workflow was to ask AI for options, compare tradeoffs, implement in small slices, test behavior, and revise based on what the game actually needed.

The project started as a Game Week submission and continued after early submission commit `216503429db57bce0c847c2d479cc36ca590565e`. Later work added stage selection, an AI-generated tri-platform arena, unlock rules, multiplayer lifecycle fixes, player nametags, FPS/ping metrics, and a repeatable multiplayer profiler.

## Learning Strategy

The first use of AI was stack selection. The project requirements pointed toward a real-time multiplayer game, but the exact platform was open. AI was used to compare the browser path against desktop and 3D options, with attention to time limits, unfamiliar technology risk, multiplayer complexity, and how quickly a playable prototype could be built.

The browser path was selected because JavaScript, Phaser, Node, and Socket.IO fit the project requirements while keeping deployment simple. Phaser handled common 2D game concerns such as scenes, input, sprites, animation, and scaling. Socket.IO handled real-time browser communication without requiring low-level WebSocket code.

## Prompt Patterns That Helped

Useful prompts focused on decisions and constraints rather than asking for broad code dumps:

- "Compare Phaser and raw Canvas for a one-week browser fighting game with multiplayer."
- "Design a shared simulation boundary so CPU and online multiplayer use the same combat rules."
- "What state should be server-authoritative in a Socket.IO real-time game?"
- "Help simplify this control scheme so the player only needs movement, jump, light, heavy, and dive."
- "Inspect this sprite sheet plan for frame consistency, clipping risk, and animation coverage."
- "Design a stage catalog so a platform fighter can support multiple stage geometries."
- "How should locked stages behave for room creation versus invite-link joining?"
- "Help align platform hitboxes to this stage art and test the geometry."
- "Why would a canvas HUD element appear in the wrong screen corner when Phaser scales the game?"
- "What tests would catch regressions in fighter state transitions, stage selection, online room behavior, and HUD layout?"

This kept AI output tied to concrete engineering decisions and made it easier to verify the result.

## Architecture Decisions Influenced By AI

The most important decision was separating simulation from rendering. Combat rules live in `shared/`, while Phaser reads match snapshots and renders them. This made it possible for CPU battles and online battles to share the same state transitions, attack timing, damage, knockback, stocks, platform collision, and match completion rules.

AI also helped shape the server model. Instead of allowing each browser to simulate independently, the server owns online room state. Clients send inputs, and the server broadcasts snapshots. This reduces disagreement between players and gives the game a clearer multiplayer authority boundary.

After the original submission, AI helped extend the architecture from one hard-coded platform to a shared stage catalog. Stage definitions now include ids, names, unlock levels, platform hitboxes, spawn points, and blast zones. That let the menu, progression system, server room creation, shared match simulation, CPU logic, results screen, and rendering all speak the same stage language.

## Debugging And Verification Workflow

AI was used to form hypotheses, but verification came from commands and browser checks:

- `npm test` for shared logic, input, room behavior, CPU, progression, stage geometry, HUD layout, latency, profiler helpers, and rendering metadata.
- `npm run build` for production build validation.
- `node scripts/validate-fighter-sprites.mjs` for sprite sheet dimensions, visible heights, opaque pixels, and clipping.
- Browser smoke tests for loading the menu, selecting stages, starting CPU Battle, creating online rooms, and checking HUD placement.
- Multiplayer profiling with `npm run profile:multiplayer` against local or deployed servers.

When something looked wrong, the workflow was to isolate the symptom, inspect the relevant code or asset, make the smallest change, and run the targeted check again. This mattered for visual issues such as Tri Platform hitboxes and HUD coordinates, where tests alone were not enough.

## AI-Assisted Asset Iteration

AI image generation was used for sprite and stage creation, but the process became intentionally incremental. Instead of generating a whole sheet and accepting mismatched frames, each important frame was reviewed for character size, centering, posture, and clipping. The final fighter sheets use larger frame bounds while keeping the visible fighter size consistent.

The Tri Platform background was also AI-generated, then committed as a normal project asset. The platform hitboxes were not guessed from the prompt alone. They were tuned against the image, adjusted through browser checks, and locked down with shared stage-geometry tests.

The asset process also added a validation script so visual fixes had a measurable check. That script catches obvious fighter-sheet problems such as incorrect sheet width, unexpected visible height, missing opaque pixels, and content touching frame edges.

## AI In The Later Iteration Loop

After the first submission, AI was most useful for turning playtest feedback into focused changes:

- Stage selector needed more room, so the menu changed from inline stage choices to a Select Stage submenu with preview cards.
- Tri Platform looked visually correct before the collision felt correct, so the hitboxes were repeatedly tuned and tested.
- CPU attacks felt tied to frame rate, so CPU stepping was separated from render FPS.
- FPS and ping first appeared in the wrong place because Phaser game coordinates and browser display coordinates were being mixed. AI helped trace that root cause and move the metrics to a DOM overlay anchored to the canvas.
- Multiplayer ping stayed at `0ms` in waiting rooms because the measurement updated after the last room-status event. The fix was an app-level `latency:ping` acknowledgement plus per-frame online HUD refresh.
- Nametags improved readability but initially sat too close to the character body, so the offset was raised and covered with a regression test.

The pattern was to use AI for diagnosis and option generation, then require code, tests, and browser evidence before treating a change as done.

## What AI Accelerated

AI helped most with unfamiliar-domain decisions:

- Choosing Phaser and Socket.IO for the timebox.
- Designing a shared simulation that works for both CPU and online modes.
- Simplifying combat controls into a learnable set.
- Creating focused tests around the highest-risk logic.
- Iterating sprite sheets while preserving animation frame order and dimensions.
- Creating the AI-generated Tri Platform art and then aligning playable geometry to it.
- Designing stage unlock behavior and invite-link exceptions.
- Hardening Socket.IO room lifecycle and rematch behavior.
- Preparing Docker packaging, deployment notes, and profiling scripts.

The important pattern was not asking AI to build the whole project in one step. The project improved fastest when AI was used for short design loops, targeted implementation help, and concrete verification checklists.

## Lessons Learned

The biggest lesson was that a game project exposes mistakes quickly. If animation frames are inconsistent, controls are too complex, multiplayer state ownership is unclear, platform hitboxes are offset, or HUD elements do not track the visible canvas, the problem is visible immediately.

For future unfamiliar stacks, this same method should transfer well:

1. Choose a stack by comparing constraints, not popularity.
2. Build one thin playable loop early.
3. Keep shared domain rules separate from rendering and transport.
4. Treat art and collision geometry as one contract.
5. Use AI for alternatives, risk checks, and debugging hypotheses.
6. Verify every important claim with tests, builds, browser checks, or profiling evidence.
