/** The feedback form's question asks for this; kept server-side so the page never carries it. */
const ANSWER = 'ford';

/** Whether a reply to the form's question is right: case, spacing and trailing punctuation aside. */
export function answerOk(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[.!?¡¿"'\s]+/g, '') === ANSWER
  );
}
