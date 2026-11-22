import { useEffect, useRef, type RefObject } from 'react';
import type { Scene } from 'three';
import { STAGE_TYPES } from '@/game/stage/regions';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { Surface } from '@/game/vehicle/surfaces';
import { placeWheelContacts, wheelContacts, type WheelContact } from '@/game/vehicle/wheelContacts';
import { DustEmitter } from '@/render/effects/DustEmitter';
import { DUST, ParticleRing } from '@/render/effects/ParticleRing';
import { SprayEmitter } from '@/render/effects/SprayEmitter';
import type { StageRenderOptions } from '@/render/stage/StageRenderer';
import type { DriveWorld, DrivingSession } from './DrivingSession';

/** Spray where a stage has watersplashes, dust where its road throws it; each a ring and its emitter. */
interface Particles {
  spray: { ring: ParticleRing; emitter: SprayEmitter } | null;
  dust: { ring: ParticleRing; emitter: DustEmitter } | null;
}

/**
 * The car's tyre particles (`ParticleRing`): spray in a watersplash, dust off
 * dry earth on a stage type with `dust`, each behind its render toggle. The
 * meshes live in the scene, not the React tree; the returned function runs
 * once a frame after the car is posed, from the wheels' places, so a replay
 * throws them too.
 */
export function useTyreParticles(
  scene: Scene,
  world: DriveWorld,
  effects: Pick<StageRenderOptions, 'waterSpray' | 'dust'> | undefined,
  reduced: RefObject<boolean>,
  contacts: WheelContact[],
): (s: DrivingSession, pose: Readonly<VehiclePose>, clock: number, dt: number) => void {
  const particles = useRef<Particles>({ spray: null, dust: null });
  const sprayOn = effects?.waterSpray === true;
  const dustOn = effects?.dust === true;

  useEffect(() => {
    const stage = world.stage;
    const def = stage ? STAGE_TYPES[stage.stageType] : null;
    const out: Particles = { spray: null, dust: null };
    if (sprayOn && def?.splashes) {
      // The spray carries the water's own mud: the Savanna's red-brown, the Moorland's grey-brown.
      const ring = new ParticleRing(def.splashes.water ? { dark: def.splashes.water } : {});
      out.spray = { ring, emitter: new SprayEmitter(ring) };
    }
    if (dustOn && def?.dust) {
      const ring = new ParticleRing({ ...DUST, dark: def.dust.color, light: def.dust.pale });
      const dusty = new Set<Surface>([def.surface, 'fechfech']);
      out.dust = { ring, emitter: new DustEmitter(ring, dusty) };
    }
    for (const p of [out.spray, out.dust]) if (p) scene.add(p.ring.mesh);
    particles.current = out;
    return () => {
      for (const p of [out.spray, out.dust]) p?.ring.dispose();
      particles.current = { spray: null, dust: null };
    };
  }, [scene, world, sprayOn, dustOn]);

  return (s, pose, clock, dt) => {
    const { spray, dust } = particles.current;
    if (!spray && !dust) return;
    if (s.replaying) placeWheelContacts(contacts, pose, s.sim.spec, world.terrain, 0, 0);
    else wheelContacts(contacts, pose, s.sim.state, s.sim.spec, world.terrain);
    const r = reduced.current === true;
    if (spray) {
      spray.emitter.update(contacts, pose, world.terrain, clock, dt, r);
      spray.ring.setTime(clock);
      spray.ring.flush();
    }
    if (dust) {
      dust.emitter.update(contacts, pose, pose.grounded, world.terrain, clock, dt, r);
      dust.ring.setTime(clock);
      dust.ring.flush();
    }
  };
}
