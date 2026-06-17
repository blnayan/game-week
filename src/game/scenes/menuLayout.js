const STAGE_SELECTOR_BUTTON = {
  x: 104,
  y: 222,
  width: 380,
  height: 62,
  paddingX: 24,
  paddingY: 11,
  label: "Select Stage",
  fontSize: "20px",
  fill: 0x10253a,
  hoverFill: 0x1a4968,
  stroke: 0xffd166,
  strokeAlpha: 0.95
};

const STAGE_MENU_PANEL = {
  x: 640,
  y: 360,
  width: 820,
  height: 480,
  padding: 40,
  headerHeight: 166
};

const STAGE_CARD = {
  gap: 28,
  titleBandHeight: 96
};

const STAGE_SELECTOR_TEXT = {
  labelHeight: 16,
  valueHeight: 20,
  gap: 4
};

const STAGE_MENU_CLOSE_BUTTON = {
  width: 132,
  height: 44
};

const STAGE_MENU_TEXT = {
  titleSubtitleGap: 56,
  subtitleHeight: 38
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

export function getStageSelectorButtonLayout() {
  return STAGE_SELECTOR_BUTTON;
}

export function getStageSelectorTextLayout() {
  const labelY = -STAGE_SELECTOR_BUTTON.height / 2 + STAGE_SELECTOR_BUTTON.paddingY;
  return {
    x: STAGE_SELECTOR_BUTTON.paddingX,
    labelY,
    labelHeight: STAGE_SELECTOR_TEXT.labelHeight,
    valueY: labelY + STAGE_SELECTOR_TEXT.labelHeight + STAGE_SELECTOR_TEXT.gap,
    valueHeight: STAGE_SELECTOR_TEXT.valueHeight
  };
}

export function getStageMenuPanelLayout() {
  return STAGE_MENU_PANEL;
}

export function getStageMenuTextLayout() {
  const x = -STAGE_MENU_PANEL.width / 2 + STAGE_MENU_PANEL.padding;
  const titleY = -STAGE_MENU_PANEL.height / 2 + STAGE_MENU_PANEL.padding;
  return {
    x,
    titleY,
    subtitleY: titleY + STAGE_MENU_TEXT.titleSubtitleGap,
    subtitleHeight: STAGE_MENU_TEXT.subtitleHeight,
    subtitleWidth: STAGE_MENU_PANEL.width - STAGE_MENU_PANEL.padding * 2 - STAGE_MENU_CLOSE_BUTTON.width - 24
  };
}

export function getStageMenuOverlayLayout(canvasWidth, canvasHeight) {
  return {
    x: canvasWidth / 2 - STAGE_MENU_PANEL.x,
    y: canvasHeight / 2 - STAGE_MENU_PANEL.y,
    width: canvasWidth,
    height: canvasHeight
  };
}

export function getStageMenuCloseButtonLayout() {
  return {
    x: STAGE_MENU_PANEL.width / 2 - STAGE_MENU_PANEL.padding - STAGE_MENU_CLOSE_BUTTON.width / 2,
    y: -STAGE_MENU_PANEL.height / 2 + STAGE_MENU_PANEL.padding + STAGE_MENU_CLOSE_BUTTON.height / 2,
    width: STAGE_MENU_CLOSE_BUTTON.width,
    height: STAGE_MENU_CLOSE_BUTTON.height
  };
}

export function getStagePreviewCardLayout(index = 0) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const width = (STAGE_MENU_PANEL.width - STAGE_MENU_PANEL.padding * 2 - STAGE_CARD.gap) / 2;
  const height = STAGE_MENU_PANEL.height - STAGE_MENU_PANEL.headerHeight - STAGE_MENU_PANEL.padding;
  const totalWidth = width * 2 + STAGE_CARD.gap;
  return {
    x: -totalWidth / 2 + column * (width + STAGE_CARD.gap),
    y: -STAGE_MENU_PANEL.height / 2 + STAGE_MENU_PANEL.headerHeight + row * (height + 26),
    width,
    height,
    previewHeight: height - STAGE_CARD.titleBandHeight
  };
}

export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y - rect.height / 2 &&
    point.y <= rect.y + rect.height / 2
  );
}
