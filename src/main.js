import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./game/scenes/BootScene.js";
import { HudScene } from "./game/scenes/HudScene.js";
import { MatchScene } from "./game/scenes/MatchScene.js";
import { MenuScene } from "./game/scenes/MenuScene.js";
import { ResultsScene } from "./game/scenes/ResultsScene.js";

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
  scene: [BootScene, MenuScene, MatchScene, HudScene, ResultsScene]
});
