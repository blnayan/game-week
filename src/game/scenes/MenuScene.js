import Phaser from "phaser";
import { DEFAULT_STAGE_ID } from "../../../shared/stages.js";
import { updateRoomCodeEntry } from "../input/roomCodeEntry.js";
import { loadProgression, selectPlayerPalette } from "../progression/progressionStore.js";
import { getMenuButtonLayout, getStageChoiceLayout, isPointInRect } from "./menuLayout.js";
import { getMenuInitialRoomCode, getMenuNoticeText } from "./menuNotice.js";
import { getMenuStageOptions, resolveMenuStageSelection } from "./stageSelection.js";

const WIDTH = 1280;
const HEIGHT = 720;
const NOTICE_WIDTH = 386;
const NOTICE_HEIGHT = 52;
const NOTICE_MARGIN = 26;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(data = {}) {
    this.progress = loadProgression();
    this.playerPalette = selectPlayerPalette(this.progress);
    this.selectedStageId = DEFAULT_STAGE_ID;
    const initialRoomCode = getMenuInitialRoomCode(data);
    if (initialRoomCode) {
      this.scene.start("MatchScene", { mode: "online-join", roomCode: initialRoomCode });
      return;
    }

    this.joinCode = "";
    this.joinMode = false;
    this.add.image(WIDTH / 2, HEIGHT / 2, "stage:cosmic-floating").setDisplaySize(WIDTH, HEIGHT);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06111f, 0.52);

    this.add.text(72, 62, "Pixel Arena Fighter", {
      fontFamily: "monospace",
      fontSize: "54px",
      color: "#ffffff",
      stroke: "#142033",
      strokeThickness: 8
    });

    this.createNotice(getMenuNoticeText(data));

    this.add.text(76, 170, "Select Stage", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f9f5d7",
      stroke: "#07111f",
      strokeThickness: 4
    });

    this.stageChoiceButtons = new Map();
    this.renderStageChoices();

    this.createButton(getMenuButtonLayout("cpu"), () => {
      this.scene.start("MatchScene", {
        mode: "cpu",
        playerPalette: this.playerPalette,
        stageId: this.selectedStageId
      });
    });

    this.createButton(getMenuButtonLayout("createRoom"), () => {
      this.scene.start("MatchScene", {
        mode: "online-create",
        stageId: this.selectedStageId,
        playerLevel: this.progress.level
      });
    });

    this.createButton(getMenuButtonLayout("enterCode"), () => {
      this.startJoinEntry();
    });

    this.joinPrompt = this.add.text(76, 548, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#07111f",
      strokeThickness: 4
    });

    this.add.text(76, 584, `Level ${this.progress.level}  XP ${this.progress.xp}  Palette ${this.playerPalette.toUpperCase()}`, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: this.playerPalette === "violet" ? "#d8b4fe" : "#d7ecff",
      stroke: "#07111f",
      strokeThickness: 4
    });

    this.add.text(76, 620, "A/D move  SPACE jump/double jump  J light  K heavy  S dive attack while airborne", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f9f5d7"
    });

    this.input.keyboard.on("keydown", this.handleJoinKey, this);
    this.input.on("pointerdown", this.handleJoinPointerFallback, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off("keydown", this.handleJoinKey, this);
      this.input.off("pointerdown", this.handleJoinPointerFallback, this);
    });
  }

  createButton(layout, onClick) {
    const container = this.add.container(layout.x, layout.y);
    const background = this.add.rectangle(0, 0, layout.width, layout.height, layout.fill, 0.92).setOrigin(0, 0.5);
    background.setStrokeStyle(2, layout.stroke, layout.strokeAlpha);
    const text = this.add.text(24, 0, layout.label, {
      fontFamily: "monospace",
      fontSize: layout.fontSize,
      color: "#ffffff"
    }).setOrigin(0, 0.5);
    const hitZone = this.add.zone(0, 0, layout.width, layout.height).setOrigin(0, 0.5).setInteractive({
      useHandCursor: true
    });

    container.add([background, text, hitZone]);
    hitZone.on("pointerover", () => background.setFillStyle(layout.hoverFill, 0.96));
    hitZone.on("pointerout", () => background.setFillStyle(layout.fill, 0.92));
    hitZone.on("pointerdown", onClick);
    return container;
  }

  renderStageChoices() {
    const options = getMenuStageOptions(this.progress, this.selectedStageId);

    for (const option of options) {
      const existing = this.stageChoiceButtons.get(option.stageId);
      if (existing) existing.destroy();

      const layout = getStageChoiceLayout(option.stageId);
      const container = this.add.container(layout.x, layout.y);
      const fill = option.selected ? 0x2d6d8f : option.locked ? 0x2a2f3d : 0x10253a;
      const hoverFill = option.selected ? 0x347ea5 : option.locked ? 0x2a2f3d : 0x1a4968;
      const stroke = option.selected ? 0xffd166 : option.locked ? 0x6f7788 : 0x79d7ff;
      const background = this.add.rectangle(0, 0, layout.width, layout.height, fill, option.locked ? 0.72 : 0.94).setOrigin(0, 0.5);
      background.setStrokeStyle(2, stroke, 0.95);
      const text = this.add.text(layout.width / 2, 0, layout.label, {
        fontFamily: "monospace",
        fontSize: layout.fontSize,
        color: option.locked ? "#d8dee9" : "#ffffff",
        align: "center"
      }).setOrigin(0.5);
      const hitZone = this.add.zone(0, 0, layout.width, layout.height).setOrigin(0, 0.5).setInteractive({
        useHandCursor: true
      });

      container.add([background, text, hitZone]);
      hitZone.on("pointerover", () => background.setFillStyle(hoverFill, option.locked ? 0.72 : 0.98));
      hitZone.on("pointerout", () => background.setFillStyle(fill, option.locked ? 0.72 : 0.94));
      hitZone.on("pointerdown", () => this.handleStageChoice(option.stageId));

      this.stageChoiceButtons.set(option.stageId, container);
    }
  }

  createNotice(message) {
    if (!message) return;
    this.noticeContainer?.destroy();

    this.noticeContainer = this.add.container(
      WIDTH - NOTICE_WIDTH / 2 - NOTICE_MARGIN,
      HEIGHT - NOTICE_HEIGHT / 2 - NOTICE_MARGIN
    ).setDepth(20);
    const container = this.noticeContainer;
    const background = this.add.rectangle(0, 0, NOTICE_WIDTH, NOTICE_HEIGHT, 0x07111f, 0.92);
    background.setStrokeStyle(2, 0xffd166, 0.95);
    const text = this.add.text(0, 0, message, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#fff2b8",
      align: "center",
      wordWrap: { width: 336 }
    }).setOrigin(0.5);

    container.add([background, text]);
    this.time.delayedCall(3200, () => {
      if (this.noticeContainer !== container || !container.active) return;
      this.tweens.add({
        targets: container,
        alpha: 0,
        duration: 260,
        onComplete: () => {
          if (this.noticeContainer === container) this.noticeContainer = null;
          container.destroy();
        }
      });
    });
  }

  handleStageChoice(stageId) {
    const { selectedStageId, notice } = resolveMenuStageSelection(stageId, this.progress, this.selectedStageId);
    this.selectedStageId = selectedStageId;
    this.renderStageChoices();
    if (notice) this.createNotice(notice);
  }

  startJoinEntry() {
    this.joinMode = true;
    this.joinCode = "";
    this.updateJoinPrompt();
  }

  handleJoinPointerFallback(pointer) {
    const inGameBounds = isPointInRect(pointer, getMenuButtonLayout("enterCode"));
    const inViewportBounds = pointer.x >= 54 && pointer.x <= 296 && pointer.y >= 286 && pointer.y <= 322;
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
