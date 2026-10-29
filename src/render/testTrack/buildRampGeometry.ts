import { ExtrudeGeometry, Shape } from 'three';

/** Wedge ramp: rises along +Z from 0 to `height` over `length`, `width` wide, centred on X. */
export function buildRampGeometry(length: number, height: number, width: number): ExtrudeGeometry {
  const profile = new Shape();
  profile.moveTo(0, 0);
  profile.lineTo(length, height);
  profile.lineTo(length, 0);
  profile.closePath();
  const geo = new ExtrudeGeometry(profile, { depth: width, bevelEnabled: false });
  // Profile X -> world Z, extrusion -> world X.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return geo;
}
