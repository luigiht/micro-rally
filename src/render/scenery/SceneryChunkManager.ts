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
  /** Geometry carries its own colours (multiplied by the tint). */
  vertexColors?: boolean;
  /** Take only some of the source props (flower boxes on some houses, one tower in three trees). */
  accept?: (p: Prop) => boolean;
  /** Adjust the instance transform after the default position, heading and uniform scale are set. */
  place?: (p: Prop, dummy: Object3D) => void;
  /** Per-instance colour computed from the prop, in place of `tint`. */
  colorAt?: (p: Prop, out: Color) => void;
}

/** Instanced, chunked roadside props, drawn with whichever kits the theme supplies; owns and disposes the kits. */
export class SceneryChunkManager {
  readonly group = new Group();
  private readonly buckets = new Map<number, Prop[]>();
  private readonly live = new Map<number, InstancedMesh[]>();
  private readonly streamer: ChunkStreamer;
  private readonly dummy = new Object3D();
  private readonly color = new Color();

  constructor(
    props: readonly Prop[],
    private readonly kits: readonly KindKit[],
    size: number,
    radius: number,
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
    this.streamer.update(x, z);
  }

  dispose(): void {
    this.streamer.clear();
    for (const kit of this.kits) {
      kit.geometry.dispose();
      kit.material.dispose();
    }
  }

  private readonly load = (_cx: number, _cz: number, key: number): void => {
    const props = this.buckets.get(key);
    if (!props) return;
    const meshes: InstancedMesh[] = [];
    for (const kit of this.kits) {
      const items = props.filter((p) => kit.sources.includes(p.kind) && (kit.accept?.(p) ?? true));
      if (items.length === 0) continue;
      const mesh = new InstancedMesh(kit.geometry, kit.material, items.length);
      items.forEach((p, i) => {
        this.dummy.position.set(p.x, p.y, p.z);
        // Heading first, then any pitch about the prop's own x axis.
        this.dummy.rotation.set(p.pitch ?? 0, p.rotation, 0, 'YXZ');
        this.dummy.scale.setScalar(p.scale);
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
      mesh.receiveShadow = false;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
      this.group.add(mesh);
    }
    this.live.set(key, meshes);
  };

  private readonly unload = (key: number): void => {
    const meshes = this.live.get(key);
    if (!meshes) return;
    for (const m of meshes) {
      this.group.remove(m);
      m.dispose();
    }
    this.live.delete(key);
  };
}
