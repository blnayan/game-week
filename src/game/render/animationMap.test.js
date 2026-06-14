import { describe, expect, it } from "vitest";
import { FighterStates } from "../../../shared/fighterState.js";
import { FIGHTER_ANIMS } from "./assetManifest.js";
import { animationKey } from "./animationMap.js";

describe("animationKey", () => {
  it("maps simplified public action states to minimal animations", () => {
    expect(animationKey({ palette: "blue", state: FighterStates.Idle })).toBe("blue:idle");
    expect(animationKey({ palette: "blue", state: FighterStates.Run })).toBe("blue:run");
    expect(animationKey({ palette: "blue", state: FighterStates.Jump })).toBe("blue:jump");
    expect(animationKey({ palette: "blue", state: FighterStates.AttackLight })).toBe("blue:light");
    expect(animationKey({ palette: "blue", state: FighterStates.AttackHeavy })).toBe("blue:heavy");
    expect(animationKey({ palette: "blue", state: FighterStates.DiveAttack })).toBe("blue:dive");
  });

  it("does not require removed move animations", () => {
    expect(FIGHTER_ANIMS).not.toHaveProperty("up");
    expect(FIGHTER_ANIMS).not.toHaveProperty("special");
    expect(FIGHTER_ANIMS).not.toHaveProperty("dodge");
    expect(FIGHTER_ANIMS).not.toHaveProperty("shield");
  });
});
