'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Vector3, type Group } from 'three';
import type { CarId, CarSpec } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { CameraMode } from '@/lib/cameraMode';
import { BerlinetteBody } from './bodies/BerlinetteBody';
import { BuggyBody } from './bodies/BuggyBody';
import { CoupeBody } from './bodies/CoupeBody';
import { DakarTruckBody } from './bodies/DakarTruckBody';
import { FocusHatchBody } from './bodies/FocusHatchBody';
import { GroupBBody } from './bodies/GroupBBody';
import { HatchbackBody } from './bodies/HatchbackBody';
import { LeMansBody } from './bodies/LeMansBody';
import { S1CoupeBody } from './bodies/S1CoupeBody';
import { SaloonBody } from './bodies/SaloonBody';
import { SchwabenBody } from './bodies/SchwabenBody';
import { T16HatchBody } from './bodies/T16HatchBody';
import { WokingBody } from './bodies/WokingBody';
import { WrcHatchBody } from './bodies/WrcHatchBody';
import { CarLamps } from '@/render/car/CarLamps';
import { tyreWidths } from '@/render/car/TyreWidths';
import { CarInterior, type CarInteriorHandle } from './CarInterior';
import { BodyMudFlaps } from './BodyMudFlaps';
import { Box, CAR_COLORS as C } from './CarParts';

export interface CarModelHandle {
  /**
   * Place the car at `pose`. With `ground`, each wheel is seated on the ground under its own
   * contact point (the body's pitch and roll follow smoothed axle heights, so on a crowned or
   * changing surface one height for all four would leave a wheel over the road or in it).
   */
  apply(pose: Readonly<VehiclePose>, ground?: TerrainQuery): void;
  /** Show the right parts for a camera: the interior view hides the roof and glass and shows the cabin fittings. */
  setView(mode: CameraMode): void;
  /** Brake input this frame, 0..1: lights the brake lamps when the car has its lamps on. */
  setBraking(level: number): void;
}

/** Wheels can rise this far into their wells before the body bottoms out (matches the sim). */
const MAX_WHEEL_LIFT = 0.35;

/**
 * Bodies that hang their own mud flaps (the buggy's hang from its spare carrier, inside the
 * leaning body; the Sirocco's from its floors, `BodyMudFlaps`), or none: the single-seater's
 * wheels stand in the open.
 */
const OWN_FLAPS: ReadonlySet<CarId> = new Set<CarId>([
  'buggy',
  'saloon',
  't16',
  'dakar',
  'formula',
]);

/** Wheel rim colour per car; cream by default. */
const RIM: Partial<Record<CarId, string>> = {
  t16: '#f4f1ea',
  saloon: '#e9b949',
  wrc: '#f4f1ea',
  s1: '#f4f1ea',
  scrs: '#f4f1ea',
  focus: '#f4f1ea',
  berlinette: '#b7b4ac',
  dakar: '#f0741f',
  lemans: '#4a4a52',
  buggy: '#b7b4ac',
  formula: '#2e2e34',
};

interface WheelProps {
  x: number;
  z: number;
  radius: number;
  width: number;
  rim: string;
  seatRef: Ref<Group>;
  steerRef?: Ref<Group>;
  spinRef: Ref<Group>;
}

/**
 * Each tyre sits this far into the ground (half a centimetre, unseen), as a loaded tyre squashes flat: its foot then still
 * casts the sun's shadow at road level, where the shadow map's normal bias would otherwise leave
 * the last centimetres under it lit.
 */
const TYRE_SINK = 0.005;
/** A wheel seated on its own ground moves at most this far down from where the shared height puts it. */
const MAX_WHEEL_DROP = 0.12;
/** Scratch for the wheels' contact points; no allocation per frame. */
const contact = new Vector3();
/** A 12-sided tyre's corner radius over its flats' (1 / cos 15°). */
const TYRE_ROUND = 1 / Math.cos(Math.PI / 12);

