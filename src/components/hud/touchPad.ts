/**
 * The look every on-screen touch pad shares: a 56 px square with its icon
 * centred, which swallows gestures and long-press selection. The driving pads
 * (TouchControls) and the touch toolbar (Pause, back to checkpoint) both use
 * it, so the top and bottom rows match. Clusters of pads sit 16 px from the
 * screen edges with 12 px between neighbours (`*-4`, `gap-3`). Display
 * classes are left to the caller.
 *
 * A borderless HUD box beside a row of pads (the clock up top, the speed
 * readout below) lines up with the pads' cream faces, not their 4 px ink
 * rings: `h-14`, 16 px from the edge.
 */
export const PAD_BUTTON = 'pixel-btn-ghost size-14 touch-none place-items-center p-0 select-none';
