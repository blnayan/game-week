import { canCreateStageAtLevel, normalizeStageId } from "./stages.js";

export const INPUT_FIELDS = [
  "left",
  "right",
  "up",
  "down",
  "jump",
  "light",
  "heavy",
  "special",
  "dodge",
  "shield"
];

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

export function canCreateRoomWithStage(payload = {}) {
  const stageId = normalizeStageId(payload.stageId);
  const allowed = canCreateStageAtLevel(stageId, payload.playerLevel);
  if (!allowed.ok) return allowed;
  return { ok: true, stageId };
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

export function canCloseRoom(room, socketId) {
  if (!room || !room.players.has(socketId)) return { ok: false, error: "Room not found" };
  if (room.match.status !== "complete") return { ok: false, error: "Room is still active" };
  return { ok: true };
}

export function canResumeRoomPause(room, playerId) {
  if (room?.phase !== "paused") return { ok: false, error: "Room is not paused" };
  if (!room.pausedBy || !playerId) return { ok: false, error: "Only the pausing player can resume" };
  if (room.pausedBy !== playerId) return { ok: false, error: "Only the pausing player can resume" };
  return { ok: true };
}

export function recordRematchRequest(room, socketId) {
  if (!room || !room.players.has(socketId)) return { ok: false, error: "Room not found" };
  if (room.players.size < 2) return { ok: false, error: "Opponent left" };
  if (room.match.status !== "complete") return { ok: false, error: "Rematch unavailable" };

  room.rematchRequests ??= new Set();
  const activeSocketIds = new Set(room.players.keys());
  room.rematchRequests = new Set([...room.rematchRequests].filter((id) => activeSocketIds.has(id)));
  room.rematchRequests.add(socketId);

  const requested = room.rematchRequests.size;
  const required = room.players.size;
  return { ok: true, ready: requested >= required, requested, required };
}

export function createRematchRequestStatus(room, requestedBy, rematch) {
  return toPublicRoomStatus(room, {
    message: `${requestedBy} wants a rematch`,
    reason: "rematch",
    rematch: {
      requestedBy,
      requested: rematch.requested,
      required: rematch.required
    }
  });
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

export function shouldForfeitOnDisconnect(room) {
  return room?.match?.status === "playing" && ["playing", "paused"].includes(room?.phase);
}

export function shouldDeleteRoomAfterSocketRemoval(removal) {
  return Boolean(removal?.emptied);
}

export function shouldResetRoomToWaitingAfterSocketRemoval(removal) {
  return Boolean(!removal?.emptied && removal?.room?.phase === "countdown");
}

export function shouldRunRoomInterval(room) {
  return room?.match?.status === "playing" && room?.phase === "playing" && room?.players?.size >= 2;
}

export function sendAck(ack, payload) {
  if (typeof ack !== "function") return false;
  ack(payload);
  return true;
}

export function toPublicRoomStatus(room, { message = "", reason = null, rematch = null } = {}) {
  return {
    message,
    reason,
    roomCode: room?.code ?? "",
    players: room?.players?.size ?? 0,
    phase: room?.phase ?? null,
    status: room?.match?.status ?? null,
    stageId: room?.match?.stageId ?? null,
    pausedBy: room?.pausedBy ?? null,
    rematch: {
      requestedBy: rematch?.requestedBy ?? null,
      requested: rematch?.requested ?? room?.rematchRequests?.size ?? 0,
      required: rematch?.required ?? room?.players?.size ?? 0
    }
  };
}

export function sanitizeMatchInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const sanitized = {};
  for (const field of INPUT_FIELDS) {
    if (typeof input[field] === "boolean") sanitized[field] = input[field];
  }
  return sanitized;
}

export function createInputRateGuard({ limit = 120, windowMs = 1000 } = {}) {
  const sockets = new Map();

  return {
    allow(socketId, now = Date.now()) {
      const state = sockets.get(socketId);
      if (!state || now - state.windowStart >= windowMs) {
        sockets.set(socketId, { windowStart: now, count: 1 });
        return true;
      }

      if (state.count >= limit) return false;
      state.count += 1;
      return true;
    },
    clear(socketId) {
      sockets.delete(socketId);
    }
  };
}

export function toPublicSnapshot(match, { phase } = {}) {
  return {
    status: match.status,
    ...(phase ? { phase } : {}),
    stageId: match.stageId,
    winnerId: match.winnerId,
    endReason: match.endReason ?? null,
    elapsedMs: Math.round(match.elapsedMs),
    effects: match.effects,
    fighters: match.fighters
  };
}
