import { Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three';
import { RAIL_LIFT, type TramLine } from '@/game/stage/Tram';
import {
  loopFleet,
  loopSectionPose,
  SECTION_LENGTH,
  TRAM_SECTIONS,
  tramPose,
  tramSchedule,
  type LoopFleet,
  type TramPose,
  type TramRun,
} from '@/game/stage/TramService';
import type { TramLoopDef } from '@/game/stage/city/TramLoop';
import type { GroundQuery } from '@/game/stage/Town';
import { tramGeometry, tramSectionGeometries } from '../scenery/TramGeometry';
import { BED_LIFT } from './TramTrackBuilder';

/** The bogies a whole tram rides on, either side of its centre, which set its pitch on a climbing street. */
const BOGIE = 8;
/** A loop tram's car pitches over its own bogies. */
const CAR_BOGIE = SECTION_LENGTH * 0.4;

/**
 * The trams on a city's lines or its loop. On lines, one mesh per line over
 * a shared geometry, posed each frame from the line's timetable
 * (`TramService`) at the run's clock, fading in and out at the line's ends.
 * On a loop, every tram is three cars, each its own mesh riding its own
 * bogies round the rails (`loopSectionPose`), so the tram bends at its
 * bellows through the curves. Each rides the street's slope. The session
 * poses the same hitboxes from the same clock.
 */
export class TramFleet {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[];
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly meshes: Mesh[] = [];
  private readonly runs: TramRun[];
  /** A mapped city's loop and the trams circling it, in place of the lines' timetable. */
  private readonly fleet: LoopFleet | null;
  private readonly pose: TramPose = { x: 0, z: 0, heading: 0, opacity: 1 };

  constructor(
    private readonly trams: readonly TramLine[],
    private readonly field: GroundQuery,
    seed: number,
    shadows: boolean,
    loop?: TramLoopDef,
  ) {
    this.group.name = 'trams';
    this.fleet = loop ? loopFleet(loop, seed) : null;
    this.geometries = this.fleet ? tramSectionGeometries() : [tramGeometry()];
    this.runs = this.fleet ? [] : tramSchedule(trams, seed);
    const count = this.fleet ? this.fleet.offsets.length * TRAM_SECTIONS : trams.length;
    for (let i = 0; i < count; i++) {
      const material = new MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.6,
        transparent: !this.fleet,
      });
      const mesh = new Mesh(this.geometries[this.fleet ? i % TRAM_SECTIONS : 0]!, material);
      mesh.castShadow = shadows;
      mesh.visible = false;
      mesh.rotation.order = 'YXZ';
      this.materials.push(material);
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Pose every tram (every car, on a loop) for the run's clock `t` (seconds). */
  tick(t: number): void {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i]!;
      const pose = this.fleet
        ? loopSectionPose(
            this.fleet,
            Math.floor(i / TRAM_SECTIONS),
            i % TRAM_SECTIONS,
            t,
            this.pose,
          )
        : tramPose(this.trams[i]!, this.runs[i]!, t);
      if (!pose) {
        mesh.visible = false;
        continue;
      }
      const reach = this.fleet ? CAR_BOGIE : BOGIE;
      const fx = Math.sin(pose.heading);
      const fz = Math.cos(pose.heading);
      const ahead = this.field.deckAt(pose.x + fx * reach, pose.z + fz * reach);
      const behind = this.field.deckAt(pose.x - fx * reach, pose.z - fz * reach);
      mesh.position.set(pose.x, (ahead + behind) / 2 + BED_LIFT + RAIL_LIFT, pose.z);
      // A positive pitch about x drops +z, the nose.
      mesh.rotation.set(-Math.atan2(ahead - behind, 2 * reach), pose.heading, 0);
      this.materials[i]!.opacity = pose.opacity;
      mesh.visible = pose.opacity > 0.01;
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
