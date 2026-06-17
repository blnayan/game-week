import { describe, expect, it } from "vitest";

import { createSnapshotRecorder } from "../../scripts/profileMultiplayerMetrics.mjs";

describe("multiplayer profiler metrics", () => {
  it("records snapshot intervals only during the measurement window", () => {
    const samples = { snapshots: [], payloadBytes: [] };
    const recorder = createSnapshotRecorder(samples);

    recorder.record({ phase: "playing" }, 10);
    recorder.start();
    recorder.record({ phase: "playing", tick: 1 }, 30);
    recorder.record({ phase: "playing", tick: 2 }, 50);
    recorder.stop();
    recorder.record({ phase: "playing", tick: 3 }, 70);

    expect(samples.snapshots).toEqual([{ intervalMs: 20 }]);
    expect(samples.payloadBytes).toHaveLength(2);
  });
});
