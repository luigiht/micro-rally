import { type BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { GRID } from '@/game/stage/CircuitStage';
import {
  CORNER_STAND,
  STAND,
  cornerStandSpots,
  grandstandSpot,
  type CircuitTrackside,
} from '@/game/stage/CircuitTrackside';
import type { RoadSample } from '@/game/stage/RoadPath';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField } from '@/game/stage/TerrainField';
import { themeColor } from '../theme/themeColor';
import type { CircuitTheme } from '../theme/WorldTheme';
import { LINE_ABOVE_DECK } from './RoadBuilder';
import { TrackMesh } from './TrackMesh';

/** Chequered start/finish line: squares this size, two rows. */
const CHEQUER = 0.6;
/** The grandstand: stepped rows of seats (its footprint is `STAND`), a roof on posts. */
const STAND_ROWS = 6;
const STAND_ROW_DEPTH = STAND.depth / STAND_ROWS;
const STAND_ROW_RISE = 0.55;
/** Boxes stand on the ground and reach this far into it, so a slope never shows a gap underneath. */
const SINK = 0.6;

type V3 = [number, number, number];

/**
 * The paint and the stand of a circuit's main straight: a chequered
 * start/finish line across the track, white grid slots behind it, and a
 * grandstand behind the barrier on the outside of the lap facing the line.
 * One merged mesh; the line paint sits a hair over the deck like the edge
 * lines.
 */
