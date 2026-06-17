import { describe, expect, it } from "vitest";

import { resolveProfileConfig } from "../../scripts/profileMultiplayerConfig.mjs";

describe("multiplayer profiler config", () => {
  it("defaults to spawning a local server on the configured profile port", () => {
    expect(resolveProfileConfig({ PROFILE_PORT: "4500" })).toMatchObject({
      serverUrl: "http://127.0.0.1:4500",
      shouldStartLocalServer: true,
      dockerContainerName: ""
    });
  });

  it("targets a public server URL without spawning a local server", () => {
    expect(
      resolveProfileConfig({
        PROFILE_SERVER_URL: "https://pixelarenafighter.nayanbhut.dev/",
        PROFILE_DOCKER_CONTAINER: "pixel-arena-fighter-web"
      })
    ).toMatchObject({
      serverUrl: "https://pixelarenafighter.nayanbhut.dev",
      shouldStartLocalServer: false,
      dockerContainerName: "pixel-arena-fighter-web"
    });
  });
});
