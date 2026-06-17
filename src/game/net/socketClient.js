import { io } from "socket.io-client";

const DEFAULT_ACK_TIMEOUT_MS = 4000;
const DEFAULT_NOW = () => performance.now();
const DEFAULT_LATENCY_INTERVAL_MS = 1000;
const DEFAULT_LATENCY_TIMEOUT_MS = 1000;

export function createSocketClient({
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS,
  socketFactory = io,
  lifecycleTarget = globalThis.window,
  latencyIntervalMs = DEFAULT_LATENCY_INTERVAL_MS,
  latencyTimeoutMs = DEFAULT_LATENCY_TIMEOUT_MS,
  now = DEFAULT_NOW
} = {}) {
  const socket = socketFactory();
  const pendingAcks = new Set();
  const statusHandlers = new Set();
  const snapshotHandlers = new Set();
  let latestStatus = null;
  let latestSnapshot = null;
  let pingStartedAt = null;
  let latencyStartedAt = null;
  let latencyTimeout = null;
  let latencyInterval = null;
  let latestPingMs = null;
  let disconnected = false;

  const handlePageHide = () => {
    disconnect();
  };
  const handlePing = () => {
    pingStartedAt = now();
  };
  const handlePong = () => {
    if (pingStartedAt === null) return;
    latestPingMs = Math.max(0, now() - pingStartedAt);
    pingStartedAt = null;
  };
  const measureLatency = () => {
    if (latencyStartedAt !== null) return;
    latencyStartedAt = now();
    latencyTimeout = setTimeout(() => {
      latencyStartedAt = null;
      latencyTimeout = null;
    }, latencyTimeoutMs);
    socket.emit("latency:ping", {}, (response) => {
      if (latencyStartedAt === null) return;
      clearTimeout(latencyTimeout);
      latencyTimeout = null;
      if (response?.ok) latestPingMs = Math.max(0, now() - latencyStartedAt);
      latencyStartedAt = null;
    });
  };

  socket.on("room:status", (status) => {
    latestStatus = status;
    for (const handler of statusHandlers) {
      handler(status);
    }
  });
  socket.on("match:snapshot", (snapshot) => {
    latestSnapshot = snapshot;
    for (const handler of snapshotHandlers) {
      handler(snapshot);
    }
  });

  if (typeof lifecycleTarget?.addEventListener === "function") {
    lifecycleTarget.addEventListener("pagehide", handlePageHide);
  }
  socket.io?.on?.("ping", handlePing);
  socket.io?.on?.("pong", handlePong);
  if (latencyIntervalMs > 0) {
    latencyInterval = setInterval(measureLatency, latencyIntervalMs);
  }

  function disconnect() {
    if (disconnected) return;
    disconnected = true;
    if (typeof lifecycleTarget?.removeEventListener === "function") {
      lifecycleTarget.removeEventListener("pagehide", handlePageHide);
    }
    socket.io?.off?.("ping", handlePing);
    socket.io?.off?.("pong", handlePong);
    clearInterval(latencyInterval);
    clearTimeout(latencyTimeout);
    for (const cancel of [...pendingAcks]) {
      cancel({ ok: false, error: "Disconnected" });
    }
    pendingAcks.clear();
    socket.disconnect();
  }

  return {
    socket,
    createRoom(options = {}) {
      return emitWithAck(
        socket,
        "room:create",
        { stageId: options.stageId, playerLevel: options.playerLevel },
        ackTimeoutMs,
        pendingAcks
      );
    },
    joinRoom(code) {
      return emitWithAck(socket, "room:join", { code }, ackTimeoutMs, pendingAcks);
    },
    sendInput(roomCode, input) {
      socket.emit("match:input", { roomCode, input });
    },
    leaveRoom(roomCode) {
      return emitWithAck(socket, "match:leave", { roomCode }, ackTimeoutMs, pendingAcks);
    },
    closeRoom(roomCode) {
      return emitWithAck(socket, "room:close", { roomCode }, ackTimeoutMs, pendingAcks);
    },
    requestRematch(roomCode) {
      return emitWithAck(socket, "match:rematch", { roomCode }, ackTimeoutMs, pendingAcks);
    },
    setPaused(roomCode, paused) {
      return emitWithAck(socket, "match:pause", { roomCode, paused: Boolean(paused) }, ackTimeoutMs, pendingAcks);
    },
    getPingMs() {
      return latestPingMs;
    },
    onSnapshot(handler, { replayLatest = true } = {}) {
      snapshotHandlers.add(handler);
      if (replayLatest && latestSnapshot) handler(latestSnapshot);
      return () => snapshotHandlers.delete(handler);
    },
    onStatus(handler, { replayLatest = true } = {}) {
      statusHandlers.add(handler);
      if (replayLatest && latestStatus) handler(latestStatus);
      return () => statusHandlers.delete(handler);
    },
    disconnect
  };
}

function emitWithAck(socket, event, payload, timeoutMs, pendingAcks) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("connect_error", onConnectError);
      pendingAcks?.delete(finish);
      resolve(response);
    };
    const onConnectError = (error) => {
      finish({ ok: false, error: error?.message || "Connection failed" });
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: "Connection timed out" });
    }, timeoutMs);

    socket.on("connect_error", onConnectError);
    pendingAcks?.add(finish);
    socket.emit(event, payload, finish);
  });
}
