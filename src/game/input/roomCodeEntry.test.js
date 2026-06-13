import { describe, expect, it } from "vitest";
import { updateRoomCodeEntry } from "./roomCodeEntry.js";

describe("updateRoomCodeEntry", () => {
  it("builds uppercase five-character room codes from keyboard keys", () => {
    expect(updateRoomCodeEntry("", "j")).toBe("J");
    expect(updateRoomCodeEntry("JAP4", "f")).toBe("JAP4F");
    expect(updateRoomCodeEntry("JAP4F", "7")).toBe("JAP4F");
  });

  it("supports backspace and ignores unsupported keys", () => {
    expect(updateRoomCodeEntry("JAP4F", "Backspace")).toBe("JAP4");
    expect(updateRoomCodeEntry("JAP4", "Shift")).toBe("JAP4");
    expect(updateRoomCodeEntry("JAP4", "-")).toBe("JAP4");
  });
});
