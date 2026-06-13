import Phaser from "phaser";
import { updateRoomCodeEntry } from "../input/roomCodeEntry.js";

const WIDTH = 1280;
const HEIGHT = 720;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    this.joinCode = "";
    this.joinMode = false;
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

    this.createButton(82, 378, "Join Online Room (R)", () => {
      this.startJoinEntry();
    });

    this.joinPrompt = this.add.text(76, 492, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#07111f",
      strokeThickness: 4
    });

    this.add.text(76, 556, "A/D move  W/SPACE jump  S fast-fall  J light  W+J up  K heavy  L special  SHIFT dodge  I shield", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f9f5d7"
    });

    this.input.keyboard.on("keydown", this.handleJoinKey, this);
    this.input.on("pointerdown", this.handleJoinPointerFallback, this);
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
    const hitArea = new Phaser.Geom.Rectangle(0, -27, 360, 54);
    container.setSize(360, 54).setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    background.setInteractive({ useHandCursor: true });
    text.setInteractive({ useHandCursor: true });
    for (const target of [container, background, text]) {
      target.on("pointerover", () => background.setFillStyle(0x1a4968, 0.96));
      target.on("pointerout", () => background.setFillStyle(0x10253a, 0.92));
      target.on("pointerdown", onClick);
    }
    return container;
  }

  startJoinEntry() {
    this.joinMode = true;
    this.joinCode = "";
    this.updateJoinPrompt();
  }

  handleJoinPointerFallback(pointer) {
    const inGameBounds = pointer.x >= 82 && pointer.x <= 442 && pointer.y >= 351 && pointer.y <= 405;
    const inViewportBounds = pointer.x >= 54 && pointer.x <= 296 && pointer.y >= 234 && pointer.y <= 270;
    if (inGameBounds || inViewportBounds) {
      this.startJoinEntry();
    }
  }

  handleJoinKey(event) {
    if (!this.joinMode) {
      if (event.key.toUpperCase() === "R") this.startJoinEntry();
      return;
    }

    if (event.key === "Escape") {
      this.joinMode = false;
      this.joinCode = "";
      this.updateJoinPrompt();
      return;
    }

    if (event.key === "Enter") {
      if (this.joinCode.length > 0) {
        this.scene.start("MatchScene", { mode: "online-join", roomCode: this.joinCode });
      }
      return;
    }

    this.joinCode = updateRoomCodeEntry(this.joinCode, event.key);
    this.updateJoinPrompt();
  }

  updateJoinPrompt() {
    if (!this.joinMode) {
      this.joinPrompt.setText("");
      return;
    }

    this.joinPrompt.setText(`Room code: ${this.joinCode.padEnd(5, "_")}  Enter to join  Esc to cancel`);
  }
}
