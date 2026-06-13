import { describe, expect, it } from "vitest";
import {
  FighterStates,
  createFighter,
  applyInputState,
  enterHitstun,
  setFighterState,
  tickFighterState
} from "../../shared/fighterState.js";

describe("fighter state machine", () => {
  it("starts fighters in idle with stocks and jumps", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    expect(fighter.state).toBe(FighterStates.Idle);
    expect(fighter.stocks).toBe(3);
    expect(fighter.jumpsRemaining).toBe(2);
  });

  it("transitions from idle to run when horizontal input is held", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    applyInputState(fighter, { left: false, right: true, jump: false, down: false });
    expect(fighter.state).toBe(FighterStates.Run);
    expect(fighter.facing).toBe(1);
  });

  it("enters jump and consumes one jump when jump is pressed", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    applyInputState(fighter, { left: false, right: false, jump: true, down: false });
    expect(fighter.state).toBe(FighterStates.Jump);
    expect(fighter.jumpsRemaining).toBe(1);
    expect(fighter.velocity.y).toBeLessThan(0);
  });

  it("hitstun blocks movement transitions until the timer expires", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    enterHitstun(fighter, { x: 12, y: -8 }, 120);
    applyInputState(fighter, { left: true, right: false, jump: true, down: false });
    expect(fighter.state).toBe(FighterStates.Hitstun);
    tickFighterState(fighter, 120);
    expect(fighter.state).toBe(FighterStates.Fall);
  });

  it("respawn returns to idle when its timer expires on the ground", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    setFighterState(fighter, FighterStates.Respawn, 120);
    tickFighterState(fighter, 120);
    expect(fighter.state).toBe(FighterStates.Idle);
  });

  it("timed action states block movement until their timer expires", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    setFighterState(fighter, FighterStates.AttackLight, 80);
    applyInputState(fighter, { left: false, right: true, jump: false, down: false });
    expect(fighter.state).toBe(FighterStates.AttackLight);

    tickFighterState(fighter, 80);
    expect(fighter.state).toBe(FighterStates.Idle);
  });

  it("consumes jumps only on fresh jump presses", () => {
    const fighter = createFighter("p1", 260, 420, 1);
    applyInputState(fighter, { left: false, right: false, jump: true, down: false });
    applyInputState(fighter, { left: false, right: false, jump: true, down: false });
    expect(fighter.jumpsRemaining).toBe(1);

    applyInputState(fighter, { left: false, right: false, jump: false, down: false });
    applyInputState(fighter, { left: false, right: false, jump: true, down: false });
    expect(fighter.jumpsRemaining).toBe(0);
  });
});
