import Phaser from "phaser";
import "./styles.css";

class SmokeScene extends Phaser.Scene {
  constructor() {
    super("smoke");
  }

  create() {
    this.cameras.main.setBackgroundColor("#101820");
    this.add
      .text(40, 40, "Pixel Arena Fighter", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#f8f8f2"
      })
      .setScrollFactor(0);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  pixelArt: true,
  backgroundColor: "#101820",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [SmokeScene]
});
