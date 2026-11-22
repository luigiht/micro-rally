import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { hashSeed, mulberry32 } from '@/game/rng';
import type { RoadSample } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField } from '@/game/stage/TerrainField';
import type { Watersplash } from '@/game/stage/Watersplashes';

/**
 * The watersplashes (`Watersplashes`): a broad, irregular puddle lying in the
 * road's dip, a rounded blob with ragged ends that fills the carriageway from
 * edge to edge across its middle, a hair over the deck so it reads as water
 * standing in the gravel; translucent, the road showing through, grey where
 * it is deep and catches the sky, browner and fading out to nothing at its
 * shallow rim, so it blends into the road with no edge. Visual only: the
 * water's drag is the `water` surface's.
 */

/** Points round a puddle's outline. */
const POINTS = 48;
/** The water stands this far over the deck. */
const WATER_ABOVE = 0.012;
/** How opaque the water is in the middle, part way out, and at the rim (where it fades out). */
const ALPHA_DEEP = 0.7;
const ALPHA_MID = 0.55;
const ALPHA_RIM = 0;
/** How square the blob is (2 an ellipse; higher fills the carriageway's corners). */
const SQUARENESS = 3.2;

const DEEP = new Color('#b7c1c5');
const SHALLOW = new Color('#a39a85');

type V3 = [number, number, number];

export class SplashBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(
    stage: StageDef,
    field: TerrainField,
    splashes: readonly Watersplash[],
    /** The water's own colour where the stage type gives one (the Savanna's muddy red-brown). */
    water?: string,
  ) {
    this.group.name = 'watersplashes';
    const pos: number[] = [];
    const col: number[] = [];
    const s: RoadSample = { x: 0, z: 0, heading: 0 };
    // A point `u` metres along the road from `along` and `v` to its left, `up` over the deck.
    const at = (along: number, u: number, v: number, up: number): V3 => {
      stage.path.sample(along + u, s);
      return [
        s.x + Math.cos(s.heading) * v,
        field.roadHeightAt(along + u) + ROAD_LIFT + up,
        s.z - Math.sin(s.heading) * v,
      ];
    };
    // The outline runs anticlockwise in (along, left), which faces down in the world: wound the
    // other way so every face looks up.
    type Tint = readonly [Color, number];
    const tri = (a: V3, b: V3, c: V3, [ca, aa]: Tint, [cb, ab]: Tint, [cc, ac]: Tint) => {
      pos.push(...a, ...c, ...b);
      col.push(ca.r, ca.g, ca.b, aa, cc.r, cc.g, cc.b, ac, cb.r, cb.g, cb.b, ab);
    };
    // Muddy water reads opaque and its own colour; the Moorland's clear grey shows the road through.
    const own = water ? new Color(water) : null;
    const deepColor = own ?? DEEP;
    // Muddy water shallows to a pale, sky-caught sheen at its rim, so it reads as water on red earth.
    const shallowColor = own ? own.clone().lerp(new Color('#b8b0a0'), 0.45) : SHALLOW;
    const deep: Tint = [deepColor, own ? 0.92 : ALPHA_DEEP];
    const mid: Tint = [new Color().copy(shallowColor).lerp(deepColor, 0.6), own ? 0.85 : ALPHA_MID];
    const rim: Tint = [shallowColor, ALPHA_RIM];
    for (const splash of splashes) {
      const rand = mulberry32(hashSeed(stage.seed, 'splash-shape', Math.round(splash.along)));
      const halfLength = (splash.to - splash.from) / 2;
      const halfWidth = halfWidthAt(stage, splash.along) + 0.05;
      // A ragged rim: a few slow waves of different phase round the outline.
      const waves = [1, 2, 3, 5].map((k) => ({ k, phase: rand() * Math.PI * 2, amp: 0.1 / k }));
      const ragged = (theta: number) =>
        1 + waves.reduce((sum, w) => sum + w.amp * Math.sin(w.k * theta + w.phase), 0);
      const outline: [number, number][] = [];
      for (let i = 0; i < POINTS; i++) {
        const theta = (i / POINTS) * Math.PI * 2;
        const c = Math.cos(theta);
        const sn = Math.sin(theta);
        const r = ragged(theta);
        // A superellipse: rounded at the ends, square enough to fill the road across its middle;
        // ragged along the road, and only a little across it so the edges stay by the verges.
        const u = Math.sign(c) * Math.abs(c) ** (2 / SQUARENESS) * halfLength * r;
        const v = Math.sign(sn) * Math.abs(sn) ** (2 / SQUARENESS) * halfWidth * (0.92 + 0.08 * r);
        outline.push([u, v]);
      }
      const centre = at(splash.along, 0, 0, WATER_ABOVE);
      for (let i = 0; i < POINTS; i++) {
        const [u0, v0] = outline[i]!;
        const [u1, v1] = outline[(i + 1) % POINTS]!;
        // Water: deep in the middle, a mid ring, the shallow rim.
        const m0 = at(splash.along, u0 * 0.55, v0 * 0.55, WATER_ABOVE);
        const m1 = at(splash.along, u1 * 0.55, v1 * 0.55, WATER_ABOVE);
        const r0 = at(splash.along, u0, v0, WATER_ABOVE);
        const r1 = at(splash.along, u1, v1, WATER_ABOVE);
        tri(centre, m1, m0, deep, mid, mid);
        tri(m0, m1, r1, mid, mid, rim);
        tri(m0, r1, r0, mid, rim, rim);
      }
    }
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      // Translucent: the road shows through, most at the rim, where the water fades out.
      transparent: true,
      depthWrite: false,
      // A wet sheen, not a mirror: the sun must not flare white off it.
      roughness: 0.18,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    if (pos.length === 0) {
      this.geometry = null;
      return;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    g.setAttribute('color', new BufferAttribute(Float32Array.from(col), 4));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    this.geometry = g;
    const mesh = new Mesh(g, this.material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.geometry?.dispose();
    this.material.dispose();
  }
}
