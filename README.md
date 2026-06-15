# Pixel Arena Fighter

A fullscreen browser platform fighter built for Game Week. It uses Phaser for the 2D client, Node/Express for hosting, Socket.IO for online rooms, and a shared JavaScript combat simulation for CPU and online play.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The Socket.IO server runs on port 3000.

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

## Modes

- **CPU Battle**: starts a local match against a CPU opponent using the shared simulation.
- **Create Online Room**: creates a Socket.IO room code for another browser to join.
- **Join Online Room**: joins an existing room code.

## Architecture

The shared simulation in `shared/` owns fighter state, combat transitions, attacks, damage, knockback, stocks, CPU input, and match lifecycle. The client renders that state with Phaser. The server is authoritative for online rooms: clients send inputs and the server broadcasts match snapshots.

Phaser Scenes manage app flow: boot, menu, match, HUD, and results. Fighter gameplay uses a custom finite state machine in `shared/fighterState.js`.

## Multiplayer Design

Socket.IO rooms map directly to match rooms. A room has two player slots, one match instance, and a fixed server tick. Disconnects notify the remaining player, and empty rooms are cleaned up.

## CPU Design

The CPU chooses compact input packets from match state. It approaches when far, uses light and heavy attacks in range, dives when airborne above the opponent, and jumps back toward the platform when recovering.

## Pixel Art Asset Pipeline

The pixel-art stage, fighter sheets, portraits, and effects are committed PNG assets under `public/assets/`. They are produced once and loaded by Phaser during boot. `npm run dev` and `npm run build` do not generate or modify art assets.

## Progression

Match results award XP in local storage. Reaching 300 XP unlocks the violet fighter palette, which is shown on the menu and used by the player in CPU Battle.

## AI-Assisted Learning Notes

The project followed a browser-game pathway from the Game Week brief. AI was used to compare Phaser and raw Canvas, design the network model, define a shared simulation boundary, and plan the state machine so CPU mode and online mode do not diverge.

See [docs/learning-log.md](docs/learning-log.md) for the Brainlift-style progress log and [docs/ai-methodology.md](docs/ai-methodology.md) for the AI learning and development methodology.

## Submission Status

- Working game: complete and deployed on a VPS.
- Multiplayer: complete and stress tested; evidence was posted on GitLab.
- Progression: complete through local XP and palette unlocks.
- Docker: verified through the VPS deployment.
- Repository: published to GitLab.
- Demo video: planned as a separate submission artifact.
