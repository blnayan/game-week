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
});
