import { io } from "socket.io-client";

export function createSocketClient() {
  const socket = io();

  return {
    socket,
    createRoom() {
      return emitWithAck(socket, "room:create", {});
    },
    joinRoom(code) {
      return emitWithAck(socket, "room:join", { code });
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

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}
