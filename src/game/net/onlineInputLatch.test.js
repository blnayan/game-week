import { describe, expect, it } from "vitest";
import { createOnlineInputLatch } from "./onlineInputLatch.js";

describe("createOnlineInputLatch", () => {
  it("keeps edge inputs true briefly after release", () => {
    const latch = createOnlineInputLatch();

    expect(latch.read({ jump: true }, 8).jump).toBe(true);
    expect(latch.read({ jump: false }, 60).jump).toBe(true);
    expect(latch.read({ jump: false }, 52).jump).toBe(true);
    expect(latch.read({ jump: false }, 1).jump).toBe(false);
  });

  it("keeps held movement and down live instead of latched", () => {
    const latch = createOnlineInputLatch();

    expect(latch.read({ left: true, down: true, light: true }, 8)).toMatchObject({
      left: true,
      down: true,
      light: true
    });
    expect(latch.read({ left: false, down: false, light: false }, 8)).toMatchObject({
      left: false,
      down: false
    });
  });

  it("does not synthesize removed action fields", () => {
    const latch = createOnlineInputLatch();

    expect(latch.read({ special: true, dodge: true, shield: true, up: true }, 8)).toEqual({
      left: false,
      right: false,
      down: false,
      jump: false,
      light: false,
      heavy: false
    });
  });
});
