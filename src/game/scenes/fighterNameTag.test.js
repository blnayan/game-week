import { describe, expect, it } from "vitest";
import { getFighterNameTagView } from "./fighterNameTag.js";

describe("fighter name tags", () => {
  it("positions a player label above the fighter body", () => {
    expect(getFighterNameTagView("p1", { x: 420, y: 554, height: 88 })).toEqual({
      label: "P1",
      x: 420,
      y: 436,
      color: "#79d7ff"
    });
  });

  it("uses the orange player color for p2", () => {
    expect(getFighterNameTagView("p2", { x: 860, y: 554, height: 88 })).toMatchObject({
      label: "P2",
      color: "#ffb067"
    });
  });
});
