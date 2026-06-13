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

export function toPublicSnapshot(match) {
  return {
    status: match.status,
    winnerId: match.winnerId,
    elapsedMs: Math.round(match.elapsedMs),
    effects: match.effects,
    fighters: match.fighters
  };
}
