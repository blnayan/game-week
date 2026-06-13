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
  it("does not send held W as up attack input", () => {
    const { keys, readInput } = createReader();
    keys.up.isDown = true;

    expect(readInput()).toMatchObject({
      jump: false,
      up: false
    });
  });

  it("maps fresh W or SPACE presses to jump", () => {
    const wReader = createReader();
    wReader.keys.up.isDown = true;
    wReader.keys.up.justPressed = true;

    expect(wReader.readInput().jump).toBe(true);

    const spaceReader = createReader();
    spaceReader.keys.jump.isDown = true;
    spaceReader.keys.jump.justPressed = true;

    expect(spaceReader.readInput().jump).toBe(true);
  });

  it("maps W plus a fresh light press to up attack instead of light", () => {
    const { keys, readInput } = createReader();
    keys.up.isDown = true;
    keys.light.isDown = true;
    keys.light.justPressed = true;

    expect(readInput()).toMatchObject({
      up: true,
      light: false
    });
  });
});

function createReader() {
  const keys = {
    left: key(),
    right: key(),
    up: key(),
    down: key(),
    jump: key(),
    light: key(),
    heavy: key(),
    special: key(),
    dodge: key(),
    shield: key()
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
