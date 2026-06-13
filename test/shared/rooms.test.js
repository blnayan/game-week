import { describe, expect, it, vi } from "vitest";
import {
  assignPlayerId,
  createRoomCode,
  normalizeRoomCode,
  removeSocketFromRooms,
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
      elapsedMs: 16.67,
      effects: [{ type: "hitSpark" }],
      fighters: { p1: { id: "p1" }, p2: { id: "p2" } },
      inputs: { p1: {}, p2: {} }
    };

    expect(toPublicSnapshot(match)).toEqual({
      status: "playing",
      winnerId: null,
      elapsedMs: 17,
      effects: match.effects,
      fighters: match.fighters
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
});
