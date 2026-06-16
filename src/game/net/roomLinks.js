export function normalizeUrlRoomCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{5}$/.test(code) ? code : "";
}

export function getInitialRoomCode(href = globalThis.location?.href) {
  try {
    const url = new URL(href);
    return normalizeUrlRoomCode(url.searchParams.get("room") || url.searchParams.get("code"));
  } catch {
    return "";
  }
}

export function buildRoomLink(roomCode, href = globalThis.location?.href) {
  const code = normalizeUrlRoomCode(roomCode);
  if (!code) return "";

  const url = new URL(href || "/", globalThis.location?.origin || "http://localhost");
  url.searchParams.set("room", code);
  return url.toString();
}

export function shouldClearRoomCodeAfterJoin(mode) {
  return mode === "online-join";
}

export function clearRoomCodeFromUrl() {
  if (!globalThis.location || !globalThis.history?.replaceState) return;

  const url = new URL(globalThis.location.href);
  url.searchParams.delete("room");
  url.searchParams.delete("code");
  globalThis.history.replaceState({}, "", url.toString());
}
