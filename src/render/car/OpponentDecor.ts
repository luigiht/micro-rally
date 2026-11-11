import {
  CanvasTexture,
  Mesh,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Material,
  type Object3D,
} from 'three';

/** Tag height as a share of the view: a constant size at any distance, so it marks a far car too. */
const TAG_SCALE = 0.045;
export const TAG_FONT = '"Press Start 2P", monospace';
const FONT_PX = 24;
const TAG_PX = 64;
const PAPER = '#f9f4eb';
const INK = '#2b2a33';

/**
 * What sets the other driver's car apart: a name tag that floats above it
 * (a sprite to add to the scene) and a fade for its materials, so it can
 * get out of the way when it overlaps this driver's car.
 */
export class OpponentDecor {
  readonly tag: Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly map = new CanvasTexture(this.canvas);
  private materials: Material[] = [];
  private opacity = 1;

  constructor() {
    this.map.colorSpace = SRGBColorSpace;
    this.tag = new Sprite(
      new SpriteMaterial({
        map: this.map,
        sizeAttenuation: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.tag.center.set(0.5, 0);
    this.tag.renderOrder = 10;
    this.tag.visible = false;
  }

  /** Draw `name` on the tag in the HUD's ink-on-paper style and size the sprite to it. */
  paint(name: string): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = `${FONT_PX}px ${TAG_FONT}`;
    const w = Math.ceil(ctx.measureText(name).width) + 40;
    this.canvas.width = w;
    this.canvas.height = TAG_PX;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, TAG_PX);
    ctx.fillStyle = PAPER;
    ctx.fillRect(4, 4, w - 8, TAG_PX - 8);
    ctx.fillStyle = INK;
    ctx.font = `${FONT_PX}px ${TAG_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, TAG_PX / 2 + 2);
    this.tag.scale.set((TAG_SCALE * w) / TAG_PX, TAG_SCALE, 1);
    this.map.needsUpdate = true;
  }

  /** Make every material under `root` fadeable (the car's own; whoever built them disposes them). */
  adopt(root: Object3D): void {
    const found = new Set<Material>();
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as Material[]) {
        m.transparent = true;
        m.opacity = 1;
        found.add(m);
      }
    });
    this.materials = [...found];
    this.opacity = 1;
  }

  fade(opacity: number): void {
    if (Math.abs(opacity - this.opacity) < 0.02 && !(opacity === 1 && this.opacity !== 1)) return;
    this.opacity = opacity;
    for (const m of this.materials) m.opacity = opacity;
  }

  /** Show the tag at a point (above the car), or hide it. */
  place(visible: boolean, x = 0, y = 0, z = 0): void {
    this.tag.visible = visible;
    if (visible) this.tag.position.set(x, y, z);
  }

  dispose(): void {
    this.tag.removeFromParent();
    this.tag.material.dispose();
    this.map.dispose();
    this.materials = [];
  }
}
