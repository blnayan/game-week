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

  it("emits a match leave command with the room code", () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });

    client.leaveRoom("ROOM1");

    expect(fakeSocket.emit).toHaveBeenCalledWith("match:leave", { roomCode: "ROOM1" });
  });

  it("closes a completed online room with acknowledgement", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "room:close") ack({ ok: true });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await expect(client.closeRoom("ROOM1")).resolves.toEqual({ ok: true });
    expect(fakeSocket.emit).toHaveBeenCalledWith("room:close", { roomCode: "ROOM1" }, expect.any(Function));
  });

  it("emits a completed room close before disconnecting from result menu", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "room:close") ack({ ok: true });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await client.closeRoom("ROOM1");
    client.disconnect();

    expect(fakeSocket.emit).toHaveBeenCalledWith("room:close", { roomCode: "ROOM1" }, expect.any(Function));
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("requests rematch with acknowledgement so rejected rematches do not advance locally", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "match:rematch") ack({ ok: false, error: "Room not found" });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await expect(client.requestRematch("ROOM1")).resolves.toEqual({ ok: false, error: "Room not found" });
    expect(fakeSocket.emit).toHaveBeenCalledWith("match:rematch", { roomCode: "ROOM1" }, expect.any(Function));
  });

  it("falls back if completed room close acknowledgement times out", async () => {
    const client = createSocketClient({ ackTimeoutMs: 25 });
    const pending = client.closeRoom("ROOM1");

    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({ ok: false, error: "Connection timed out" });
  });

  it("emits match pause state changes with the room code", () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });

    client.setPaused("ROOM1", true);

    expect(fakeSocket.emit).toHaveBeenCalledWith("match:pause", { roomCode: "ROOM1", paused: true });
  });

  it("clears pending ack timers and listeners when disconnected mid-request", async () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });
    const pending = client.joinRoom("ROOM1");

    client.disconnect();
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toEqual({ ok: false, error: "Disconnected" });
    expect(fakeSocket.off).toHaveBeenCalledWith("connect_error", expect.any(Function));
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("disconnects on pagehide so reloads release server rooms promptly", async () => {
    const lifecycleTarget = createLifecycleTarget();
    const client = createSocketClient({ ackTimeoutMs: 100, lifecycleTarget });
    const pending = client.joinRoom("ROOM1");

    lifecycleTarget.dispatch("pagehide");
    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toEqual({ ok: false, error: "Disconnected" });
    expect(fakeSocket.disconnect).toHaveBeenCalled();
    expect(lifecycleTarget.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
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

function createLifecycleTarget() {
  const handlers = new Map();

  return {
    addEventListener: vi.fn((event, handler) => {
      handlers.set(event, handler);
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (handlers.get(event) === handler) handlers.delete(event);
    }),
    dispatch(event) {
      handlers.get(event)?.();
    }
  };
}
