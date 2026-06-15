# AI Methodology

Pixel Arena Fighter used AI as a learning and engineering partner rather than as a replacement for technical judgment. The workflow was to ask AI for options, compare tradeoffs, implement in small slices, test behavior, and revise based on what the game actually needed.

## Learning Strategy

The first use of AI was stack selection. The project requirements pointed toward a real-time multiplayer game, but the exact platform was open. AI was used to compare the browser path against desktop and 3D options, with attention to time limits, unfamiliar technology risk, multiplayer complexity, and how quickly a playable prototype could be built.

The browser path was selected because JavaScript, Phaser, Node, and Socket.IO fit the project requirements while keeping deployment simple. Phaser handled common 2D game concerns such as scenes, input, sprites, and animation. Socket.IO handled real-time browser communication without requiring low-level WebSocket code.

## Prompt Patterns That Helped

Useful prompts focused on decisions and constraints rather than asking for broad code dumps:

- "Compare Phaser and raw Canvas for a one-week browser fighting game with multiplayer."
- "Design a shared simulation boundary so CPU and online multiplayer use the same combat rules."
- "What state should be server-authoritative in a Socket.IO real-time game?"
- "Help simplify this control scheme so the player only needs movement, jump, light, heavy, and dive."
- "Inspect this sprite sheet plan for frame consistency, clipping risk, and animation coverage."
- "What tests would catch regressions in fighter state transitions and online room behavior?"

This kept AI output tied to concrete engineering decisions and made it easier to verify the result.

## Architecture Decisions Influenced By AI

The most important decision was separating simulation from rendering. Combat rules live in `shared/`, while Phaser reads match snapshots and renders them. This made it possible for CPU battles and online battles to share the same state transitions, attack timing, damage, knockback, stocks, and match completion rules.

AI also helped shape the server model. Instead of allowing each browser to simulate independently, the server owns online room state. Clients send inputs, and the server broadcasts snapshots. This reduces disagreement between players and gives the game a clearer multiplayer authority boundary.

## Debugging And Verification Workflow

AI was used to form hypotheses, but verification came from commands and browser checks:

- `npm test` for shared logic, input, room, CPU, progression, and rendering metadata.
- `npm run build` for production build validation.
- `node scripts/validate-fighter-sprites.mjs` for sprite sheet dimensions, visible heights, opaque pixels, and clipping.
- Browser smoke tests for loading the menu and starting CPU Battle.
- Multiplayer stress testing using deployed GitLab/VPS evidence.

When something looked wrong, the workflow was to isolate the symptom, inspect the relevant code or asset, make the smallest change, and run the targeted check again.

## AI-Assisted Asset Iteration

AI image generation was used for sprite creation, but the process became intentionally incremental. Instead of generating a whole sheet and accepting mismatched frames, each important frame was reviewed for character size, centering, posture, and clipping. The final sheet uses larger frame bounds while keeping the visible fighter size consistent.

The asset process also added a validation script so visual fixes had a measurable check. That script catches obvious problems such as incorrect sheet width, unexpected visible height, missing opaque pixels, and content touching frame edges.

## What AI Accelerated

AI helped most with unfamiliar-domain decisions:

- Choosing Phaser and Socket.IO for the timebox.
- Designing a shared simulation that works for both CPU and online modes.
- Simplifying combat controls into a learnable set.
- Creating focused tests around the highest-risk logic.
- Iterating sprite sheets while preserving animation frame order and dimensions.
- Preparing Docker packaging and deployment notes.

The important pattern was not asking AI to build the whole project in one step. The project improved fastest when AI was used for short design loops, targeted implementation help, and concrete verification checklists.

## Lessons Learned

The biggest lesson was that a game project exposes mistakes quickly. If animation frames are inconsistent, controls are too complex, or multiplayer state ownership is unclear, the problem is visible immediately. AI was most useful when paired with tight feedback loops: play the game, inspect the issue, adjust one part, and verify again.

For future unfamiliar stacks, this same method should transfer well:

1. Choose a stack by comparing constraints, not popularity.
2. Build one thin playable loop early.
3. Keep shared domain rules separate from rendering and transport.
4. Use AI for alternatives and risk checks.
5. Verify every important claim with tests, builds, or live app behavior.
