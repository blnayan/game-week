import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { FIXED_DT_MS } from "../shared/constants.js";
import { createMatch, forfeitMatch, queueInput, stepMatch } from "../shared/match.js";
import {
  assignPlayerId,
  canCloseRoom,
  canJoinRoom,
  createRoomCode,
  createRematchRequestStatus,
  normalizeRoomCode,
  recordRematchRequest,
  removeSocketFromRooms,
  sendAck,
  shouldForfeitOnDisconnect,
  shouldRunRoomInterval,
  toPublicSnapshot
} from "../shared/rooms.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
const port = Number(process.env.PORT || 3000);
const distPath = path.resolve(__dirname, "../dist");
const rooms = new Map();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pixel-arena-fighter", rooms: rooms.size });
});

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("room:create", (_payload, ack) => {
    const code = createRoomCode(new Set(rooms.keys()));
    const room = createServerRoom(code);
    releaseSocketFromGameRooms(socket);
    rooms.set(code, room);
    joinRoom(socket, room, ack);
  });

  socket.on("room:join", (payload, ack) => {
    const normalized = normalizeRoomCode(payload);
    const room = rooms.get(normalized);
    if (!room) return sendAck(ack, { ok: false, error: "Room not found" });
    const joinable = canJoinRoom(room, socket.id);
    if (!joinable.ok) return sendAck(ack, joinable);
    releaseSocketFromGameRooms(socket, room.code);
    joinRoom(socket, room, ack);
  });

  socket.on("room:close", (payload, ack) => {
    const room = rooms.get(normalizeRoomCode({ code: payload?.roomCode }));
    const closeable = canCloseRoom(room, socket.id);
    if (!closeable.ok) return sendAck(ack, closeable);

    io.to(room.code).emit("room:status", {
      message: "Room disconnected",
      players: Math.max(room.players.size - 1, 0),
      roomCode: room.code
    });
    deleteRoom(room);
    sendAck(ack, { ok: true });
  });

  socket.on("match:input", (payload) => {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const room = rooms.get(normalizeRoomCode({ code: safePayload.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId || room.match.status === "complete" || room.phase !== "playing") return;
    const input = safePayload.input && typeof safePayload.input === "object" ? safePayload.input : {};
    queueInput(room.match, playerId, input);
  });

  socket.on("match:pause", (payload) => {
    const room = rooms.get(normalizeRoomCode({ code: payload?.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId || room.match.status === "complete") return;

    if (payload?.paused && room.phase === "playing") {
      room.phase = "paused";
      stopRoomInterval(room);
      io.to(room.code).emit("room:status", { message: `${playerId} paused`, players: room.players.size, roomCode: room.code });
      return;
    }

    if (!payload?.paused && room.phase === "paused") {
      room.phase = "playing";
      startRoomInterval(room);
      io.to(room.code).emit("room:status", { message: "Fight", players: room.players.size, roomCode: room.code });
    }
  });

  socket.on("match:leave", (payload) => {
    const room = rooms.get(normalizeRoomCode({ code: payload?.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId || room.match.status === "complete") return;

    clearRoomCountdown(room);
    forfeitMatch(room.match, playerId, "forfeit");
    room.phase = "complete";
    io.to(room.code).emit("room:status", { message: `${playerId} forfeited`, players: room.players.size, roomCode: room.code });
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
    stopRoomInterval(room);
  });

  socket.on("match:rematch", (payload, ack) => {
    const room = rooms.get(normalizeRoomCode({ code: payload?.roomCode }));
    const playerId = room?.players.get(socket.id);
    const rematch = recordRematchRequest(room, socket.id);
    if (!rematch.ok) return sendAck(ack, rematch);
    if (!rematch.ready) {
      sendAck(ack, rematch);
      io.to(room.code).emit("room:status", createRematchRequestStatus(room, playerId, rematch));
      return;
    }

    room.match = createMatch("online");
    room.rematchRequests.clear();
    sendAck(ack, rematch);
    io.to(room.code).emit("room:status", { message: `${playerId} started a rematch`, players: room.players.size, roomCode: room.code });
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
    startRoomCountdown(room);
  });

  socket.on("disconnect", () => {
    releaseSocketFromGameRooms(socket);
  });
});

function createServerRoom(code) {
  const room = {
    code,
    players: new Map(),
    match: createMatch("online"),
    phase: "waiting",
    rematchRequests: new Set(),
    countdownTimers: [],
    interval: null
  };
  return room;
}

function startRoomInterval(room) {
  if (!shouldRunRoomInterval(room)) return;
  if (room.interval) return;
  room.interval = setInterval(() => {
    if (room.players.size < 2 || room.phase !== "playing") return;
    stepMatch(room.match, FIXED_DT_MS);
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
    if (room.match.status === "complete") {
      room.phase = "complete";
      stopRoomInterval(room);
    }
  }, FIXED_DT_MS);
}

function joinRoom(socket, room, ack) {
  socket.join(room.code);
  const playerId = assignPlayerId(room.players, socket.id);
  room.players.set(socket.id, playerId);
  sendAck(ack, { ok: true, roomCode: room.code, playerId });
  io.to(room.code).emit("room:status", { message: "Player joined", players: room.players.size, roomCode: room.code });
  socket.emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
  if (room.players.size < 2) {
    io.to(room.code).emit("room:status", { message: "Waiting for opponent", players: room.players.size, roomCode: room.code });
  } else if (room.match.status === "playing" && room.phase === "waiting") {
    startRoomCountdown(room);
  }
}

function releaseSocketFromGameRooms(socket, exceptRoomCode = null) {
  const removals = removeSocketFromRooms(rooms, socket.id, exceptRoomCode);
  for (const removal of removals) {
    if (shouldForfeitOnDisconnect(removal.room)) {
      clearRoomCountdown(removal.room);
      forfeitMatch(removal.room.match, removal.playerId, "disconnect");
      removal.room.phase = "complete";
      io.to(removal.code).emit("room:status", {
        message: "Room disconnected",
        players: removal.players,
        roomCode: removal.code
      });
      io.to(removal.code).emit("match:snapshot", toPublicSnapshot(removal.room.match, { phase: removal.room.phase }));
      stopRoomInterval(removal.room);
      deleteRoom(removal.room);
      continue;
    }

    socket.leave(removal.code);
    if (!removal.emptied) {
      io.to(removal.code).emit("room:status", { message: "Room disconnected", players: removal.players, roomCode: removal.code });
    }
    deleteRoom(removal.room);
  }
}

function startRoomCountdown(room) {
  clearRoomCountdown(room);
  room.phase = "countdown";

  [3, 2, 1].forEach((count, index) => {
    room.countdownTimers.push(setTimeout(() => {
      if (room.players.size < 2 || room.match.status !== "playing") return;
      io.to(room.code).emit("room:status", { message: `Starting in ${count}`, players: room.players.size, roomCode: room.code });
    }, index * 1000));
  });

  room.countdownTimers.push(setTimeout(() => {
    if (room.players.size < 2 || room.match.status !== "playing") {
      room.phase = "waiting";
      return;
    }

    room.phase = "playing";
    startRoomInterval(room);
    io.to(room.code).emit("room:status", { message: "Fight", players: room.players.size, roomCode: room.code });
  }, 3000));
}

function clearRoomCountdown(room) {
  for (const timer of room.countdownTimers || []) {
    clearTimeout(timer);
  }
  room.countdownTimers = [];
}

function stopRoomInterval(room) {
  if (!room.interval) return;
  clearInterval(room.interval);
  room.interval = null;
}

function deleteRoom(room) {
  clearRoomCountdown(room);
  stopRoomInterval(room);
  rooms.delete(room.code);
  io.in(room.code).socketsLeave(room.code);
}

server.listen(port, () => {
  console.log(`Pixel Arena Fighter server listening on ${port}`);
});
