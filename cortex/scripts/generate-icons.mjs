// Génère les icônes PWA (PNG) sans dépendance externe : encodeur PNG minimal
// (RGBA 8 bits, un seul IDAT, filtre "none") + un motif géométrique simple
// (cible / focus) dessiné pixel par pixel. À relancer si tu changes la charte.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [17, 19, 24]; // #111318
const FG = [124, 156, 255]; // bleu clair d'accent

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = makeTable());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function makeTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function drawTarget(size, { maskableSafeZone = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // Zone de sécurité maskable : le contenu significatif doit tenir dans ~80% du canvas.
  const maxR = size * (maskableSafeZone ? 0.32 : 0.4);
  const ringWidth = size * 0.055;
  const rings = [maxR, maxR * 0.62, maxR * 0.24];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let color = BG;
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        const onRing = Math.abs(dist - r) < ringWidth / 2;
        const filledCenter = i === rings.length - 1 && dist < r;
        if (onRing || filledCenter) {
          color = FG;
          break;
        }
      }
      const idx = (y * size + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

function encodePNG(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter: none
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL("../public/icons", import.meta.url), { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
];

for (const t of targets) {
  const pixels = drawTarget(t.size, { maskableSafeZone: t.maskable });
  const png = encodePNG(t.size, pixels);
  const path = new URL(`../public/icons/${t.name}`, import.meta.url);
  writeFileSync(path, png);
  console.log(`✓ ${t.name} (${t.size}x${t.size}, ${png.length} octets)`);
}
