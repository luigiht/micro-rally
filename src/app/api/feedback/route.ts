import { FEEDBACK_TO, feedbackEmail, parseFeedback } from '@/lib/feedback';
import { answerOk } from './answer';

const NO_STORE = { 'cache-control': 'no-store' };
/** Per instance and client address: enough to stop a loop resending the form, not a hard quota. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map<string, number[]>();

function fail(error: string, status = 400): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

function limited(client: string, now: number): boolean {
  const times = (recent.get(client) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) return true;
  times.push(now);
  recent.set(client, times);
  if (recent.size > 1000) recent.delete(recent.keys().next().value!);
  return false;
}

/** Send a feedback submission to the author by email (Resend). 503 when the deployment has no mail key. */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('invalid_json');
  }
  const parsed = parseFeedback(body);
  if (!parsed.ok) return fail(parsed.error);
  // A filled honeypot is answered as a success so the bot learns nothing.
  if (parsed.spam) return Response.json({ ok: true }, { headers: NO_STORE });
  const client = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(client, Date.now())) return fail('rate_limited', 429);
  if (!answerOk((body as Record<string, unknown>).answer)) return fail('wrong_answer');
  const key = process.env.RESEND_API_KEY;
  if (!key) return fail('mail_unconfigured', 503);
  const { subject, text } = feedbackEmail(parsed.feedback);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM ?? 'Micro Rally <onboarding@resend.dev>',
      to: [FEEDBACK_TO],
      subject,
      text,
      ...(parsed.feedback.email ? { reply_to: parsed.feedback.email } : {}),
    }),
  });
  if (!res.ok) return fail('send_failed', 502);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
