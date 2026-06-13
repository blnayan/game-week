import { describe, expect, it, vi } from "vitest";
import { createRoomCode, toPublicSnapshot } from "../../shared/rooms.js";

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
});
