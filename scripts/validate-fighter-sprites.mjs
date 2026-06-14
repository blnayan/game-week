import { readFileSync } from "node:fs";

const EXPECTED = {
  width: 1408,
  height: 128,
  signature: "89504e470d0a1a0a"
};

for (const name of ["blue", "orange", "violet"]) {
  const path = `public/assets/fighters/${name}.png`;
  const png = readFileSync(path);
  const signature = png.subarray(0, 8).toString("hex");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];

  if (signature !== EXPECTED.signature) {
    throw new Error(`${path} is not a PNG file`);
  }
  if (width !== EXPECTED.width || height !== EXPECTED.height) {
    throw new Error(`${path} must be ${EXPECTED.width}x${EXPECTED.height}, got ${width}x${height}`);
  }
  if (colorType !== 6 && colorType !== 4) {
    throw new Error(`${path} must include an alpha channel, got PNG color type ${colorType}`);
  }

  console.log(`${path}: ${width}x${height}, alpha color type ${colorType}`);
}
