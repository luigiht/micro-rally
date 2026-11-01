/**
 * One-bit glyphs (8×8 unless noted) drawn as crisp SVG rects in the current text colour.
 * `garage` is a car seen head-on; `handbrake` is a pedal pad with grip
 * ridges; the surface glyphs are a road with a dashed centre line, pebbles,
 * a puddle, a snowflake and grass blades.
 */
export type PixelIconName =
  | 'restart'
  | 'settings'
  | 'game'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'handbrake'
  | 'pointer'
  | 'help'
  | 'pause'
  | 'garage'
  | 'tarmac'
  | 'gravel'
  | 'mud'
  | 'snow'
  | 'grass';

const GLYPHS: Record<PixelIconName, readonly string[]> = {
  restart: [
    '..###...',
    '.#...#.#',
    '#.....##',
    '#....###',
    '#.......',
    '#......#',
    '.#....#.',
    '..####..',
  ],
  settings: [
    '...##...',
    '.######.',
    '.##..##.',
    '##....##',
    '##....##',
    '.##..##.',
    '.######.',
    '...##...',
  ],
  game: [
    '........',
    '.######.',
    '##.#####',
    '#...#.##',
    '##.###.#',
    '########',
    '###..###',
    '........',
  ],
  left: [
    '....#...',
    '...##...',
    '..###...',
    '.#######',
    '..###...',
    '...##...',
    '....#...',
    '........',
  ],
  right: [
    '...#....',
    '...##...',
    '...###..',
    '#######.',
    '...###..',
    '...##...',
    '...#....',
    '........',
  ],
  up: [
    '...#....',
    '..###...',
    '.#####..',
    '#######.',
    '...#....',
    '...#....',
    '...#....',
    '...#....',
  ],
  down: [
    '...#....',
    '...#....',
    '...#....',
    '...#....',
    '#######.',
    '.#####..',
    '..###...',
    '...#....',
  ],
  // 12×14, two-pixel strokes: a bevelled pedal pad with two grip ridges on its arm and foot.
  handbrake: [
    '..########..',
    '.##########.',
    '##........##',
    '##.######.##',
    '##.######.##',
    '##........##',
    '##.######.##',
    '##.######.##',
    '##........##',
    '.##########.',
    '..########..',
    '....####....',
    '....####....',
    '...######...',
  ],
  pointer: [
    '.......#',
    '.....###',
    '...#####',
    '.#######',
    '...#####',
    '.....###',
    '.......#',
    '........',
  ],
  help: [
    '..####..',
    '.##..##.',
    '.....##.',
    '....##..',
    '...##...',
    '...##...',
    '........',
    '...##...',
  ],
  pause: [
    '........',
    '.##..##.',
    '.##..##.',
    '.##..##.',
    '.##..##.',
    '.##..##.',
    '.##..##.',
    '........',
  ],
  garage: [
    '........',
    '..####..',
    '.#....#.',
    '########',
    '#.#..#.#',
    '########',
    '.##..##.',
    '........',
  ],
  tarmac: [
    '#..##..#',
    '#..##..#',
    '#......#',
    '#..##..#',
    '#..##..#',
    '#......#',
    '#..##..#',
    '#..##..#',
  ],
  gravel: [
    '........',
    '.##...#.',
    '.##..###',
    '......#.',
    '..#.....',
    '.###.##.',
    '..#..##.',
    '........',
  ],
  mud: [
    '..#.....',
    '.....#..',
    '..####..',
    '.######.',
    '########',
    '.######.',
    '..####..',
    '........',
  ],
  snow: [
    '...#....',
    '.#.#.#..',
    '..###...',
    '#######.',
    '..###...',
    '.#.#.#..',
    '...#....',
    '........',
  ],
  grass: [
    '........',
    '.#......',
    '.#..#..#',
    '#.#.#.#.',
    '#.#.##.#',
    '.##.#.##',
    '.#..#.#.',
    '########',
  ],
};

interface PixelIconProps {
  name: PixelIconName;
  className?: string;
}

export function PixelIcon({ name, className }: PixelIconProps) {
  const rows = GLYPHS[name];
  const cols = rows[0]!.length;
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows.length}`}
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      fill="currentColor"
      className={className}
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null,
        ),
      )}
    </svg>
  );
}
