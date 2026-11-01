import fs from 'fs';
import zlib from 'zlib';

function decode(path) {
  const buf = fs.readFileSync(path);
  let i = 8, w, h, bpp, idat = Buffer.alloc(0);
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.slice(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); const colorType = data[9]; bpp = colorType === 2 ? 3 : (colorType === 6 ? 4 : 1); }
    else if (type === 'IDAT') idat = Buffer.concat([idat, data]);
    i += 12 + len;
  }
  const raw = zlib.inflateSync(idat);
  const stride = w * bpp;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = rows[y - 1] || new Uint8Array(stride);
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v;
      if (filter === 0) v = row[x];
      else if (filter === 1) v = row[x] + a;
      else if (filter === 2) v = row[x] + b;
      else if (filter === 3) v = row[x] + ((a + b) >> 1);
      else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - a - b); const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); v = row[x] + pr; }
      cur[x] = v & 0xff;
    }
    rows.push(cur);
  }
  return { w, h, bpp, rows };
}

function px(rows, x, y, bpp) {
  const row = rows[y];
  const i = x * bpp;
  return [row[i], row[i + 1], row[i + 2]];
}

function scan(path, label) {
  const p = decode(path);
  const { w, h, rows, bpp } = p;
  const bg = px(rows, 5, 5, bpp);
  let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
  const hist = {};
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const c = px(rows, x, y, bpp);
      if (c[0] !== bg[0] || c[1] !== bg[1] || c[2] !== bg[2]) {
        count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        const key = c.join(',');
        hist[key] = (hist[key] || 0) + 1;
      }
    }
  }
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c}:${n}`).join(' ');
  console.log(`${label} bg=${JSON.stringify(bg)} nonBg=${count} box=x[${minX}-${maxX}] y[${minY}-${maxY}] topColors=${top}`);
}

for (const f of ['src_frame_1.png', 'frame_0.png', 'frame_1.png', 'frame_3.5.png']) {
  scan('C:/tmp/aud/' + f, f);
}