import type { CarId, CarSpec } from '@/game/vehicle/CarSpec';

/**
 * Tyre widths per car, front and rear, where they differ from the default (0.8 × the radius,
 * truck tyres as fat as they are tall): a single-seater's narrow fronts and wide rear slicks.
 */
const OWN: Partial<Record<CarId, { readonly front: number; readonly rear: number }>> = {
  formula: { front: 0.3, rear: 0.44 },
};

/** A car's tyre widths, front and rear, metres: what `CarModel` draws and its tyre marks are laid at. */
export function tyreWidths(spec: CarSpec): { readonly front: number; readonly rear: number } {
  return OWN[spec.id] ?? { front: spec.wheelRadius * 0.8, rear: spec.wheelRadius * 0.8 };
}
