'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

/**
 * Two sign-in modes.
 *
 * Password is the default because Supabase's built-in mailer is rate-limited to
 * a couple of messages an hour, and this Workspace blocks the app passwords a
 * custom SMTP relay would need. Accounts are created in the Supabase dashboard;
 * the profile trigger fires on auth.users insert regardless of how the user got
 * there, so dashboard-created accounts still pick up the admin role correctly.
 *
 * Magic link stays available for when SMTP is sorted out.
 *
 * Receives `initialError` and `next` as props rather than reading them with
 * useSearchParams — that hook forces a Suspense boundary, whose fallback is
 * what the server actually emits.
 */
export default function LoginForm({ initialError = '', next = '' }) {
  const router = useRouter();
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState(initialError);
  const [showRequestNote, setShowRequestNote] = useState(false);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    if (mode === 'password' && !password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    if (mode === 'password') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });

      setIsLoading(false);

      if (signInError) {
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'Wrong email or password. If you have never set one, ask the admin.'
            : signInError.message || 'Could not sign you in.'
        );
        return;
      }

      // refresh() so the Server Components re-run and pick up the new cookie.
      router.push(safeNext);
      router.refresh();
      return;
    }

    const callback = new URL('/auth/callback', window.location.origin);
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      callback.searchParams.set('next', next);
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: callback.toString() },
    });

    setIsLoading(false);

    if (otpError) {
      setError(
        /rate limit/i.test(otpError.message)
          ? 'Email limit reached — Supabase allows only a couple per hour. Use a password instead, or try again later.'
          : otpError.message || 'Could not send the link. Please try again.'
      );
      return;
    }

    setIsSent(true);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setIsSent(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <input
            type="email"
            placeholder="name@coffeecartel.pk"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || isSent}
            autoComplete="email"
            aria-label="Email address"
          />
          <svg
            className={styles.inputIcon}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {mode === 'password' && (
          <div className={styles.inputWrapper}>
            <input
              type="password"
              placeholder="Password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              aria-label="Password"
            />
            <svg
              className={styles.inputIcon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        {!isSent ? (
          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? (
              <div className={styles.spinner}></div>
            ) : mode === 'password' ? (
              'Sign In'
            ) : (
              'Send Magic Link'
            )}
          </button>
        ) : (
          <div className={styles.successMessage} role="status">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Check your inbox for the link
          </div>
        )}
      </form>

      <button
        type="button"
        className={styles.modeToggle}
        onClick={() => switchMode(mode === 'password' ? 'magic' : 'password')}
      >
        {mode === 'password'
          ? 'Email me a sign-in link instead'
          : 'Sign in with a password instead'}
      </button>

      <div className={styles.divider}>or</div>

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => setShowRequestNote((v) => !v)}
      >
        Request Access
      </button>

      {showRequestNote && (
        <p className={styles.requestNote}>
          Sign in first. Once you are in, you can request access to individual
          forms from your dashboard and the admin will review it. If you have no
          account yet, ask the admin to create one for you.
        </p>
      )}
    </>
  );
}
