export function resolveProfileConfig(env = process.env) {
  const port = Number(env.PROFILE_PORT || 4317);
  const publicServerUrl = normalizeServerUrl(env.PROFILE_SERVER_URL || "");

  return {
    roomCount: Number(env.PROFILE_ROOMS || 16),
    durationMs: Number(env.PROFILE_DURATION_MS || 15000),
    inputHz: Number(env.PROFILE_INPUT_HZ || 60),
    port,
    serverUrl: publicServerUrl || `http://127.0.0.1:${port}`,
    shouldStartLocalServer: !publicServerUrl,
    dockerContainerName: env.PROFILE_DOCKER_CONTAINER || ""
  };
}

function normalizeServerUrl(value) {
  return value.trim().replace(/\/+$/, "");
}
