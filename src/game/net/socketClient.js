import { io } from "socket.io-client";

const DEFAULT_ACK_TIMEOUT_MS = 4000;

export function createSocketClient({ ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS, socketFactory = io, lifecycleTarget = globalThis.window } = {}) {
  const socket = socketFactory();
  const pendingAcks = new Set();
  let disconnected = false;

  const handlePageHide = () => {
    disconnect();
  };

  if (typeof lifecycleTarget?.addEventListener === "function") {
    lifecycleTarget.addEventListener("pagehide", handlePageHide);
  }

  function disconnect() {
    if (disconnected) return;
    disconnected = true;
    if (typeof lifecycleTarget?.removeEventListener === "function") {
      lifecycleTarget.removeEventListener("pagehide", handlePageHide);
    }
    for (const cancel of [...pendingAcks]) {
      cancel({ ok: false, error: "Disconnected" });
    }
    pendingAcks.clear();
    socket.disconnect();
  }

  return {
    socket,
    createRoom() {
      return emitWithAck(socket, "room:create", {}, ackTimeoutMs, pendingAcks);
    },
    joinRoom(code) {
      return emitWithAck(socket, "room:join", { code }, ackTimeoutMs, pendingAcks);
    },
    sendInput(roomCode, input) {
      socket.emit("match:input", { roomCode, input });
    },
    leaveRoom(roomCode) {
      socket.emit("match:leave", { roomCode });
    },
    closeRoom(roomCode) {
      return emitWithAck(socket, "room:close", { roomCode }, ackTimeoutMs, pendingAcks);
    },
    requestRematch(roomCode) {
      return emitWithAck(socket, "match:rematch", { roomCode }, ackTimeoutMs, pendingAcks);
    },
    setPaused(roomCode, paused) {
      socket.emit("match:pause", { roomCode, paused: Boolean(paused) });
    },
    onSnapshot(handler) {
      socket.on("match:snapshot", handler);
      return () => socket.off("match:snapshot", handler);
    },
    onStatus(handler) {
      socket.on("room:status", handler);
      return () => socket.off("room:status", handler);
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
