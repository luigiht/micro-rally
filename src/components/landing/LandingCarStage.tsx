'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { Group } from 'three';
import { CarModel, type CarModelHandle } from '@/components/game/CarModel';
import { CAR_SPECS, type CarId } from '@/game/vehicle/CarSpec';
import { createVehiclePose } from '@/game/vehicle/interpolatePose';

/** The car at rest at the origin. */
const REST = createVehiclePose();
/** Auto-spin, rad/s. */
const SPIN_RATE = 0.5;
/** Drag: radians per pixel moved. */
const DRAG_GAIN = 0.012;
/** How fast a flick's speed settles back to the auto-spin, per second. */
const SETTLE = 2.5;
/** One arrow-key press turns the car this far. */
const KEY_STEP = Math.PI / 12;
/** The angle a car is first shown at: three-quarter front, as the renders are. */
const START_ANGLE = 0.15;
const LOOK_AT_HEIGHT = 0.55;
/** How far back the camera stands, against the game's dealership turntable: the stage is squarer. */
const FRAME = 1.15;
/**
 * Phones: the stage runs up under the stats and the hint (see landing.css),
 * so the camera stands a little farther back and aims higher, which sets the
 * car lower in the frame, clear of them.
 */
const PHONE_QUERY = '(max-width: 620px)';
const PHONE_FRAME = 1.3;
const PHONE_LOOK_AT_HEIGHT = 1.05;

function subscribePhone(onChange: () => void): () => void {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function usePhoneFraming(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
/** The renders' sky and ground, so the stage and its poster match. */
const SKY = '#e2f6f5';
const GROUND = '#c6cbaf';

/** Spin state, shared by the pointer handlers and the frame loop; never in React state. */
interface Spin {
  angle: number;
  /** Current turn speed, rad/s; eases back to the auto-spin when let go. */
  speed: number;
  dragging: boolean;
  lastX: number;
  lastT: number;
}

/** Frames the car: stands the camera back by the vehicle's `bodyScale`, so the truck fits like the cars. */
function CameraFit({ scale, phone }: { scale: number; phone: boolean }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { camera } = get();
    const frame = (phone ? PHONE_FRAME : FRAME) * scale;
    camera.position.set(3.8 * frame, 1.8 * frame, 4.75 * frame);
    camera.far = 60 * scale;
    camera.lookAt(0, (phone ? PHONE_LOOK_AT_HEIGHT : LOOK_AT_HEIGHT) * scale, 0);
    camera.updateProjectionMatrix();
  }, [get, scale, phone]);
  return null;
}

function Turntable({
  id,
  spinRef,
  autoSpin,
}: {
  id: CarId;
  spinRef: RefObject<Spin>;
  autoSpin: boolean;
}) {
  const group = useRef<Group>(null);
  const car = useRef<CarModelHandle>(null);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const spin = spinRef.current;
    car.current?.apply(REST);
    if (!spin.dragging) {
      const target = autoSpin ? SPIN_RATE : 0;
      spin.speed += (target - spin.speed) * Math.min(1, dt * SETTLE);
      spin.angle += spin.speed * dt;
    }
    if (group.current) group.current.rotation.y = spin.angle;
  });
  return (
    <group ref={group}>
      <CarModel ref={car} spec={CAR_SPECS[id]} />
    </group>
  );
}

interface Props {
  id: CarId;
  /** Read out to screen readers; says how to turn the car. */
  label: string;
  /** Off under reduced motion: the car holds still until dragged. */
  autoSpin: boolean;
  /** Draw frames only while the section is on screen. */
  active: boolean;
  /** Called once the first frame is drawn, so the still render under it can fade out. */
  onReady: () => void;
}

/**
 * The garage's live car: the game's own `CarModel` on a turntable that turns
 * by itself and can be dragged (mouse or touch, with a little momentum) or
 * turned with the arrow keys. One canvas serves every car; switching cars
 * only swaps the model and resets the angle.
 */
export default function LandingCarStage({ id, label, autoSpin, active, onReady }: Props) {
  const spin = useRef<Spin>({ angle: START_ANGLE, speed: 0, dragging: false, lastX: 0, lastT: 0 });
  const phone = usePhoneFraming();

  useEffect(() => {
    spin.current.angle = START_ANGLE;
    spin.current.speed = 0;
  }, [id]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(spin.current, { dragging: true, speed: 0, lastX: e.clientX, lastT: e.timeStamp });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (!s.dragging) return;
    const turn = (e.clientX - s.lastX) * DRAG_GAIN;
    const dt = Math.max((e.timeStamp - s.lastT) / 1000, 1 / 240);
    s.angle += turn;
    // Smoothed so one jittery event doesn't set the flick speed.
    s.speed = s.speed * 0.6 + (turn / dt) * 0.4;
    s.lastX = e.clientX;
    s.lastT = e.timeStamp;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (!s.dragging) return;
    s.dragging = false;
    // Held still before letting go: no flick.
    if (e.timeStamp - s.lastT > 80) s.speed = 0;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    spin.current.angle += e.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP;
    spin.current.speed = 0;
  };

  return (
    <div
      className="car-stage"
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        camera={{ fov: 32, near: 0.1 }}
        onCreated={() => requestAnimationFrame(onReady)}
      >
        <color attach="background" args={[SKY]} />
        <CameraFit scale={CAR_SPECS[id].bodyScale} phone={phone} />
        <hemisphereLight args={['#fff6e0', '#7fa05f', 1.6]} />
        <directionalLight position={[4, 6, 3]} intensity={2.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <circleGeometry args={[4.2 * CAR_SPECS[id].bodyScale, 48]} />
          <meshStandardMaterial color={GROUND} flatShading />
        </mesh>
        <Turntable key={id} id={id} spinRef={spin} autoSpin={autoSpin} />
      </Canvas>
    </div>
  );
}
