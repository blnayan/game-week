# Simplified Controls, Dive Attack, And Roomier Fighter Sprites

Date: 2026-06-14

## Purpose

Simplify the playable fighter kit and rebuild the fighter sprite sheets around that smaller move set. The game should keep the responsive platform-fighter core while removing extra attacks and defensive inputs that make the controls harder to learn.

The final player controls are:

- `A` / `D`: move left and right.
- `Space`: jump and double jump.
- `J`: light attack.
- `K`: heavy attack.
- `S`: airborne dive attack.

Grounded `S` does nothing. `W`, `L`, `Shift`, and `I` are no longer gameplay controls.

## Chosen Approach

Use the simplified combat kit with a real dive attack.

The game will keep only the user-facing moves listed above, while retaining internal non-player states needed for match lifecycle and feedback: hitstun, launched, respawn, KO, and victory. Up attack, special, dodge, and shield will be removed from player input, CPU decision-making, attack definitions, active combat transitions, and fighter animation coverage.

This approach is cleaner than an input-only cleanup because it removes dead moves from the combat model and sprite requirements. It is lower risk than purging every old state reference blindly because lifecycle states still serve active match behavior.

## Controls And Input

`src/game/input/inputMapper.js` will map only the new public controls:

- `A`: held left movement.
- `D`: held right movement.
- `Space`: fresh jump press.
- `J`: fresh light attack press.
- `K`: fresh heavy attack press.
- `S`: held or fresh down input that the shared simulation interprets as dive attack only when the fighter is airborne.

`W` will no longer jump or combine with `J` for up attack. This makes `Space` the only jump input and avoids accidental special-case attacks.

Online input should keep sending compact input objects, but the active edge inputs shrink to jump, light, heavy, and the dive/down action. Compatibility can be handled by leaving ignored fields harmless during transition, but tests should assert the removed controls no longer produce gameplay actions.

## Combat Behavior

Light and heavy attacks remain the standard horizontal attacks:

- `light`: quick, low cooldown, small forward hitbox.
- `heavy`: slower, higher damage, larger forward hitbox.

The new `dive` attack starts only while airborne when `S` is pressed. It should:

- Enter a timed `DiveAttack` state.
- Push the fighter downward with a committed fall velocity.
- Use a downward hitbox near and below the fighter body.
- Apply moderate damage and knockback that pops the target slightly down and away or down-forward.
- Use its own cooldown so holding `S` does not restart the attack every frame.
- End into `Fall` after its active window unless the fighter lands.

Grounded `S` does not fast fall and does not start an attack. Double jump remains unchanged through the existing two-jump counter.

Defense actions are removed from the player kit. There will be no dodge invulnerability input and no shield-lite state from `I`. Existing respawn invulnerability remains because it is part of match lifecycle, not a player move.

## CPU Behavior

The CPU should continue to be deterministic:

- Move toward the opponent when outside attack range.
- Jump back toward the platform when recovering.
- Use light attacks at close range.
- Occasionally use heavy attacks at close to medium range on normal and hard difficulty.
- Use the dive attack only when airborne above or near the opponent.

The CPU should not emit special, dodge, shield, or up-attack inputs.

## Sprite Sheet Format

Each fighter sheet will be rebuilt from the ground up as a transparent single-row PNG:

- Frame size: 128px wide by 128px high.
- Character source-art body target: about the current visible body size, roughly 76px tall.
- Frame count: enough for the reduced animation set, expected to be 30 frames unless implementation finds a smaller clean count.
- Background: transparent.
- Pixel-art style: crisp shapes, limited palettes, chunky outlines, no antialiasing blur.

The larger frame is for animation room, not a larger fighter. The render scale and sprite origin should keep the in-game character close to its current visible size and keep feet planted on the platform.

The three committed fighter files remain:

- `public/assets/fighters/blue.png`
- `public/assets/fighters/orange.png`
- `public/assets/fighters/violet.png`

The sheets should be generated deterministically by a repo script so future changes can reproduce the assets.

## Animation Coverage

The reduced animation map should cover only active gameplay and lifecycle states:

- `idle`: subtle breathing or stance shift.
- `run`: readable alternating legs and arms.
- `jump`: upward airborne pose.
- `fall`: normal descending pose.
- `light`: windup, strike, recovery.
- `heavy`: windup, impact, follow-through, recovery.
- `dive`: airborne downward attack windup, strike, recovery/fall pose.
- `hurt`: hit reaction.
- `launched`: stronger airborne knockback pose.
- `respawn`: re-entry pose.
- `ko`: defeat pose.
- `victory`: short celebration loop.

Up attack, special, dodge, and shield animation entries are removed from the fighter animation map because they no longer correspond to usable moves.

## Integration

Runtime changes should stay aligned with the existing architecture:

- `shared/attacks.js` owns only `light`, `heavy`, and `dive`.
- `shared/fighterState.js` owns simplified public action states and retains lifecycle states.
- `shared/match.js` starts attacks from the simplified input set and no longer runs defense input transitions.
- `shared/cpu.js` emits only movement, jump, light, heavy, and dive.
- `src/game/render/assetManifest.js` loads the new 128x128 fighter sheets and reduced animation frames.
- `src/game/render/animationMap.js` maps `DiveAttack` to `dive`.
- `src/game/scenes/MenuScene.js` and `README.md` show the new controls.
- Existing collision dimensions stay unchanged unless a test exposes an issue. The visual art should fit the current gameplay body instead of changing physics.

## Testing And Verification

Tests should be updated or added before implementation changes:

- Input mapper tests proving `Space`, `A`, `D`, `J`, `K`, and `S` map correctly and `W`, `L`, `Shift`, and `I` no longer create gameplay actions.
- Fighter state or match tests proving double jump remains available.
- Match tests proving airborne `S` starts `DiveAttack`, grounded `S` does nothing, and dive attacks can hit.
- Match tests proving removed inputs do not start up, special, dodge, or shield behavior.
- CPU tests proving it emits only the simplified move set.
- Asset manifest tests proving 128x128 fighter frame dimensions and expected PNG sheet dimensions.
- Animation map tests or equivalent assertions proving removed move animations are not required and `DiveAttack` resolves to `dive`.

Verification should run the focused tests first, then the full test suite and production build:

- `npm test -- src/game/input/inputMapper.test.js test/shared/fighterState.test.js test/shared/match.test.js test/shared/cpu.test.js src/game/render/assetManifest.test.js`
- `npm test`
- `npm run build`

A local visual pass should confirm the characters remain the same apparent size, the 128x128 frames do not clip attacks, idle/run/light/heavy/dive animations are readable, and the simplified controls work in a CPU match.

## Out Of Scope

This change does not add new characters, new stages, new online room features, per-character unique attacks, or changed stock/match rules. It does not redesign portraits or effects unless a small compatibility update is required after the removed shield/special/dodge behavior is gone.

## Self-Review

- No placeholders remain.
- The requested controls are explicit and remove the extra public inputs.
- Dive attack is defined as a real airborne attack, not a generic fast fall.
- Double jump remains in scope and unchanged.
- The sprite frame size increases to 128x128 while the character body target stays near the current size.
- The design keeps lifecycle states that the match still needs, avoiding an unsafe full state purge.
