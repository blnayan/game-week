import Phaser from "phaser";
import { chooseCpuInput } from "../../../shared/cpu.js";
import { createMatch, queueInput, stepMatch } from "../../../shared/match.js";
import { createKeyboardInput } from "../input/inputMapper.js";
import { createOnlineInputLatch } from "@game/net/onlineInputLatch.js";
import { createSocketClient } from "@game/net/socketClient.js";
import { animationKey } from "../render/animationMap.js";
import { EFFECT_RENDER_SCALE, FIGHTER_RENDER_SCALE } from "../render/renderScale.js";

const WIDTH = 1280;
const HEIGHT = 720;

export class MatchScene extends Phaser.Scene {
  constructor() {
    super("MatchScene");
  }

  create(data = {}) {
    this.mode = data.mode || "cpu";
    this.roomCode = data.roomCode || "";
    this.match = createMatch(this.mode);
    if (this.mode === "cpu" && data.playerPalette) {
      this.match.fighters.p1.palette = data.playerPalette;
    }
    this.readPlayerInput = createKeyboardInput(this);
    this.onlineInputLatch = createOnlineInputLatch();
    this.effectSprites = [];
    this.resultStarted = false;

    this.add.image(WIDTH / 2, HEIGHT / 2, "stage:cosmic-floating").setDisplaySize(WIDTH, HEIGHT);

    this.fighterSprites = {
      p1: this.createFighterSprite(this.match.fighters.p1),
      p2: this.createFighterSprite(this.match.fighters.p2)
    };

    this.scene.launch("HudScene");
    this.hud = this.scene.get("HudScene");
    if (this.mode !== "cpu") {
      this.setupOnline(data);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeSnapshot?.();
      this.unsubscribeStatus?.();
      this.net?.disconnect();
      this.scene.stop("HudScene");
    });
  }

  update(_time, delta) {
    if (!this.match || this.resultStarted) return;

    const input = this.readPlayerInput();

    if (this.mode !== "cpu") {
      if (this.roomCode && this.net) {
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
        this.scene.stop("HudScene");
        this.scene.start("ResultsScene", {
          winnerId: this.match.winnerId,
          snapshot: this.match
        });
      });
    }
  }

  async setupOnline(data) {
    this.net = createSocketClient();
    let response;

    try {
      response = this.mode === "online-create" ? await this.net.createRoom() : await this.net.joinRoom(data.roomCode);
    } catch (error) {
      response = { ok: false, error: error?.message };
    }

    if (!response?.ok) {
      window.alert(response?.error || "Unable to join online room");
      this.scene.start("MenuScene");
      return;
    }

    this.roomCode = response.roomCode;
    this.playerId = response.playerId;
    this.unsubscribeStatus = this.net.onStatus((status) => {
      this.hud?.updateHud(this.match, { mode: this.mode, roomCode: this.roomCode, status: status.message });
    });
    this.unsubscribeSnapshot = this.net.onSnapshot((snapshot) => {
      this.match = snapshot;
      this.renderFighters();
      this.renderEffects();
      this.hud?.updateHud(this.match, { mode: this.mode, roomCode: this.roomCode, status: `You are ${this.playerId}` });

      if (snapshot.status === "complete" && !this.resultStarted) {
        this.resultStarted = true;
        this.net.disconnect();
        this.scene.stop("HudScene");
        this.scene.start("ResultsScene", {
          winnerId: snapshot.winnerId,
          snapshot,
          xp: 120
        });
      }
    });
  }

  createFighterSprite(fighter) {
    const sprite = this.add.sprite(fighter.x, fighter.y, `fighter:${fighter.palette}`, 0);
    sprite.setOrigin(0.5, 1);
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
