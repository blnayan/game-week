export function createRoomCode(existingCodes = new Set()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  throw new Error("Unable to allocate room code");
}

export function normalizeRoomCode(payload) {
  return String(payload?.code || "").trim().toUpperCase();
}

export function assignPlayerId(players, socketId) {
  const existingPlayerId = players.get(socketId);
  if (existingPlayerId) return existingPlayerId;

  const existingSlots = new Set(players.values());
  return existingSlots.has("p1") ? "p2" : "p1";
}

export function canJoinRoom(room, socketId) {
  if (room.match.status === "complete") return { ok: false, error: "Room is complete" };
  if (room.players.size >= 2 && !room.players.has(socketId)) return { ok: false, error: "Room is full" };
  return { ok: true };
}

export function removeSocketFromRooms(rooms, socketId, exceptRoomCode = null) {
  const removed = [];

  for (const room of rooms.values()) {
    if (room.code === exceptRoomCode || !room.players.has(socketId)) continue;

    const playerId = room.players.get(socketId);
    room.players.delete(socketId);
    removed.push({
      room,
      code: room.code,
      playerId,
      players: room.players.size,
      emptied: room.players.size === 0
    });
  }

  return removed;
}

export function sendAck(ack, payload) {
  if (typeof ack !== "function") return false;
  ack(payload);
  return true;
}

export function toPublicSnapshot(match) {
  return {
    status: match.status,
    winnerId: match.winnerId,
    elapsedMs: Math.round(match.elapsedMs),
    effects: match.effects,
    fighters: match.fighters
  };
}
