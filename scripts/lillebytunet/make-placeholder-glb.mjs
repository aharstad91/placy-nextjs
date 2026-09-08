/**
 * Lager placeholder-GLB for Lillebytunet-demoen: en teksturert boks der hver
 * side bærer sitt eget aksenavn (+X, -X, +Y, -Y, +Z, -Z) i egen farge.
 *
 * Hensikten er å måle aksekonvensjonen til Google Maps 3D empirisk. Modellen
 * er skrevet for hånd fordi Google-motoren ikke støtter noen glTF-utvidelser:
 * boksen er ren kjerne-glTF 2.0 (én mesh, én primitive, én PBR-material, én
 * PNG i BIN-chunken). Ingen Draco, ingen KHR_*.
 *
 * Kjør: node scripts/lillebytunet/make-placeholder-glb.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ── Mål i meter. X = lengde, Y = høyde (glTF-konvensjonen er +Y opp), Z = dybde.
const SIZE = { x: 30, y: 15, z: 20 };

// ── 5×7 bitmapfont. Bare tegnene etikettene trenger.
const GLYPHS = {
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  "-": ["     ", "     ", "     ", "#####", "     ", "     ", "     "],
  X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
};

const CELL = 128;
const COLS = 3;
const ROWS = 2;
const ATLAS_W = CELL * COLS;
const ATLAS_H = CELL * ROWS;

/**
 * Sidene i atlaset. `cell` er [kolonne, rad]; `normal` er flatens normal i
 * modellrommet; `label` er teksten som males på.
 */
const FACES = [
  { key: "+X", cell: [0, 0], color: [0xe2, 0x45, 0x3c], normal: [1, 0, 0] },
  { key: "-X", cell: [1, 0], color: [0x2f, 0x6f, 0xd0], normal: [-1, 0, 0] },
  { key: "+Z", cell: [2, 0], color: [0x2f, 0x9e, 0x4f], normal: [0, 0, 1] },
  { key: "-Z", cell: [0, 1], color: [0xf4, 0xc0, 0x20], normal: [0, 0, -1] },
  { key: "+Y", cell: [1, 1], color: [0xf5, 0xf5, 0xf2], normal: [0, 1, 0] },
  { key: "-Y", cell: [2, 1], color: [0x33, 0x33, 0x38], normal: [0, -1, 0] },
];

// ── Atlas ────────────────────────────────────────────────────────────────────

function makeAtlas() {
  const px = Buffer.alloc(ATLAS_W * ATLAS_H * 3);
  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= ATLAS_W || y >= ATLAS_H) return;
    const i = (y * ATLAS_W + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };

  for (const face of FACES) {
    const [col, row] = face.cell;
    const x0 = col * CELL;
    const y0 = row * CELL;
    const lum = (face.color[0] * 299 + face.color[1] * 587 + face.color[2] * 114) / 1000;
    const ink = lum > 140 ? [20, 20, 24] : [250, 250, 250];
    const edge = face.color.map((c) => Math.round(c * 0.55));

    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const onBorder = x < 5 || y < 5 || x >= CELL - 5 || y >= CELL - 5;
        put(x0 + x, y0 + y, onBorder ? edge : face.color);
      }
    }

    // Etiketten, sentrert. Skalaen velges så to tegn får plass i cellen.
    const chars = [...face.key];
    const scale = 9;
    const gap = 6;
    const glyphW = 5 * scale;
    const glyphH = 7 * scale;
    const totalW = chars.length * glyphW + (chars.length - 1) * gap;
    const startX = x0 + Math.round((CELL - totalW) / 2);
    const startY = y0 + Math.round((CELL - glyphH) / 2);
    chars.forEach((ch, idx) => {
      const rows = GLYPHS[ch];
      if (!rows) throw new Error(`Mangler glyph for «${ch}»`);
      const gx = startX + idx * (glyphW + gap);
      rows.forEach((line, ry) => {
        [...line].forEach((cellChar, rx) => {
          if (cellChar !== "#") return;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              put(gx + rx * scale + sx, startY + ry * scale + sy, ink);
            }
          }
        });
      });
    });

    // Bunnstripe: markerer hvilken kant som er modellens nedside, slik at roll
    // kan leses av på et skjermbilde. UV-ene er lagt slik at «ned i cellen» =
    // modellens -Y for sideflatene.
    for (let y = CELL - 16; y < CELL - 5; y++) {
      for (let x = 8; x < CELL - 8; x++) put(x0 + x, y0 + y, ink);
    }
  }

  // PNG: 8-bit truecolor, filter 0 per scanline.
  const raw = Buffer.alloc((ATLAS_W * 3 + 1) * ATLAS_H);
  for (let y = 0; y < ATLAS_H; y++) {
    raw[y * (ATLAS_W * 3 + 1)] = 0;
    px.copy(raw, y * (ATLAS_W * 3 + 1) + 1, y * ATLAS_W * 3, (y + 1) * ATLAS_W * 3);
  }

  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ATLAS_W, 0);
  ihdr.writeUInt32BE(ATLAS_H, 4);
  ihdr[8] = 8; // bitdybde
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Geometri ─────────────────────────────────────────────────────────────────

