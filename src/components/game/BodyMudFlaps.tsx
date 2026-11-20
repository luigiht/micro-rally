'use client';

import type { CarId, CarSpec } from '@/game/vehicle/CarSpec';
import { Box, CAR_COLORS as C } from './CarParts';

/** Cars that hang mud flaps behind their front wheels too (every car has rear ones). */
const FRONT_FLAPS: ReadonlySet<CarId> = new Set<CarId>(['coupe', 'wrc', 'groupb', 's1', 'focus']);

/** The flap stands this far behind the tyre: clear of its trailing corner at full lock. */
const GAP = 0.05;
const THICK = 0.03;
/** The hull's wheel wells are cut this much wider than the wheel (`wellsFor`). */
const WELL_CLEARANCE = 0.08;
/** The flap's top runs this far up into the body over the arch's edge, so it never shows a gap. */
const TUCK = 0.05;

/**
 * The Sirocco hangs all four of its flaps from the body: from the cab's floor behind the front
 * tyres (its steps moved back clear of them, `DakarTruckBody`) and from the cargo box's floor
 * behind the rear ones, within the body's width, so none shows a gap under the floor.
 */
const DAKAR = { gap: 0.08, floor: 0.95, x: 0.99, width: 0.38 };

/** One flap either side, from `bottom` up to `top`, centred `x` out, at `z`. */
function FlapPair({
  x,
  z,
  width,
  top,
  bottom,
}: {
  x: number;
  z: number;
  width: number;
  top: number;
  bottom: number;
}) {
  return (
    <>
      {([1, -1] as const).map((side) => (
        <Box
          key={side}
          p={[x * side, (top + bottom) / 2, z]}
          s={[width, top - bottom, THICK]}
          c={C.trim}
        />
      ))}
    </>
  );
}

/**
 * Mud flaps hung from the body, in the root frame, for a body's group: they ride and lean with
 * the body rather than staying with the wheels. Behind the front wheels of `FRONT_FLAPS` cars,
 * each from the wheel arch's trailing edge, its top tucked into the body, its foot level with the
 * rear flaps'; and all four of the Sirocco's (it is in `CarModel.OWN_FLAPS`).
 */
export function BodyMudFlaps({ spec }: { spec: CarSpec }) {
  const r = spec.wheelRadius;
  const bottom = 0.35 * r;
  if (spec.id === 'dakar') {
    const behind = r + DAKAR.gap + THICK / 2;
    const flap = { x: DAKAR.x, width: DAKAR.width, top: DAKAR.floor + TUCK, bottom };
    return (
      <>
        <FlapPair {...flap} z={spec.cgToFront - behind} />
        <FlapPair {...flap} z={-spec.cgToRear - behind} />
      </>
    );
  }
  if (!FRONT_FLAPS.has(spec.id)) return null;
  const behind = r + GAP + THICK / 2;
  // The arch's edge over the flap: the well's circle at this distance behind the axle.
  const well = r + WELL_CLEARANCE;
  const top = r + Math.sqrt(Math.max(0, well * well - behind * behind)) + TUCK;
  return (
    <FlapPair
      x={spec.trackWidth / 2}
      z={spec.cgToFront - behind}
      width={0.8 * r}
      top={top}
      bottom={bottom}
    />
  );
}
