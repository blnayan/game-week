import { describe, expect, it } from "vitest";
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

describe("menu layout", () => {
  it("keeps manual join styled like the primary menu buttons", () => {
    const cpu = getMenuButtonLayout("cpu");
    const createRoom = getMenuButtonLayout("createRoom");
    const enterCode = getMenuButtonLayout("enterCode");

    expect(enterCode.label).toBe("Join Online Room (R)");
    expect(enterCode.width).toBe(cpu.width);
    expect(enterCode.height).toBe(cpu.height);
    expect(enterCode.fill).toBe(cpu.fill);
    expect(enterCode.stroke).toBe(cpu.stroke);
    expect(enterCode.y).toBeGreaterThan(createRoom.y);
  });

  it("uses matching visual and pointer bounds for the manual join button", () => {
    const enterCode = getMenuButtonLayout("enterCode");

    expect(isPointInRect({ x: enterCode.x + enterCode.width - 1, y: enterCode.y }, enterCode)).toBe(true);
    expect(isPointInRect({ x: enterCode.x + enterCode.width + 1, y: enterCode.y }, enterCode)).toBe(false);
    expect(isPointInRect({ x: enterCode.x, y: enterCode.y - enterCode.height / 2 - 1 }, enterCode)).toBe(false);
  });

  it("positions the stage picker above the match mode buttons", () => {
    const cpu = getMenuButtonLayout("cpu");
    const createRoom = getMenuButtonLayout("createRoom");
    const stageSelector = getStageSelectorButtonLayout();
    const text = getStageSelectorTextLayout();

    expect(stageSelector.label).toBe("Select Stage");
    expect(stageSelector.y + stageSelector.height / 2).toBeLessThan(cpu.y - cpu.height / 2);
    expect(stageSelector.width).toBeGreaterThan(cpu.width);
    expect(text.x).toBe(stageSelector.paddingX);
    expect(text.labelY + stageSelector.height / 2).toBe(stageSelector.paddingY);
    expect(stageSelector.height / 2 - (text.valueY + text.valueHeight)).toBe(stageSelector.paddingY);
    expect(createRoom.y).toBeGreaterThan(cpu.y);
  });

  it("lays stage preview cards inside a larger selection panel", () => {
    const panel = getStageMenuPanelLayout();
    const text = getStageMenuTextLayout();
    const first = getStagePreviewCardLayout(0);
    const second = getStagePreviewCardLayout(1);
    const close = getStageMenuCloseButtonLayout();

    expect(panel.width).toBeGreaterThan(800);
    expect(panel.height).toBeGreaterThan(450);
    expect(panel.x).toBe(640);
    expect(panel.y).toBe(360);
    expect(first.previewHeight).toBeGreaterThan(140);
    expect(first.y - (text.subtitleY + text.subtitleHeight)).toBeGreaterThanOrEqual(28);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    expect(first.x).toBe(-panel.width / 2 + panel.padding);
    expect(panel.width / 2 - (second.x + second.width)).toBe(panel.padding);
    expect(panel.height / 2 - (first.y + first.height)).toBe(panel.padding);
    expect(panel.width / 2 - (close.x + close.width / 2)).toBe(panel.padding);
    expect(close.y - close.height / 2 + panel.height / 2).toBe(panel.padding);
    expect(first.y).toBe(second.y);
  });

  it("centers the stage menu overlay on the full canvas while it is inside the panel container", () => {
    const panel = getStageMenuPanelLayout();
    const overlay = getStageMenuOverlayLayout(1280, 720);

    expect(panel.x + overlay.x - overlay.width / 2).toBe(0);
    expect(panel.x + overlay.x + overlay.width / 2).toBe(1280);
    expect(panel.y + overlay.y - overlay.height / 2).toBe(0);
    expect(panel.y + overlay.y + overlay.height / 2).toBe(720);
  });
});
