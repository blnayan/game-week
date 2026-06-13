import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 3000);
const distPath = path.resolve(__dirname, "../dist");

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pixel-arena-fighter" });
});

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

server.listen(port, () => {
  console.log(`Pixel Arena Fighter server listening on ${port}`);
});
