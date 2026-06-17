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
    scene.pingText = textSpy();

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
    expect(scene.pingText.setText).toHaveBeenCalledWith("Ping N/A");
  });

  it("shows rounded ping in the bottom-right corner when available", () => {
    const scene = new HudScene();
    scene.game = { loop: { actualFps: 59.6 } };
    scene.p1Text = textSpy();
    scene.p2Text = textSpy();
    scene.centerText = textSpy();
    scene.debugText = textSpy();
    scene.pingText = textSpy();

    scene.updateHud(
      {
        status: "playing",
        fighters: {
          p1: { damage: 0, stocks: 3 },
          p2: { damage: 0, stocks: 3 }
        }
      },
      { mode: "online-create", pingMs: 42.4 }
    );

    expect(scene.pingText.setText).toHaveBeenCalledWith("Ping 42ms");
  });

  it("shows sub-millisecond measured ping without rounding it to zero", () => {
    const scene = new HudScene();
    scene.game = { loop: { actualFps: 59.6 } };
    scene.p1Text = textSpy();
    scene.p2Text = textSpy();
    scene.centerText = textSpy();
    scene.debugText = textSpy();
    scene.pingText = textSpy();

    scene.updateHud(
      {
        status: "playing",
        fighters: {
          p1: { damage: 0, stocks: 3 },
          p2: { damage: 0, stocks: 3 }
        }
      },
      { mode: "online-create", pingMs: 0.4 }
    );

    expect(scene.pingText.setText).toHaveBeenCalledWith("Ping <1ms");
  });

  it("shows local CPU ping as zero", () => {
    const scene = new HudScene();
    scene.game = { loop: { actualFps: 59.6 } };
    scene.p1Text = textSpy();
    scene.p2Text = textSpy();
    scene.centerText = textSpy();
    scene.debugText = textSpy();
    scene.pingText = textSpy();

    scene.updateHud(
      {
        status: "playing",
        fighters: {
          p1: { damage: 0, stocks: 3 },
          p2: { damage: 0, stocks: 3 }
        }
      },
      { mode: "cpu", pingMs: 0 }
    );

    expect(scene.pingText.setText).toHaveBeenCalledWith("Ping 0ms");
  });


  it("positions fps and ping in the game-space bottom corners when the display is scaled", () => {
    const scene = new HudScene();
    scene.cameras = { main: { width: 1280, height: 720 } };
    scene.scale = { displaySize: { width: 853, height: 480 } };
    scene.debugText = textSpy();
    scene.pingText = textSpy();

    scene.positionBottomHud();

    expect(scene.debugText.setPosition).toHaveBeenCalledWith(32, 668);
    expect(scene.pingText.setPosition).toHaveBeenCalledWith(1248, 668);
  });
});

function textSpy() {
  return {
    setPosition: vi.fn(),
    setText: vi.fn()
  };
}
