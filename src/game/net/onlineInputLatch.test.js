import { describe, expect, it } from "vitest";
import { createOnlineInputLatch } from "./onlineInputLatch.js";

describe("createOnlineInputLatch", () => {
  it("keeps edge inputs true briefly after release", () => {
    const latch = createOnlineInputLatch(40);

    expect(latch.read({ jump: true }, 8).jump).toBe(true);
    expect(latch.read({ jump: false }, 16).jump).toBe(true);
    expect(latch.read({ jump: false }, 16).jump).toBe(true);
    expect(latch.read({ jump: false }, 1).jump).toBe(false);
  });

  it("keeps held movement and shield live instead of latched", () => {
    const latch = createOnlineInputLatch(40);

    expect(latch.read({ left: true, shield: true, light: true }, 8)).toMatchObject({
      left: true,
      shield: true,
      light: true
    });
    expect(latch.read({ left: false, shield: false, light: false }, 8)).toMatchObject({
      left: false,
      shield: false,
      light: true
    });
  });
});
