// Bins the Body mesh of a reference .glb along its length and prints, per
// slice: roof height, body half-width, cabin half-width (within 12 cm of the
// roof) and underside height. Used once to bake procedural car profiles.
// Usage: node scripts/profile-glb.mjs file.glb [bins]
import { readFile } from 'node:fs/promises';

const buf = await readFile(process.argv[2]);
const bins = Number(process.argv[3] ?? 24);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;

function positions(accIdx) {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const stride = bv.byteStride ?? 12;
  const base = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out = new Float32Array(acc.count * 3);
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    out[i * 3] = buf.readFloatLE(o);
    out[i * 3 + 1] = buf.readFloatLE(o + 4);
    out[i * 3 + 2] = buf.readFloatLE(o + 8);
  }
  return out;
}

const bodyNode = gltf.nodes.find((n) => n.name === 'Body');
const mesh = gltf.meshes[bodyNode.mesh];
const t = bodyNode.translation ?? [0, 0, 0];
let zMin = Infinity,
  zMax = -Infinity;
const verts = [];
for (const p of mesh.primitives) {
  const pos = positions(p.attributes.POSITION);
  for (let i = 0; i < pos.length; i += 3) {
    // The references face -z; the game drives toward +z, so flip z.
    const v = [pos[i] + t[0], pos[i + 1] + t[1], -(pos[i + 2] + t[2])];
    verts.push(v);
    zMin = Math.min(zMin, v[2]);
    zMax = Math.max(zMax, v[2]);
  }
}
const step = (zMax - zMin) / bins;
const slices = Array.from({ length: bins }, () => ({ top: 0, half: 0, cabin: 0, under: Infinity }));
for (const [x, y, z] of verts) {
  const b = Math.min(bins - 1, Math.floor((z - zMin) / step));
  const s = slices[b];
  s.top = Math.max(s.top, y);
  s.half = Math.max(s.half, Math.abs(x));
  s.under = Math.min(s.under, y);
}
for (const [x, y, z] of verts) {
  const b = Math.min(bins - 1, Math.floor((z - zMin) / step));
  const s = slices[b];
  if (y > s.top - 0.12) s.cabin = Math.max(s.cabin, Math.abs(x));
}
console.log(
  `${process.argv[2].split('/').pop()}  verts=${verts.length}  z ${zMin.toFixed(2)}..${zMax.toFixed(2)} (rear..front)`,
);
console.log('   z     top   half  cabin  under');
slices.forEach((s, i) => {
  const z = zMin + (i + 0.5) * step;
  console.log(
    `${z.toFixed(2).padStart(6)} ${s.top.toFixed(2).padStart(6)} ${s.half.toFixed(2).padStart(6)} ${s.cabin.toFixed(2).padStart(6)} ${s.under.toFixed(2).padStart(6)}`,
  );
});
