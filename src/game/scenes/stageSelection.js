import {
  canCreateStageAtLevel,
  DEFAULT_STAGE_ID,
  getStageDefinition,
  normalizeStageId,
  TRI_PLATFORM_STAGE_ID
} from "../../../shared/stages.js";
import { getStageAssetKey } from "../render/assetManifest.js";

export const MENU_STAGE_IDS = Object.freeze([DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID]);

export function getMenuStageOptions(progress = {}, selectedStageId = DEFAULT_STAGE_ID) {
  const currentStageId = normalizeStageId(selectedStageId);

  return MENU_STAGE_IDS.map((stageId) => {
    const definition = getStageDefinition(stageId);
    const availability = canCreateStageAtLevel(stageId, progress.level);
    return {
      stageId,
      label: availability.ok ? definition.name : `${definition.name} - Level ${definition.unlockLevel}`,
      selected: currentStageId === stageId,
      locked: !availability.ok,
      notice: availability.ok ? "" : availability.error,
      unlockLevel: definition.unlockLevel
    };
  });
}

export function resolveMenuStageSelection(stageId, progress = {}, currentStageId = DEFAULT_STAGE_ID) {
  const nextStageId = normalizeStageId(stageId);
  const fallbackStageId = normalizeStageId(currentStageId);
  const availability = canCreateStageAtLevel(nextStageId, progress.level);

  if (!availability.ok) {
    return {
      selectedStageId: fallbackStageId,
      notice: availability.error
    };
  }

  return {
    selectedStageId: nextStageId,
    notice: ""
  };
}

export function getStageSelectorButtonViewModel(selectedStageId = DEFAULT_STAGE_ID) {
  const stage = getStageDefinition(selectedStageId);

  return {
    label: `Stage: ${stage.name}`,
    fill: 0x10253a,
    hoverFill: 0x1a4968,
    stroke: 0xffd166,
    textColor: "#ffffff"
  };
}

export function getStagePreviewCardViewModel(option = {}) {
  const locked = Boolean(option.locked);
  const selected = Boolean(option.selected);
  const unlockLevel = Number(option.unlockLevel);
  const showUnlockLevel = locked && Number.isFinite(unlockLevel);

  return {
    title: option.label || "",
    imageKey: getStageAssetKey(option.stageId),
    badgeLabel: selected ? "Selected" : showUnlockLevel ? `Level ${unlockLevel}` : "",
    fill: selected ? 0x2d6d8f : locked ? 0x2a2f3d : 0x10253a,
    hoverFill: selected ? 0x347ea5 : locked ? 0x2a2f3d : 0x1a4968,
    stroke: selected ? 0xffd166 : locked ? 0x6f7788 : 0x79d7ff,
    fillAlpha: locked ? 0.72 : 0.94,
    hoverAlpha: locked ? 0.72 : 0.98,
    textColor: locked ? "#d8dee9" : "#ffffff"
  };
}
