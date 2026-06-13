const EDGE_INPUTS = ["up", "jump", "light", "heavy", "special", "dodge"];
const DEFAULT_LATCH_MS = 50;

export function createOnlineInputLatch(latchMs = DEFAULT_LATCH_MS) {
  const remainingMs = Object.fromEntries(EDGE_INPUTS.map((key) => [key, 0]));

  return {
    read(input = {}, deltaMs = 0) {
      const output = { ...input };

      for (const key of EDGE_INPUTS) {
        if (input[key]) {
          remainingMs[key] = latchMs;
        }

        output[key] = remainingMs[key] > 0;
        remainingMs[key] = Math.max(0, remainingMs[key] - deltaMs);
      }

      return output;
    }
  };
}
