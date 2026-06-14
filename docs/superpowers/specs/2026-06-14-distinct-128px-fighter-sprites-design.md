# Distinct 128px Fighter Sprite Redesign

Date: 2026-06-14

## Purpose

Replace the current shared-silhouette fighter sprite sheets with three distinct original pixel-art characters and a roomier animation frame format. Each fighter frame will be 128px by 128px, with the playable character body targeting about 96px tall and the remaining space reserved for attack arcs, headband or scarf motion, jump extension, and other animation overshoot.

The goal is better readability in motion: stronger walking cycles, clearer light and heavy attacks, and distinct silhouettes for the blue, orange, and violet fighters while preserving the existing gameplay kit.

## Chosen Approach

Use distinct character art with the existing shared animation map.

The project already maps fighter states to fixed frame indexes in `src/game/render/assetManifest.js` and `src/game/render/animationMap.js`. Keeping those indexes avoids unnecessary combat and scene changes while allowing the sheets themselves to be rebuilt at 128px per frame.

This means:

- Keep the same three fighter asset keys: `blue`, `orange`, and `violet`.
- Keep the same animation names and frame counts.
- Replace each fighter PNG with a new 38-frame single-row sheet.
- Update fighter frame constants from 96x80 to 128x128.
- Add a shared baseline constant so feet stay visually planted inside the taller frame.
- Preserve shared gameplay hitboxes unless visual QA shows an obvious mismatch.

## Character Direction

### Blue Fighter

The blue fighter becomes an original headband martial artist inspired by the supplied reference direction, not a direct copy. The readable traits are:

- Spiky dark hair.
- Red headband with animated trailing tails.
- Sleeveless dark martial-arts vest or gi shape.
- Red gloves and red shoes.
- Strong forward side-view stance.
- Athletic midweight proportions.

The 96px body target should prioritize silhouette and motion over tiny costume details. Headband tails can use the extra 32px frame space during idle, run, jump, and attack follow-through.

### Orange Fighter

The orange fighter becomes a bulky power fighter:

- Broad shoulders and torso.
- Large arms, gauntlets, and boots.
- Lower, heavier stance.
- Slower-looking heavy attack poses.
- Wider strike silhouettes than the other fighters.

The character should feel strong even though gameplay values stay shared. Heavy attack frames should show a clear windup, impact extension, and recovery.

### Violet Fighter

The violet fighter becomes an agile duelist or ninja:

- Slim body and narrow stance.
- Scarf or sash motion.
- Sharp angled limbs.
- Fast lean in run and light attack frames.
- Blade-like or energy-accented attack silhouettes without requiring unique gameplay.

The character should read as fast and precise while fitting the same hitbox and state machine as the other fighters.

## Sprite Sheet Format

Each fighter sheet will be a single-row PNG:

- Frame size: 128px wide by 128px high.
- Frame count: 38 frames.
- Sheet size: 4864px wide by 128px high.
- Body target: about 96px tall.
- Foot baseline: about 116px from the top of each frame.
- Background: transparent.
- Pixel-art style: chunky outlines, limited readable palette, no antialiasing blur.

The baseline leaves roughly 12px below the feet for shoe soles, dust, or stance variation and roughly 20px above a 96px body for hair, headbands, raised arms, and jump or attack overshoot. The exact pose can exceed the body target when the action needs it, but feet should remain aligned to the shared baseline for grounded states.

## Animation Coverage

The existing animation map remains the source of truth:

- `idle`: frames 0, 1, 2, played as `[0, 1, 0, 2]`; subtle breathing and stance shift.
- `run`: frames 3, 4, 5, played as `[3, 4, 5, 4]`; readable alternating legs and arms.
- `jump`: frame 6; compressed upward pose.
- `fall`: frame 7; descending pose with clear air silhouette.
- `light`: frames 8, 9, 10; anticipation, quick strike, recovery.
- `heavy`: frames 11, 12, 13, 14; large windup, committed strike, follow-through, recovery.
- `up`: frames 15, 16, 17; upward attack with vertical reach.
- `special`: frames 18, 19, 20, 21; forward special pose with distinct character-specific accent.
- `dodge`: frames 22, 23; crouch/blur or evasive lean.
- `shield`: frames 24, 25; guarded stance compatible with the existing shield visual.
- `hurt`: frames 26, 27; readable hit reaction.
- `launched`: frames 28, 29; airborne knockback pose.
- `respawn`: frames 30, 31, 32; re-entry or materializing pose.
- `ko`: frames 33, 34; defeat/fall pose.
- `victory`: frames 35, 36, 37, played as `[35, 36, 37, 36]`; character-specific celebration.

Frame counts should stay just enough for readable action. If a state needs more polish later, the animation map can be expanded in a separate change, but this redesign should not increase scope.

## Integration

Runtime changes should be limited to the asset pipeline:

- Update `FIGHTER_FRAME_WIDTH` and `FIGHTER_FRAME_HEIGHT` to 128.
- Add or restore `FIGHTER_FRAME_BASELINE`, expected to be 116.
- Anchor fighter sprites using `FIGHTER_FRAME_BASELINE / FIGHTER_FRAME_HEIGHT`.
- Adjust `FIGHTER_RENDER_SCALE` so the visible characters remain close to the current gameplay size.
- Update tests to assert 128x128 frames and 4864x128 sheet dimensions.

The shared fighter collision size currently remains `48x78` in `shared/fighterState.js`. That collision box is the gameplay contract. The new sprites should be drawn around that scale rather than changing match physics.

## Asset Production Method

Assets can be produced programmatically as committed PNG sheets if that gives the most deterministic result. The generated sheets should use transparent backgrounds and crisp pixel blocks, not runtime-created Phaser graphics.

If AI image generation is used for concepting, the final project assets still need to be copied into `public/assets/fighters/` and validated as actual 128px sprite sheets. The game must not depend on generated images outside the repository.

## Testing And Verification

Verification should cover both file shape and in-game readability:

- Unit tests for the asset manifest should pass with 128x128 frame options.
- PNG dimensions should be checked for all three fighter sheets.
- The game should build successfully.
- A local visual pass should confirm the fighters are not clipped, feet remain planted, attacks have readable overshoot, and character sizes still fit the floating arena.

## Out Of Scope

This redesign does not add new combat moves, per-character abilities, unique hitboxes, new fighter states, or a new sprite atlas format. It also does not redesign stage art, effects, portraits, or UI unless a small portrait refresh becomes necessary to avoid obvious mismatch.

## Self-Review

- No placeholders remain.
- The design keeps the current animation map and states consistent with the implementation files.
- The requested 128px by 128px frame format is explicit.
- The distinct silhouettes and the supplied first-fighter reference direction are captured without requiring a licensed copy.
- The scope is limited to fighter sheets and the render constants needed to load them.
