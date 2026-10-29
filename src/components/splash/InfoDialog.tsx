'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface InfoDialogProps {
  id: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Small modal note with one Close button. Esc closes; focus returns to the opener. */
export function InfoDialog({ id, title, closeLabel, onClose, children }: InfoDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="pixel-scrim absolute inset-0 z-10 grid place-items-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={onKeyDown}
        className="pixel-box w-full max-w-sm p-5"
      >
        <h2 id={`${id}-title`} className="font-pixel text-sm">
          {title}
        </h2>
        <div className="mt-3 text-sm">{children}</div>
        <button ref={closeRef} type="button" onClick={onClose} className="pixel-btn mt-5 w-full">
          {closeLabel}
        </button>
      </section>
    </div>
  );
}
