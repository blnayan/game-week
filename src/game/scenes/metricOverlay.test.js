import { describe, expect, it } from "vitest";
import { getMetricOverlayLayout } from "./metricOverlay.js";

describe("getMetricOverlayLayout", () => {
  it("anchors metrics to the visible canvas bottom corners", () => {
    expect(getMetricOverlayLayout({
      canvasRect: { left: 0, right: 1074, bottom: 780, width: 1074 },
      viewportWidth: 1074,
      viewportHeight: 965
    })).toEqual({
      bottom: "209px",
      fontSize: "17px",
      fpsLeft: "24px",
      pingRight: "24px"
    });
  });
});
