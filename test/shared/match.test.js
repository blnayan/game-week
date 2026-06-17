import { describe, expect, it } from "vitest";
import { STAGE } from "../../shared/constants.js";
import { FighterStates } from "../../shared/fighterState.js";
import { createMatch, forfeitMatch, queueInput, stepMatch } from "../../shared/match.js";
import { TRI_PLATFORM_STAGE_ID } from "../../shared/stages.js";

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

  it("creates tri-platform matches with stage-specific spawns", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });

    expect(match.stageId).toBe(TRI_PLATFORM_STAGE_ID);
    expect(match.fighters.p1.spawn).toMatchObject({ x: 430, y: 450, facing: 1 });
    expect(match.fighters.p2.spawn).toMatchObject({ x: 850, y: 450, facing: -1 });
  });

  it.each([
    ["left", 280, 381],
    ["top", 640, 191],
    ["right", 1000, 381],
    ["main", 640, 540]
  ])("lands on the %s tri-platform ledge", (_name, x, y) => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    match.fighters.p1.x = x;
    match.fighters.p1.y = y - 8;
    match.fighters.p1.velocity.y = 14;

    stepMatch(match, 16.67);

    expect(match.fighters.p1.y).toBe(y);
    expect(match.fighters.p1.onGround).toBe(true);
    expect(match.fighters.p1.velocity.y).toBe(0);
  });

  it("does not snap down to a tri-platform ledge before crossing its top", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    match.fighters.p1.x = 640;
    match.fighters.p1.y = 191 - 24;
    match.fighters.p1.velocity.y = 14;

    stepMatch(match, 16.67);

    expect(match.fighters.p1.y).toBeLessThan(191);
    expect(match.fighters.p1.onGround).toBe(false);
    expect(match.fighters.p1.velocity.y).toBeGreaterThan(0);
  });

  it("does not snap to a tri-platform ledge when moving upward from below", () => {
    const match = createMatch("cpu", { stageId: TRI_PLATFORM_STAGE_ID });
    match.fighters.p1.x = 640;
    match.fighters.p1.y = 221;
    match.fighters.p1.velocity.y = -12;

    stepMatch(match, 16.67);

    expect(match.fighters.p1.y).toBeLessThan(221);
    expect(match.fighters.p1.y).not.toBe(191);
    expect(match.fighters.p1.onGround).toBe(false);
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
    expect(match.endReason).toBe("stocks");
  });

  it("ends immediately when a player forfeits", () => {
    const match = createMatch("online");

    forfeitMatch(match, "p1", "disconnect");

    expect(match.status).toBe("complete");
    expect(match.winnerId).toBe("p2");
    expect(match.endReason).toBe("disconnect");
    expect(match.fighters.p1.stocks).toBe(0);
    expect(match.fighters.p1.stats.falls).toBe(1);
    expect(match.fighters.p2.stats.kos).toBe(1);
    expect(match.fighters.p2.state).toBe(FighterStates.Victory);
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
    match.fighters.p1.y = STAGE.platform.y;
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

  it("starts a dive attack from airborne down input", () => {
    const match = createMatch("cpu");
    match.fighters.p1.y = STAGE.platform.y - 120;
    match.fighters.p1.onGround = false;
    match.fighters.p1.velocity.y = 2;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.DiveAttack);
    expect(match.fighters.p1.activeAttack).toMatchObject({ key: "dive", hasHit: false });
    expect(match.fighters.p1.velocity.y).toBeGreaterThan(2);
  });

  it("does not start a dive attack from grounded down input", () => {
    const match = createMatch("cpu");
    match.fighters.p1.y = STAGE.platform.y;
    match.fighters.p1.onGround = true;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.Idle);
    expect(match.fighters.p1.activeAttack).toBeNull();
  });

  it("does not start a dive attack from same-frame grounded jump and down", () => {
    const match = createMatch("cpu");
    match.fighters.p1.y = STAGE.platform.y;
    match.fighters.p1.onGround = true;

    queueInput(match, "p1", { jump: true, down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.Jump);
    expect(match.fighters.p1.state).not.toBe(FighterStates.DiveAttack);
    expect(match.fighters.p1.activeAttack).toBeNull();
  });

  it("requires a fresh airborne down press after holding down on the ground", () => {
    const match = createMatch("cpu");
    match.fighters.p1.y = STAGE.platform.y;
    match.fighters.p1.onGround = true;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    match.fighters.p1.y = STAGE.platform.y - 120;
    match.fighters.p1.onGround = false;
    match.fighters.p1.velocity.y = 2;
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).not.toBe(FighterStates.DiveAttack);
    expect(match.fighters.p1.activeAttack).toBeNull();

    queueInput(match, "p1", {});
    stepMatch(match, 16.67);
    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.DiveAttack);
    expect(match.fighters.p1.activeAttack).toMatchObject({ key: "dive", hasHit: false });
  });

  it("applies damage when a dive attack overlaps below the attacker", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p1.y = STAGE.platform.y - 84;
    match.fighters.p1.onGround = false;
    match.fighters.p1.velocity.y = 4;
    match.fighters.p2.x = 500;
    match.fighters.p2.y = STAGE.platform.y;

    queueInput(match, "p1", { down: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p2.damage).toBeGreaterThan(0);
    expect(match.fighters.p2.state).toBe(FighterStates.Hitstun);
    expect(match.effects).toContainEqual(expect.objectContaining({ type: "hitSpark" }));
  });

  it("ignores removed up special dodge and shield inputs", () => {
    const match = createMatch("cpu");
    match.fighters.p1.x = 500;
    match.fighters.p2.x = 548;

    queueInput(match, "p1", { up: true, special: true, dodge: true, shield: true });
    stepMatch(match, 16.67);

    expect(match.fighters.p1.state).toBe(FighterStates.Idle);
    expect(match.fighters.p1.activeAttack).toBeNull();
    expect(match.fighters.p1.invulnerableMs).toBe(0);
    expect(match.fighters.p2.damage).toBe(0);
  });
});
