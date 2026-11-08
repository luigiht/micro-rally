import type { PaceGrade, PaceSide } from '@/game/stage/PaceNotes';
import { CARD, paceNotePixels, pixelPath } from './paceNotePixels';

/** Red for the sharpest calls through orange and yellow to green for a 6. */
export const PACE_COLORS: Record<string, string> = {
  acute: '#ff2d6a',
  hairpin: '#ff2a3a',
  square: '#ff6a1a',
  '1': '#ff8c1a',
  '2': '#ffad1f',
  '3': '#ffd21f',
  '4': '#e8f01f',
  '5': '#a6ef2a',
  '6': '#3fe04a',
};

const FILL = '#1e1418';
const DIGIT = '#f4ecd8';
const OUTLINE = '#2b2a33';

/** One pace-note card in pixel art (see `paceNotePixels`), in the grade's colour with a soft glow. */
export function PaceNoteIcon({
  grade,
  side,
  className,
}: {
  grade: PaceGrade;
  side: PaceSide;
  /** Sizing classes; the card is square. */
  className: string;
}) {
  const color = PACE_COLORS[String(grade)]!;
  const px = paceNotePixels(grade, side);
  return (
    <svg
      viewBox={`0 0 ${CARD} ${CARD}`}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
    >
      <rect x="2" y="2" width={CARD - 4} height={CARD - 4} fill={FILL} fillOpacity="0.9" />
      <path d={pixelPath(px.dots)} fill={color} fillOpacity="0.22" />
      <path d={pixelPath(px.frame)} fill={color} />
      <path d={pixelPath(px.arrow)} fill={color} />
      <path d={pixelPath(px.outline)} fill={OUTLINE} />
      <path d={pixelPath(px.digit)} fill={DIGIT} />
    </svg>
  );
}
