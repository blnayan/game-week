import { spawn, execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { io } from "socket.io-client";

const roomCount = Number(process.env.PROFILE_ROOMS || 16);
const durationMs = Number(process.env.PROFILE_DURATION_MS || 15000);
const inputHz = Number(process.env.PROFILE_INPUT_HZ || 60);
const port = Number(process.env.PROFILE_PORT || 4317);
const serverUrl = `http://127.0.0.1:${port}`;

const samples = {
  snapshots: [],
  payloadBytes: [],
  cpu: [],
  rssMb: [],
  createAckMs: [],
  joinAckMs: []
};

const serverProcess = spawn(process.execPath, ["server/index.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverOutput = "";
serverProcess.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
serverProcess.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

process.on("exit", () => {
  serverProcess.kill();
});

try {
  await waitForServer();
  const rooms = await createRooms();
  const inputTimer = startInputLoop(rooms);
  const psTimer = startProcessSampler();

  await waitForPlaying(rooms);
  const measurementStart = performance.now();
  await delay(durationMs);
  const measurementEnd = performance.now();

  clearInterval(inputTimer);
  clearInterval(psTimer);
  for (const room of rooms) {
    room.p1.disconnect();
    room.p2.disconnect();
  }

  printReport({
    roomCount,
    clients: roomCount * 2,
    durationMs: measurementEnd - measurementStart,
    inputHz,
    snapshotIntervals: getSnapshotIntervals(samples.snapshots),
    payloadBytes: samples.payloadBytes,
    cpu: samples.cpu,
    rssMb: samples.rssMb,
    createAckMs: samples.createAckMs,
    joinAckMs: samples.joinAckMs
  });
} catch (error) {
  console.error(error.message);
  if (serverOutput.trim()) {
    console.error("\nServer output:");
    console.error(serverOutput.trim());
  }
  process.exitCode = 1;
} finally {
  serverProcess.kill();
}

async function waitForServer() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${serverUrl}/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the child server is listening.
    }
    await delay(100);
  }
  throw new Error(`Server did not start on ${serverUrl}`);
}

async function createRooms() {
  const rooms = [];
  for (let i = 0; i < roomCount; i += 1) {
    const p1 = createClient(`room-${i}-p1`);
    const p2 = createClient(`room-${i}-p2`);
    await Promise.all([p1.connected, p2.connected]);

    const createStart = performance.now();
    const createAck = await emitWithAck(p1.socket, "room:create", {});
    samples.createAckMs.push(performance.now() - createStart);
    if (!createAck.ok) throw new Error(`room:create failed: ${createAck.error}`);

    const joinStart = performance.now();
    const joinAck = await emitWithAck(p2.socket, "room:join", { code: createAck.roomCode });
    samples.joinAckMs.push(performance.now() - joinStart);
    if (!joinAck.ok) throw new Error(`room:join failed: ${joinAck.error}`);

    rooms.push({ code: createAck.roomCode, p1, p2 });
  }
  return rooms;
}

function createClient(label) {
  const socket = io(serverUrl, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 4000
  });
  let lastSnapshotAt = null;

  const connected = new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  socket.on("match:snapshot", (snapshot) => {
    const now = performance.now();
    if (snapshot.phase === "playing") {
      samples.payloadBytes.push(Buffer.byteLength(JSON.stringify(snapshot)));
      if (lastSnapshotAt !== null) {
        samples.snapshots.push({ label, intervalMs: now - lastSnapshotAt });
      }
      lastSnapshotAt = now;
    }
  });

  return {
    socket,
    connected,
    disconnect: () => socket.disconnect()
  };
}

async function waitForPlaying(rooms) {
  const pending = new Set(rooms.map((room) => room.code));
  const deadline = Date.now() + 8000;

  for (const room of rooms) {
    const markPlaying = (status) => {
      if (status.phase === "playing") pending.delete(room.code);
    };
    room.p1.socket.on("room:status", markPlaying);
  }

  while (pending.size > 0 && Date.now() < deadline) {
    await delay(100);
  }
  if (pending.size > 0) throw new Error(`Timed out waiting for ${pending.size} rooms to enter playing phase`);
}

function startInputLoop(rooms) {
  let tick = 0;
  return setInterval(() => {
    tick += 1;
    for (const room of rooms) {
      room.p1.socket.emit("match:input", {
        roomCode: room.code,
        input: {
          right: tick % 120 < 60,
          left: tick % 120 >= 60,
          jump: tick % 45 === 0,
          light: tick % 50 === 0,
          heavy: tick % 95 === 0
        }
      });
      room.p2.socket.emit("match:input", {
        roomCode: room.code,
        input: {
          left: tick % 120 < 60,
          right: tick % 120 >= 60,
          jump: tick % 52 === 0,
          light: tick % 47 === 0,
          heavy: tick % 101 === 0
        }
      });
    }
  }, 1000 / inputHz);
}

function startProcessSampler() {
  return setInterval(() => {
    const stats = readProcessStats(serverProcess.pid);
    if (!stats) return;
    samples.cpu.push(stats.cpu);
    samples.rssMb.push(stats.rssMb);
  }, 500);
}

function readProcessStats(pid) {
  try {
    const output = execFileSync("ps", ["-o", "%cpu=", "-o", "rss=", "-p", String(pid)], {
      encoding: "utf8"
    }).trim();
    if (!output) return null;
    const [cpu, rssKb] = output.split(/\s+/).map(Number);
    return { cpu, rssMb: rssKb / 1024 };
  } catch {
    return null;
  }
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 4000);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function getSnapshotIntervals(snapshotSamples) {
  return snapshotSamples.map((sample) => sample.intervalMs);
}

function printReport(report) {
  const snapshotCount = report.snapshotIntervals.length;
  const expectedSnapshots = Math.round((report.durationMs / 1000) * 60 * report.clients);

  console.log("Multiplayer performance profile");
  console.log(`Rooms: ${report.roomCount}`);
  console.log(`Clients: ${report.clients}`);
  console.log(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
  console.log(`Input rate: ${report.inputHz}Hz per client`);
  console.log(`Snapshot samples: ${snapshotCount} / ~${expectedSnapshots} expected`);
  console.log(`Snapshot interval avg: ${mean(report.snapshotIntervals).toFixed(2)}ms`);
  console.log(`Snapshot interval p95: ${percentile(report.snapshotIntervals, 95).toFixed(2)}ms`);
  console.log(`Snapshot payload avg: ${mean(report.payloadBytes).toFixed(0)} bytes`);
  console.log(`Snapshot payload p95: ${percentile(report.payloadBytes, 95).toFixed(0)} bytes`);
  console.log(`Create room ack avg: ${mean(report.createAckMs).toFixed(2)}ms`);
  console.log(`Join room ack avg: ${mean(report.joinAckMs).toFixed(2)}ms`);
  console.log(`Server CPU avg: ${mean(report.cpu).toFixed(1)}%`);
  console.log(`Server CPU max: ${Math.max(...report.cpu).toFixed(1)}%`);
  console.log(`Server RSS avg: ${mean(report.rssMb).toFixed(1)}MB`);
  console.log(`Server RSS max: ${Math.max(...report.rssMb).toFixed(1)}MB`);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}