/**
 * To rammer, samme boks.
 *
 * `gltf` er glTF-konvensjonen: +Y opp, bunnen i y = 0. Den er måleinstrumentet
 * — den viser hva Google faktisk gjør med aksene.
 *
 * `google` er rammen motoren viser seg å bruke: +X mot øst, +Y mot nord, +Z
 * opp, bunnen i z = 0. Det er rammen ekte modeller skal eksporteres i.
 */
function makeGeometry(frame) {
  const hx = SIZE.x / 2;

  if (frame === "google") {
    const hy = SIZE.z / 2; // nord–sør-utstrekningen
    const z1 = SIZE.y; // høyden
    // Sideflatenes hjørne 0 og 1 ligger nederst, så cellens nedside blir ned.
    const quads = {
      "+X": [[hx, -hy, 0], [hx, hy, 0], [hx, hy, z1], [hx, -hy, z1]],
      "-X": [[-hx, hy, 0], [-hx, -hy, 0], [-hx, -hy, z1], [-hx, hy, z1]],
      "+Y": [[hx, hy, 0], [-hx, hy, 0], [-hx, hy, z1], [hx, hy, z1]],
      "-Y": [[-hx, -hy, 0], [hx, -hy, 0], [hx, -hy, z1], [-hx, -hy, z1]],
      "+Z": [[-hx, -hy, z1], [hx, -hy, z1], [hx, hy, z1], [-hx, hy, z1]],
      "-Z": [[-hx, hy, 0], [hx, hy, 0], [hx, -hy, 0], [-hx, -hy, 0]],
    };
    return assemble(quads, [-hx, -hy, 0], [hx, hy, z1]);
  }

  const hz = SIZE.z / 2;
  const y1 = SIZE.y;

  // Hjørnene oppgis mot klokka sett fra utsiden, med første kant «nederst».
  const quads = {
    "+X": [[hx, 0, hz], [hx, 0, -hz], [hx, y1, -hz], [hx, y1, hz]],
    "-X": [[-hx, 0, -hz], [-hx, 0, hz], [-hx, y1, hz], [-hx, y1, -hz]],
    "+Z": [[-hx, 0, hz], [hx, 0, hz], [hx, y1, hz], [-hx, y1, hz]],
    "-Z": [[hx, 0, -hz], [-hx, 0, -hz], [-hx, y1, -hz], [hx, y1, -hz]],
    "+Y": [[-hx, y1, hz], [hx, y1, hz], [hx, y1, -hz], [-hx, y1, -hz]],
    "-Y": [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]],
  };

  return assemble(quads, [-hx, 0, -hz], [hx, y1, hz]);
}

