const ROOM_CODE_PATTERN = /^[A-Z0-9]$/;
const MAX_ROOM_CODE_LENGTH = 5;

export function updateRoomCodeEntry(code, key) {
  const current = String(code || "").toUpperCase();
  const normalizedKey = String(key || "").toUpperCase();

  if (normalizedKey === "BACKSPACE") return current.slice(0, -1);
  if (!ROOM_CODE_PATTERN.test(normalizedKey) || current.length >= MAX_ROOM_CODE_LENGTH) return current;

  return `${current}${normalizedKey}`;
}
