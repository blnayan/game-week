import { describe, expect, it, vi } from "vitest";
import { TRI_PLATFORM_STAGE_ID } from "../../../shared/stages.js";
import { renderStageView } from "./stageRender.js";

function createStageView({ showPlatformHitboxes = false } = {}) {
  return {
    stageId: TRI_PLATFORM_STAGE_ID,
    showPlatformHitboxes,
    stageBackground: { setTexture: vi.fn() },
    platformGraphics: {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      lineStyle: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn()
    }
  };
}

describe("stage rendering", () => {
  it("does not draw platform hitbox overlays by default", () => {
    const view = createStageView();

    renderStageView(view);

    expect(view.stageBackground.setTexture).toHaveBeenCalledWith("stage:tri-platform");
    expect(view.platformGraphics.clear).toHaveBeenCalledOnce();
    expect(view.platformGraphics.fillRect).not.toHaveBeenCalled();
    expect(view.platformGraphics.strokeRect).not.toHaveBeenCalled();
  });
});
