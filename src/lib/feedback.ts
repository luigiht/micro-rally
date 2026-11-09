/** Where feedback goes, and the limits a submission must keep. Shared by the form and the API route. */
export const FEEDBACK_TO = 'luis@luigiht.com';
export const FEEDBACK_NAME_MAX = 60;
export const FEEDBACK_EMAIL_MAX = 254;
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 4000;

export interface Feedback {
  name: string;
  /** Optional reply address; empty when not given. */
  email: string;
  message: string;
}

export type FeedbackError = 'invalid_json' | 'invalid_email' | 'invalid_message' | 'invalid_name';

// One line, no spaces or angle brackets: safe as a reply-to header value.
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/** Single-line text with control characters (CR/LF included) removed. */
function oneLine(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

/** Validate a submission from the network; `website` is a honeypot real people leave empty. */
export function parseFeedback(
  raw: unknown,
): { ok: true; feedback: Feedback; spam: boolean } | { ok: false; error: FeedbackError } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'invalid_json' };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const name = oneLine(str(r.name));
  const email = oneLine(str(r.email));
  const message = str(r.message)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim();
  if (name.length > FEEDBACK_NAME_MAX) return { ok: false, error: 'invalid_name' };
  if (email && (email.length > FEEDBACK_EMAIL_MAX || !EMAIL.test(email)))
    return { ok: false, error: 'invalid_email' };
  if (message.length < FEEDBACK_MESSAGE_MIN || message.length > FEEDBACK_MESSAGE_MAX)
    return { ok: false, error: 'invalid_message' };
  return { ok: true, feedback: { name, email, message }, spam: str(r.website) !== '' };
}

/** The plain-text email for a submission. */
export function feedbackEmail(f: Feedback): { subject: string; text: string } {
  const from = f.name || 'Anonymous';
  return {
    subject: `Micro Rally feedback from ${from}`,
    text: `From: ${from}\nReply to: ${f.email || '(not given)'}\n\n${f.message}\n`,
  };
}
