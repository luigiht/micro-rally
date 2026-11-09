import { describe, expect, it } from 'vitest';
import { answerOk } from '@/app/api/feedback/answer';
import { FEEDBACK_MESSAGE_MAX, feedbackEmail, parseFeedback } from '@/lib/feedback';

describe('feedback', () => {
  it('accepts a message with an optional name and email, trimmed', () => {
    const r = parseFeedback({
      name: ' Ada ',
      email: 'ada@example.com',
      message: '  Loved the coast!  ',
    });
    expect(r).toEqual({
      ok: true,
      spam: false,
      feedback: { name: 'Ada', email: 'ada@example.com', message: 'Loved the coast!' },
    });
    const anon = parseFeedback({ message: 'Just a quick note.' });
    expect(anon.ok && anon.feedback).toEqual({
      name: '',
      email: '',
      message: 'Just a quick note.',
    });
  });

  it('rejects bad bodies, short or long messages and malformed emails', () => {
    expect(parseFeedback(null)).toEqual({ ok: false, error: 'invalid_json' });
    expect(parseFeedback({ message: 'short' })).toEqual({ ok: false, error: 'invalid_message' });
    expect(parseFeedback({ message: 'x'.repeat(FEEDBACK_MESSAGE_MAX + 1) })).toEqual({
      ok: false,
      error: 'invalid_message',
    });
    for (const email of ['nope', 'a@b', 'a b@c.d', 'a@b.c\nBcc: x@y.z', '<a@b.c>'])
      expect(parseFeedback({ email, message: 'A long enough message.' }).ok, email).toBe(false);
  });

  it('keeps header text on one line and flags the honeypot', () => {
    const r = parseFeedback({
      name: 'Eve\r\nBcc: x@y.z',
      message: 'Line one\nline two.',
      website: 'http://spam',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spam).toBe(true);
    expect(r.feedback.name).not.toMatch(/[\r\n]/);
    const mail = feedbackEmail(r.feedback);
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.text).toContain('Line one\nline two.');
    expect(feedbackEmail({ name: '', email: '', message: 'Hi there, all good.' }).subject).toBe(
      'Micro Rally feedback from Anonymous',
    );
  });
});

describe('feedback question', () => {
  it('takes Ford in any case, spacing or trailing punctuation, and nothing else', () => {
    for (const a of ['Ford', 'ford', ' FORD ', 'Ford.', '"Ford"!'])
      expect(answerOk(a), a).toBe(true);
    for (const a of ['', 'Fiat', 'Ford Motor', 'Fo rd?x', undefined, 4])
      expect(answerOk(a)).toBe(false);
  });
});
