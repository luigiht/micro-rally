// Prints the structure of a .glb reference model: overall bounds, named nodes
// with their mesh bounds, and material base colours. Geometry is not exported;
// the game's cars stay procedural. Usage: node scripts/inspect-glb.mjs file.glb
import { readFile } from 'node:fs/promises';

const buf = await readFile(process.argv[2]);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const f = (n) => (Math.round(n * 100) / 100).toFixed(2);

const mats = (gltf.materials ?? []).map((m, i) => {
  const c = m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
  const hex =
    '#' +
    c
      .slice(0, 3)
      .map((v) =>
        Math.round(Math.pow(v, 1 / 2.2) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return `${i}:${m.name ?? ''}${hex}${m.pbrMetallicRoughness?.baseColorTexture ? '(tex)' : ''}`;
});
console.log(
  'generator:',
  gltf.asset?.generator,
  '| meshes:',
  gltf.meshes?.length,
  '| nodes:',
  gltf.nodes?.length,
);
console.log('materials:', mats.join('  '));

const world = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
function walk(idx, parentT = [0, 0, 0], depth = 0) {
  const n = gltf.nodes[idx];
  const t = (n.translation ?? [0, 0, 0]).map((v, i) => v + parentT[i]);
  if (n.mesh !== undefined) {
    const mesh = gltf.meshes[n.mesh];
    for (const p of mesh.primitives) {
      const acc = gltf.accessors[p.attributes.POSITION];
      if (!acc?.min) continue;
      const mn = acc.min.map((v, i) => v + t[i]);
      const mx = acc.max.map((v, i) => v + t[i]);
      for (let i = 0; i < 3; i++) {
        world[i] = Math.min(world[i], mn[i]);
        world[3 + i] = Math.max(world[3 + i], mx[i]);
      }
      const size = mx.map((v, i) => v - mn[i]);
      const ctr = mx.map((v, i) => (v + mn[i]) / 2);
      console.log(
        `${'  '.repeat(depth)}${n.name ?? mesh.name ?? 'mesh'} mat=${p.material} ctr=(${ctr.map(f).join(',')}) size=(${size.map(f).join(',')})`,
      );
    }
  }
  for (const c of n.children ?? []) walk(c, t, depth + 1);
}
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) walk(root);
console.log(
  'world min/max:',
  world.slice(0, 3).map(f).join(','),
  '/',
  world.slice(3).map(f).join(','),
);
