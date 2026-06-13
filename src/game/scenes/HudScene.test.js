import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Scene: class {}
  }
}));

const { HudScene } = await import("./HudScene.js");

describe("HudScene", () => {
  it("shows room status messages when provided", () => {
    const scene = new HudScene();
    scene.game = { loop: { actualFps: 59.6 } };
    scene.p1Text = textSpy();
    scene.p2Text = textSpy();
    scene.centerText = textSpy();
    scene.debugText = textSpy();

    scene.updateHud(
      {
        status: "playing",
        fighters: {
          p1: { damage: 12, stocks: 3 },
          p2: { damage: 44, stocks: 2 }
        }
      },
      { mode: "online-create", roomCode: "AB123", status: "p2 disconnected" }
    );

    expect(scene.debugText.setText).toHaveBeenCalledWith("FPS 60  p2 disconnected");
  });
});

function textSpy() {
  return {
    setText: vi.fn()
  };
}
