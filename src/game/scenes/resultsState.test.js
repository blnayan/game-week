import { describe, expect, it } from "vitest";
import {
  canOfferOnlineRematch,
  getOnlineRematchSceneData,
  getResultMenuSceneData,
  getRematchDisplayState,
  getResultStatusText,
  getResultRoomStatusText,
  isRematchStartSnapshot,
  shouldHideOnlineRematchOnStatus
} from "./resultsState.js";

describe("canOfferOnlineRematch", () => {
  it("allows online rematch after stocks or manual forfeit when both players remain", () => {
    expect(canOfferOnlineRematch({ isOnline: true, endReason: "stocks", roomPlayers: 2 })).toBe(true);
    expect(canOfferOnlineRematch({ isOnline: true, endReason: "forfeit", roomPlayers: 2 })).toBe(true);
  });

  it("hides online rematch after disconnects or when the other player is gone", () => {
    expect(canOfferOnlineRematch({ isOnline: true, endReason: "disconnect", roomPlayers: 2 })).toBe(false);
    expect(canOfferOnlineRematch({ isOnline: true, endReason: "forfeit", roomPlayers: 1 })).toBe(false);
    expect(canOfferOnlineRematch({ isOnline: false, endReason: "stocks", roomPlayers: 0 })).toBe(false);
  });
});

describe("result screen state helpers", () => {
  it("labels online result status by end reason", () => {
    expect(getResultStatusText({ endReason: "disconnect", isOnline: true, roomCode: "ABCDE" })).toBe("Room disconnected");
    expect(getResultStatusText({ endReason: "forfeit", isOnline: true, roomCode: "ABCDE" })).toBe("Match forfeited");
    expect(getResultStatusText({ endReason: "stocks", isOnline: true, roomCode: "ABCDE" })).toBe("Room ABCDE");
    expect(getResultStatusText({ endReason: "stocks", isOnline: false, roomCode: "ABCDE" })).toBe("");
  });

  it("hides rematch when a completed online room loses the other player", () => {
    expect(shouldHideOnlineRematchOnStatus({ message: "Room disconnected", players: 1 })).toBe(true);
    expect(shouldHideOnlineRematchOnStatus({ message: "p1 forfeited", players: 1 })).toBe(true);
    expect(shouldHideOnlineRematchOnStatus({ message: "p1 forfeited", players: 2 })).toBe(false);
    expect(shouldHideOnlineRematchOnStatus({ reason: "disconnect", players: 1 })).toBe(true);
    expect(shouldHideOnlineRematchOnStatus({ reason: "forfeit", players: 2 })).toBe(false);
  });

  it("shows mutual rematch requests differently for requester and opponent", () => {
    const status = {
      message: "p1 wants a rematch",
      players: 2,
      rematch: { requestedBy: "p1", requested: 1, required: 2 }
    };

    expect(getResultRoomStatusText(status, { playerId: "p1", roomCode: "ABCDE" })).toBe("Waiting for opponent...");
    expect(getResultRoomStatusText(status, { playerId: "p2", roomCode: "ABCDE" })).toBe("Opponent wants a rematch");
  });

  it("keeps rematch request display based on requester after forfeit and natural wins", () => {
    const forfeitStatus = {
      reason: "forfeit",
      players: 2,
      message: "p1 forfeited",
      rematch: { requestedBy: "p2", requested: 1, required: 2 }
    };
    const naturalWinStatus = {
      reason: "stocks",
      players: 2,
      message: "p2 wins",
      rematch: { requestedBy: "p2", requested: 1, required: 2 }
    };

    expect(getRematchDisplayState(forfeitStatus, { playerId: "p1", roomCode: "ABCDE" })).toMatchObject({
      statusText: "Opponent wants a rematch",
      opponentRequested: true
    });
    expect(getRematchDisplayState(naturalWinStatus, { playerId: "p2", roomCode: "ABCDE" })).toMatchObject({
      statusText: "Waiting for opponent...",
      opponentRequested: false
    });
  });

  it("recognizes only active rematch-start snapshots", () => {
    expect(isRematchStartSnapshot({ status: "playing", phase: "countdown" })).toBe(true);
    expect(isRematchStartSnapshot({ status: "playing", phase: "playing" })).toBe(true);
    expect(isRematchStartSnapshot({ status: "playing", phase: "complete" })).toBe(false);
    expect(isRematchStartSnapshot({ status: "complete", phase: "complete" })).toBe(false);
  });

  it("keeps the rematch button label stable while notifying the opponent", () => {
    const status = {
      message: "p1 wants a rematch",
      players: 2,
      rematch: { requestedBy: "p1", requested: 1, required: 2 }
    };

    expect(getRematchDisplayState(status, { playerId: "p2", roomCode: "ABCDE" })).toEqual({
      statusText: "Opponent wants a rematch",
      buttonLabel: "Rematch",
      opponentRequested: true
    });
    expect(getRematchDisplayState(status, { playerId: "p1", roomCode: "ABCDE" })).toMatchObject({
      statusText: "Waiting for opponent...",
      buttonLabel: "Rematch",
      opponentRequested: false
    });
  });

  it("returns to menu without consuming stale invite links", () => {
    expect(getResultMenuSceneData()).toEqual({ skipInitialRoomJoin: true });
  });

  it("keeps rematch startup data consistent after the server accepts rematch", () => {
    const net = { requestRematch: () => {} };

    expect(getOnlineRematchSceneData({ roomCode: "ABCDE", playerId: "p2", roomPlayers: 2, net })).toEqual({
      mode: "online-rematch",
      roomCode: "ABCDE",
      playerId: "p2",
      roomPlayers: 2,
      net
    });
    expect(getOnlineRematchSceneData({ roomCode: "ABCDE", playerId: "p2", net })).toMatchObject({ roomPlayers: 2 });
  });
});
