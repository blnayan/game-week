import { describe, expect, it } from "vitest";
import { getMatchHudMeta } from "./matchHudMeta.js";

describe("getMatchHudMeta", () => {
  it("includes the latest online ping in HUD metadata", () => {
    expect(getMatchHudMeta({
      mode: "online-create",
      roomCode: "ROOM1",
      status: "Waiting for opponent",
      net: { getPingMs: () => 12.4 }
    })).toEqual({
      mode: "online-create",
      roomCode: "ROOM1",
      status: "Waiting for opponent",
      pingMs: 12.4
    });
  });
});
