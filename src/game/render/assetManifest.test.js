import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FIGHTER_FRAME_BASELINE,
  FIGHTER_FRAME_HEIGHT,
  FIGHTER_FRAME_WIDTH,
  FIGHTER_SHEETS,
  loadGameAssets
} from "./assetManifest.js";

function readPngSize(path) {
  const png = readFileSync(path);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}

describe("asset manifest", () => {
  it("loads the cosmic floating arena background", () => {
    const images = new Map();
    const scene = {
      load: {
        image: (key, path) => images.set(key, path),
        spritesheet: () => {}
      }
    };

    loadGameAssets(scene);

    expect(images.get("stage:cosmic-floating")).toBe("/assets/stage/cosmic-floating-arena.png");
  });

  it("loads fighters with wide enough cells for attack animations", () => {
    const spritesheets = new Map();
    const scene = {
      load: {
        image: () => {},
        spritesheet: (key, path, options) => spritesheets.set(key, { path, options })
      }
    };

    loadGameAssets(scene);

    for (const name of FIGHTER_SHEETS) {
      const sheet = spritesheets.get(`fighter:${name}`);
      expect(sheet.options).toMatchObject({
        frameWidth: 128,
        frameHeight: 128
      });
      expect(readPngSize(`public${sheet.path}`).width).toBe(FIGHTER_FRAME_WIDTH * 12);
      expect(readPngSize(`public${sheet.path}`).height).toBe(FIGHTER_FRAME_HEIGHT);
    }
  });

  it("uses an internal baseline for the 128px fighter frames", () => {
    expect(FIGHTER_FRAME_BASELINE).toBe(108);
    expect(FIGHTER_FRAME_BASELINE).toBeLessThan(FIGHTER_FRAME_HEIGHT);
  });
});
