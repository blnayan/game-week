import { describe, expect, it, vi } from "vitest";
import {
  assignPlayerId,
  canCloseRoom,
  canJoinRoom,
  createRoomCode,
  createRematchRequestStatus,
  normalizeRoomCode,
  recordRematchRequest,
  removeSocketFromRooms,
  shouldForfeitOnDisconnect,
  shouldRunRoomInterval,
  sendAck,
  toPublicSnapshot
} from "../../shared/rooms.js";

describe("room helpers", () => {
  it("creates a five-character room code not already in use", () => {
    const code = createRoomCode(new Set(["AAAAA"]));

    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    expect(code).not.toBe("AAAAA");
  });

  it("throws when no room code can be allocated", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    expect(() => createRoomCode(new Set(["AAAAA"]))).toThrow("Unable to allocate room code");

    randomSpy.mockRestore();
  });

  it("returns only the public match snapshot fields", () => {
    const match = {
      status: "playing",
      winnerId: null,
      endReason: null,
      elapsedMs: 16.67,
      effects: [{ type: "hitSpark" }],
      fighters: { p1: { id: "p1" }, p2: { id: "p2" } },
      inputs: { p1: {}, p2: {} }
    };

    expect(toPublicSnapshot(match)).toEqual({
      status: "playing",
      winnerId: null,
      endReason: null,
      elapsedMs: 17,
      effects: match.effects,
      fighters: match.fighters
    });
  });

  it("includes the server room phase in public match snapshots when provided", () => {
    const match = {
      status: "playing",
      winnerId: null,
      endReason: null,
      elapsedMs: 0,
      effects: [],
      fighters: { p1: { id: "p1" }, p2: { id: "p2" } }
    };

    expect(toPublicSnapshot(match, { phase: "playing" })).toMatchObject({
      status: "playing",
      phase: "playing"
    });
  });

  it("normalizes malformed room code payloads without throwing", () => {
    expect(normalizeRoomCode(null)).toBe("");
    expect(normalizeRoomCode(undefined)).toBe("");
    expect(normalizeRoomCode({ code: " ab234 " })).toBe("AB234");
  });

  it("preserves an existing socket player slot on repeated joins", () => {
    const players = new Map([
      ["socket-a", "p1"],
      ["socket-b", "p2"]
    ]);

    expect(assignPlayerId(players, "socket-a")).toBe("p1");
  });

  it("assigns the open player slot for new sockets", () => {
    expect(assignPlayerId(new Map(), "socket-a")).toBe("p1");
    expect(assignPlayerId(new Map([["socket-a", "p1"]]), "socket-b")).toBe("p2");
  });

  it("removes a socket from prior rooms while preserving the target room", () => {
    const oldRoom = { code: "OLD01", players: new Map([["socket-a", "p1"]]) };
    const targetRoom = { code: "NEW01", players: new Map([["socket-a", "p2"]]) };
    const rooms = new Map([
      [oldRoom.code, oldRoom],
      [targetRoom.code, targetRoom]
    ]);

    expect(removeSocketFromRooms(rooms, "socket-a", targetRoom.code)).toEqual([
      { room: oldRoom, code: oldRoom.code, playerId: "p1", players: 0, emptied: true }
    ]);
    expect(oldRoom.players.has("socket-a")).toBe(false);
    expect(targetRoom.players.get("socket-a")).toBe("p2");
  });

  it("only sends acknowledgements through function callbacks", () => {
    const ack = vi.fn();

    expect(sendAck(ack, { ok: true })).toBe(true);
    expect(ack).toHaveBeenCalledWith({ ok: true });
    expect(sendAck("not-a-function", { ok: false })).toBe(false);
    expect(sendAck(null, { ok: false })).toBe(false);
  });

  it("denies joins to completed rooms", () => {
    const room = {
      match: { status: "complete" },
      players: new Map([["socket-a", "p1"]])
    };

    expect(canJoinRoom(room, "socket-a")).toEqual({ ok: false, error: "Room is complete" });
    expect(canJoinRoom(room, "socket-b")).toEqual({ ok: false, error: "Room is complete" });
  });

  it("only allows explicit room close after a completed match by a room player", () => {
    const completedRoom = {
      match: { status: "complete" },
      players: new Map([["socket-a", "p1"], ["socket-b", "p2"]])
    };
    const activeRoom = {
      match: { status: "playing" },
      players: new Map([["socket-a", "p1"], ["socket-b", "p2"]])
    };

    expect(canCloseRoom(completedRoom, "socket-a")).toEqual({ ok: true });
    expect(canCloseRoom(activeRoom, "socket-a")).toEqual({ ok: false, error: "Room is still active" });
    expect(canCloseRoom(completedRoom, "socket-c")).toEqual({ ok: false, error: "Room not found" });
    expect(canCloseRoom(null, "socket-a")).toEqual({ ok: false, error: "Room not found" });
  });

  it("requires both current room players to request rematch", () => {
    const room = {
      match: { status: "complete" },
      players: new Map([["socket-a", "p1"], ["socket-b", "p2"]]),
      rematchRequests: new Set()
    };

    expect(recordRematchRequest(room, "socket-a")).toEqual({ ok: true, ready: false, requested: 1, required: 2 });
    expect(room.rematchRequests.has("socket-a")).toBe(true);
    expect(recordRematchRequest(room, "socket-a")).toEqual({ ok: true, ready: false, requested: 1, required: 2 });
    expect(recordRematchRequest(room, "socket-b")).toEqual({ ok: true, ready: true, requested: 2, required: 2 });
  });

  it("builds structured rematch request status for both result screens", () => {
    const room = {
      code: "ABCDE",
      players: new Map([["socket-a", "p1"], ["socket-b", "p2"]])
    };
    const rematch = { requested: 1, required: 2 };

    expect(createRematchRequestStatus(room, "p1", rematch)).toEqual({
      message: "p1 wants a rematch",
      players: 2,
      roomCode: "ABCDE",
      rematch: {
        requestedBy: "p1",
        requested: 1,
        required: 2
      }
    });
  });

  it("rejects rematch requests when the room is gone, active, or missing an opponent", () => {
    expect(recordRematchRequest(null, "socket-a")).toEqual({ ok: false, error: "Room not found" });
    expect(recordRematchRequest({
      match: { status: "playing" },
      players: new Map([["socket-a", "p1"], ["socket-b", "p2"]]),
      rematchRequests: new Set()
    }, "socket-a")).toEqual({ ok: false, error: "Rematch unavailable" });
    expect(recordRematchRequest({
      match: { status: "complete" },
      players: new Map([["socket-a", "p1"]]),
      rematchRequests: new Set()
    }, "socket-a")).toEqual({ ok: false, error: "Opponent left" });
  });

  it("forfeits active disconnects but not waiting room exits", () => {
    expect(shouldForfeitOnDisconnect({ phase: "playing", match: { status: "playing" } })).toBe(true);
    expect(shouldForfeitOnDisconnect({ phase: "paused", match: { status: "playing" } })).toBe(true);
    expect(shouldForfeitOnDisconnect({ phase: "waiting", match: { status: "playing" } })).toBe(false);
    expect(shouldForfeitOnDisconnect({ phase: "countdown", match: { status: "playing" } })).toBe(false);
    expect(shouldForfeitOnDisconnect({ phase: "complete", match: { status: "complete" } })).toBe(false);
  });

  it("runs room simulation intervals only during active two-player matches", () => {
    expect(shouldRunRoomInterval({ phase: "waiting", match: { status: "playing" }, players: new Map([["a", "p1"]]) })).toBe(false);
    expect(shouldRunRoomInterval({ phase: "countdown", match: { status: "playing" }, players: new Map([["a", "p1"], ["b", "p2"]]) })).toBe(false);
    expect(shouldRunRoomInterval({ phase: "paused", match: { status: "playing" }, players: new Map([["a", "p1"], ["b", "p2"]]) })).toBe(false);
    expect(shouldRunRoomInterval({ phase: "playing", match: { status: "playing" }, players: new Map([["a", "p1"], ["b", "p2"]]) })).toBe(true);
    expect(shouldRunRoomInterval({ phase: "playing", match: { status: "complete" }, players: new Map([["a", "p1"], ["b", "p2"]]) })).toBe(false);
  });
});
