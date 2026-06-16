export function canOfferOnlineRematch({ isOnline, endReason, roomPlayers }) {
  if (!isOnline || roomPlayers < 2) return false;
  return endReason !== "disconnect";
}

export function getResultStatusText({ endReason, isOnline, roomCode }) {
  if (endReason === "disconnect") return "Room disconnected";
  if (endReason === "forfeit") return "Match forfeited";
  return isOnline ? `Room ${roomCode}` : "";
}

export function getResultRoomStatusText(status = {}, { playerId, roomCode } = {}) {
  if (status.rematch?.requestedBy) {
    return status.rematch.requestedBy === playerId ? "Waiting for opponent..." : "Opponent wants a rematch";
  }

  return status.message || (roomCode ? `Room ${roomCode}` : "");
}

export function getRematchDisplayState(status = {}, { playerId, roomCode } = {}) {
  const opponentRequested = Boolean(status.rematch?.requestedBy && status.rematch.requestedBy !== playerId);

  return {
    statusText: getResultRoomStatusText(status, { playerId, roomCode }),
    buttonLabel: "Rematch",
    opponentRequested
  };
}

export function shouldHideOnlineRematchOnStatus(status = {}) {
  return status.message === "Room disconnected" || status.players < 2;
}

export function getResultMenuSceneData() {
  return { skipInitialRoomJoin: true };
}

export function getOnlineRematchSceneData({ roomCode, playerId, roomPlayers, net }) {
  return {
    mode: "online-rematch",
    roomCode,
    playerId,
    roomPlayers: roomPlayers || 2,
    net
  };
}
