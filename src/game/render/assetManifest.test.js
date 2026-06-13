import { describe, expect, it } from "vitest";
import { loadGameAssets } from "./assetManifest.js";

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
});
