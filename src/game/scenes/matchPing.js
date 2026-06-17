export function getMatchPingMs(mode, net) {
  if (mode === "cpu") return 0;
  return net?.getPingMs?.() ?? 0;
}
