import { describe, expect, it } from "vitest";
import { FighterStates } from "../../shared/fighterState.js";
import { createMatch, queueInput, stepMatch } from "../../shared/match.js";

describe("match simulation", () => {
  it("applies damage and knockback when a light attack connects", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p2.x = 548;
    queueInput(match, "p1", { light: true });
    stepMatch(match, 100);
    expect(match.fighters.p2.damage).toBeGreaterThan(0);
    expect(match.fighters.p2.state).toBe(FighterStates.Hitstun);
  });

  it("removes a stock when a fighter crosses the bottom blast zone", () => {
    const match = createMatch("cpu");
    match.fighters.p2.y = 980;
    stepMatch(match, 16.67);
    expect(match.fighters.p2.stocks).toBe(2);
    expect(match.fighters.p2.state).toBe(FighterStates.Respawn);
  });

  it("ends when a fighter has no stocks left", () => {
    const match = createMatch("cpu");
    match.fighters.p2.stocks = 1;
    match.fighters.p2.y = 980;
    stepMatch(match, 16.67);
    expect(match.status).toBe("complete");
    expect(match.winnerId).toBe("p1");
  });

  it.each([FighterStates.Launched, FighterStates.KO])(
    "does not start a light attack while in %s",
    (state) => {
      const match = createMatch("cpu");
      match.fighters.p1.state = state;
      queueInput(match, "p1", { light: true });
      stepMatch(match, 16.67);
      expect(match.fighters.p1.state).toBe(state);
      expect(match.fighters.p1.activeAttack).toBeNull();
    }
  );

  it("clears stale active attacks when a fighter loses a stock", () => {
    const match = createMatch("cpu");
    match.fighters.p2.x = match.fighters.p2.spawn.x;
    match.fighters.p2.y = 980;
    match.fighters.p2.activeAttack = { key: "light", remainingMs: 500, hasHit: false };

    stepMatch(match, 16.67);

    expect(match.fighters.p2.activeAttack).toBeNull();

    match.fighters.p1.x = 860;
    match.fighters.p1.y = match.fighters.p2.spawn.y;
    stepMatch(match, 16.67);
    expect(match.fighters.p1.damage).toBe(0);
  });

  it("does not restart a held light attack after cooldown until released and pressed again", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p1.y = 520;
    match.fighters.p2.x = 900;
    queueInput(match, "p1", { light: true });

    stepMatch(match, 100);
    expect(match.fighters.p1.attackCooldownMs).toBeGreaterThan(0);

    stepMatch(match, 200);
    stepMatch(match, 16.67);
    expect(match.fighters.p1.state).not.toBe(FighterStates.AttackLight);
    expect(match.fighters.p1.activeAttack).toBeNull();

    queueInput(match, "p1", {});
    stepMatch(match, 16.67);
    queueInput(match, "p1", { light: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.AttackLight);
    expect(match.fighters.p1.activeAttack).toMatchObject({ key: "light", hasHit: false });
  });
});
