import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RegionPalette } from '@/game/stage/regions';
import type { Prop, PropKind } from '@/game/stage/SceneryScatter';
import { ChunkStreamer, chunkKey } from '../ChunkStreamer';

interface KindKit {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  tinted: boolean;
  castShadow: boolean;
}

function foliageGeometry(): BufferGeometry {
  const low = new ConeGeometry(1.35, 2.6, 7).translate(0, 2.2, 0);
  const high = new ConeGeometry(0.95, 2.1, 7).translate(0, 3.4, 0);
  const merged = mergeGeometries([low, high])!;
  low.dispose();
  high.dispose();
  return merged;
}

/** Instanced, chunked roadside props: cone trees, blob bushes, faceted rocks. */
export class SceneryChunkManager {
  readonly group = new Group();
  private readonly kits: { kind: PropKind | 'trunk'; kit: KindKit }[];
  private readonly buckets = new Map<number, Prop[]>();
  private readonly live = new Map<number, InstancedMesh[]>();
  private readonly streamer: ChunkStreamer;
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly palette: { foliage: Color; foliageAlt: Color };

  constructor(
    props: readonly Prop[],
    palette: RegionPalette,
    size: number,
    radius: number,
    shadows: boolean,
  ) {
    this.group.name = 'scenery';
    this.palette = {
      foliage: new Color(palette.foliage),
      foliageAlt: new Color(palette.foliageAlt),
    };
    const mat = (color: string) =>
      new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
    this.kits = [
      {
        kind: 'tree',
        kit: {
          geometry: foliageGeometry(),
          material: mat('#ffffff'),
          tinted: true,
          castShadow: shadows,
        },
      },
      {
        kind: 'trunk',
        kit: {
          geometry: new CylinderGeometry(0.16, 0.24, 1.4, 5).translate(0, 0.7, 0),
          material: mat(palette.trunk),
          tinted: false,
          castShadow: false,
        },
      },
      {
        kind: 'bush',
        kit: {
          geometry: new IcosahedronGeometry(0.9, 0).translate(0, 0.45, 0),
          material: mat('#ffffff'),
          tinted: true,
          castShadow: false,
        },
      },
      {
        kind: 'rock',
        kit: {
          geometry: new DodecahedronGeometry(0.9, 0).translate(0, 0.25, 0),
          material: mat(palette.boulder),
          tinted: false,
          castShadow: shadows,
        },
      },
    ];
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
    for (const { kit } of this.kits) {
      kit.geometry.dispose();
      kit.material.dispose();
    }
  }

  private readonly load = (_cx: number, _cz: number, key: number): void => {
    const props = this.buckets.get(key);
    if (!props) return;
    const meshes: InstancedMesh[] = [];
    for (const { kind, kit } of this.kits) {
      const source = kind === 'trunk' ? 'tree' : kind;
      const items = props.filter((p) => p.kind === source);
      if (items.length === 0) continue;
      const mesh = new InstancedMesh(kit.geometry, kit.material, items.length);
      items.forEach((p, i) => {
        this.dummy.position.set(p.x, p.y - (kind === 'rock' ? 0.2 * p.scale : 0), p.z);
        this.dummy.rotation.set(kind === 'rock' ? p.rotation : 0, p.rotation, 0);
        this.dummy.scale.setScalar(p.scale);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
        if (kit.tinted) {
          this.color.copy(p.variant ? this.palette.foliageAlt : this.palette.foliage);
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
