const GAME_WIDTH = 1280;
const METRIC_MARGIN_PX = 24;

export function getMetricOverlayLayout({ canvasRect, viewportWidth, viewportHeight }) {
  const scale = canvasRect.width / GAME_WIDTH;
  const fontSize = Math.round(Math.max(12, Math.min(20, 20 * scale)));

  return {
    bottom: `${Math.max(0, viewportHeight - canvasRect.bottom + METRIC_MARGIN_PX)}px`,
    fontSize: `${fontSize}px`,
    fpsLeft: `${canvasRect.left + METRIC_MARGIN_PX}px`,
    pingRight: `${Math.max(0, viewportWidth - canvasRect.right + METRIC_MARGIN_PX)}px`
  };
}
