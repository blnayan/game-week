# Pixel Arena Fighter Design

Date: 2026-06-13

## Purpose

Build a polished early-submission browser game for Game Week: a pixelated arena fighter inspired by platform fighters, with real online multiplayer rooms and a CPU opponent mode. The game should feel good quickly: responsive movement, readable attacks, damage percentages, knockback, impact effects, stocks, and a fullscreen browser presentation.

## Chosen Approach

Use a browser-based stack:

- Phaser for the 2D fullscreen client.
- Node.js and Express for serving the built client.
- Socket.IO for online real-time rooms.
- Shared JavaScript game simulation modules for server rooms and CPU matches.

This approach aligns with the Week 7 browser pathway and keeps the technical story clear: the project uses a new game framework, supports real multiplayer, and remains deployable as a web app.

Official references checked during design:

- Phaser overview: https://docs.phaser.io/phaser/getting-started/what-is-phaser
- Phaser animation concepts: https://docs.phaser.io/phaser/concepts/animations
- Socket.IO rooms: https://socket.io/docs/v4/rooms/

## Player Experience

The first screen is the actual game experience, not a marketing landing page. The browser opens to a fullscreen animated arena with compact menu overlays:

- Fight CPU
- Play Online
- Controls
- Progress

The game uses a stable 16:9 internal arena coordinate system for predictable physics, then scales to fill the browser viewport. HUD elements are anchored to screen-safe positions and remain readable while the game canvas fills the browser.

## Game Modes

### Fight CPU

The player starts an immediate match against a CPU fighter. CPU mode is a required v1 feature, not a fallback. It uses the same shared match rules as online play and supports selectable difficulty tiers.

CPU behavior:

- Move toward the opponent when far away.
- Maintain spacing near attack range.
- Jump or recover when below the platform.
- Prefer light attacks at close range.
- Use heavy or special attacks when the opponent is vulnerable.
- Occasionally dodge or shield-lite based on difficulty.

### Online Room

The player can create or join a room code. Socket.IO rooms hold the match participants. The server assigns player slots, starts the match when two players are ready, receives input packets, advances the match simulation, and broadcasts snapshots.

Online v1 supports:

- Create room.
- Join room by code.
- Two-player match.
- Disconnect handling.
- Rematch from results screen.
- Compact status overlay for room code, ping, and connection state.

Local same-keyboard play is out of scope for v1 unless it becomes trivial after online and CPU modes are complete.

## Core Gameplay

The game is a tight arena fighter with one polished stage and two original street-fighter-style pixel characters. The characters share the same gameplay kit in v1, but differ by silhouette and palette for readability.

Core systems:

- Horizontal movement.
- Jump and double jump.
- Fast fall.
- Light attack.
- Heavy attack.
- Up attack.
- Special projectile or strike.
- Dodge or shield-lite.
- Damage percentage.
- Damage-scaled knockback.
- Hit stun.
- Recovery frames.
- Attack cooldowns.
- Respawn invulnerability.
- Blast-zone KO checks.
- Stocks.
- Timer.
- Win state.

The game should favor responsiveness and readable feedback over roster size.

## Progression

Progression is lightweight but real, satisfying the Week 7 requirement without turning v1 into a large RPG system.

Progression includes:

- XP gained after completed matches.
- CPU difficulty tiers.
- Unlockable palette badges.
- Match results showing KOs, falls, damage dealt, and XP earned.

Progress can be stored in browser local storage for v1. No account database is required.

## Visual and Animation Direction

The game uses original pixel-art street fighters rather than licensed characters. The target is punchy and readable, with enough animation frames and effects to make impacts feel intentional.

Fighter animation states:

- Idle.
- Run.
- Jump.
- Fall.
- Light attack.
- Heavy attack.
- Up attack.
- Special.
- Hurt.
- Launched.
- KO.
- Victory.

Effect animation states:

- Hit spark.
- Heavy impact flash.
- Dust step.
- Jump puff.
- Projectile trail.
- Shield shimmer.
- Respawn burst.
- KO streak.

Phaser frame animations and sprite sheets or atlases will drive character and effect playback. Camera shake, brief hit pause, and small particle bursts will be used sparingly to improve feel without obscuring gameplay.

Assets should be pre-generated PNG files committed with the project, not runtime-created temporary textures. The visual target is original pixel art with chunky outlines, a limited pastel arcade palette, expressive small fighters, and a side-view city/beach arena. The reference direction is about pixel-art quality and readability, not copying any existing character, scene, or UI.

Required pre-generated assets:

