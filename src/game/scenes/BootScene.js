import Phaser from "phaser";
import { createGameAnimations, loadGameAssets } from "../render/assetManifest.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    loadGameAssets(this);
  }

  create() {
    createGameAnimations(this);
    this.scene.start("MenuScene");
  }
}
