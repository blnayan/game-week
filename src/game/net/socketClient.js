import { io } from "socket.io-client";

const DEFAULT_ACK_TIMEOUT_MS = 4000;

export function createSocketClient({ ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS, socketFactory = io } = {}) {
  const socket = socketFactory();

  return {
    socket,
    createRoom() {
      return emitWithAck(socket, "room:create", {}, ackTimeoutMs);
    },
    joinRoom(code) {
      return emitWithAck(socket, "room:join", { code }, ackTimeoutMs);
    },
    sendInput(roomCode, input) {
      socket.emit("match:input", { roomCode, input });
    },
    onSnapshot(handler) {
      socket.on("match:snapshot", handler);
      return () => socket.off("match:snapshot", handler);
    },
    onStatus(handler) {
      socket.on("room:status", handler);
      return () => socket.off("room:status", handler);
    },
    disconnect() {
      socket.disconnect();
    }
  };
}

function emitWithAck(socket, event, payload, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("connect_error", onConnectError);
      resolve(response);
    };
    const onConnectError = (error) => {
      finish({ ok: false, error: error?.message || "Connection failed" });
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: "Connection timed out" });
    }, timeoutMs);

    socket.on("connect_error", onConnectError);
    socket.emit(event, payload, finish);
  });
}
