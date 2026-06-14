import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Input: {
      Keyboard: {
        JustDown: (key) => Boolean(key.justPressed)
      }
    }
  }
}));

const { createKeyboardInput } = await import("./inputMapper.js");

describe("createKeyboardInput", () => {
  it("maps A and D to held horizontal movement", () => {
    const { keys, readInput } = createReader();
    keys.left.isDown = true;
    keys.right.isDown = true;

    expect(readInput()).toMatchObject({
      left: true,
      right: true
    });
  });

  it("maps fresh SPACE presses to jump without using W", () => {
    const spaceReader = createReader();
    spaceReader.keys.jump.isDown = true;
    spaceReader.keys.jump.justPressed = true;

    expect(spaceReader.readInput().jump).toBe(true);

    const wReader = createReader();
    wReader.keys.removedUp.isDown = true;
    wReader.keys.removedUp.justPressed = true;

    expect(wReader.readInput().jump).toBe(false);
  });

  it("maps J and K to fresh light and heavy presses", () => {
    const { keys, readInput } = createReader();
    keys.light.justPressed = true;
    keys.heavy.justPressed = true;

    expect(readInput()).toMatchObject({
      light: true,
      heavy: true
    });
  });

  it("maps held S to down for airborne dive handling", () => {
    const { keys, readInput } = createReader();
    keys.down.isDown = true;

    expect(readInput()).toMatchObject({
      down: true
    });
  });

  it("does not expose removed up special dodge or shield controls", () => {
    const { keys, readInput } = createReader();
    keys.removedUp.isDown = true;
    keys.removedUp.justPressed = true;
    keys.removedSpecial.justPressed = true;
    keys.removedDodge.justPressed = true;
    keys.removedShield.isDown = true;

    expect(readInput()).toEqual({
      left: false,
      right: false,
      down: false,
      jump: false,
      light: false,
      heavy: false
    });
  });
});

function createReader() {
  const keys = {
    left: key(),
    right: key(),
    down: key(),
    jump: key(),
    light: key(),
    heavy: key(),
    removedUp: key(),
    removedSpecial: key(),
    removedDodge: key(),
    removedShield: key()
  };
  const scene = {
    input: {
      keyboard: {
        addKeys: vi.fn(() => keys)
      }
    }
  };

  return {
    keys,
    readInput: createKeyboardInput(scene)
  };
}

function key() {
  return {
    isDown: false,
    justPressed: false
  };
}
