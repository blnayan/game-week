import Phaser from "phaser";
import { clearRoomCodeFromUrl } from "@game/net/roomLinks.js";
import { awardMatchXp } from "@game/progression/progressionStore.js";
import {
  canOfferOnlineRematch,
  getOnlineRematchSceneData,
  getResultMenuSceneData,
  getRematchDisplayState,
  getResultStatusText,
  isRematchStartSnapshot,
  shouldHideOnlineRematchOnStatus
} from "./resultsState.js";

const WIDTH = 1280;
const HEIGHT = 720;

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super("ResultsScene");
  }

  create(data = {}) {
    this.add.image(WIDTH / 2, HEIGHT / 2, "stage:cosmic-floating").setDisplaySize(WIDTH, HEIGHT);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x05070a, 0.72);

    const winner = data.winnerId === "p2" ? "P2 Wins" : "P1 Wins";
    const p1 = data.snapshot?.fighters?.p1;
    const p2 = data.snapshot?.fighters?.p2;
    const xp = data.xp ?? 100;
    const progress = awardMatchXp(xp);

    this.add.text(WIDTH / 2, 220, winner, {
      fontFamily: "monospace",
      fontSize: "64px",
      color: "#ffffff",
      stroke: "#142033",
      strokeThickness: 8
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 316, `XP gained ${xp}`, {
      fontFamily: "monospace",
      fontSize: "30px",
      color: "#f9f5d7"
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 372, `Level ${progress.level}    Total XP ${progress.xp}`, {
      fontFamily: "monospace",
      fontSize: "26px",
      color: "#d7ecff"
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 426, `P1 KOs ${p1?.stats?.kos || 0}  Falls ${p1?.stats?.falls || 0}    P2 KOs ${p2?.stats?.kos || 0}  Falls ${p2?.stats?.falls || 0}`, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d7ecff"
    }).setOrigin(0.5);

    const isOnline = data.mode !== "cpu" && data.net && data.roomCode;
    const endReason = data.snapshot?.endReason || null;
    const canRematch = canOfferOnlineRematch({ isOnline, endReason, roomPlayers: data.roomPlayers || 0 });
    const statusText = getResultStatusText({ endReason, isOnline, roomCode: data.roomCode });
    this.statusText = this.add.text(WIDTH / 2, 494, statusText, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#d7ecff"
    }).setOrigin(0.5);

    if (canRematch) {
      this.unsubscribeStatus = data.net.onStatus((status) => {
        const displayState = getRematchDisplayState(status, { playerId: data.playerId, roomCode: data.roomCode });
        this.statusText.setText(displayState.statusText);
        this.rematchButton?.setLabel(displayState.buttonLabel);
        if (shouldHideOnlineRematchOnStatus(status)) {
          this.hideOnlineRematch();
        }
      });
      this.unsubscribeSnapshot = data.net.onSnapshot((snapshot) => {
        if (!isRematchStartSnapshot(snapshot)) return;
        this.unsubscribeSnapshot?.();
        this.unsubscribeStatus?.();
        this.scene.start("MatchScene", getOnlineRematchSceneData({
          roomCode: data.roomCode,
          playerId: data.playerId,
          roomPlayers: data.roomPlayers,
          net: data.net
        }));
      });
    }

    if (canRematch || !isOnline) {
      this.rematchRequested = false;
      this.rematchButton = this.createButton(WIDTH / 2 - 160, 560, "Rematch", async () => {
        if (isOnline) {
          if (this.rematchRequested) return;
          this.rematchRequested = true;
          this.statusText.setText("Starting rematch...");
          const response = await data.net.requestRematch(data.roomCode);
          if (!response?.ok) {
            this.rematchRequested = false;
            this.hideOnlineRematch(response?.error === "Opponent left" ? "Opponent left" : "Room disconnected");
          } else if (!response.ready) {
            this.statusText.setText("Waiting for opponent...");
          }
          return;
        }

        this.scene.start("MatchScene", {
          mode: "cpu",
          playerPalette: data.playerPalette || data.snapshot?.fighters?.p1?.palette
        });
      });
    }

    const menuX = canRematch || !isOnline ? WIDTH / 2 + 160 : WIDTH / 2;
    this.leavingForMenu = false;
    this.menuButton = this.createButton(menuX, 560, "Menu", async () => {
      if (this.leavingForMenu) return;
      this.leavingForMenu = true;
      if (isOnline) {
        this.statusText.setText("Leaving room...");
        await data.net?.closeRoom?.(data.roomCode);
      }
      data.net?.disconnect();
      clearRoomCodeFromUrl();
      this.scene.start("MenuScene", getResultMenuSceneData());
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeSnapshot?.();
      this.unsubscribeStatus?.();
    });
  }

  createButton(x, y, label, onClick) {
    const container = this.add.container(x, y);
    const background = this.add.rectangle(0, 0, 220, 54, 0x10253a, 0.94).setOrigin(0.5);
    background.setStrokeStyle(2, 0x79d7ff, 0.9);
    const text = this.add.text(0, 0, label, {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#ffffff"
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 220, 54).setOrigin(0.5).setInteractive({ useHandCursor: true });

    container.add([background, text, hitZone]);
    hitZone.on("pointerover", () => background.setFillStyle(0x1a4968, 0.98));
    hitZone.on("pointerout", () => background.setFillStyle(0x10253a, 0.94));
    hitZone.on("pointerdown", onClick);
    container.setLabel = (nextLabel) => {
      text.setText(nextLabel);
    };
    return container;
  }

  hideOnlineRematch(message = "Room disconnected") {
    this.rematchButton?.setVisible(false);
    this.menuButton?.setPosition(WIDTH / 2, 560);
    this.statusText?.setText(message);
    this.unsubscribeSnapshot?.();
    this.unsubscribeStatus?.();
    this.unsubscribeSnapshot = null;
    this.unsubscribeStatus = null;
  }
}
