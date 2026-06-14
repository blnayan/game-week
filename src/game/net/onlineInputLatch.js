const EDGE_INPUTS = ["jump", "light", "heavy"];
const LIVE_INPUTS = ["left", "right", "down"];
const LATCH_MS = 120;

export function createOnlineInputLatch() {
  const timers = Object.fromEntries(EDGE_INPUTS.map((key) => [key, 0]));

  return {
    read(input, dtMs) {
      for (const key of EDGE_INPUTS) {
        if (input[key]) timers[key] = LATCH_MS;
      }

      const latched = {};
      for (const key of LIVE_INPUTS) {
        latched[key] = Boolean(input[key]);
      }
      for (const key of EDGE_INPUTS) {
        latched[key] = timers[key] > 0;
        timers[key] = Math.max(0, timers[key] - dtMs);
      }

      return latched;
    }
  };
}