function Wheel({ x, z, radius, width, rim, seatRef, steerRef, spinRef }: WheelProps) {
  const out = x > 0 ? 1 : -1;
  return (
    <group position={[x, radius - TYRE_SINK, z]} ref={seatRef}>
      <group ref={steerRef}>
        <group ref={spinRef}>
          {/* The 12-sided tyre's flats, not its corners, reach the wheel radius: a flat at the bottom
            still reaches into the road instead of standing a centimetre over it */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[radius * TYRE_ROUND, radius * TYRE_ROUND, width, 12]} />
            <meshStandardMaterial color={C.tyre} flatShading />
          </mesh>
          <mesh position={[0.02 * out, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[radius * 0.6, radius * 0.6, width, 8]} />
            <meshStandardMaterial color={rim} flatShading metalness={0.3} roughness={0.5} />
          </mesh>
          <Box
            p={[Math.max(0.15, width / 2 + 0.02) * out, 0, 0]}
            s={[0.02, radius * 1.1, 0.08]}
            c={C.trim}
          />
        </group>
      </group>
    </group>
  );
}

function BodyFor({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  switch (spec.id) {
    case 'berlinette':
      return <BerlinetteBody spec={spec} cabinRef={cabinRef} />;
    case 'coupe':
      return <CoupeBody spec={spec} cabinRef={cabinRef} />;
    case 't16':
      return <T16HatchBody spec={spec} cabinRef={cabinRef} />;
    case 'saloon':
      return <SaloonBody spec={spec} cabinRef={cabinRef} />;
    case 'wrc':
      return <WrcHatchBody spec={spec} cabinRef={cabinRef} />;
    case 'groupb':
      return <GroupBBody spec={spec} cabinRef={cabinRef} />;
    case 'scrs':
      return <SchwabenBody spec={spec} cabinRef={cabinRef} />;
    case 's1':
      return <S1CoupeBody spec={spec} cabinRef={cabinRef} />;
    case 'focus':
      return <FocusHatchBody spec={spec} cabinRef={cabinRef} />;
    case 'dakar':
      return <DakarTruckBody spec={spec} cabinRef={cabinRef} />;
    case 'lemans':
      return <LeMansBody spec={spec} cabinRef={cabinRef} />;
    case 'buggy':
      return <BuggyBody spec={spec} cabinRef={cabinRef} />;
    case 'formula':
      return <WokingBody spec={spec} cabinRef={cabinRef} />;
    default:
      return <HatchbackBody spec={spec} cabinRef={cabinRef} />;
  }
}

/**
 * Chassis, wheels, interior and the lofted body for `spec.id`. The body rides
 * on the springs; the wheels ride on the ground.
 */
export function CarModel({
  spec,
  ref,
  lamps = false,
}: {
  spec: CarSpec;
  ref: Ref<CarModelHandle>;
  /** Headlamps with a beam down the road and brake lamps (after dark). */
  lamps?: boolean;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const carLamps = useRef<CarLamps | null>(null);
  const wheels = useRef<Group>(null);
  const cabin = useRef<Group>(null);
  const interior = useRef<CarInteriorHandle>(null);
  const steerFL = useRef<Group>(null);
  const steerFR = useRef<Group>(null);
  const spinFL = useRef<Group>(null);
  const spinFR = useRef<Group>(null);
  const spinRL = useRef<Group>(null);
  const spinRR = useRef<Group>(null);
  const seatFL = useRef<Group>(null);
  const seatFR = useRef<Group>(null);
  const seatRL = useRef<Group>(null);
  const seatRR = useRef<Group>(null);

  useImperativeHandle(ref, () => ({
    apply(pose, ground) {
      const r = root.current;
      if (!r) return;
      r.position.set(pose.x, pose.y, pose.z);
      r.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
      if (body.current)
        body.current.rotation.z = Math.max(-0.07, Math.min(0.07, pose.latAccel * 0.008));
      // The root is the sprung body; the wheels stay on the ground as the springs compress.
      if (wheels.current)
        wheels.current.position.y = Math.max(
          0,
          Math.min(MAX_WHEEL_LIFT, pose.groundHeight - pose.y),
        );
      // Each wheel on the ground under its own contact point.
      const lift = wheels.current?.position.y ?? 0;
      if (ground) {
        r.updateMatrix();
        const seats = [
          [seatFL.current, spec.trackWidth / 2, spec.cgToFront],
          [seatFR.current, -spec.trackWidth / 2, spec.cgToFront],
          [seatRL.current, spec.trackWidth / 2, -spec.cgToRear],
          [seatRR.current, -spec.trackWidth / 2, -spec.cgToRear],
        ] as const;
        for (const [seat, x, z] of seats) {
          if (!seat) continue;
          contact.set(x, lift, z).applyMatrix4(r.matrix);
          const dy = ground.heightAt(contact.x, contact.z, pose.y) - contact.y;
          const d = Math.max(-MAX_WHEEL_DROP, Math.min(MAX_WHEEL_LIFT - lift, dy));
          seat.position.y = spec.wheelRadius - TYRE_SINK + d;
        }
      }
      if (steerFL.current) steerFL.current.rotation.y = pose.steerAngle;
      if (steerFR.current) steerFR.current.rotation.y = pose.steerAngle;
      const spin = pose.wheelAngle;
      if (spinFL.current) spinFL.current.rotation.x = spin;
      if (spinFR.current) spinFR.current.rotation.x = spin;
      if (spinRL.current) spinRL.current.rotation.x = spin;
      if (spinRR.current) spinRR.current.rotation.x = spin;
      interior.current?.apply(pose);
    },
    setView(mode) {
      if (cabin.current) cabin.current.visible = mode !== 'interior';
      interior.current?.setVisible(mode === 'interior');
    },
    setBraking(level) {
      carLamps.current?.setBraking(level);
    },
  }));

  // On the sprung body, so they lean with it; refitted whenever the body changes.
  useEffect(() => {
    const b = body.current;
    if (!lamps || !b) return;
    const l = new CarLamps();
    b.add(l.group);
    l.fit(b, b);
    carLamps.current = l;
    return () => {
      l.dispose();
      carLamps.current = null;
    };
  }, [lamps, spec]);

  const half = spec.trackWidth / 2;
  const r = spec.wheelRadius;
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const rim = RIM[spec.id] ?? C.rim;
  const tyres = tyreWidths(spec);
  return (
    <group ref={root}>
      <group ref={body} position={[0, 0.1, 0]}>
        <group position={[spec.cabinAcross, spec.cabinDrop, spec.cabinForward]}>
          <CarInterior ref={interior} spec={spec} />
        </group>
        <BodyFor spec={spec} cabinRef={cabin} />
        {/* Flaps hung from the body lean with it, not with the wheels */}
        <group position={[0, -0.1, 0]}>
          <BodyMudFlaps spec={spec} />
        </group>
      </group>
      {/* Mud flaps hang off the chassis, not the leaning body; sized to the wheel. Some day bodies hang their own. */}
      {!OWN_FLAPS.has(spec.id) && (
        <>
          <Box p={[half, 0.75 * r, rear - 1.3 * r]} s={[0.9 * r, 0.8 * r, 0.03]} c={C.trim} />
          <Box p={[-half, 0.75 * r, rear - 1.3 * r]} s={[0.9 * r, 0.8 * r, 0.03]} c={C.trim} />
        </>
      )}
      <group ref={wheels}>
        {(
          [
            [half, front, seatFL, steerFL, spinFL],
            [-half, front, seatFR, steerFR, spinFR],
            [half, rear, seatRL, undefined, spinRL],
            [-half, rear, seatRR, undefined, spinRR],
          ] as const
        ).map(([x, z, seatRef, steerRef, spinRef]) => (
          <Wheel
            key={`${x},${z}`}
            x={x}
            z={z}
            radius={r}
            width={z === front ? tyres.front : tyres.rear}
            rim={rim}
            seatRef={seatRef}
            steerRef={steerRef}
            spinRef={spinRef}
          />
        ))}
      </group>
    </group>
  );
}
