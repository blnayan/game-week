import { describe, expect, it } from "vitest";
import { getOnlineOverlayState, isActiveOnlineMatchSnapshot, shouldUnlockOnlineRoundFromSnapshot } from "./matchOverlayState.js";

describe("getOnlineOverlayState", () => {
  it("shows copy invite only while waiting for an opponent", () => {
    expect(getOnlineOverlayState({ message: "Waiting for opponent", players: 1 }, true)).toMatchObject({
      title: "Waiting for opponent",
      canCopyInvite: true
    });

    expect(getOnlineOverlayState({ phase: "waiting", players: 1, reason: "waiting", message: "any" }, true)).toMatchObject({
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

    expect(getOnlineOverlayState({ phase: "countdown", players: 2, message: "Ready" }, true)).toMatchObject({
      title: "Get Ready",
      canCopyInvite: false
    });

    expect(getOnlineOverlayState({ phase: "countdown", players: 2, reason: "rematch", message: "Waiting for opponent" }, true)).toMatchObject({
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

    expect(getOnlineOverlayState({ reason: "disconnect", players: 1, message: "Socket closed" }, true)).toMatchObject({
      title: "Room disconnected",
      canExitRoom: true
    });
  });

  it("shows a resumable pause state from structured pause fields", () => {
    expect(getOnlineOverlayState({ phase: "paused", pausedBy: "p1", message: "Game stopped" }, false)).toMatchObject({
      title: "Paused",
      canResume: true
    });

    expect(getOnlineOverlayState({ phase: "paused", pausedBy: "p1", players: 2, message: "Waiting for opponent" }, true)).toMatchObject({
      title: "Paused",
      canResume: true,
      canCopyInvite: false
    });

    expect(getOnlineOverlayState({ phase: "paused", pausedBy: "p1", players: 2 }, false)).toMatchObject({
      title: "Paused",
      message: "p1 paused"
    });
  });

  it("treats only playing-phase snapshots as active online rounds", () => {
    expect(isActiveOnlineMatchSnapshot({ status: "playing", phase: "playing" })).toBe(true);
    expect(isActiveOnlineMatchSnapshot({ status: "playing", phase: "countdown" })).toBe(false);
    expect(isActiveOnlineMatchSnapshot({ status: "playing" })).toBe(false);
    expect(isActiveOnlineMatchSnapshot({ status: "complete", phase: "playing" })).toBe(false);
  });

  it("does not unlock active snapshots over an intentional local pause", () => {
    expect(shouldUnlockOnlineRoundFromSnapshot({ status: "playing", phase: "playing" }, { localPaused: false })).toBe(true);
    expect(shouldUnlockOnlineRoundFromSnapshot({ status: "playing", phase: "playing" }, { localPaused: true })).toBe(false);
    expect(shouldUnlockOnlineRoundFromSnapshot({ status: "playing", phase: "countdown" }, { localPaused: false })).toBe(false);
  });
});
