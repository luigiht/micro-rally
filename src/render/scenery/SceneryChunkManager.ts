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
import { houseRoofGeometry, houseWallsGeometry } from './HouseGeometry';

interface KindKit {
  sources: readonly PropKind[];
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  /** Per-instance colour pair (variant 0 / 1); null = material colour. */
  tint: readonly [Color, Color] | null;
  castShadow: boolean;
  /** Geometry carries its own colours (multiplied by the tint). */
  vertexColors?: boolean;
}

function foliageGeometry(): BufferGeometry {
  // Foliage starts 1.3 m up so the trunk shows, in the tree and in its shadow.
  const low = new ConeGeometry(1.35, 2.6, 7).translate(0, 2.6, 0);
  const high = new ConeGeometry(0.95, 2.1, 7).translate(0, 3.8, 0);
  const merged = mergeGeometries([low, high])!;
  low.dispose();
  high.dispose();
  return merged;
}

function canopyGeometry(): BufferGeometry {
  const parts = [
    new IcosahedronGeometry(1.5, 0).translate(0, 3.1, 0),
    new IcosahedronGeometry(1.05, 0).translate(0.9, 2.7, 0.3),
    new IcosahedronGeometry(0.95, 0).translate(-0.7, 3.6, -0.4),
  ];
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Instanced, chunked roadside props: cone pines, round broadleaf trees, blob bushes, faceted rocks, houses. */
export class SceneryChunkManager {
  readonly group = new Group();
  private readonly kits: KindKit[];
  private readonly buckets = new Map<number, Prop[]>();
  private readonly live = new Map<number, InstancedMesh[]>();
  private readonly streamer: ChunkStreamer;
  private readonly dummy = new Object3D();
  private readonly color = new Color();

  constructor(
    props: readonly Prop[],
    palette: RegionPalette,
    size: number,
    radius: number,
    shadows: boolean,
    /** Snow regions: roofs under snow and paler walls, so houses sit into the white landscape. */
    snow = false,
  ) {
    this.group.name = 'scenery';
    const pine = [new Color(palette.foliage), new Color(palette.foliageAlt)] as const;
    const leaf = [new Color(palette.canopy), new Color(palette.canopyAlt)] as const;
    const mat = (color: string, vertexColors = false) =>
      new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, vertexColors });
    const walls = snow
      ? ([new Color('#e9e6dd'), new Color('#cfc3a8')] as const)
      : ([new Color('#efe6cf'), new Color('#d9b26b')] as const);
    const roofs = snow
      ? ([new Color('#eef2f5'), new Color('#e4e9ee')] as const)
      : ([new Color('#b5523c'), new Color('#4a5160')] as const);
    this.kits = [
      {
        sources: ['tree'],
        geometry: foliageGeometry(),
        material: mat('#ffffff'),
        tint: pine,
        castShadow: shadows,
      },
      {
        sources: ['broadleaf'],
        geometry: canopyGeometry(),
        material: mat('#ffffff'),
        tint: leaf,
        castShadow: shadows,
      },
      {
        sources: ['tree', 'broadleaf'],
        geometry: new CylinderGeometry(0.16, 0.24, 1.6, 5).translate(0, 0.8, 0),
        material: mat(palette.trunk),
        tint: null,
        castShadow: shadows,
      },
      {
        sources: ['bush'],
        geometry: new IcosahedronGeometry(0.9, 0).translate(0, 0.45, 0),
        material: mat('#ffffff'),
        tint: pine,
        castShadow: false,
      },
      {
        sources: ['rock'],
        geometry: new DodecahedronGeometry(0.9, 0).translate(0, 0.25, 0),
        material: mat(palette.boulder),
        tint: null,
        castShadow: shadows,
      },
      {
        sources: ['house'],
        geometry: houseWallsGeometry(),
        material: mat('#ffffff', true),
        tint: walls,
        castShadow: shadows,
        vertexColors: true,
      },
      {
        sources: ['house'],
        geometry: houseRoofGeometry(),
        material: mat('#ffffff', true),
        tint: roofs,
        castShadow: shadows,
        vertexColors: true,
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
      const items = props.filter((p) => kit.sources.includes(p.kind));
      if (items.length === 0) continue;
      const mesh = new InstancedMesh(kit.geometry, kit.material, items.length);
      const isTrunk = kit.sources.length > 1;
      items.forEach((p, i) => {
        const rock = p.kind === 'rock';
        this.dummy.position.set(p.x, p.y - (rock ? 0.2 * p.scale : 0), p.z);
        this.dummy.rotation.set(rock ? p.rotation : 0, p.rotation, 0);
        this.dummy.scale.setScalar(p.scale);
        // Broadleaf canopies sit higher, so stretch their trunks.
        if (isTrunk && p.kind === 'broadleaf') this.dummy.scale.y *= 1.6;
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
        if (kit.tint) {
          this.color.copy(kit.tint[p.variant ? 1 : 0]);
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
