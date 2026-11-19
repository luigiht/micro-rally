'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface HudDialogProps {
  id: string;
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** Under the content, directly above the Close button; scrolls with it. */
  footer?: ReactNode;
  /** Extra classes for the panel, e.g. a wider max width on short screens. */
  className?: string;
}

/** Scrimmed modal panel used by the Game and Settings screens. */
export function HudDialog({
  id,
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
  footer,
  className = '',
}: HudDialogProps) {
  const titleId = `${id}-title`;
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus Close as the panel opens without scrolling to it: it sits at the end of the scrolling content.
  useEffect(() => closeRef.current?.focus({ preventScroll: true }), []);
  return (
    <div className="pixel-scrim pointer-events-auto absolute inset-0 flex items-center justify-center p-4 short:p-2 md:p-8">
      {/* min-w-0 stops wide children (the 3D preview canvas) from pushing the panel past the screen. */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`pixel-box flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-lg flex-col p-5 short:max-h-[calc(100dvh-1rem)] short:p-3 md:max-h-[calc(100dvh-4rem)] md:p-6 ${className}`}
      >
        <div className="-mx-3 min-h-0 overflow-y-auto px-3 pb-3">
          <h2 id={titleId} className="font-pixel text-lg short:text-base">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm text-ink/70 short:mt-1 short:text-xs">{subtitle}</p>
          )}
          {children}
          {/* The actions scroll with the content, so a short screen never stacks them over it. */}
          <div className={`flex flex-col gap-4 ${footer ? 'mt-5' : 'mt-6'} short:mt-3`}>
            {footer}
            <button ref={closeRef} type="button" onClick={onClose} className="pixel-btn w-full">
              {closeLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
