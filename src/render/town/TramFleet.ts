import { Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three';
import { RAIL_LIFT, type TramLine } from '@/game/stage/Tram';
import { tramPose, tramSchedule, type TramRun } from '@/game/stage/TramService';
import type { GroundQuery } from '@/game/stage/Town';
import { tramGeometry } from '../scenery/TramGeometry';
import { BED_LIFT } from './TramTrackBuilder';

/** The bogies the tram rides on, either side of its centre, which set its pitch on a climbing street. */
const BOGIE = 8;

/**
 * The trams on a city's lines: one mesh per line over a shared geometry,
 * posed each frame from the line's timetable (`TramService`) at the run's
 * clock, riding the rails with the street's slope and fading in and out at
 * the line's ends. The session poses the same timetable's hitboxes from
 * the same clock.
 */
export class TramFleet {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly meshes: Mesh[] = [];
  private readonly runs: TramRun[];

  constructor(
    private readonly trams: readonly TramLine[],
    private readonly field: GroundQuery,
    seed: number,
    shadows: boolean,
  ) {
    this.group.name = 'trams';
    this.geometry = tramGeometry();
    this.runs = tramSchedule(trams, seed);
    for (let i = 0; i < trams.length; i++) {
      const material = new MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.6,
        transparent: true,
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.castShadow = shadows;
      mesh.visible = false;
      mesh.rotation.order = 'YXZ';
      this.materials.push(material);
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Pose every tram for the run's clock `t` (seconds). */
  tick(t: number): void {
    this.trams.forEach((line, i) => {
      const mesh = this.meshes[i]!;
      const pose = tramPose(line, this.runs[i]!, t);
      if (!pose) {
        mesh.visible = false;
        return;
      }
      const fx = Math.sin(pose.heading);
      const fz = Math.cos(pose.heading);
      const ahead = this.field.deckAt(pose.x + fx * BOGIE, pose.z + fz * BOGIE);
      const behind = this.field.deckAt(pose.x - fx * BOGIE, pose.z - fz * BOGIE);
      mesh.position.set(pose.x, (ahead + behind) / 2 + BED_LIFT + RAIL_LIFT, pose.z);
      // A positive pitch about x drops +z, the nose.
      mesh.rotation.set(-Math.atan2(ahead - behind, 2 * BOGIE), pose.heading, 0);
      this.materials[i]!.opacity = pose.opacity;
      mesh.visible = pose.opacity > 0.01;
    });
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
