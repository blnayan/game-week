import Phaser from "phaser";

const WIDTH = 1280;
const HEIGHT = 720;

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(data = {}) {
    this.add.image(WIDTH / 2, HEIGHT / 2, "stage:city-beach").setDisplaySize(WIDTH, HEIGHT);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x05070a, 0.72);

    const winner = data.winnerId === "p2" ? "P2 Wins" : "P1 Wins";
    const p1 = data.snapshot?.fighters?.p1;
    const p2 = data.snapshot?.fighters?.p2;
    const xp = Math.max(25, Math.round((p1?.stats?.damageDealt || 0) + (p1?.stats?.kos || 0) * 50));

    this.add.text(WIDTH / 2, 220, winner, {
      fontFamily: "monospace",
      fontSize: "64px",
      color: "#ffffff",
      stroke: "#142033",
      strokeThickness: 8
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 316, `XP +${xp}`, {
      fontFamily: "monospace",
      fontSize: "30px",
      color: "#f9f5d7"
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 372, `P1 KOs ${p1?.stats?.kos || 0}  Falls ${p1?.stats?.falls || 0}    P2 KOs ${p2?.stats?.kos || 0}  Falls ${p2?.stats?.falls || 0}`, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d7ecff"
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 494, "Click to return to menu", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#79d7ff"
    }).setOrigin(0.5);

    this.input.once("pointerdown", () => {
      this.scene.start("MenuScene");
    });
  }
}
