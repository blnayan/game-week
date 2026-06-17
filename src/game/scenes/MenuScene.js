import Phaser from "phaser";
import { DEFAULT_STAGE_ID } from "../../../shared/stages.js";
import { updateRoomCodeEntry } from "../input/roomCodeEntry.js";
import { loadProgression, selectPlayerPalette } from "../progression/progressionStore.js";
import {
  getMenuButtonLayout,
  getStageMenuCloseButtonLayout,
  getStageMenuOverlayLayout,
  getStageMenuPanelLayout,
  getStageMenuTextLayout,
  getStagePreviewCardLayout,
  getStageSelectorButtonLayout,
  getStageSelectorTextLayout,
  isPointInRect
} from "./menuLayout.js";
import { getMenuInitialRoomCode, getMenuNoticeText } from "./menuNotice.js";
import {
  getMenuStageOptions,
  getStagePreviewCardViewModel,
  getStageSelectorButtonViewModel,
  resolveMenuStageSelection
} from "./stageSelection.js";

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

    this.stageMenuContainer = null;
    this.createStageSelectorButton();

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
      this.closeStageMenu();
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

  createStageSelectorButton() {
    const layout = getStageSelectorButtonLayout();
    const textLayout = getStageSelectorTextLayout();
    const view = getStageSelectorButtonViewModel(this.selectedStageId);
    const container = this.add.container(layout.x, layout.y);
    const background = this.add.rectangle(0, 0, layout.width, layout.height, view.fill, 0.92).setOrigin(0, 0.5);
    background.setStrokeStyle(2, view.stroke, layout.strokeAlpha);
    const label = this.add.text(textLayout.x, textLayout.labelY, layout.label, {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f9f5d7"
    }).setOrigin(0, 0);
    const selectedStageText = this.add.text(textLayout.x, textLayout.valueY, view.label, {
      fontFamily: "monospace",
      fontSize: layout.fontSize,
      color: view.textColor
    }).setOrigin(0, 0);
    const hitZone = this.add.zone(0, 0, layout.width, layout.height).setOrigin(0, 0.5).setInteractive({
      useHandCursor: true
    });

    container.add([background, label, selectedStageText, hitZone]);
    hitZone.on("pointerover", () => background.setFillStyle(view.hoverFill, 0.96));
    hitZone.on("pointerout", () => background.setFillStyle(view.fill, 0.92));
    hitZone.on("pointerdown", () => this.openStageMenu());
    this.stageSelectorText = selectedStageText;
    this.stageSelectorBackground = background;
    this.stageSelectorLayout = layout;
    return container;
  }

  updateStageSelectorButton() {
    const view = getStageSelectorButtonViewModel(this.selectedStageId);
    this.stageSelectorText?.setText(view.label);
    this.stageSelectorBackground?.setFillStyle(view.fill, 0.92);
    this.stageSelectorBackground?.setStrokeStyle(2, view.stroke, this.stageSelectorLayout?.strokeAlpha ?? 0.95);
  }

  openStageMenu() {
    if (this.stageMenuContainer) return;
    this.joinMode = false;
    this.updateJoinPrompt();

    const panel = getStageMenuPanelLayout();
    const overlayLayout = getStageMenuOverlayLayout(WIDTH, HEIGHT);
    const overlay = this.add.rectangle(overlayLayout.x, overlayLayout.y, overlayLayout.width, overlayLayout.height, 0x020712, 0.72).setInteractive();
    const container = this.add.container(panel.x, panel.y).setDepth(30);
    const background = this.add.rectangle(0, 0, panel.width, panel.height, 0x08111f, 0.97);
    background.setStrokeStyle(3, 0x6cc8ff, 0.94);
    const textLayout = getStageMenuTextLayout();
    const header = this.add.text(textLayout.x, textLayout.titleY, "Select Stage", {
      fontFamily: "monospace",
      fontSize: "34px",
      color: "#ffffff",
      stroke: "#07111f",
      strokeThickness: 5
    }).setOrigin(0, 0);
    const subtitle = this.add.text(textLayout.x, textLayout.subtitleY, "Invite links can join locked stages; creating rooms requires unlocks.", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#b9d7ea",
      wordWrap: { width: textLayout.subtitleWidth }
    }).setOrigin(0, 0);
    const closeButton = this.createStageMenuCloseButton(panel);

    container.add([overlay, background, header, subtitle, closeButton]);

    const options = getMenuStageOptions(this.progress, this.selectedStageId);

    for (let index = 0; index < options.length; index += 1) {
      container.add(this.createStagePreviewCard(options[index], index));
    }

    overlay.on("pointerdown", () => this.closeStageMenu());
    this.stageMenuContainer = container;
  }

  createStageMenuCloseButton(panel) {
    const layout = getStageMenuCloseButtonLayout();
    const group = this.add.container(layout.x, layout.y);
    const background = this.add.rectangle(0, 0, layout.width, layout.height, 0x132236, 0.94);
    background.setStrokeStyle(2, 0x8aa3bd, 0.92);
    const text = this.add.text(0, 0, "Back", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ffffff"
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, layout.width, layout.height).setInteractive({ useHandCursor: true });

    group.add([background, text, hitZone]);
    hitZone.on("pointerover", () => background.setFillStyle(0x1f3a57, 0.98));
    hitZone.on("pointerout", () => background.setFillStyle(0x132236, 0.94));
    hitZone.on("pointerdown", () => this.closeStageMenu());
    return group;
  }

  createStagePreviewCard(option, index) {
    const layout = getStagePreviewCardLayout(index);
    const view = getStagePreviewCardViewModel(option);
    const group = this.add.container(layout.x, layout.y);
    const background = this.add.rectangle(0, 0, layout.width, layout.height, view.fill, view.fillAlpha).setOrigin(0, 0);
    background.setStrokeStyle(3, view.stroke, 0.96);
    const preview = this.add.image(layout.width / 2, layout.previewHeight / 2, view.imageKey).setDisplaySize(layout.width, layout.previewHeight);
    const previewShade = this.add.rectangle(0, 0, layout.width, layout.previewHeight, 0x000000, option.locked ? 0.42 : 0.08).setOrigin(0, 0);
    const title = this.add.text(18, layout.previewHeight + 28, view.title, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: view.textColor,
      wordWrap: { width: layout.width - 36 }
    }).setOrigin(0, 0.5);
    const badge = view.badgeLabel
      ? this.createStageCardBadge(layout.width - 92, 18, view.badgeLabel, option.selected)
      : null;
    const hitZone = this.add.zone(0, 0, layout.width, layout.height).setOrigin(0, 0).setInteractive({
      useHandCursor: true
    });

    group.add([background, preview, previewShade, title]);
    if (badge) group.add(badge);
    group.add(hitZone);

    hitZone.on("pointerover", () => background.setFillStyle(view.hoverFill, view.hoverAlpha));
    hitZone.on("pointerout", () => background.setFillStyle(view.fill, view.fillAlpha));
    hitZone.on("pointerdown", () => this.handleStageChoice(option.stageId));
    return group;
  }

  createStageCardBadge(x, y, label, selected) {
    const group = this.add.container(x, y);
    const background = this.add.rectangle(0, 0, 124, 34, selected ? 0xffd166 : 0x202838, 0.96);
    background.setStrokeStyle(2, selected ? 0xffffff : 0x8a93a4, 0.9);
    const text = this.add.text(0, 0, label, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: selected ? "#07111f" : "#e5e7eb"
    }).setOrigin(0.5);
    group.add([background, text]);
    return group;
  }

  closeStageMenu() {
    this.stageMenuContainer?.destroy();
    this.stageMenuContainer = null;
  }

  createNotice(message) {
    if (!message) return;
    this.noticeContainer?.destroy();

    this.noticeContainer = this.add.container(
      WIDTH - NOTICE_WIDTH / 2 - NOTICE_MARGIN,
      HEIGHT - NOTICE_HEIGHT / 2 - NOTICE_MARGIN
    ).setDepth(50);
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
    this.updateStageSelectorButton();
    if (!notice) this.closeStageMenu();
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