export class CircuitDressingBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(
    stage: StageDef,
    trackside: CircuitTrackside,
    field: TerrainField,
    theme: CircuitTheme,
  ) {
    this.group.name = 'circuit-dressing';
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new TrackMesh();
    const { path, halfWidth: hw, startDistance } = stage;
    const s: RoadSample = { x: 0, z: 0, heading: 0 };
    const paint = ROAD_LIFT + LINE_ABOVE_DECK;
    // A point `lat` to the left and `fwd` ahead of the line, on the deck plus `up`.
    const on = (d: number, lat: number, up: number): V3 => {
      path.sample(d, s);
      const x = s.x + Math.cos(s.heading) * lat;
      const z = s.z - Math.sin(s.heading) * lat;
      return [x, field.roadHeightAt(d) + up, z];
    };
    const chequer = [themeColor(theme.chequer[0]), themeColor(theme.chequer[1])] as const;
    const across = Math.ceil((hw * 2) / CHEQUER);
    for (let row = 0; row < 2; row++) {
      const d0 = startDistance - CHEQUER * (row - 1);
      for (let k = 0; k < across; k++) {
        const l0 = -hw + k * CHEQUER;
        const l1 = Math.min(hw, l0 + CHEQUER);
        mesh.ribbon(
          on(d0 - CHEQUER, l0, paint),
          on(d0 - CHEQUER, l1, paint),
          on(d0, l0, paint),
          on(d0, l1, paint),
          chequer[(row + k) % 2]!,
        );
      }
    }
    const grid = themeColor(theme.grid);
    for (let k = 0; k < GRID.slots; k++) {
      const d = startDistance - GRID.first - k * GRID.pitch;
      const lat = k % 2 === 0 ? GRID.stagger : -GRID.stagger;
      // A bar across the slot's front and a short tick down each side, like a painted bracket.
      mesh.ribbon(
        on(d - 0.2, lat - 1.1, paint),
        on(d - 0.2, lat + 1.1, paint),
        on(d, lat - 1.1, paint),
        on(d, lat + 1.1, paint),
        grid,
      );
      for (const e of [-1.1, 0.95]) {
        mesh.ribbon(
          on(d - 1.6, lat + e, paint),
          on(d - 1.6, lat + e + 0.15, paint),
          on(d - 0.2, lat + e, paint),
          on(d - 0.2, lat + e + 0.15, paint),
          grid,
        );
      }
    }
    // The stand: on the outside of the lap behind the barrier, facing the line (see `grandstandSpot`).
    const spot = grandstandSpot(stage, trackside);
    const seats = themeColor(theme.stand.seats);
    const frame = themeColor(theme.stand.frame);
    const roof = themeColor(theme.stand.roof);
    path.sample(startDistance, s);
    const yaw = spot.heading;
    const centre = (lat: number, along = 0): [number, number] => [
      s.x + Math.cos(yaw) * lat * spot.side + Math.sin(yaw) * along,
      s.z - Math.sin(yaw) * lat * spot.side + Math.cos(yaw) * along,
    ];
    // Rows step up from the highest ground under the stand's front, so the seats never dip into a slope.
    let base = -Infinity;
    for (const along of [-STAND.length / 2, 0, STAND.length / 2]) {
      const [x, z] = centre(spot.back, along);
      base = Math.max(base, field.heightAt(x, z));
    }
    for (let r = 0; r < STAND_ROWS; r++) {
      const top = STAND_ROW_RISE * (r + 1);
      const [x, z] = centre(spot.back + STAND_ROW_DEPTH * (r + 0.5));
      const h = top + SINK;
      mesh.box(
        x,
        base - SINK + h / 2,
        z,
        STAND_ROW_DEPTH,
        h,
        STAND.length,
        yaw,
        r % 2 ? frame : seats,
      );
    }
    const roofY = base + STAND_ROW_RISE * STAND_ROWS + 2.6;
    for (const along of [-STAND.length / 2, 0, STAND.length / 2]) {
      const [x, z] = centre(spot.back + STAND.depth, along);
      const h = roofY - base + SINK;
      mesh.box(x, roofY - h / 2, z, 0.3, h, 0.3, yaw, frame);
    }
    const [rx, rz] = centre(spot.back + STAND.depth / 2);
    mesh.box(rx, roofY, rz, STAND.depth + 1.5, 0.25, STAND.length + 2, yaw, roof);

    for (const corner of cornerStandSpots(stage, trackside)) {
      path.sample(corner.distance, s);
      const cornerCentre = (lat: number, along = 0): [number, number] => [
        s.x + Math.cos(s.heading) * lat * corner.side + Math.sin(s.heading) * along,
        s.z - Math.sin(s.heading) * lat * corner.side + Math.cos(s.heading) * along,
      ];
      let cornerBase = -Infinity;
      for (const along of [-CORNER_STAND.length / 2, 0, CORNER_STAND.length / 2])
        for (const lat of [corner.back, corner.back + CORNER_STAND.depth]) {
          const [x, z] = cornerCentre(lat, along);
          cornerBase = Math.max(cornerBase, field.heightAt(x, z));
        }
      const rowDepth = CORNER_STAND.depth / CORNER_STAND.rows;
      for (let row = 0; row < CORNER_STAND.rows; row++) {
        const top = CORNER_STAND.rowRise * (row + 1);
        const [x, z] = cornerCentre(corner.back + rowDepth * (row + 0.5));
        const h = top + SINK;
        mesh.box(
          x,
          cornerBase - SINK + h / 2,
          z,
          rowDepth,
          h,
          CORNER_STAND.length,
          s.heading,
          row % 2 ? frame : seats,
        );
      }
      const cornerRoofY = cornerBase + CORNER_STAND.rowRise * CORNER_STAND.rows + 2.2;
      for (const along of [-CORNER_STAND.length / 2, 0, CORNER_STAND.length / 2]) {
        const [x, z] = cornerCentre(corner.back + CORNER_STAND.depth, along);
        const h = cornerRoofY - cornerBase + SINK;
        mesh.box(x, cornerRoofY - h / 2, z, 0.3, h, 0.3, s.heading, frame);
      }
      const [cx, cz] = cornerCentre(corner.back + CORNER_STAND.depth / 2);
      mesh.box(
        cx,
        cornerRoofY,
        cz,
        CORNER_STAND.depth + 1.2,
        0.25,
        CORNER_STAND.length + 2,
        s.heading,
        roof,
      );
    }
    this.geometry = mesh.empty ? null : mesh.build();
    if (this.geometry) {
      const m = new Mesh(this.geometry, this.material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}
