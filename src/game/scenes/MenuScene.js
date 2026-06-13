import Phaser from "phaser";

const WIDTH = 1280;
const HEIGHT = 720;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    this.add.image(WIDTH / 2, HEIGHT / 2, "stage:city-beach").setDisplaySize(WIDTH, HEIGHT);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06111f, 0.52);

    this.add.text(72, 62, "Pixel Arena Fighter", {
      fontFamily: "monospace",
      fontSize: "54px",
      color: "#ffffff",
      stroke: "#142033",
      strokeThickness: 8
    });

    this.createButton(82, 230, "CPU Battle", () => {
      this.scene.start("MatchScene", { mode: "cpu" });
    });

    this.createButton(82, 304, "Create Online Room", () => {
      this.scene.start("MatchScene", { mode: "online-create" });
    });

    this.createButton(82, 378, "Join Online Room", () => {
      const roomCode = window.prompt("Enter room code")?.trim().toUpperCase() || "";
      this.scene.start("MatchScene", { mode: "online-join", roomCode });
    });

    this.add.text(76, 556, "A/D move  W/SPACE jump  S fast-fall  J light  W+J up  K heavy  L special  SHIFT dodge  I shield", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f9f5d7"
    });
  }

  createButton(x, y, label, onClick) {
    const container = this.add.container(x, y);
    const background = this.add.rectangle(0, 0, 360, 54, 0x10253a, 0.92).setOrigin(0, 0.5);
    background.setStrokeStyle(2, 0x79d7ff, 0.9);
    const text = this.add.text(24, 0, label, {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#ffffff"
    }).setOrigin(0, 0.5);

    container.add([background, text]);
    background.setInteractive({ useHandCursor: true });
    background.on("pointerover", () => background.setFillStyle(0x1a4968, 0.96));
    background.on("pointerout", () => background.setFillStyle(0x10253a, 0.92));
    background.on("pointerdown", onClick);
    return container;
  }
}
