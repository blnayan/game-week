const NAME_TAG_OFFSET_Y = 30;
const NAME_TAG_COLORS = {
  p1: "#79d7ff",
  p2: "#ffb067"
};

export function getFighterNameTagView(fighterId, fighter = {}) {
  return {
    label: String(fighterId).toUpperCase(),
    x: fighter.x,
    y: fighter.y - fighter.height - NAME_TAG_OFFSET_Y,
    color: NAME_TAG_COLORS[fighterId] ?? "#ffffff"
  };
}
