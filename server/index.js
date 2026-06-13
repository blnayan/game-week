import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { FIXED_DT_MS } from "../shared/constants.js";
import { createMatch, queueInput, stepMatch } from "../shared/match.js";
import {
  assignPlayerId,
  canJoinRoom,
  createRoomCode,
  normalizeRoomCode,
  removeSocketFromRooms,
  sendAck,
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

  socket.on("match:input", (payload) => {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const room = rooms.get(normalizeRoomCode({ code: safePayload.roomCode }));
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId || room.match.status === "complete") return;
    const input = safePayload.input && typeof safePayload.input === "object" ? safePayload.input : {};
    queueInput(room.match, playerId, input);
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
    interval: null
  };
  room.interval = setInterval(() => {
    if (room.players.size < 2) return;
    stepMatch(room.match, FIXED_DT_MS);
    io.to(room.code).emit("match:snapshot", toPublicSnapshot(room.match));
    if (room.match.status === "complete") {
      stopRoomInterval(room);
    }
  }, FIXED_DT_MS);
  return room;
}

function joinRoom(socket, room, ack) {
  socket.join(room.code);
  const playerId = assignPlayerId(room.players, socket.id);
  room.players.set(socket.id, playerId);
  sendAck(ack, { ok: true, roomCode: room.code, playerId });
  io.to(room.code).emit("room:status", { message: "Player joined", players: room.players.size, roomCode: room.code });
  socket.emit("match:snapshot", toPublicSnapshot(room.match));
}

function releaseSocketFromGameRooms(socket, exceptRoomCode = null) {
  const removals = removeSocketFromRooms(rooms, socket.id, exceptRoomCode);
  for (const removal of removals) {
    io.to(removal.code).emit("room:status", { message: `${removal.playerId} disconnected`, players: removal.players });
    socket.leave(removal.code);
    if (removal.emptied) {
      stopRoomInterval(removal.room);
      rooms.delete(removal.code);
    }
  }
}

function stopRoomInterval(room) {
  if (!room.interval) return;
  clearInterval(room.interval);
  room.interval = null;
}

server.listen(port, () => {
  console.log(`Pixel Arena Fighter server listening on ${port}`);
});
