import { DEFAULT_STAGE_ID, TRI_PLATFORM_STAGE_ID } from "../../../shared/stages.js";

const STAGE_CHOICES = {
  [DEFAULT_STAGE_ID]: {
    x: 104,
    y: 222,
    width: 152,
    height: 52,
    label: "Cosmic Floating",
    fontSize: "16px"
  },
  [TRI_PLATFORM_STAGE_ID]: {
    x: 272,
    y: 222,
    width: 152,
    height: 52,
    label: "Tri Platform",
    fontSize: "16px"
  }
};

const BUTTONS = {
  cpu: {
    x: 104,
    y: 314,
    width: 320,
    height: 54,
    label: "CPU Battle",
    fontSize: "22px",
    fill: 0x10253a,
    hoverFill: 0x1a4968,
    stroke: 0x79d7ff,
    strokeAlpha: 0.9
  },
  createRoom: {
    x: 104,
    y: 388,
    width: 320,
    height: 54,
    label: "Create Online Room",
    fontSize: "22px",
    fill: 0x10253a,
    hoverFill: 0x1a4968,
    stroke: 0x79d7ff,
    strokeAlpha: 0.9
  },
  enterCode: {
    x: 104,
    y: 462,
    width: 320,
    height: 54,
    label: "Join Online Room (R)",
    fontSize: "22px",
    fill: 0x10253a,
    hoverFill: 0x1a4968,
    stroke: 0x79d7ff,
    strokeAlpha: 0.9
  }
};

export function getMenuButtonLayout(key) {
  return BUTTONS[key];
}

export function getStageChoiceLayout(stageId) {
  return STAGE_CHOICES[stageId];
}

export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y - rect.height / 2 &&
    point.y <= rect.y + rect.height / 2
  );
}
