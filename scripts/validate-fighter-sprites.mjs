import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const EXPECTED = {
  frameWidth: 128,
  frameHeight: 128,
  frames: 12,
  width: 128 * 12,
  height: 128,
  signature: "89504e470d0a1a0a"
};

const EXPECTED_VISIBLE_HEIGHTS = [76, 76, 76, 76, 76, 76, 84, 76, 108, 82, 76, 76];

function parsePng(path) {
  const png = readFileSync(path);
  const signature = png.subarray(0, 8).toString("hex");

  if (signature !== EXPECTED.signature) {
    throw new Error(`${path} is not a PNG file`);
  }

  let offset = 8;
  let header = null;
  const idat = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += length + 12;
  }

  if (!header) {
    throw new Error(`${path} is missing a PNG header`);
  }
  if (
    header.width !== EXPECTED.width ||
    header.height !== EXPECTED.height
  ) {
    throw new Error(
      `${path} must be ${EXPECTED.width}x${EXPECTED.height}, got ${header.width}x${header.height}`
    );
  }
  if (header.bitDepth !== 8 || header.colorType !== 6) {
    throw new Error(`${path} must be 8-bit RGBA PNG data`);
  }
  if (header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error(`${path} must be a non-interlaced PNG with standard compression/filter methods`);
  }

  return { ...header, rgba: decodeRgba(path, header, idat) };
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodeRgba(path, header, idat) {
  const bytesPerPixel = 4;
  const stride = header.width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(header.height * stride);
  let sourceOffset = 0;

  for (let y = 0; y < header.height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? rgba[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? rgba[rowStart + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? rgba[rowStart + x - stride - bytesPerPixel] : 0;

      if (filter === 0) {
        rgba[rowStart + x] = raw;
      } else if (filter === 1) {
        rgba[rowStart + x] = (raw + left) & 255;
      } else if (filter === 2) {
        rgba[rowStart + x] = (raw + up) & 255;
      } else if (filter === 3) {
        rgba[rowStart + x] = (raw + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        rgba[rowStart + x] = (raw + paeth(left, up, upLeft)) & 255;
      } else {
        throw new Error(`${path} has unsupported PNG row filter ${filter}`);
      }
    }

    sourceOffset += stride;
  }

  return rgba;
}

function alphaAt(rgba, width, x, y) {
  return rgba[(y * width + x) * 4 + 3];
}

for (const name of ["blue", "orange", "violet"]) {
  const path = `public/assets/fighters/${name}.png`;
  const { width, height, rgba } = parsePng(path);
  let transparentPixels = 0;
  let opaquePixels = 0;

  for (let frame = 0; frame < EXPECTED.frames; frame += 1) {
    let frameOpaquePixels = 0;
    let edgePixels = 0;
    const frameX = frame * EXPECTED.frameWidth;
    let top = EXPECTED.frameHeight;
    let bottom = -1;

    for (let y = 0; y < EXPECTED.frameHeight; y += 1) {
      for (let x = 0; x < EXPECTED.frameWidth; x += 1) {
        const alpha = alphaAt(rgba, width, frameX + x, y);
        if (alpha === 0) transparentPixels += 1;
        if (alpha > 0) {
          opaquePixels += 1;
          frameOpaquePixels += 1;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          if (
            x === 0 ||
            y === 0 ||
            x === EXPECTED.frameWidth - 1 ||
            y === EXPECTED.frameHeight - 1
          ) {
            edgePixels += 1;
          }
        }
      }
    }

    if (frameOpaquePixels < 64) {
      throw new Error(`${path} frame ${frame} has too little visible sprite content`);
    }
    if (edgePixels > 0) {
      throw new Error(`${path} frame ${frame} has ${edgePixels} opaque pixels touching the frame edge`);
    }
    const visibleHeight = bottom - top + 1;
    if (visibleHeight !== EXPECTED_VISIBLE_HEIGHTS[frame]) {
      throw new Error(
        `${path} frame ${frame} must be ${EXPECTED_VISIBLE_HEIGHTS[frame]}px tall, got ${visibleHeight}px`
      );
    }
  }

  const totalPixels = width * height;
  if (transparentPixels < totalPixels * 0.45) {
    throw new Error(`${path} does not have enough transparent padding`);
  }
  if (opaquePixels < totalPixels * 0.02) {
    throw new Error(`${path} does not have enough visible sprite content`);
  }

  console.log(`${path}: ${width}x${height}, ${opaquePixels} opaque pixels, no frame-edge clipping`);
}
