import Phaser from "phaser";
import { chooseCpuInput } from "../../../shared/cpu.js";
import { createMatch, forfeitMatch, queueInput, stepMatch } from "../../../shared/match.js";
import { createKeyboardInput } from "../input/inputMapper.js";
import { createOnlineInputLatch } from "@game/net/onlineInputLatch.js";
import { buildRoomLink, clearRoomCodeFromUrl, shouldClearRoomCodeAfterJoin } from "@game/net/roomLinks.js";
import { createSocketClient } from "@game/net/socketClient.js";
import { getOnlineOverlayState, shouldUnlockOnlineRoundFromSnapshot } from "./matchOverlayState.js";
import { animationKey } from "../render/animationMap.js";
import { FIGHTER_FRAME_BASELINE, FIGHTER_FRAME_HEIGHT } from "../render/assetManifest.js";
import { EFFECT_RENDER_SCALE, FIGHTER_RENDER_SCALE } from "../render/renderScale.js";

const WIDTH = 1280;
const HEIGHT = 720;
const OVERLAY_PANEL_WIDTH = 560;
const OVERLAY_PANEL_HEIGHT = 340;
const OVERLAY_TEXT_WIDTH = 440;

export class MatchScene extends Phaser.Scene {
  constructor() {
    super("MatchScene");
  }

