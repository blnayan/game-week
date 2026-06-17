import {
  canCreateStageAtLevel,
  DEFAULT_STAGE_ID,
  getStageDefinition,
  normalizeStageId,
  TRI_PLATFORM_STAGE_ID
} from "../../../shared/stages.js";

export const MENU_STAGE_IDS = Object.freeze([DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID]);

export function getMenuStageOptions(progress = {}, selectedStageId = DEFAULT_STAGE_ID) {
  const currentStageId = normalizeStageId(selectedStageId);

  return MENU_STAGE_IDS.map((stageId) => {
    const definition = getStageDefinition(stageId);
    const availability = canCreateStageAtLevel(stageId, progress.level);
    return {
      stageId,
      label: definition.name,
      selected: currentStageId === stageId,
      locked: !availability.ok,
      notice: availability.ok ? "" : availability.error
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
