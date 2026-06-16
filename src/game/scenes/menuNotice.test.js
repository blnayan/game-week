import { describe, expect, it } from "vitest";
import { getMenuInitialRoomCode, getMenuNoticeText } from "./menuNotice.js";

describe("getMenuNoticeText", () => {
  it("shows room-not-found join failures on the menu", () => {
    expect(getMenuNoticeText({ notice: "Room not found" })).toBe("Room not found");
  });

  it("ignores empty notice data", () => {
    expect(getMenuNoticeText({ notice: "" })).toBe("");
    expect(getMenuNoticeText()).toBe("");
  });
});

describe("getMenuInitialRoomCode", () => {
  it("skips invite auto-join when returning from an ended room", () => {
    expect(getMenuInitialRoomCode({ skipInitialRoomJoin: true }, "https://game.example.test/?room=ABCDE")).toBe("");
  });

  it("keeps invite auto-join for direct room links", () => {
    expect(getMenuInitialRoomCode({}, "https://game.example.test/?room=ABCDE")).toBe("ABCDE");
  });
});