  create(data = {}) {
    this.mode = data.mode || "cpu";
    this.roomCode = data.roomCode || "";
    this.playerPalette = data.playerPalette;
    this.match = createMatch(this.mode);
    if (this.mode === "cpu" && data.playerPalette) {
      this.match.fighters.p1.palette = data.playerPalette;
    }
    this.readPlayerInput = createKeyboardInput(this);
    this.onlineInputLatch = createOnlineInputLatch();
    this.effectSprites = [];
    this.resultStarted = false;
    this.preserveNetOnShutdown = false;
    this.shareLink = "";
    this.roomPlayers = this.mode === "cpu" ? 0 : 1;
    this.localPaused = false;
    this.roundActive = this.mode === "cpu";
    this.overlayLocked = false;

    this.add.image(WIDTH / 2, HEIGHT / 2, "stage:cosmic-floating").setDisplaySize(WIDTH, HEIGHT);

    this.fighterSprites = {
      p1: this.createFighterSprite(this.match.fighters.p1),
      p2: this.createFighterSprite(this.match.fighters.p2)
    };

    this.scene.launch("HudScene");
    this.hud = this.scene.get("HudScene");
    this.createPauseOverlay();
    this.input.keyboard.on("keydown-ESC", this.handleEscapeMenu, this);
    if (this.mode !== "cpu") {
      this.setupOnline(data);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off("keydown-ESC", this.handleEscapeMenu, this);
      this.unsubscribeSnapshot?.();
      this.unsubscribeStatus?.();
      if (!this.preserveNetOnShutdown) this.net?.disconnect();
      this.scene.stop("HudScene");
    });
  }

  update(_time, delta) {
    if (!this.match || this.resultStarted) return;
    if (this.localPaused) return;

    const input = this.readPlayerInput();

    if (this.mode !== "cpu") {
      if (this.roomCode && this.net && this.roundActive) {
        this.net.sendInput(this.roomCode, this.onlineInputLatch.read(input, Math.min(delta, 50)));
      }
      return;
    }

    queueInput(this.match, "p1", input);
    queueInput(this.match, "p2", chooseCpuInput(this.match, "p2", "normal"));
    stepMatch(this.match, Math.min(delta, 50));

    this.renderFighters();
    this.renderEffects();
    this.hud?.updateHud(this.match, { mode: this.mode, roomCode: this.roomCode });

    if (this.match.status === "complete") {
      this.resultStarted = true;
      this.time.delayedCall(900, () => {
        this.startResults(this.match, { xp: 100 });
      });
    }
  }

  async setupOnline(data) {
    if (data.net) {
      this.net = data.net;
      this.roomCode = data.roomCode;
      this.playerId = data.playerId;
      this.roomPlayers = data.roomPlayers || 2;
      this.updateOnlineControls(`You are ${this.playerId}`);
      this.showPauseOverlay("Get Ready", "Starting rematch...", { canResume: false });
      this.subscribeToOnlineMatch();
      return;
    }

    this.net = createSocketClient();
    this.updateOnlineControls(this.mode === "online-create" ? "Creating online room..." : `Joining room ${data.roomCode}...`);
    this.showPauseOverlay(this.mode === "online-create" ? "Creating Room" : "Joining Room", "Preparing online match...", {
      canResume: false
    });
    let response;

    try {
      response = this.mode === "online-create" ? await this.net.createRoom() : await this.net.joinRoom(data.roomCode);
    } catch (error) {
      response = { ok: false, error: error?.message };
    }

    if (!response?.ok) {
      const notice = response?.error || "Unable to join online room";
      clearRoomCodeFromUrl();
      this.net?.disconnect();
      this.scene.start("MenuScene", { notice });
      return;
    }

    this.roomCode = response.roomCode;
    this.playerId = response.playerId;
    this.roomPlayers = 1;
    if (shouldClearRoomCodeAfterJoin(this.mode)) clearRoomCodeFromUrl();
    this.updateOnlineControls(`You are ${this.playerId}`);
    this.showPauseOverlay("Waiting for opponent", "Share the invite link so another player can join.", {
      canResume: false,
      canCopyInvite: true
    });
    if (this.mode === "online-create") this.copyRoomLink();
    this.subscribeToOnlineMatch();
  }

  subscribeToOnlineMatch() {
    this.unsubscribeStatus = this.net.onStatus((status) => {
      if (Number.isFinite(status?.players)) this.roomPlayers = status.players;
      this.updateOnlineControls(status.message);
      this.handleOnlineStatus(status);
      this.hud?.updateHud(this.match, { mode: this.mode, roomCode: this.roomCode, status: status.message });
    }, { replayLatest: false });
    this.unsubscribeSnapshot = this.net.onSnapshot((snapshot) => {
      this.match = snapshot;
      this.renderFighters();
      this.renderEffects();
      if (shouldUnlockOnlineRoundFromSnapshot(snapshot, { localPaused: this.localPaused })) {
        this.roundActive = true;
        this.hidePauseOverlay();
      }
      this.hud?.updateHud(this.match, { mode: this.mode, roomCode: this.roomCode, status: `You are ${this.playerId}` });

      if (snapshot.status === "complete" && !this.resultStarted) {
        this.resultStarted = true;
        this.startResults(snapshot, { xp: 120 });
      }
    });
  }

  createPauseOverlay() {
    this.pauseOverlay = this.add.container(0, 0).setDepth(80).setVisible(false);
    const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x02050a, 0.58);
    const panel = this.add.rectangle(WIDTH / 2, HEIGHT / 2, OVERLAY_PANEL_WIDTH, OVERLAY_PANEL_HEIGHT, 0x10253a, 0.96);
    panel.setStrokeStyle(3, 0x79d7ff, 0.92);

    this.pauseTitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 86, "Paused", {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#ffffff",
      stroke: "#07111f",
      strokeThickness: 6,
      align: "center",
      wordWrap: { width: OVERLAY_TEXT_WIDTH }
    }).setOrigin(0.5);

    this.pauseMessage = this.add.text(WIDTH / 2, HEIGHT / 2 - 28, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#d7ecff",
      align: "center",
      wordWrap: { width: OVERLAY_TEXT_WIDTH }
    }).setOrigin(0.5);

    this.resumeButton = this.createModalButton(WIDTH / 2, HEIGHT / 2 + 38, "Resume", () => {
      this.resumeFromOverlay();
    });
    this.centerForfeitButton = this.createModalButton(WIDTH / 2, HEIGHT / 2 + 104, "Forfeit", () => {
      this.handleForfeit();
    });
    this.copyInviteButton = this.createModalButton(WIDTH / 2, HEIGHT / 2 + 76, "Copy Invite", () => {
      this.copyRoomLink();
    });
    this.exitRoomButton = this.createModalButton(WIDTH / 2, HEIGHT / 2 + 138, "Exit Room", () => {
      this.exitWaitingRoom();
    });

    this.pauseOverlay.add([
      dim,
      panel,
      this.pauseTitle,
      this.pauseMessage,
      this.resumeButton,
      this.centerForfeitButton,
      this.copyInviteButton,
      this.exitRoomButton
    ]);
  }

  createModalButton(x, y, label, onClick) {
    const container = this.add.container(x, y);
    const background = this.add.rectangle(0, 0, 260, 52, 0x173754, 0.98).setOrigin(0.5);
    background.setStrokeStyle(2, 0x79d7ff, 0.95);
    const text = this.add.text(0, 0, label, {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#ffffff"
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 260, 52).setOrigin(0.5).setInteractive({ useHandCursor: true });

    container.add([background, text, hitZone]);
    hitZone.on("pointerover", () => background.setFillStyle(0x215a7c, 0.98));
    hitZone.on("pointerout", () => background.setFillStyle(0x173754, 0.98));
    hitZone.on("pointerdown", onClick);
    return container;
  }

  updateOnlineControls(status = "") {
    if (this.mode === "cpu") return;

    this.shareLink = this.roomCode ? buildRoomLink(this.roomCode) : "";
  }

  copyRoomLink({ silent = false } = {}) {
    if (!this.shareLink) {
      this.updateOnlineControls("Room link not ready yet");
      return;
    }

    copyTextToClipboard(this.shareLink)
      .then(() => {
        this.updateOnlineControls("Invite link copied");
        if (this.pauseOverlay?.visible && this.overlayLocked) {
          this.pauseMessage.setText("Invite link copied. Waiting for opponent...");
        }
      })
      .catch(() => {
        if (!silent) this.updateOnlineControls("Copy failed; use the invite link");
      });
  }

  handleOnlineStatus(status) {
    const message = status?.message || "";

    if (message === "Fight") {
      this.roundActive = true;
      this.hidePauseOverlay();
      return;
    }

    const overlay = getOnlineOverlayState(status, Boolean(this.shareLink));
    if (overlay) {
      this.roundActive = false;
      this.showPauseOverlay(overlay.title, overlay.message, overlay);
    }
  }

  handleEscapeMenu() {
    if (this.resultStarted || this.overlayLocked) return;

    if (this.localPaused) {
      this.resumeFromOverlay();
      return;
    }

    this.localPaused = true;
    this.roundActive = false;
    this.showPauseOverlay("Paused", "Resume the match or forfeit.", { canResume: true });
    if (this.mode !== "cpu" && this.roomCode && this.playerId) {
      this.net?.setPaused(this.roomCode, true);
    }
  }

  showPauseOverlay(title, message, { canResume, canCopyInvite = false, canExitRoom = false }) {
    this.overlayLocked = !canResume;
    this.pauseTitle.setText(title);
    this.pauseMessage.setText(message);
    this.resumeButton.setVisible(canResume);
    this.centerForfeitButton.setVisible(canResume);
    this.copyInviteButton.setVisible(canCopyInvite);
    this.exitRoomButton.setVisible(canCopyInvite || canExitRoom);
    this.pauseTitle.setPosition(WIDTH / 2, canResume ? HEIGHT / 2 - 86 : canCopyInvite ? HEIGHT / 2 - 112 : HEIGHT / 2 - 34);
    this.pauseMessage.setPosition(WIDTH / 2, canResume ? HEIGHT / 2 - 28 : canCopyInvite ? HEIGHT / 2 - 56 : HEIGHT / 2 + 22);
    this.centerForfeitButton.setPosition(WIDTH / 2, canResume ? HEIGHT / 2 + 104 : HEIGHT / 2 + 70);
    this.copyInviteButton.setPosition(WIDTH / 2, HEIGHT / 2 + 36);
    this.exitRoomButton.setPosition(WIDTH / 2, canCopyInvite ? HEIGHT / 2 + 98 : HEIGHT / 2 + 84);
    this.pauseOverlay.setVisible(true);
  }

  hidePauseOverlay() {
    this.overlayLocked = false;
    this.localPaused = false;
    this.pauseOverlay.setVisible(false);
  }

  resumeFromOverlay() {
    if (this.overlayLocked) return;

    this.hidePauseOverlay();
    this.roundActive = true;
    if (this.mode !== "cpu" && this.roomCode && this.playerId) {
      this.net?.setPaused(this.roomCode, false);
    }
  }

  handleForfeit() {
    if (this.resultStarted) return;

    if (this.mode === "cpu") {
      forfeitMatch(this.match, "p1");
      this.renderFighters();
      this.startResults(this.match, { xp: 0 });
      return;
    }

    if (!this.roomCode || !this.playerId) {
      clearRoomCodeFromUrl();
      this.scene.start("MenuScene");
      return;
    }

    this.updateOnlineControls("Forfeiting...");
    this.showPauseOverlay("Forfeiting", "Ending the match...", { canResume: false });
    this.net?.leaveRoom(this.roomCode);
  }

  exitWaitingRoom() {
    this.net?.disconnect();
    clearRoomCodeFromUrl();
    this.scene.start("MenuScene");
  }

  startResults(snapshot, { xp }) {
    const isOnline = this.mode !== "cpu";
    this.preserveNetOnShutdown = isOnline;
    this.scene.stop("HudScene");
    this.scene.start("ResultsScene", {
      winnerId: snapshot.winnerId,
      snapshot,
      xp,
      mode: this.mode,
      playerPalette: this.playerPalette,
      roomCode: this.roomCode,
      playerId: this.playerId,
      shareLink: this.shareLink,
      roomPlayers: this.roomPlayers,
      net: isOnline ? this.net : null
    });
  }

  createFighterSprite(fighter) {
    const sprite = this.add.sprite(fighter.x, fighter.y, `fighter:${fighter.palette}`, 0);
    sprite.setOrigin(0.5, FIGHTER_FRAME_BASELINE / FIGHTER_FRAME_HEIGHT);
    sprite.setScale(FIGHTER_RENDER_SCALE);
    sprite.play(animationKey(fighter));
    return sprite;
  }

  renderFighters() {
    for (const fighterId of ["p1", "p2"]) {
      const fighter = this.match.fighters[fighterId];
      const sprite = this.fighterSprites[fighterId];
      sprite.setPosition(fighter.x, fighter.y);
      sprite.setFlipX(fighter.facing < 0);
      sprite.setAlpha(fighter.invulnerableMs > 0 && Math.floor(fighter.invulnerableMs / 120) % 2 === 0 ? 0.45 : 1);

      const key = animationKey(fighter);
      if (sprite.anims.currentAnim?.key !== key) {
        sprite.play(key, true);
      }
    }
  }

  renderEffects() {
    for (const effect of this.match.effects) {
      const sprite = this.add.sprite(effect.x, effect.y, "effects", 0);
      sprite.setScale(EFFECT_RENDER_SCALE);
      sprite.play(`effect:${effect.type}`);
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
      this.effectSprites.push(sprite);
    }

    this.effectSprites = this.effectSprites.filter((sprite) => sprite.active);
  }
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the legacy copy command below.
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-10000px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command rejected");
    }
  } finally {
    document.body.removeChild(textArea);
  }
}
