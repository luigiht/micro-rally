/** 8×8 one-bit glyphs drawn as crisp SVG rects in the current text colour. `garage` is a car seen head-on. */
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
  | 'garage';

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
  handbrake: [
    '.#####..',
    '.#....#.',
    '.#....#.',
    '.#####..',
    '.#......',
    '.#......',
    '.#......',
    '........',
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
};

interface PixelIconProps {
  name: PixelIconName;
  className?: string;
}

export function PixelIcon({ name, className }: PixelIconProps) {
  const rows = GLYPHS[name];
  return (
    <svg
      viewBox="0 0 8 8"
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
