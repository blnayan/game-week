import { sendAck } from "./rooms.js";

export function sendLatencyAck(ack) {
  sendAck(ack, { ok: true });
}
