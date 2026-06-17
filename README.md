# Pixel Arena Fighter

A fullscreen browser platform fighter built for Game Week. It uses Phaser for the 2D client, Node/Express for hosting, Socket.IO for online rooms, and a shared JavaScript combat simulation for CPU and online play.

The current `main` branch includes the original submission plus later improvements made after early submission commit `216503429db57bce0c847c2d479cc36ca590565e`: stage selection, the AI-generated tri-platform arena, stage unlock rules, invite-link joins for locked stages, online room lifecycle fixes, multiplayer profiling, player nametags, and FPS/ping HUD metrics.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Vite serves the client on port `5173` and proxies Socket.IO traffic to the Node server on port `3000`.

## Production Build

```bash
npm run build
npm start
```

Open `http://localhost:3000`.

## Docker

```bash
docker build -t pixel-arena-fighter .
docker run --rm -p 3000:3000 pixel-arena-fighter
```

Open `http://localhost:3000`.

## Controls

- `A` / `D`: move
- `Space`: jump / double jump
- `J`: light attack
- `K`: heavy attack
- `S`: dive attack while airborne

## Modes And Menu Flow

- **Select Stage**: opens a stage-selection submenu with stage preview cards.
- **CPU Battle**: starts a local match against a CPU opponent using the shared simulation.
- **Create Online Room**: creates a Socket.IO room with the selected stage.
- **Join Online Room**: joins an existing room code.
- **Invite links**: a room link can join a locked stage, but the locked stage cannot be selected when creating a room until the player reaches the required level.

## Stages

- **Cosmic Floating**: default stage, unlocked at level 1.
- **Tri Platform**: AI-generated arena with one large main platform and three smaller platforms. It unlocks for room creation at level 10.

Stage geometry lives in `shared/stages.js`. Both CPU and online matches use the same platform definitions, spawn points, blast zones, and collision geometry. The tri-platform hitboxes are intentionally aligned to the committed stage art.

## Architecture

The shared simulation in `shared/` owns fighter state, combat transitions, attacks, damage, knockback, stocks, CPU input, stage geometry, and match lifecycle. The client renders that state with Phaser. The server is authoritative for online rooms: clients send inputs and the server broadcasts match snapshots.

Phaser scenes manage app flow: boot, menu, match, HUD, and results. Fighter gameplay uses a custom finite state machine in `shared/fighterState.js`.

## Multiplayer Design

Socket.IO rooms map directly to match rooms. A room has two player slots, one match instance, and a fixed server tick. Disconnects notify the remaining player, rematch state is preserved across the results screen, and empty rooms are cleaned up.

Online latency is measured with an app-level `latency:ping` acknowledgement rather than relying only on Socket.IO internals. The HUD refreshes ping during online waiting rooms and active matches.

## HUD

The match HUD shows player damage/stocks, mode or room status, player nametags above fighters, FPS in the bottom-left corner, and ping in the bottom-right corner. FPS and ping use a DOM overlay anchored to the visible canvas so they stay in the correct corners when the game is scaled or letterboxed.

CPU matches show local ping as `Ping 0ms`. Online matches show measured ping, including `Ping <1ms` when the local round trip is below one millisecond.

## Multiplayer Performance Profile

Measured against the live public site on June 17, 2026 with:

```bash
PROFILE_SERVER_URL=https://pixelarenafighter.nayanbhut.dev \
PROFILE_DOCKER_CONTAINER=pixel-arena-fighter-web \
node scripts/profile-multiplayer.mjs
```

The profile used 16 active online rooms, 32 Socket.IO clients, and 60 Hz input from every client for 15 seconds after countdown.

- Server tick target: 60 Hz / 16.67 ms fixed timestep.
- Snapshot delivery interval: 16.28 ms average, 17.21 ms p95.
- Snapshot volume: 29,446 samples captured out of roughly 28,801 expected.
- Snapshot payload size: 1,043 bytes average, 1,139 bytes p95.
- Room setup acks: 0.62 ms average for create, 0.50 ms average for join.
- Live container usage: 16.4% CPU average, 18.4% CPU max, 55.2 MB RSS average, 58.1 MB RSS max.

The profiler can also spawn a local server when `PROFILE_SERVER_URL` is not provided.

## CPU Design

The CPU chooses compact input packets from match state. It approaches when far, uses light and heavy attacks in range, dives when airborne above the opponent, and jumps back toward the platform when recovering. CPU stepping is kept independent of render FPS so CPU attack timing remains stable when frame rate changes.

## Pixel Art Asset Pipeline

The pixel-art stage backgrounds, fighter sheets, portraits, and effects are committed PNG assets under `public/assets/`. They are produced once and loaded by Phaser during boot. `npm run dev` and `npm run build` do not generate or modify art assets.

The tri-platform arena art is AI-generated, committed as `public/assets/stage/tri-platform-arena.png`, and paired with manually tuned platform geometry.

Fighter sheet dimensions and clipping can be checked with:

```bash
node scripts/validate-fighter-sprites.mjs
```

## Progression

Match results award XP in local storage. Level is calculated as `1 + floor(xp / 300)`.

- 300 XP unlocks the violet fighter palette.
- Level 10 unlocks Tri Platform for room creation.

Progression is local to the browser. Saved progression is normalized on load so outdated or unknown palette data does not persist.

## Verification

```bash
npm test
npm run build
node scripts/validate-fighter-sprites.mjs
```

The current suite covers shared combat, room behavior, stage geometry, stage selection, progression, input, CPU stepping, rendering metadata, online latency, HUD layout, result/rematch behavior, and multiplayer profiler helpers.

## AI-Assisted Learning Notes

The project followed a browser-game pathway from the Game Week brief. AI was used to compare Phaser and raw Canvas, design the network model, define a shared simulation boundary, plan the state machine, iterate pixel art, tune platform geometry against generated art, and harden online room behavior.

See [docs/learning-log.md](docs/learning-log.md) for the Brainlift-style progress log and [docs/ai-methodology.md](docs/ai-methodology.md) for the AI learning and development methodology.

## Repository And Submission Status

- Working game: complete and deployed on a VPS.
- Multiplayer: complete, profiled, and stress tested.
- Progression: complete through local XP, palette unlocks, and stage unlocks.
- Docker: verified through the VPS deployment.
- Repository: published to the configured remote.
- Demo video: handled as a separate submission artifact.
