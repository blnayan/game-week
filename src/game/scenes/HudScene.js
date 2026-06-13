import Phaser from "phaser";

export class HudScene extends Phaser.Scene {
  constructor() {
    super("HudScene");
  }

  create() {
    this.p1Text = this.addHudText(32, 24, "#79d7ff");
    this.p2Text = this.addHudText(938, 24, "#ffb067").setOrigin(0, 0);
    this.centerText = this.addHudText(640, 24, "#ffffff").setOrigin(0.5, 0);
    this.debugText = this.addHudText(32, 668, "#b5ffd9");
  }

  updateHud(snapshot, meta = {}) {
    const p1 = snapshot?.fighters?.p1;
    const p2 = snapshot?.fighters?.p2;
    if (!p1 || !p2) return;

    this.p1Text.setText(`P1 ${Math.round(p1.damage)}%  Stocks ${p1.stocks}`);
    this.p2Text.setText(`P2 ${Math.round(p2.damage)}%  Stocks ${p2.stocks}`);

    const room = meta.roomCode ? `  Room ${meta.roomCode}` : "";
    this.centerText.setText(`${formatMode(meta.mode)}${room}`);

    const fps = Math.round(this.game.loop.actualFps || 0);
    this.debugText.setText(`FPS ${fps}  ${meta.status || snapshot.status}`);
  }

  addHudText(x, y, color) {
    return this.add.text(x, y, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color,
      stroke: "#07111f",
      strokeThickness: 4
    });
  }
}

function formatMode(mode = "cpu") {
  if (mode === "online-create") return "Online: Create";
  if (mode === "online-join") return "Online: Join";
  return "CPU Battle";
}
