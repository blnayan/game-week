import { getMatchPingMs } from "./matchPing.js";

export function getMatchHudMeta({ mode, roomCode, status, net }) {
  return {
    mode,
    roomCode,
    status,
    pingMs: getMatchPingMs(mode, net)
  };
}
