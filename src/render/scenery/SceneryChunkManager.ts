import { type BufferGeometry, Color, Group, InstancedMesh, type Material, Object3D } from 'three';
import type { Prop, PropKind } from '@/game/stage/SceneryScatter';
import { ChunkStreamer, chunkKey } from '../ChunkStreamer';

/** One instanced mesh per chunk: which props feed it, what it draws them with and how. */
export interface KindKit {
  sources: readonly PropKind[];
  geometry: BufferGeometry;
  material: Material;
  /** Per-instance colours, one per variant (`variant % length`); null = material colour. */
  tint: readonly Color[] | null;
  castShadow: boolean;
  /** Takes the trees' shadows (ground cover); off unless set. */
  receiveShadow?: boolean;
  /** Geometry carries its own colours (multiplied by the tint). */
  vertexColors?: boolean;
  /** Take only some of the source props (flower boxes on some houses, one tower in three trees). */
  accept?: (p: Prop) => boolean;
  /** Adjust the instance transform after the default position, heading and uniform scale are set. */
  place?: (p: Prop, dummy: Object3D) => void;
  /** Per-instance colour computed from the prop, in place of `tint`. */
  colorAt?: (p: Prop, out: Color) => void;
  /**
   * Level of detail: a `near` kit draws only in chunks near the camera
   * target, a `far` one only beyond them (a cheap stand-in); unset, both.
   */
  lod?: 'near' | 'far';
}

/** A chunk switches back to `near` inside the radius and to `far` this far beyond it, so it never flickers. */
const LOD_MARGIN = 16;

interface LiveChunk {
  meshes: InstancedMesh[];
  cx: number;
  cz: number;
  near: boolean;
}

/** Instanced, chunked roadside props, drawn with whichever kits the theme supplies; owns and disposes the kits. */
export class SceneryChunkManager {
  readonly group = new Group();
  private readonly buckets = new Map<number, Prop[]>();
  private readonly live = new Map<number, LiveChunk>();
  private x = Number.NaN;
  private z = Number.NaN;
  private readonly streamer: ChunkStreamer;
  private readonly dummy = new Object3D();
  private readonly color = new Color();

  constructor(
    props: readonly Prop[],
    private readonly kits: readonly KindKit[],
    private readonly size: number,
    radius: number,
    /**
     * Chunks any part of which lies within this of the target draw their
     * `near` kits, so nothing closer than this ever shows a stand-in.
     */
    private readonly nearRadius = Infinity,
  ) {
    this.group.name = 'scenery';
    for (const p of props) {
      const key = chunkKey(Math.floor(p.x / size), Math.floor(p.z / size));
      const list = this.buckets.get(key);
      if (list) list.push(p);
      else this.buckets.set(key, [p]);
    }
    this.streamer = new ChunkStreamer(size, radius, this.load, this.unload);
  }

  update(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.streamer.update(x, z);
    if (this.nearRadius === Infinity) return;
    // A chunk crossing the detail radius is rebuilt with the other kits (rare: a few a second at speed).
    for (const [key, chunk] of this.live) {
      const d = this.edgeDistance(chunk.cx, chunk.cz);
      const near = chunk.near ? d < this.nearRadius + LOD_MARGIN : d < this.nearRadius;
      if (near === chunk.near) continue;
      this.unload(key);
      this.load(chunk.cx, chunk.cz, key);
    }
  }

  /** Distance from the target to the nearest point of a chunk's square (0 inside it). */
  private edgeDistance(cx: number, cz: number): number {
    if (Number.isNaN(this.x)) return 0;
    const dx = Math.max(cx * this.size - this.x, 0, this.x - (cx + 1) * this.size);
    const dz = Math.max(cz * this.size - this.z, 0, this.z - (cz + 1) * this.size);
    return Math.hypot(dx, dz);
  }

  dispose(): void {
    this.streamer.clear();
    for (const kit of this.kits) {
      kit.geometry.dispose();
      kit.material.dispose();
    }
  }

  private readonly load = (cx: number, cz: number, key: number): void => {
    const props = this.buckets.get(key);
    if (!props) return;
    const near = this.edgeDistance(cx, cz) < this.nearRadius;
    const meshes: InstancedMesh[] = [];
    for (const kit of this.kits) {
      if (kit.lod && (kit.lod === 'near') !== near) continue;
      const items = props.filter((p) => kit.sources.includes(p.kind) && (kit.accept?.(p) ?? true));
      if (items.length === 0) continue;
      const mesh = new InstancedMesh(kit.geometry, kit.material, items.length);
      items.forEach((p, i) => {
        this.dummy.position.set(p.x, p.y, p.z);
        // Heading first, then any pitch about the prop's own x axis.
        this.dummy.rotation.set(p.pitch ?? 0, p.rotation, 0, 'YXZ');
        this.dummy.scale.setScalar(p.scale);
        if (p.stretch) this.dummy.scale.y *= p.stretch;
        if (p.widen) this.dummy.scale.x *= p.widen;
        kit.place?.(p, this.dummy);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
        if (kit.colorAt) {
          kit.colorAt(p, this.color);
          mesh.setColorAt(i, this.color);
        } else if (kit.tint) {
          this.color.copy(kit.tint[p.variant % kit.tint.length]!);
          // Houses keep their palette; foliage varies a little per instance.
          if (!kit.vertexColors)
            this.color.multiplyScalar(0.88 + (p.rotation / (Math.PI * 2)) * 0.24);
          mesh.setColorAt(i, this.color);
        }
      });
      mesh.castShadow = kit.castShadow;
      mesh.receiveShadow = kit.receiveShadow ?? false;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
      this.group.add(mesh);
    }
    this.live.set(key, { meshes, cx, cz, near });
  };

  private readonly unload = (key: number): void => {
    const chunk = this.live.get(key);
    if (!chunk) return;
    for (const m of chunk.meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.live.delete(key);
  };
}
