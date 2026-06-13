import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fakeSocket;

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => fakeSocket)
}));

const { createSocketClient } = await import("./socketClient.js");

describe("createSocketClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeSocket = createFakeSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves room creation with an error when the ack times out", async () => {
    const client = createSocketClient({ ackTimeoutMs: 25 });
    const pending = client.createRoom();

    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({ ok: false, error: "Connection timed out" });
  });

  it("resolves room joins with an error on connect failure", async () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });
    const pending = client.joinRoom("ROOM1");

    fakeSocket.emitServer("connect_error", new Error("network down"));

    await expect(pending).resolves.toEqual({ ok: false, error: "network down" });
  });
});

function createFakeSocket() {
  const handlers = new Map();

  return {
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      const eventHandlers = handlers.get(event) ?? new Set();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
    }),
    off: vi.fn((event, handler) => {
      handlers.get(event)?.delete(handler);
    }),
    disconnect: vi.fn(),
    emitServer(event, payload) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    }
  };
}
