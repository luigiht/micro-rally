'use client';

import { useEffect } from 'react';

/** Keys that move or act on focus: pressing one means the player is driving the menus by keyboard. */
const NAV_KEYS = new Set([
  'Tab',
  'Enter',
  ' ',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);

/**
 * Menus focus their first control as they open (`autoFocus`), and browsers
 * draw `:focus-visible` for that before the player has done anything. While
 * mounted, this marks `<html data-focus-gate>` so globals.css hides focus
 * rings until a navigation key sets `data-focus-ring`; a pointer press
 * clears it again.
 */
export function useFocusRingGate() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-focus-gate', '');
    const onKey = (e: KeyboardEvent) => {
      if (NAV_KEYS.has(e.key)) root.setAttribute('data-focus-ring', '');
    };
    const onPointer = () => root.removeAttribute('data-focus-ring');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      root.removeAttribute('data-focus-gate');
      root.removeAttribute('data-focus-ring');
    };
  }, []);
}
