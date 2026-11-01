import fs from 'fs';
import zlib from 'zlib';

function decodePng(path) {
  const buf = fs.readFileSync(path);
  let i = 8;
  let w, h, bitDepth, colorType, idat = Buffer.alloc(0);
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.slice(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat = Buffer.concat([idat, data]);
    }
    i += 12 + len;
  }
  const raw = zlib.inflateSync(idat);
  const bytesPerPixel = colorType === 2 ? 3 : (colorType === 6 ? 4 : 1);
  const stride = w * bytesPerPixel;
  const out = [];
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = out[y - 1] || new Uint8Array(stride);
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? cur[x - bytesPerPixel] : 0;
      const b = prev[x];
      const c = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      let v;
      if (filter === 0) v = row[x];
      else if (filter === 1) v = row[x] + a;
      else if (filter === 2) v = row[x] + b;
      else if (filter === 3) v = row[x] + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - a - b);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        v = row[x] + pr;
      }
      cur[x] = v & 0xff;
    }
    out.push(cur);
  }
  return { w, h, bytesPerPixel, rows: out };
}

function pixel(rows, x, y, bpp) {
  const i = y * rows[0].length + x * bpp;
  return [rows[y][i], rows[y][i + 1], rows[y][i + 2]];
}

function summarize(path, label) {
  const p = decodePng(path);
  const { w, h, rows, bytesPerPixel } = p;
  // Sample a grid, count non-background pixels
  let dark = 0, light = 0, amber = 0, total = 0;
  const sample = 4;
  for (let y = 0; y < h; y += sample) {
    for (let x = 0; x < w; x += sample) {
      const [r, g, b] = pixel(rows, x, y, bytesPerPixel);
      total++;
      if (r < 40 && g < 40 && b < 40) dark++;
      if (r > 200 && g > 200 && b > 200) light++;
      if (r > 200 && g > 120 && b < 60) amber++;
    }
  }
  // Find bounding box of non-background content
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const [r, g, b] = pixel(rows, x, y, bytesPerPixel);
      if (r > 10 || g > 10 || b > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`${label}: ${w}x${h} dark=${dark} light=${light} amber=${amber}/${total} contentBox=x[${minX}-${maxX}] y[${minY}-${maxY}]`);
  return p;
}

const [,, file, label] = process.argv;
summarize(file, label || file);