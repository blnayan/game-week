import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { FIXED_DT_MS } from "../shared/constants.js";
import { sendLatencyAck } from "../shared/latency.js";
import { createMatch, forfeitMatch, queueInput, stepMatch } from "../shared/match.js";
import {
  assignPlayerId,
  canCloseRoom,
  canCreateRoomWithStage,
  canJoinRoom,
  canResumeRoomPause,
  createInputRateGuard,
  createRematchMatchOptions,
  createRoomCode,
  createRematchRequestStatus,
  normalizeRoomCode,
  recordRematchRequest,
  removeSocketFromRooms,
  sanitizeMatchInput,
  sendAck,
  shouldDeleteRoomAfterSocketRemoval,
  shouldForfeitOnDisconnect,
  shouldResetRoomToWaitingAfterSocketRemoval,
  shouldRunRoomInterval,
  toPublicRoomStatus,
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
const inputRateGuard = createInputRateGuard();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pixel-arena-fighter", rooms: rooms.size });
});

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("latency:ping", (_payload, ack) => {
    sendLatencyAck(ack);
  });

  socket.on("room:create", (payload, ack) => {
    const creation = canCreateRoomWithStage(payload);
    if (!creation.ok) return sendAck(ack, creation);

    const code = createRoomCode(new Set(rooms.keys()));
    const room = createServerRoom(code, creation.stageId);
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

    io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
      message: "Room disconnected",
      reason: "disconnect"
    }));
    deleteRoom(room);
    sendAck(ack, { ok: true });
  });

  socket.on("match:input", (payload) => {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    if (!inputRateGuard.allow(socket.id)) return;
    const room = rooms.get(normalizeRoomCode({ code: safePayload.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId || room.match.status === "complete" || room.phase !== "playing") return;
    queueInput(room.match, playerId, sanitizeMatchInput(safePayload.input));
  });

  socket.on("match:pause", (payload, ack) => {
    const room = rooms.get(normalizeRoomCode({ code: payload?.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId) return sendAck(ack, { ok: false, error: "Room not found" });
    if (room.match.status === "complete") return sendAck(ack, { ok: false, error: "Match is complete" });

    if (payload?.paused && room.phase === "playing") {
      room.phase = "paused";
      room.pausedBy = playerId;
      stopRoomInterval(room);
      sendAck(ack, { ok: true });
      io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
        message: `${playerId} paused`,
        reason: "pause"
      }));
      return;
    }

    if (!payload?.paused && room.phase === "paused") {
      const resumable = canResumeRoomPause(room, playerId);
      if (!resumable.ok) return sendAck(ack, resumable);

      room.phase = "playing";
      room.pausedBy = null;
      startRoomInterval(room);
      sendAck(ack, { ok: true });
      io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
        message: "Fight",
        reason: "resume"
      }));
      return;
    }

    sendAck(ack, { ok: false, error: "Pause unavailable" });
  });

  socket.on("match:leave", (payload, ack) => {
    const room = rooms.get(normalizeRoomCode({ code: payload?.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId) return sendAck(ack, { ok: false, error: "Room not found" });
    if (room.match.status === "complete") return sendAck(ack, { ok: false, error: "Match is complete" });

    clearRoomCountdown(room);
    forfeitMatch(room.match, playerId, "forfeit");
    room.phase = "complete";
    io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
      message: `${playerId} forfeited`,
      reason: "forfeit"
    }));
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
    stopRoomInterval(room);
    sendAck(ack, { ok: true });
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

    room.match = createMatch("online", createRematchMatchOptions(room));
    room.rematchRequests.clear();
    room.phase = "countdown";
    sendAck(ack, rematch);
    io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
      message: `${playerId} started a rematch`,
      reason: "rematch"
    }));
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
    startRoomCountdown(room);
  });

  socket.on("disconnect", () => {
    inputRateGuard.clear(socket.id);
    releaseSocketFromGameRooms(socket);
  });
});

function createServerRoom(code, stageId) {
  const room = {
    code,
    players: new Map(),
    match: createMatch("online", { stageId }),
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
    if (room.match.status === "complete") {
      room.phase = "complete";
      io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
      io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
        message: "Match complete",
        reason: "complete"
      }));
      stopRoomInterval(room);
      return;
    }
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
  }, FIXED_DT_MS);
}

function joinRoom(socket, room, ack) {
  socket.join(room.code);
  const playerId = assignPlayerId(room.players, socket.id);
  room.players.set(socket.id, playerId);
  sendAck(ack, { ok: true, roomCode: room.code, playerId });
  io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
    message: "Player joined",
    reason: "join"
  }));
  socket.emit("match:snapshot", toPublicSnapshot(room.match, { phase: room.phase }));
  if (room.players.size < 2) {
    io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
      message: "Waiting for opponent",
      reason: "waiting"
    }));
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
      io.to(removal.code).emit("room:status", toPublicRoomStatus(removal.room, {
        message: "Room disconnected",
        reason: "disconnect"
      }));
      io.to(removal.code).emit("match:snapshot", toPublicSnapshot(removal.room.match, { phase: removal.room.phase }));
      stopRoomInterval(removal.room);
      deleteRoom(removal.room);
      continue;
    }

    socket.leave(removal.code);
    if (!removal.emptied) {
      const resetToWaiting = shouldResetRoomToWaitingAfterSocketRemoval(removal);
      if (resetToWaiting) {
        clearRoomCountdown(removal.room);
        removal.room.phase = "waiting";
      }
      io.to(removal.code).emit("room:status", toPublicRoomStatus(removal.room, {
        message: "Room disconnected",
        reason: "disconnect"
      }));
      if (resetToWaiting) {
        io.to(removal.code).emit("room:status", toPublicRoomStatus(removal.room, {
          message: "Waiting for opponent",
          reason: "waiting"
        }));
      }
    }
    if (shouldDeleteRoomAfterSocketRemoval(removal)) {
      deleteRoom(removal.room);
    }
  }
}

function startRoomCountdown(room) {
  clearRoomCountdown(room);
  room.phase = "countdown";

  [3, 2, 1].forEach((count, index) => {
    room.countdownTimers.push(setTimeout(() => {
      if (room.players.size < 2 || room.match.status !== "playing") return;
      io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
        message: `Starting in ${count}`,
        reason: "countdown"
      }));
    }, index * 1000));
  });

  room.countdownTimers.push(setTimeout(() => {
    if (room.players.size < 2 || room.match.status !== "playing") {
      room.phase = "waiting";
      return;
    }

    room.phase = "playing";
    startRoomInterval(room);
    io.to(room.code).emit("room:status", toPublicRoomStatus(room, {
      message: "Fight",
      reason: "countdown"
    }));
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
