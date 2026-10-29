import { createControlInput, type ControlInput } from '@/game/vehicle/ControlInput';

export type KeyAction = 'reset' | 'camera' | 'debug' | 'pause';

const ACTIONS: Readonly<Record<string, KeyAction>> = {
  KeyR: 'reset',
  KeyC: 'camera',
  KeyV: 'camera',
  Backquote: 'debug',
  Escape: 'pause',
};

const DRIVING_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'KeyQ',
  'KeyE',
]);

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Maps keyboard state to a ControlInput the sim reads each step. */
export class KeyboardControls {
  readonly input: ControlInput = createControlInput();
  private readonly down = new Set<string>();

  constructor(private readonly onAction: (action: KeyAction) => void) {}

  attach(target: Window): void {
    target.addEventListener('keydown', this.handleDown);
    target.addEventListener('keyup', this.handleUp);
    target.addEventListener('blur', this.handleBlur);
  }

  detach(target: Window): void {
    target.removeEventListener('keydown', this.handleDown);
    target.removeEventListener('keyup', this.handleUp);
    target.removeEventListener('blur', this.handleBlur);
    this.handleBlur();
  }

  private readonly handleDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    if (DRIVING_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat && e.code === 'KeyE') this.input.shiftUp = true;
      if (!e.repeat && e.code === 'KeyQ') this.input.shiftDown = true;
      this.down.add(e.code);
      this.sync();
      return;
    }
    const action = ACTIONS[e.code];
    if (action && !e.repeat) {
      e.preventDefault();
      this.onAction(action);
    }
  };

  private readonly handleUp = (e: KeyboardEvent): void => {
    if (this.down.delete(e.code)) this.sync();
  };

  private readonly handleBlur = (): void => {
    this.down.clear();
    this.sync();
  };

  private sync(): void {
    const d = this.down;
    const i = this.input;
    i.throttle = d.has('KeyW') || d.has('ArrowUp') ? 1 : 0;
    i.brake = d.has('KeyS') || d.has('ArrowDown') ? 1 : 0;
    const left = d.has('KeyA') || d.has('ArrowLeft') ? 1 : 0;
    const right = d.has('KeyD') || d.has('ArrowRight') ? 1 : 0;
    i.steer = right - left;
    i.handbrake = d.has('Space');
    i.turbo = d.has('ShiftLeft') || d.has('ShiftRight');
  }
}
