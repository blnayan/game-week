import { describe, expect, it, vi } from "vitest";
import { sendLatencyAck } from "../../shared/latency.js";

describe("sendLatencyAck", () => {
  it("acknowledges latency pings", () => {
    const ack = vi.fn();

    sendLatencyAck(ack);

    expect(ack).toHaveBeenCalledWith({ ok: true });
  });
});
