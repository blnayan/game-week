import { getStageDefinition } from "../../../shared/stages.js";
import { getStageAssetKey } from "../render/assetManifest.js";

export function renderStageView({
  stageBackground,
  platformGraphics,
  stageId,
  showPlatformHitboxes = false
} = {}) {
  stageBackground?.setTexture(getStageAssetKey(stageId));
  platformGraphics?.clear();

  if (!showPlatformHitboxes || !platformGraphics) return;

  platformGraphics.fillStyle(0xe2edf4, 0.18);
  platformGraphics.lineStyle(2, 0xf4d46a, 0.95);

  for (const platform of getStageDefinition(stageId).platforms) {
    platformGraphics.fillRect(platform.x, platform.y, platform.width, platform.height);
    platformGraphics.strokeRect(platform.x, platform.y, platform.width, platform.height);
  }
}
