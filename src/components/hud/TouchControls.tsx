'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { resetControlInput } from '@/game/vehicle/ControlInput';
import { TOUCH_INPUT } from '@/components/game/input/touchInput';
import { applyUpgrades } from '@/game/economy/upgrades';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { PixelIcon, type PixelIconName } from './PixelIcon';

interface PadButtonProps {
  icon: PixelIconName;
  label: string;
  onPress: (down: boolean) => void;
  /** Icon size: 8×8 glyphs draw at 3× (24 px), 16×16 ones at 2× (32 px), so pixels stay square. */
  iconSize?: string;
}

/** Momentary on-screen button: held while the pointer is down, released on up/cancel. */
function PadButton({ icon, label, onPress, iconSize = 'size-6' }: PadButtonProps) {
  const start = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onPress(true);
  };
  const end = () => onPress(false);
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
      className="pixel-btn-ghost pointer-events-auto grid size-14 touch-none place-items-center p-0 select-none"
    >
      <PixelIcon name={icon} className={iconSize} />
    </button>
  );
}

/**
 * Steer pad (left) with the turbo over steer-left when the car has one;
 * handbrake over the pedals (right). Shown on coarse-pointer devices only.
 */
export function TouchControls() {
  const m = useMessages();
  const hasTurbo = useGameStore(
    (s) => applyUpgrades(CAR_SPECS[s.carId], s.upgrades).turboForce > 0,
  );
  const steer = useRef({ left: false, right: false });
  useEffect(() => () => resetControlInput(TOUCH_INPUT), []);

  const setSteer = (side: 'left' | 'right', down: boolean) => {
    steer.current[side] = down;
    TOUCH_INPUT.steer = (steer.current.right ? 1 : 0) - (steer.current.left ? 1 : 0);
  };

  return (
    <>
      <div className="absolute bottom-4 left-4 hidden flex-col items-start gap-3 coarse:flex">
        {hasTurbo && (
          <PadButton
            icon="turbo"
            label={m.touch.turbo}
            iconSize="size-8"
            onPress={(d) => (TOUCH_INPUT.turbo = d)}
          />
        )}
        <div className="flex gap-3">
          <PadButton icon="left" label={m.touch.left} onPress={(d) => setSteer('left', d)} />
          <PadButton icon="right" label={m.touch.right} onPress={(d) => setSteer('right', d)} />
        </div>
      </div>
      <div className="absolute right-4 bottom-4 hidden flex-col items-end gap-3 coarse:flex">
        <PadButton
          icon="handbrake"
          label={m.touch.handbrake}
          onPress={(d) => (TOUCH_INPUT.handbrake = d)}
        />
        <div className="flex gap-3">
          <PadButton
            icon="down"
            label={m.touch.brake}
            onPress={(d) => (TOUCH_INPUT.brake = d ? 1 : 0)}
          />
          <PadButton
            icon="up"
            label={m.touch.gas}
            onPress={(d) => (TOUCH_INPUT.throttle = d ? 1 : 0)}
          />
        </div>
      </div>
    </>
  );
}