function assemble(quads, min, max) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (const face of FACES) {
    const base = positions.length / 3;
    const [col, row] = face.cell;
    const u0 = col / COLS;
    const v0 = row / ROWS;
    const du = 1 / COLS;
    const dv = 1 / ROWS;
    // glTF har UV-origo øverst til venstre. Hjørne 0 og 1 er «nederste» kant,
    // og får derfor v = v0 + dv.
    const cellUv = [
      [u0, v0 + dv],
      [u0 + du, v0 + dv],
      [u0 + du, v0],
      [u0, v0],
    ];
    quads[face.key].forEach((p, i) => {
      positions.push(...p);
      normals.push(...face.normal);
      uvs.push(...cellUv[i]);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return { positions, normals, uvs, indices, min, max };
}

// ── GLB ──────────────────────────────────────────────────────────────────────

const pad4 = (n) => (4 - (n % 4)) % 4;

function buildGlb(frame) {
  const { positions, normals, uvs, indices, min, max } = makeGeometry(frame);
  const png = makeAtlas();

  const posBuf = Buffer.from(new Float32Array(positions).buffer);
  const nrmBuf = Buffer.from(new Float32Array(normals).buffer);
  const uvBuf = Buffer.from(new Float32Array(uvs).buffer);
  const idxBuf = Buffer.from(new Uint16Array(indices).buffer);

  const parts = [];
  let offset = 0;
  const push = (buf) => {
    const byteOffset = offset;
    parts.push(buf);
    offset += buf.length;
    const p = pad4(offset);
    if (p) {
      parts.push(Buffer.alloc(p));
      offset += p;
    }
    return { byteOffset, byteLength: buf.length };
  };

  const posView = push(posBuf);
  const nrmView = push(nrmBuf);
  const uvView = push(uvBuf);
  const idxView = push(idxBuf);
  const imgView = push(png);
  const bin = Buffer.concat(parts);

  const count = positions.length / 3;

  const gltf = {
    asset: { version: "2.0", generator: "placy/make-placeholder-glb" },
    scene: 0,
    scenes: [{ nodes: [0], name: "Lillebytunet placeholder" }],
    nodes: [{ mesh: 0, name: "placeholder-box" }],
    meshes: [
      {
        name: "box",
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    materials: [
      {
        name: "axis-atlas",
        doubleSided: false,
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0, texCoord: 0 },
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.75,
        },
      },
    ],
    textures: [{ sampler: 0, source: 0 }],
    // CLAMP_TO_EDGE så cellene ikke blør over i hverandre langs kantene.
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 4, mimeType: "image/png" }],
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: indices.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, ...posView, target: 34962 },
      { buffer: 0, ...nrmView, target: 34962 },
      { buffer: 0, ...uvView, target: 34962 },
      { buffer: 0, ...idxView, target: 34963 },
      { buffer: 0, ...imgView },
    ],
    buffers: [{ byteLength: bin.length }],
  };

  const jsonBuf = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length), 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc(pad4(bin.length), 0)]);

  const chunkOf = (data, type) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.write(type, 4, 4, "ascii");
    return Buffer.concat([head, data]);
  };
  const jsonChunk = chunkOf(jsonPad, "JSON");
  const binChunk = chunkOf(binPad, "BIN\0");

  const header = Buffer.alloc(12);
  header.write("glTF", 0, 4, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + jsonChunk.length + binChunk.length, 8);
  return Buffer.concat([header, jsonChunk, binChunk]);
}

/**
 * `placeholder-box.glb` er den demoen bruker som default, fordi den ligger i
 * rammen motoren faktisk leser: +Z opp, bunn i z=0. Ekte modeller skal
 * eksporteres slik.
 *
 * `placeholder-box-yup-probe.glb` er samme boks bygget etter glTF-boka (+Y
 * opp). Den beholdes fordi den er måleinstrumentet: legges den inn i kartet,
 * ser man umiddelbart at motoren snur den på siden og graver halve ned.
 */
const OUTPUTS = [
  {
    frame: "google",
    path: "public/models/lillebytunet/placeholder-box.glb",
    note: `${SIZE.x} m øst–vest, ${SIZE.z} m nord–sør, ${SIZE.y} m høy, bunn i z=0 (Google-rammen, +Z opp)`,
  },
  {
    frame: "gltf",
    path: "public/models/lillebytunet/placeholder-box-yup-probe.glb",
    note: `${SIZE.x} m i X, ${SIZE.y} m i Y, ${SIZE.z} m i Z, bunn i y=0 (glTF-konvensjon, +Y opp)`,
  },
];

for (const output of OUTPUTS) {
  const out = resolve(output.path);
  mkdirSync(dirname(out), { recursive: true });
  const glb = buildGlb(output.frame);
  writeFileSync(out, glb);
  console.log(`Skrev ${out} — ${glb.length} bytes: ${output.note}`);
}
