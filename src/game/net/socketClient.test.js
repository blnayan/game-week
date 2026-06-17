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

  it("sends the selected stage and player level when creating a room", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "room:create") ack({ ok: true });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await expect(client.createRoom({ stageId: "tri-platform", playerLevel: 10 })).resolves.toEqual({ ok: true });

    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "room:create",
      { stageId: "tri-platform", playerLevel: 10 },
      expect.any(Function)
    );
  });

  it("resolves room joins with an error on connect failure", async () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });
    const pending = client.joinRoom("ROOM1");

    fakeSocket.emitServer("connect_error", new Error("network down"));

    await expect(pending).resolves.toEqual({ ok: false, error: "network down" });
  });

  it("leaves a match with acknowledgement", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "match:leave") ack({ ok: true });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await expect(client.leaveRoom("ROOM1")).resolves.toEqual({ ok: true });

    expect(fakeSocket.emit).toHaveBeenCalledWith("match:leave", { roomCode: "ROOM1" }, expect.any(Function));
  });

  it("resolves match leave with an error when acknowledgement times out", async () => {
    const client = createSocketClient({ ackTimeoutMs: 25 });
    const pending = client.leaveRoom("ROOM1");

    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({ ok: false, error: "Connection timed out" });
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

  it("sets match pause state with acknowledgement", async () => {
    fakeSocket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "match:pause") ack({ ok: true });
    });
    const client = createSocketClient({ ackTimeoutMs: 100 });

    await expect(client.setPaused("ROOM1", true)).resolves.toEqual({ ok: true });

    expect(fakeSocket.emit).toHaveBeenCalledWith("match:pause", { roomCode: "ROOM1", paused: true }, expect.any(Function));
  });

  it("resolves match pause with an error when acknowledgement times out", async () => {
    const client = createSocketClient({ ackTimeoutMs: 25 });
    const pending = client.setPaused("ROOM1", true);

    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({ ok: false, error: "Connection timed out" });
  });

  it("replays the latest room status to result screens that subscribe after the event", () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });
    const rematchStatus = {
      message: "p1 wants a rematch",
      players: 2,
      roomCode: "ROOM1",
      rematch: { requestedBy: "p1", requested: 1, required: 2 }
    };
    const handler = vi.fn();

    fakeSocket.emitServer("room:status", rematchStatus);
    client.onStatus(handler);

    expect(handler).toHaveBeenCalledWith(rematchStatus);
  });

  it("allows gameplay screens to subscribe only to fresh room statuses", () => {
    const client = createSocketClient({ ackTimeoutMs: 100 });
    const status = { message: "p1 started a rematch", players: 2, roomCode: "ROOM1" };
    const handler = vi.fn();

    fakeSocket.emitServer("room:status", status);
    client.onStatus(handler, { replayLatest: false });

    expect(handler).not.toHaveBeenCalled();

    fakeSocket.emitServer("room:status", { message: "Fight", players: 2, roomCode: "ROOM1" });

    expect(handler).toHaveBeenCalledWith({ message: "Fight", players: 2, roomCode: "ROOM1" });
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