- Fighter sprite sheets for the two v1 fighters and unlockable palette variants.
- Effect sprite sheets for hit sparks, heavy impacts, jump puffs, shield shimmer, respawn burst, projectile trail, and KO streak.
- Stage background and stage platform tile art.
- UI portraits, stock icons, and compact menu/HUD panels.

The repo may include a deterministic asset-generation script so assets can be regenerated, but Phaser should load PNG files from the project asset folder during gameplay.

The client will map shared fighter state machine states to Phaser animation keys. Phaser should not be the source of truth for gameplay state; it should visualize the authoritative state coming from local CPU simulation or online server snapshots.

## Architecture

### State Management

Phaser Scenes will manage high-level application flow:

- Boot.
- Menu.
- Match.
- HUD.
- Results.

Fighter gameplay will use a small custom finite state machine in the shared simulation layer. Phaser's current state concept is Scenes, which are useful for game sections but are not the right place to own server-authoritative combat transitions.

Shared fighter states:

- Idle.
- Run.
- Jump.
- Fall.
- AttackLight.
- AttackHeavy.
- AttackUp.
- Special.
- Dodge.
- Shield.
- Hitstun.
- Launched.
- Respawn.
- KO.
- Victory.

The state machine should be implemented with plain JavaScript objects and explicit transition functions. Avoid a heavy state-machine library for v1 unless combat rules become complex enough to justify the dependency.

### Client

The client owns:

- Phaser game boot.
- Fullscreen scale management.
- Input capture.
- Rendering and interpolation.
- Animation playback.
- Effects and audio cues.
- Menu, room, HUD, pause, and results overlays.
- Local storage for progression.

### Shared Simulation

Shared modules own:

- Fighter state shape.
- Input state shape.
- Fighter finite state machine.
- Stage bounds and blast zones.
- Physics constants.
- Attack definitions.
- Damage, knockback, hit stun, and stocks.
- CPU input selection.
- Match lifecycle.

Keeping these rules shared prevents CPU mode and online mode from drifting apart.

### Server

The server owns:

- Static hosting for the production client.
- Socket.IO setup.
- Room creation and joining.
- Player slot assignment.
- Server-side match loop.
- Input buffering.
- Snapshot broadcasting.
- Disconnect and rematch handling.

The server is authoritative for online matches. Clients send inputs, not position claims.

## Data Flow

CPU mode:

1. Client captures player input.
2. CPU module chooses CPU input.
3. Shared simulation advances locally.
4. Phaser renders current state.
5. Results update local progression.

Online mode:

1. Client joins a Socket.IO room.
2. Client sends compact input packets.
3. Server advances the shared simulation on a fixed tick.
4. Server broadcasts snapshots to sockets in the room.
5. Clients interpolate and render snapshots.
6. Results are shown client-side after the server reports match end.

## Error Handling

Expected failure cases:

- Invalid room code.
- Room full.
- Opponent disconnects.
- Server connection drops.
- Online match waits too long for another player.

The UI should show compact, plain-language statuses and offer direct recovery actions: retry, return to menu, create new room, or fight CPU.

## Testing and Verification

Automated tests should focus on shared match rules:

- Damage increases after valid hits.
- Knockback scales with damage.
- Fighters lose stocks when crossing blast zones.
- Respawn state grants temporary invulnerability.
- Match ends when a fighter reaches zero stocks.
- CPU returns plausible inputs for nearby, distant, and recovery situations.

Manual browser verification:

- CPU mode can complete a match.
- Two browser clients can join one online room and complete a match.
- Fullscreen canvas fills the browser without layout overflow.
- HUD stays readable after resizing.
- Disconnect and rematch paths work.
- Debug overlay shows FPS, ping, room code, and server tick timing.

## Delivery Scope

Required commands:

- `npm run dev` starts the local client and server development flow.
- `npm run build` creates the production client build.
- `npm start` serves the built client and Socket.IO server.

Required documentation:

- Setup instructions.
- Controls.
- Architecture overview.
- Multiplayer design.
- CPU behavior.
- AI-assisted learning notes for the Game Week rubric.

## Out of Scope for v1

- Large character roster.
- Ranked matchmaking.
- Persistent database accounts.
- Complex map editor.
- Mobile touch controls.
- Local same-keyboard multiplayer as a required feature.

## Acceptance Criteria

The early-submission build is acceptable when:

- The game opens as a fullscreen browser arena fighter.
- Fight CPU mode is playable start-to-finish.
- Online room mode supports two browser clients in the same match.
- Core movement, attacks, damage, knockback, stocks, KO, respawn, and win flow work.
- Character and effect animations are visible and varied enough to make the game feel alive.
- Progression is visible after matches.
- Build and start commands work.
- README documents how to run and evaluate the project.
