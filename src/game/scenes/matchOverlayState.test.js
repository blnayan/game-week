import { describe, expect, it } from "vitest";
import { getOnlineOverlayState } from "./matchOverlayState.js";

describe("getOnlineOverlayState", () => {
  it("shows copy invite only while waiting for an opponent", () => {
    expect(getOnlineOverlayState({ message: "Waiting for opponent", players: 1 }, true)).toMatchObject({
      title: "Waiting for opponent",
      canCopyInvite: true
    });
  });

  it("does not show copy invite during rematch startup or countdown", () => {
    expect(getOnlineOverlayState({ message: "p1 started a rematch", players: 2 }, true)).toMatchObject({
      title: "Get Ready",
      canCopyInvite: false
    });
    expect(getOnlineOverlayState({ message: "Starting in 3", players: 2 }, true)).toMatchObject({
      title: "Get Ready",
      canCopyInvite: false
    });
  });

  it("shows an exit-only state when a pre-match room is disconnected", () => {
    expect(getOnlineOverlayState({ message: "Room disconnected", players: 1 }, true)).toMatchObject({
      title: "Room disconnected",
      canCopyInvite: false,
      canExitRoom: true
    });
  });
});
