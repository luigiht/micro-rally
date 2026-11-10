'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { Box } from './CarParts';
import { DashCluster, type DashHandle } from './interior/InteriorDash';
import {
  BucketSeat,
  CoDriverKit,
  Extinguisher,
  GearLever,
  Handbrake,
  HOOP_Z,
  RollCage,
  SEAT_BASE,
  SteeringWheel,
  type GearLeverHandle,
} from './interior/InteriorParts';
import { EYE, INTERIORS } from './interior/interiorSpecs';
import { RaidKit } from './interior/RaidConsole';

export interface CarInteriorHandle {
  apply(pose: Readonly<VehiclePose>): void;
  setVisible(visible: boolean): void;
}

/** Steering wheel turn per radian of road-wheel angle (≈160° at full lock). */
const WHEEL_RATIO = 4.5;

/**
 * Cabin interior seen from the driver's seat, built from the car's
 * `InteriorSpec`: envelope (floor, lining, pillars, door cards, bulkhead),
 * roll cage, dash cluster, wheel, levers, bucket seats and the co-driver's
 * kit. Lives inside the leaning body group; shown only in the interior view.
 */
export function CarInterior({ ref, spec }: { ref: Ref<CarInteriorHandle>; spec: CarSpec }) {
  const s = INTERIORS[spec.id];
  const p = s.palette;
  const root = useRef<Group>(null);
  const rim = useRef<Group>(null);
  const dash = useRef<DashHandle>(null);
  const lever = useRef<GearLeverHandle>(null);

  useImperativeHandle(ref, () => ({
    apply(pose) {
      if (!root.current?.visible) return;
      // A right turn is a negative road-wheel angle; the rim turns clockwise for the driver.
      if (rim.current) rim.current.rotation.z = -pose.steerAngle * WHEEL_RATIO;
      dash.current?.apply(pose);
      lever.current?.setGear(pose.gear);
    },
    setVisible(visible) {
      if (root.current) root.current.visible = visible;
    },
  }));

  const { halfWidth: hw, roofY, floorY, dashTopY, cowlZ, cowlY, dashDepth, screenTopZ, rearZ } = s;
  const beltY = s.doorTopY ?? dashTopY - 0.06;
  // Door cards run the whole side, cowl to rear bulkhead, so a glance into a corner never finds a hole.
  const doorZ0 = cowlZ;
  const doorZ1 = rearZ;
  // A-pillar from the dash corner up to the header.
  const pillarLen = Math.hypot(roofY - dashTopY, cowlZ - screenTopZ);
  const pillarTilt = -Math.atan2(cowlZ - screenTopZ, roofY - dashTopY);
  return (
    <group ref={root} visible={false}>
      {/* Floor, roof lining (self-lit a little so the ground light doesn't tint it), header, sun strip, mirror, map light */}
      <Box p={[0, floorY, (cowlZ + rearZ) / 2]} s={[hw * 2, 0.01, cowlZ - rearZ]} c="#2b2a33" />
      {/* Front wall below the dash (firewall and kick panels): a shallow dash must not show the outside */}
      <Box
        p={[0, (floorY + dashTopY) / 2, cowlZ - 0.01]}
        s={[hw * 2, dashTopY - floorY, 0.02]}
        c={p.door}
      />
      <Box
        p={[0, roofY, (screenTopZ + rearZ) / 2]}
        s={[hw * 2, 0.02, screenTopZ - rearZ]}
        c={p.lining}
        glow={0.45}
      />
      <Box p={[0, roofY - 0.02, screenTopZ]} s={[hw * 2, 0.045, 0.14]} c={p.lining} glow={0.2} />
      <Box p={[0, roofY - 0.075, screenTopZ + 0.1]} s={[hw * 2 - 0.1, 0.06, 0.012]} c="#2b2a33" />
      <Box p={[0, roofY - 0.108, screenTopZ + 0.1]} s={[hw * 2 - 0.1, 0.008, 0.014]} c={p.accent} />
      <Box p={[0, roofY - 0.07, screenTopZ - 0.04]} s={[0.02, 0.06, 0.02]} c="#2b2a33" />
      <Box p={[0, roofY - 0.12, screenTopZ - 0.07]} s={[0.26, 0.07, 0.02]} c="#4d6f8c" />
      <Box p={[0.12, roofY - 0.015, -0.2]} s={[0.08, 0.02, 0.1]} c="#2b2a33" />
      <Box p={[0.12, roofY - 0.027, -0.2]} s={[0.04, 0.006, 0.05]} c="#f4f1ea" glow={0.3} />
      {/* Pillars, door cards with pull straps and arm rests, both sides */}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box
            p={[(hw - 0.03) * side, (dashTopY + roofY) / 2, (cowlZ + screenTopZ) / 2]}
            s={[0.06, pillarLen, 0.07]}
            c={p.lining}
            r={[pillarTilt, 0, 0]}
          />
          <Box
            p={[(hw - 0.025) * side, (beltY + roofY) / 2, HOOP_Z]}
            s={[0.05, roofY - beltY, 0.08]}
            c={p.lining}
          />
          <Box
            p={[hw * side, (floorY + beltY) / 2, (doorZ0 + doorZ1) / 2]}
            s={[0.03, beltY - floorY, doorZ0 - doorZ1]}
            c={p.door}
          />
          <Box p={[(hw - 0.03) * side, beltY - 0.1, -0.15]} s={[0.06, 0.04, 0.5]} c="#2b2a33" />
          <Box
            p={[(hw - 0.02) * side, Math.max(floorY + 0.05, beltY - 0.3), 0.1]}
            s={[0.012, 0.03, 0.18]}
            c={p.accent}
          />
        </group>
      ))}
      {/* Rear bulkhead with a shelf where the cabin runs back */}
      <Box p={[0, (floorY + beltY) / 2, rearZ]} s={[hw * 2, beltY - floorY, 0.02]} c={p.lining} />
      {rearZ < HOOP_Z - 0.35 && (
        <Box
          p={[0, beltY, (HOOP_Z - 0.1 + rearZ) / 2]}
          s={[hw * 2, 0.02, HOOP_Z - 0.1 - rearZ]}
          c={p.door}
        />
      )}
      {/* Dash and knee roll, then the cluster */}
      <Box
        p={[0, dashTopY - 0.09, cowlZ - dashDepth / 2]}
        s={[hw * 2, 0.18, dashDepth]}
        c={p.dash}
      />
      <Box
        p={[0, dashTopY - 0.24, cowlZ - dashDepth / 4]}
        s={[hw * 2, 0.12, dashDepth / 2]}
        c={p.dash}
      />
      {/* Scuttle ledge up to the screen base, with a demister slot, where the hull's cowl sits above the dash */}
      {cowlY > dashTopY - 0.01 && (
        <>
          <Box
            p={[0, (dashTopY - 0.02 + cowlY + 0.01) / 2, cowlZ - 0.1]}
            s={[hw * 2, cowlY + 0.03 - dashTopY, 0.2]}
            c={p.dash}
          />
          <Box p={[0, cowlY + 0.012, cowlZ - 0.08]} s={[hw * 2 - 0.4, 0.006, 0.08]} c="#15141a" />
        </>
      )}
      <DashCluster ref={dash} spec={s} redlineRpm={spec.redlineRpm} />
      {s.raidKit && <RaidKit spec={s} />}
      <RollCage spec={s} />
      <SteeringWheel spec={s} rimRef={rim} />
      {/* Transmission tunnel with the gear lever, handbrake and intercom; seats; co-driver kit */}
      <Box p={[0, floorY + 0.06, -0.05]} s={[0.26, 0.12, 0.5]} c="#2b2a33" />
      <GearLever ref={lever} style={s.lever} p={p} position={[-0.04, floorY + 0.12, 0.12]} />
      <Handbrake position={[0.09, floorY + 0.12, -0.02]} />
      <BucketSeat x={EYE.x} p={p} />
      <BucketSeat x={s.coDriverX} p={p} />
      {/* Suspended seats stand on pedestals where the floor sits well below the cushions (the truck) */}
      {SEAT_BASE - floorY > 0.03 &&
        [EYE.x, s.coDriverX].map((x) => (
          <Box
            key={x}
            p={[x, (floorY + SEAT_BASE) / 2, -0.4]}
            s={[0.34, SEAT_BASE - floorY, 0.4]}
            c="#2b2a33"
          />
        ))}
      <CoDriverKit spec={s} x={s.coDriverX} />
      {s.extinguisher && <Extinguisher x={s.coDriverX} floorY={floorY} z={cowlZ - 0.55} />}
    </group>
  );
}
