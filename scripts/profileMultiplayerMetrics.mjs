export function createSnapshotRecorder(samples) {
  let measuring = false;
  let lastSnapshotAt = null;

  return {
    start() {
      measuring = true;
      lastSnapshotAt = null;
    },
    stop() {
      measuring = false;
      lastSnapshotAt = null;
    },
    record(snapshot, now) {
      if (!measuring || snapshot.phase !== "playing") return;

      samples.payloadBytes.push(Buffer.byteLength(JSON.stringify(snapshot)));
      if (lastSnapshotAt !== null) {
        samples.snapshots.push({ intervalMs: now - lastSnapshotAt });
      }
      lastSnapshotAt = now;
    }
  };
}
