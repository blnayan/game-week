import Phaser from "phaser";
import { getMetricOverlayLayout } from "./metricOverlay.js";

export class HudScene extends Phaser.Scene {
  constructor() {
    super("HudScene");
  }

  create() {
    this.p1Text = this.addHudText(32, 24, "#79d7ff");
    this.p2Text = this.addHudText(938, 24, "#ffb067").setOrigin(0, 0);
    this.centerText = this.addHudText(640, 24, "#ffffff").setOrigin(0.5, 0);
    this.debugText = this.addHudText(32, 632, "#b5ffd9");
    this.pingText = this.addHudText(1248, 632, "#b5ffd9").setOrigin(1, 0);
    this.metricOverlay = this.createMetricOverlay();
    if (this.metricOverlay) {
      this.debugText.setVisible(false);
      this.pingText.setVisible(false);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.metricOverlay?.fps.remove();
        this.metricOverlay?.ping.remove();
        this.metricOverlay = null;
      });
    }
  }

  updateHud(snapshot, meta = {}) {
    const p1 = snapshot?.fighters?.p1;
    const p2 = snapshot?.fighters?.p2;
    if (!p1 || !p2) return;

    this.positionBottomHud();

    this.p1Text.setText(`P1 ${Math.round(p1.damage)}%  Stocks ${p1.stocks}`);
    this.p2Text.setText(`P2 ${Math.round(p2.damage)}%  Stocks ${p2.stocks}`);

    const room = meta.roomCode ? `  Room ${meta.roomCode}` : "";
    this.centerText.setText(`${formatMode(meta.mode)}${room}`);

    const fps = Math.round(this.game.loop.actualFps || 0);
    const fpsText = `FPS ${fps}  ${meta.status || snapshot.status}`;
    const pingText = formatPing(meta.pingMs);
    this.debugText.setText(fpsText);
    this.pingText.setText(pingText);
    this.updateMetricOverlay(fpsText, pingText);
  }

  positionBottomHud() {
    const camera = this.cameras?.main;
    const width = Number.isFinite(camera?.width) ? camera.width : 1280;
    const height = Number.isFinite(camera?.height) ? camera.height : 720;
    const y = Math.max(24, height - 52);

    this.debugText?.setPosition?.(32, y);
    this.pingText?.setPosition?.(width - 32, y);
  }

  addHudText(x, y, color) {
    return this.add.text(x, y, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color,
      stroke: "#07111f",
      strokeThickness: 4
    }).setDepth(1000);
  }

  createMetricOverlay() {
    const documentRef = typeof document === "undefined" ? null : document;
    const root = documentRef?.getElementById?.("game-root") ?? documentRef?.body;
    if (!documentRef || !root) return null;

    const fps = documentRef.createElement("div");
    const ping = documentRef.createElement("div");
    for (const element of [fps, ping]) {
      Object.assign(element.style, {
        color: "#b5ffd9",
        fontFamily: "monospace",
        fontWeight: "700",
        pointerEvents: "none",
        position: "fixed",
        textShadow: "-2px 0 #07111f, 0 2px #07111f, 2px 0 #07111f, 0 -2px #07111f",
        zIndex: "20"
      });
    }
    ping.style.textAlign = "right";
    root.append(fps, ping);
    return { fps, ping };
  }

  updateMetricOverlay(fpsText, pingText) {
    if (!this.metricOverlay) return;
    const rect = this.game?.canvas?.getBoundingClientRect?.();
    if (!rect) return;

    const layout = getMetricOverlayLayout({
      canvasRect: rect,
      viewportWidth: typeof window === "undefined" ? rect.right : window.innerWidth,
      viewportHeight: typeof window === "undefined" ? rect.bottom : window.innerHeight
    });
    Object.assign(this.metricOverlay.fps.style, {
      bottom: layout.bottom,
      fontSize: layout.fontSize,
      left: layout.fpsLeft
    });
    Object.assign(this.metricOverlay.ping.style, {
      bottom: layout.bottom,
      fontSize: layout.fontSize,
      right: layout.pingRight
    });
    this.metricOverlay.fps.textContent = fpsText;
    this.metricOverlay.ping.textContent = pingText;
  }
}

function formatMode(mode = "cpu") {
  if (mode === "online-create") return "Online: Create";
  if (mode === "online-join") return "Online: Join";
  if (mode === "online-rematch") return "Online: Rematch";
  return "CPU Battle";
}

function formatPing(pingMs) {
  if (!Number.isFinite(pingMs)) return "Ping N/A";
  if (pingMs > 0 && pingMs < 1) return "Ping <1ms";
  return `Ping ${Math.max(0, Math.round(pingMs))}ms`;
}
