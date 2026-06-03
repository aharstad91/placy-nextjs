#!/usr/bin/env node
/**
 * gen-placeholder-massing-glb — genererer en selvstendig placeholder-modell
 * (binær glTF 2.0 / `.glb`) for 3D-modell-på-tiles-demoen.
 *
 * Hvorfor: Google `Model3DElement` støtter KUN `.glb` (ikke rå glTF-JSON), og
 * repoet har ingen three.js/gltf-verktøykjede. Dette nullavhengighets-scriptet
 * emitterer en enkel nøytral-grå enhetskube (rotert i y=0 så basen står på
 * bakken) som vi skalerer til grov bygnings-massing via `Model3DElement.scale`.
 * Bytt `.glb`-en til en ekte arkitekt-modell senere uten kodeendring.
 *
 * `doubleSided: true` → kuben rendres solid uavhengig av face-winding (robust
 * placeholder). Ingen normaler ⇒ renderer beregner flat-normaler (glTF-spec),
 * flat-shadet grå massing — helt greit for en demo.
 *
 * Bruk:
 *   node scripts/gen-placeholder-massing-glb.mjs
 *   → skriver public/models/placeholder-massing.glb (commit den)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "public/models/placeholder-massing.glb";

// Enhetskube rotert i y=0 (base på bakken). Reell størrelse via Model3DElement.scale.
const W = 1,
  H = 1,
  D = 1;
const positions = new Float32Array([
  0, 0, 0, W, 0, 0, W, 0, D, 0, 0, D, // bunn (y=0)
  0, H, 0, W, H, 0, W, H, D, 0, H, D, // topp (y=H)
]);
const indices = new Uint16Array([
  0, 1, 2, 0, 2, 3, // bunn
  4, 6, 5, 4, 7, 6, // topp
  0, 4, 5, 0, 5, 1, // sider
  1, 5, 6, 1, 6, 2,
  2, 6, 7, 2, 7, 3,
  3, 7, 4, 3, 4, 0,
]);

const pad4 = (n) => (4 - (n % 4)) % 4;
const idxBytes = Buffer.from(indices.buffer);
const idxPad = pad4(idxBytes.length);
const posOffset = idxBytes.length + idxPad;
const posBytes = Buffer.from(positions.buffer);
const binChunkData = Buffer.concat([idxBytes, Buffer.alloc(idxPad), posBytes]);

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < positions.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    const v = positions[i + k];
    if (v < min[k]) min[k] = v;
    if (v > max[k]) max[k] = v;
  }
}

const gltf = {
  asset: { version: "2.0", generator: "placy-placeholder-massing" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 1 }, indices: 0, material: 0 }] }],
  materials: [
    {
      name: "massing",
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [0.82, 0.83, 0.85, 1],
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    },
  ],
  buffers: [{ byteLength: binChunkData.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: idxBytes.length, target: 34963 },
    { buffer: 0, byteOffset: posOffset, byteLength: posBytes.length, target: 34962 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5123, count: indices.length, type: "SCALAR" },
    {
      bufferView: 1,
      componentType: 5126,
      count: positions.length / 3,
      type: "VEC3",
      min,
      max,
    },
  ],
};

let jsonBuf = Buffer.from(JSON.stringify(gltf), "utf8");
const jp = pad4(jsonBuf.length);
if (jp) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(" ".repeat(jp))]);
const bp = pad4(binChunkData.length);
const binBuf = bp ? Buffer.concat([binChunkData, Buffer.alloc(bp)]) : binChunkData;

const totalLen = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // "glTF"
header.writeUInt32LE(2, 4); // version
header.writeUInt32LE(totalLen, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(jsonBuf.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4); // "JSON"
const bh = Buffer.alloc(8);
bh.writeUInt32LE(binBuf.length, 0);
bh.writeUInt32LE(0x004e4942, 4); // "BIN\0"

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, jh, jsonBuf, bh, binBuf]));
console.log(`✓ Skrev ${OUT} (${totalLen} bytes)`);
