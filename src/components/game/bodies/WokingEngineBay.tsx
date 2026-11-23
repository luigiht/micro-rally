'use client';

import { Box, Tube } from '../CarParts';

const C = {
  block: '#55555c',
  cam: '#2a2a30',
  camStripe: '#c9302c',
  alloy: '#b4b4ba',
  turbo: '#8d8d93',
  exhaust: '#9c9ca2',
  gearbox: '#4a4a50',
  damper: '#d9b22a',
  carbon: '#26262b',
  tail: '#d8231b',
} as const;

const SIDES = [1, -1] as const;
/** The V6's banks lean out this far from upright, radians. */
const BANK_LEAN = 0.5;
/** Along each bank: its three cylinders' intake trumpets. */
const CYLINDERS = [-1.12, -1.22, -1.32] as const;
/** The gearbox's casting ribs along its flanks. */
const RIBS = [-1.45, -1.55, -1.65] as const;

/**
 * The Woking V6 Turbo's engine bay, bare behind the engine cover's open end over the rear axle
 * (`WokingShape`): the turbo V6's two banks with black cam covers striped red, three intake
 * trumpets a bank under a plenum in the vee, a turbo each side with its exhaust straight back
 * out under the rear wing; the bellhousing, then the ribbed gearbox out
 * under the wing with the inboard rear dampers on it and the rain light on its tail; a cross tube.
 * Coordinates in the body's frame (`WokingBody`).
 */
export function WokingEngineBay() {
  return (
    <>
      {SIDES.map((side) => (
        <group key={side}>
          {/* A bank, its cam cover and the cover's red stripe */}
          <group position={[0.1 * side, 0.46, -1.24]} rotation={[0, 0, -BANK_LEAN * side]}>
            <Box p={[0, 0, 0]} s={[0.11, 0.1, 0.3]} c={C.block} />
            <Box p={[0, 0.06, 0]} s={[0.09, 0.025, 0.3]} c={C.cam} />
            <Box p={[0, 0.074, 0]} s={[0.025, 0.006, 0.26]} c={C.camStripe} />
          </group>
          {/* The bank's intake trumpets, rising into the plenum */}
          {CYLINDERS.map((z) => (
            <Tube
              key={z}
              a={[0.04 * side, 0.48, z]}
              b={[0.035 * side, 0.565, z]}
              r={0.018}
              c={C.alloy}
            />
          ))}
          {/* The turbo: its turbine and compressor */}
          <Tube
            a={[0.17 * side, 0.36, -1.36]}
            b={[0.26 * side, 0.36, -1.36]}
            r={0.06}
            c={C.turbo}
          />
          <Tube
            a={[0.19 * side, 0.36, -1.29]}
            b={[0.25 * side, 0.36, -1.29]}
            r={0.045}
            c={C.alloy}
          />
          {/* The exhaust from the turbo straight back out under the rear wing */}
          <Tube
            a={[0.21 * side, 0.34, -1.36]}
            b={[0.16 * side, 0.38, -1.68]}
            r={0.028}
            c={C.exhaust}
          />
          {/* An inboard rear damper lying on the gearbox, its spring yellow */}
          <Tube
            a={[0.05 * side, 0.39, -1.44]}
            b={[0.19 * side, 0.45, -1.27]}
            r={0.022}
            c={C.damper}
          />
          <Tube
            a={[0.03 * side, 0.385, -1.47]}
            b={[0.06 * side, 0.395, -1.43]}
            r={0.01}
            c={C.alloy}
          />
          {/* The gearbox's casting ribs */}
          {RIBS.map((z) => (
            <Box key={z} p={[0.125 * side, 0.28, z]} s={[0.012, 0.17, 0.02]} c={C.block} />
          ))}
        </group>
      ))}
      {/* The plenum over the trumpets in the vee */}
      <Box p={[0, 0.58, -1.22]} s={[0.12, 0.04, 0.32]} c={C.alloy} />
      {/* Bellhousing, gearbox and its tail with the rain light, the cross tube */}
      <Box p={[0, 0.3, -1.3]} s={[0.3, 0.22, 0.2]} c={C.block} />
      <Box p={[0, 0.28, -1.55]} s={[0.24, 0.19, 0.4]} c={C.gearbox} />
      <Box p={[0, 0.28, -1.76]} s={[0.16, 0.13, 0.03]} c={C.block} />
      <Tube a={[-0.45, 0.42, -1.32]} b={[0.45, 0.42, -1.32]} r={0.016} c={C.carbon} />
      <Box p={[0, 0.3, -1.78]} s={[0.09, 0.05, 0.02]} c={C.tail} glow={0.5} />
    </>
  );
}
