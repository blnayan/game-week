import { describe, expect, it } from "vitest";
import { buildRoomLink, getInitialRoomCode, normalizeUrlRoomCode, shouldClearRoomCodeAfterJoin } from "./roomLinks.js";

describe("room link helpers", () => {
  it("builds a shareable room link with the room code in the query string", () => {
    expect(buildRoomLink("ab234", "https://game.example.test/play?room=old#top")).toBe(
      "https://game.example.test/play?room=AB234#top"
    );
  });

  it("extracts a normalized room code from supported URL parameters", () => {
    expect(getInitialRoomCode("https://game.example.test/?room= ab234 ")).toBe("AB234");
    expect(getInitialRoomCode("https://game.example.test/?code=zz999")).toBe("ZZ999");
  });

  it("ignores invalid room codes from URLs", () => {
    expect(normalizeUrlRoomCode("abc")).toBe("");
    expect(normalizeUrlRoomCode("abcde!")).toBe("");
    expect(getInitialRoomCode("not a url")).toBe("");
  });

  it("clears stale invite URLs after successfully joining from a link", () => {
    expect(shouldClearRoomCodeAfterJoin("online-join")).toBe(true);
    expect(shouldClearRoomCodeAfterJoin("online-create")).toBe(false);
    expect(shouldClearRoomCodeAfterJoin("online-rematch")).toBe(false);
  });
});
