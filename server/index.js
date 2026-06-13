import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { FIXED_DT_MS } from "../shared/constants.js";
import { createMatch, queueInput, stepMatch } from "../shared/match.js";
import { createRoomCode, toPublicSnapshot } from "../shared/rooms.js";

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
    rooms.set(code, room);
    joinRoom(socket, room, ack);
  });

  socket.on("room:join", ({ code }, ack) => {
    const normalized = String(code || "").trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return ack?.({ ok: false, error: "Room not found" });
    if (room.players.size >= 2 && !room.players.has(socket.id)) return ack?.({ ok: false, error: "Room is full" });
    joinRoom(socket, room, ack);
  });

  socket.on("match:input", ({ roomCode, input }) => {
    const room = rooms.get(roomCode);
    const playerId = room?.players.get(socket.id);
    if (!room || !playerId) return;
    queueInput(room.match, playerId, input);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      if (!room.players.has(socket.id)) continue;
      const playerId = room.players.get(socket.id);
      room.players.delete(socket.id);
      io.to(room.code).emit("room:status", { message: `${playerId} disconnected`, players: room.players.size });
      if (room.players.size === 0) {
        clearInterval(room.interval);
        rooms.delete(room.code);
      }
    }
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
  }, FIXED_DT_MS);
  return room;
}

function joinRoom(socket, room, ack) {
  socket.join(room.code);
  const existingSlots = new Set(room.players.values());
  const playerId = existingSlots.has("p1") ? "p2" : "p1";
  room.players.set(socket.id, playerId);
  ack?.({ ok: true, roomCode: room.code, playerId });
  io.to(room.code).emit("room:status", { message: "Player joined", players: room.players.size, roomCode: room.code });
  socket.emit("match:snapshot", toPublicSnapshot(room.match));
}

server.listen(port, () => {
  console.log(`Pixel Arena Fighter server listening on ${port}`);
});
