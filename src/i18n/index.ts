import type { Messages } from './messages/en';
import { en } from './messages/en';
import { es } from './messages/es';
import { it } from './messages/it';

export type Locale = 'en' | 'es' | 'it';
export type { Messages };

export const LOCALES: readonly Locale[] = ['en', 'es', 'it'];

const dictionaries: Record<Locale, Messages> = { en, es, it };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
