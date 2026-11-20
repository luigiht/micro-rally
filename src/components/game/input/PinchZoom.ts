/**
 * Two-finger pinch on the game canvas, turned into the mouse wheel's zoom: spreading the fingers
 * zooms in, closing them zooms out. Only touches that start on the canvas count, so the on-screen
 * pads (buttons over it) never pinch. The canvas takes `touch-action: none` while attached, so
 * the browser doesn't zoom the page instead.
 */

/** The rigs zoom by `exp(delta × 0.001)` per wheel delta (`ChaseCameraRig.zoom`). */
const WHEEL_RATE = 0.001;

/**
 * The wheel delta that scales the camera's distance by the fingers' spread change: half the
 * spread, twice the distance. Positive zooms out, as the wheel's does.
 */
export function pinchDelta(previousSpread: number, spread: number): number {
  if (previousSpread <= 0 || spread <= 0) return 0;
  return Math.log(previousSpread / spread) / WHEEL_RATE;
}

export class PinchZoom {
  private target: HTMLElement | null = null;
  private spread = 0;
  private previousTouchAction = '';

  constructor(private readonly zoom: (delta: number) => void) {}

  attach(target: HTMLElement): void {
    this.target = target;
    this.previousTouchAction = target.style.touchAction;
    target.style.touchAction = 'none';
    target.addEventListener('touchstart', this.onTouch, { passive: false });
    target.addEventListener('touchmove', this.onMove, { passive: false });
    target.addEventListener('touchend', this.onTouch);
    target.addEventListener('touchcancel', this.onTouch);
  }

  detach(): void {
    const t = this.target;
    if (!t) return;
    t.style.touchAction = this.previousTouchAction;
    t.removeEventListener('touchstart', this.onTouch);
    t.removeEventListener('touchmove', this.onMove);
    t.removeEventListener('touchend', this.onTouch);
    t.removeEventListener('touchcancel', this.onTouch);
    this.target = null;
    this.spread = 0;
  }

  /** Fingers down or up: start (or restart) from the current spread, or stop with fewer than two. */
  private readonly onTouch = (e: TouchEvent): void => {
    this.spread = spreadOf(e.targetTouches);
    if (this.spread > 0 && e.cancelable) e.preventDefault();
  };

  private readonly onMove = (e: TouchEvent): void => {
    const spread = spreadOf(e.targetTouches);
    if (spread <= 0) return;
    if (e.cancelable) e.preventDefault();
    if (this.spread > 0) this.zoom(pinchDelta(this.spread, spread));
    this.spread = spread;
  };
}

/** The distance between the first two touches, or 0 with fewer than two. */
function spreadOf(touches: TouchList): number {
  const a = touches[0];
  const b = touches[1];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
