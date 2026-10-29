import { createControlInput } from '@/game/vehicle/ControlInput';

/**
 * Control input written by the on-screen TouchControls and read by the
 * DrivingSession each physics step. A plain shared object: no React state on
 * the hot path, and the HUD (outside the canvas) can reach it without props.
 */
export const TOUCH_INPUT = createControlInput();
