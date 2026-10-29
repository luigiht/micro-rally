'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { resetControlInput } from '@/game/vehicle/ControlInput';
import { TOUCH_INPUT } from '@/components/game/input/touchInput';
import { useMessages } from '@/i18n/useMessages';
import { PixelIcon, type PixelIconName } from './PixelIcon';

interface PadButtonProps {
  icon: PixelIconName;
  label: string;
  onPress: (down: boolean) => void;
}

/** Momentary on-screen button: held while the pointer is down, released on up/cancel. */
function PadButton({ icon, label, onPress }: PadButtonProps) {
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
      <PixelIcon name={icon} className="size-6" />
    </button>
  );
}

/** Steer pad (left) and pedals (right), shown on coarse-pointer devices only. */
export function TouchControls() {
  const m = useMessages();
  const steer = useRef({ left: false, right: false });
  useEffect(() => () => resetControlInput(TOUCH_INPUT), []);

  const setSteer = (side: 'left' | 'right', down: boolean) => {
    steer.current[side] = down;
    TOUCH_INPUT.steer = (steer.current.right ? 1 : 0) - (steer.current.left ? 1 : 0);
  };

  return (
    <>
      <div className="absolute bottom-4 left-4 hidden flex-col items-start gap-3 coarse:flex">
        <PadButton
          icon="handbrake"
          label={m.touch.handbrake}
          onPress={(d) => (TOUCH_INPUT.handbrake = d)}
        />
        <div className="flex gap-3">
          <PadButton icon="left" label={m.touch.left} onPress={(d) => setSteer('left', d)} />
          <PadButton icon="right" label={m.touch.right} onPress={(d) => setSteer('right', d)} />
        </div>
      </div>
      <div className="absolute right-4 bottom-4 hidden gap-3 coarse:flex">
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
    </>
  );
}
