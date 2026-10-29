'use client';

import type { ReactNode } from 'react';

interface HudDialogProps {
  id: string;
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Scrimmed modal panel used by the Game and Settings screens. */
export function HudDialog({ id, title, subtitle, closeLabel, onClose, children }: HudDialogProps) {
  const titleId = `${id}-title`;
  return (
    <div className="pixel-scrim pointer-events-auto absolute inset-0 grid place-items-center p-4 md:p-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pixel-box flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col p-5 md:max-h-[calc(100dvh-4rem)] md:p-6"
      >
        <div className="-mx-3 min-h-0 overflow-y-auto px-3 pb-3">
          <h2 id={titleId} className="font-pixel text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-2 text-sm text-ink/70">{subtitle}</p>}
          {children}
        </div>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="pixel-btn mt-6 mb-1 w-full shrink-0"
        >
          {closeLabel}
        </button>
      </section>
    </div>
  );
}
