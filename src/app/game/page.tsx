import type { Metadata } from 'next';
import { GameRoot } from '@/components/game/GameRoot';
import { en } from '@/i18n/messages/en';

/** The game itself. The landing page at `/` links here; the installed app opens here. */
export const metadata: Metadata = {
  title: { absolute: en.meta.title },
  alternates: { canonical: '/game' },
};

export default function Game() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GameRoot />
    </main>
  );
}
