'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { FormIcon, LockIcon } from '@/lib/forms/icons';
import { requestAccess } from './actions';
import styles from './page.module.css';

function LockedCard({ form, onRequest, requestState, pending }) {
  const state = requestState[form.slug];

  return (
    <div className={`${styles.formCard} ${styles.locked}`}>
      <span className={styles.lockedBadge}>
        <LockIcon size={13} /> No access
      </span>

      <div className={styles.formCardHeader}>
        <div className={`${styles.formIcon} ${styles.lockedIcon}`}>
          <FormIcon name={form.icon} />
        </div>
        <div className={styles.formTitle}>{form.name}</div>
      </div>

      <div className={styles.formDesc}>{form.description}</div>

      <div className={styles.formFooter}>
        {state === 'sent' ? (
          <span className={styles.requestSent}>Request sent — awaiting admin</span>
        ) : state === 'pending' ? (
          <span className={styles.requestSent}>Already requested</span>
        ) : state ? (
          <span className={styles.requestError}>{state}</span>
        ) : (
          <span className={styles.lastSub}>Contact admin for access</span>
        )}

        {!state && (
          <button
            type="button"
            className={styles.requestBtn}
            onClick={() => onRequest(form.slug)}
            disabled={pending}
          >
            {pending ? 'Sending…' : 'Request Access'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FormsGrid({ forms, grants, isAdmin }) {
  const [search, setSearch] = useState('');
  const [requestState, setRequestState] = useState({});
  const [pendingSlug, setPendingSlug] = useState(null);
  const [, startTransition] = useTransition();

  const handleRequest = (slug) => {
    setPendingSlug(slug);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('formSlug', slug);
      const result = await requestAccess(null, fd);
      setPendingSlug(null);
      setRequestState((prev) => ({
        ...prev,
        [slug]: result.ok
          ? (result.alreadyPending ? 'pending' : 'sent')
          : (result.error || 'Request failed'),
      }));
    });
  };

  const term = search.trim().toLowerCase();
  const visible = forms.filter(
    (f) =>
      f.name.toLowerCase().includes(term) ||
      f.description.toLowerCase().includes(term)
  );

  return (
    <section className={styles.formsSection}>
      <div className={styles.sectionHeader}>
        <h2>Available Forms</h2>
        <input
          type="text"
          placeholder="Search forms..."
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search forms"
        />
      </div>

      <div className={styles.formsGrid}>
        {visible.map((form) => {
          const level = grants[form.slug];
          const isComingSoon = form.status === 'coming_soon';

          // Not granted and not merely unbuilt — show the locked state with a
          // way to ask. The server never sent this form's data either way.
          if (!level && !isComingSoon) {
            return (
              <LockedCard
                key={form.slug}
                form={form}
                onRequest={handleRequest}
                requestState={requestState}
                pending={pendingSlug === form.slug}
              />
            );
          }

          return (
            <div
              key={form.slug}
              className={`${styles.formCard} ${isComingSoon ? styles.comingSoon : styles.active}`}
            >
              {isComingSoon ? (
                <span className={styles.comingSoonBadgeOverlay}>Coming Soon</span>
              ) : (
                <span className={styles.activeBadge}>
                  {level === 'view_all' ? 'Full access' : 'Submit'}
                </span>
              )}

              <div className={styles.formCardHeader}>
                <div className={`${styles.formIcon} ${styles[form.color]}`}>
                  <FormIcon name={form.icon} />
                </div>
                <div className={styles.formTitle}>{form.name}</div>
              </div>

              <div className={styles.formDesc}>{form.description}</div>

              <div className={styles.formFooter}>
                <span className={styles.lastSub}>
                  {isComingSoon ? 'Not built yet' : 'Ready'}
                </span>
                {!isComingSoon && (
                  <Link href={`/forms/${form.slug}`} className={styles.openBtn}>
                    Open Form
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className={styles.emptyState}>No forms match “{search}”.</p>
      )}

      {isAdmin && (
        <p className={styles.adminHint}>
          You are signed in as admin — you have full access to every form.
        </p>
      )}
    </section>
  );
}
