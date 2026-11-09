'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import {
  FEEDBACK_EMAIL_MAX,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_NAME_MAX,
} from '@/lib/feedback';

type Step = 'form' | 'sending' | 'sent' | 'failed' | 'wrong';

/** The feedback page: an optional name and email and a message, emailed to the author. */
export function FeedbackForm() {
  const m = useMessages();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [answer, setAnswer] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [touched, setTouched] = useState(false);

  const shortMessage = message.trim().length < FEEDBACK_MESSAGE_MIN;
  const badEmail = email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const noAnswer = answer.trim() === '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (shortMessage || badEmail || noAnswer || step === 'sending') return;
    setStep('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message, website, answer }),
      });
      if (res.ok) setStep('sent');
      else {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        setStep(error === 'wrong_answer' ? 'wrong' : 'failed');
      }
    } catch {
      setStep('failed');
    }
  };

  const reset = () => {
    setMessage('');
    setAnswer('');
    setTouched(false);
    setStep('form');
  };

  return (
    <main className="min-h-dvh bg-ink px-4 py-10">
      <article className="pixel-box mx-auto max-w-2xl p-6 md:p-8">
        <h1 className="font-pixel text-xl leading-snug">{m.feedback.title}</h1>
        <p className="mt-5 text-sm">{m.feedback.intro}</p>
        {step === 'sent' ? (
          <div className="mt-6">
            <p role="status" className="pixel-box-dark p-3 text-sm">
              {m.feedback.sent}
            </p>
            <button type="button" className="pixel-btn-ghost mt-5 w-full" onClick={reset}>
              {m.feedback.another}
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
            <div>
              <label htmlFor="feedback-name" className="block font-pixel text-xs">
                {m.feedback.nameLabel}
              </label>
              <input
                id="feedback-name"
                className="pixel-input mt-2 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={FEEDBACK_NAME_MAX}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="feedback-email" className="block font-pixel text-xs">
                {m.feedback.emailLabel}
              </label>
              <input
                id="feedback-email"
                type="email"
                className="pixel-input mt-2 w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={FEEDBACK_EMAIL_MAX}
                autoComplete="email"
                aria-invalid={(touched && badEmail) || undefined}
                aria-describedby={touched && badEmail ? 'feedback-email-error' : undefined}
              />
              {touched && badEmail && (
                <p id="feedback-email-error" className="mt-2 text-xs text-rally">
                  {m.feedback.badEmail}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="feedback-message" className="block font-pixel text-xs">
                {m.feedback.messageLabel}
              </label>
              <textarea
                id="feedback-message"
                className="pixel-input mt-2 min-h-40 w-full resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={FEEDBACK_MESSAGE_MAX}
                placeholder={m.feedback.messagePlaceholder}
                required
                aria-invalid={(touched && shortMessage) || undefined}
                aria-describedby={touched && shortMessage ? 'feedback-message-error' : undefined}
              />
              {touched && shortMessage && (
                <p id="feedback-message-error" className="mt-2 text-xs text-rally">
                  {fill(m.feedback.tooShort, { n: FEEDBACK_MESSAGE_MIN })}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="feedback-answer" className="block font-pixel text-xs">
                {m.feedback.question}
              </label>
              <input
                id="feedback-answer"
                className="pixel-input mt-2 w-full"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (step === 'wrong') setStep('form');
                }}
                maxLength={40}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                required
                aria-invalid={(touched && noAnswer) || step === 'wrong' || undefined}
                aria-describedby="feedback-answer-hint"
              />
              <p id="feedback-answer-hint" className="mt-2 text-xs text-ink/70">
                {m.feedback.questionHint}
              </p>
              {step === 'wrong' && (
                <p role="alert" className="mt-2 text-xs text-rally">
                  {m.feedback.wrongAnswer}
                </p>
              )}
            </div>
            {/* Honeypot: hidden from people and assistive tech, filled in by bots. */}
            <div aria-hidden="true" className="hidden">
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                name="website"
              />
            </div>
            {step === 'failed' && (
              <p role="alert" className="pixel-box-dark p-3 text-sm">
                {m.feedback.failed}
              </p>
            )}
            <button type="submit" className="pixel-btn w-full" disabled={step === 'sending'}>
              {step === 'sending' ? m.feedback.sending : m.feedback.send}
            </button>
          </form>
        )}
        <p className="mt-6 text-xs text-ink/70">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-rally">
            {m.feedback.privacy}
          </Link>
        </p>
        <Link href="/" className="pixel-btn mt-8 inline-block">
          {m.feedback.back}
        </Link>
      </article>
    </main>
  );
}
