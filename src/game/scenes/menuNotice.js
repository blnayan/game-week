import { getInitialRoomCode } from "../net/roomLinks.js";

export function getMenuNoticeText(data = {}) {
  const notice = typeof data.notice === "string" ? data.notice.trim() : "";
  return notice.slice(0, 80);
}

export function getMenuInitialRoomCode(data = {}, href = globalThis.location?.href) {
  return data.skipInitialRoomJoin ? "" : getInitialRoomCode(href);
}
