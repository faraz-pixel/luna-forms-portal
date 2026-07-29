'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

/**
 * Receives `initialError` and `next` as props rather than reading them with
 * useSearchParams — that hook forces a Suspense boundary, whose fallback is
 * what the server actually emits. With fallback={null} the page shipped an
 * empty body and only appeared after hydration.
 */
export default function LoginForm({ initialError = '', next = '' }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState(initialError);
  const [showRequestNote, setShowRequestNote] = useState(false);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

    setIsLoading(true);

    const callback = new URL('/auth/callback', window.location.origin);
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      callback.searchParams.set('next', next);
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: callback.toString() },
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message || 'Could not send the link. Please try again.');
      return;
    }

    setIsSent(true);
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

        {error && <div className={styles.error} role="alert">{error}</div>}

        {!isSent ? (
          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? <div className={styles.spinner}></div> : 'Send Magic Link'}
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
          Sign in with your email first. Once you are in, you can request access
          to individual forms from your dashboard and the admin will review it.
        </p>
      )}
    </>
  );
}
