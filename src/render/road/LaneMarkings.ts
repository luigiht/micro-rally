import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { onMedian } from '@/game/stage/Median';
import { BAY_WIDTH, onParkingStretch, type ParkingStretch } from '@/game/stage/ParkingBays';
import { onRoundabout } from '@/game/stage/Roundabout';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';
import { junctionReach } from '@/game/stage/TownJunctions';
import { junctionKerbs } from '@/game/stage/TownKerbs';
import { CROSSING_EXTENT } from '@/game/stage/Crossings';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';
import { LINE_LIFT } from './RoadBuilder';

/** A lane is about this wide; a street gets as many as fit, two at least before any divider is painted. */
const LANE_WIDTH = 3.3;
const LINE_WIDTH = 0.15;
/** Dashes: painted samples then bare samples, in 2 m road samples. */
const DASH_ON = 2;
const DASH_PERIOD = 4;
/** Lane lines stand a hair over the edge lines, so the two never share a plane. */
const ABOVE_EDGE_LINE = 0.001;
/** Lines stop this far short of a junction's crossing and stop line along the route, and clear of every roundabout ring. */
const JUNCTION_MARGIN = 1.5;

/** How many lanes a carriageway `2 · hw` wide holds, less a parking bay each side where the street has them. */
export function laneCount(hw: number, parked: boolean): number {
  return Math.floor((2 * hw - (parked ? 2 * BAY_WIDTH : 0)) / LANE_WIDTH);
}

/**
 * Lane markings on a city's wider streets: dashed white dividers between
 * lanes and a solid centre line where the lane count is even, laid sample
 * by sample on the ribbon from the per-sample half width, and left off
 * through junction mouths and roundabouts and, for the centre line, along a
 * boulevard's median. Along a parking stretch the kerb lane each side is
 * bays, so the lanes are counted and spaced over the width between them.
 * One mesh.
 */
export class LaneMarkings {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;

  constructor(
    stage: StageDef,
    field: TerrainField,
    road: RoadTheme,
    parking: readonly ParkingStretch[] = [],
  ) {
    this.group.name = 'lane-markings';
    const line = themeColor(road.line);
    const town = stage.town;
    const path = stage.path;
    const sp = path.spacing;
    // Where each junction's paving spans the route (from where the ribbon first hands its verge
    // to the junction to where it takes it back), plus the crossing and stop line laid beyond it,
    // and a margin: the lines end before the pavement flares into the mouth, never under the zebra.
    const hit = createRoadHit();
    const zones: [number, number][] = [];
    for (const j of town?.junctions ?? []) {
      const k = junctionKerbs(j, stage, stage.halfWidth);
      const all = [...k.openings.left, ...k.openings.right];
      if (all.length > 0) {
        zones.push([
          Math.min(...all.map((o) => o.from)) - CROSSING_EXTENT - JUNCTION_MARGIN,
          Math.max(...all.map((o) => o.to)) + CROSSING_EXTENT + JUNCTION_MARGIN,
        ]);
        continue;
      }
      if (!path.nearest(j.x, j.z, 60, hit)) continue;
      const reach = junctionReach(j) + CROSSING_EXTENT + JUNCTION_MARGIN;
      zones.push([hit.along - reach, hit.along + reach]);
    }
    const rings = town?.roundabouts ?? [];
    const blank = (d: number) =>
      zones.some(([a, b]) => d > a && d < b) || onRoundabout(rings, d, 2 * stage.halfWidth);
    const pos: number[] = [];
    const col: number[] = [];
    const index: number[] = [];
    const c = new Color(line);
    const vertex = (x: number, y: number, z: number) => {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
    };
    for (let i = 0; i + 1 < path.count; i++) {
      const d0 = i * sp;
      const d1 = d0 + sp;
      if (blank(d0) || blank(d1)) continue;
      // Nor through a lane drop: the lines resume once the street holds its new width.
      if (Math.abs(halfWidthAt(stage, d0) - halfWidthAt(stage, d1)) > 1e-6) continue;
      const parked = onParkingStretch(parking, d0) && onParkingStretch(parking, d1);
      const bay = parked ? BAY_WIDTH : 0;
      const hw0 = halfWidthAt(stage, d0) - bay;
      const hw1 = halfWidthAt(stage, d1) - bay;
      const lanes = laneCount(Math.min(hw0, hw1) + bay, parked);
      if (lanes < 2) continue;
      const y0 = field.roadHeightAt(d0) + LINE_LIFT + ABOVE_EDGE_LINE;
      const y1 = field.roadHeightAt(d1) + LINE_LIFT + ABOVE_EDGE_LINE;
      const l0x = Math.cos(path.headings[i]!);
      const l0z = -Math.sin(path.headings[i]!);
      const l1x = Math.cos(path.headings[i + 1]!);
      const l1z = -Math.sin(path.headings[i + 1]!);
      const medians = town?.medians ?? [];
      for (let k = 1; k < lanes; k++) {
        const centre = lanes % 2 === 0 && k === lanes / 2;
        if (!centre && i % DASH_PERIOD >= DASH_ON) continue;
        // A boulevard's green divider stands where its centre line would be painted.
        if (
          centre &&
          (onMedian(medians, path.xs[i]!, path.zs[i]!) ||
            onMedian(medians, path.xs[i + 1]!, path.zs[i + 1]!))
        )
          continue;
        const e0 = -hw0 + (2 * hw0 * k) / lanes;
        const e1 = -hw1 + (2 * hw1 * k) / lanes;
        const base = pos.length / 3;
        const w = LINE_WIDTH / 2;
        vertex(path.xs[i]! + l0x * (e0 - w), y0, path.zs[i]! + l0z * (e0 - w));
        vertex(path.xs[i]! + l0x * (e0 + w), y0, path.zs[i]! + l0z * (e0 + w));
        vertex(path.xs[i + 1]! + l1x * (e1 - w), y1, path.zs[i + 1]! + l1z * (e1 - w));
        vertex(path.xs[i + 1]! + l1x * (e1 + w), y1, path.zs[i + 1]! + l1z * (e1 + w));
        index.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
      }
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
    this.geometry.setIndex(index);
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
