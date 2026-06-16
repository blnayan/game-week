const BUTTONS = {
  cpu: {
    x: 104,
    y: 230,
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
    y: 304,
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
    y: 378,
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

export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y - rect.height / 2 &&
    point.y <= rect.y + rect.height / 2
  );
}
