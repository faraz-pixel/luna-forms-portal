'use client';

import React, { useState, useTransition } from 'react';
import { setGrant, revokeGrant, resolveRequest, setUserRole } from './actions';
import styles from './page.module.css';

const LEVEL_LABEL = { submit: 'Submit only', view_all: 'Full access' };

export default function AdminClient({ pending, profiles, forms, grantMap, adminId }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [levelChoice, setLevelChoice] = useState({});
  const [, startTransition] = useTransition();

  const run = (key, fn) => {
    setBusy(key);
    setError('');
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (result && !result.ok) setError(result.error || 'Something went wrong.');
    });
  };

  // Admin holds implicit access to everything; showing toggles for their own
  // row would imply a grant that does not exist as a row.
  const members = profiles.filter((p) => p.id !== adminId);
  const grantableForms = forms.filter((f) => f.status === 'active');

  return (
    <>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>
          Pending requests
          {pending.length > 0 && <span className={styles.count}>{pending.length}</span>}
        </h2>

        {pending.length === 0 ? (
          <p className={styles.empty}>Nothing waiting for review.</p>
        ) : (
          <ul className={styles.requestList}>
            {pending.map((req) => {
              const chosen = levelChoice[req.id] ?? 'submit';
              return (
                <li key={req.id} className={styles.requestRow}>
                  <div className={styles.requestInfo}>
                    <div className={styles.requestEmail}>{req.email}</div>
                    <div className={styles.requestForm}>
                      wants <strong>{req.formName}</strong>
                    </div>
                    {req.message && <p className={styles.requestMessage}>“{req.message}”</p>}
                  </div>

                  <div className={styles.requestActions}>
                    <select
                      value={chosen}
                      onChange={(e) =>
                        setLevelChoice((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      className={styles.levelSelect}
                      aria-label={`Access level for ${req.email}`}
                    >
                      <option value="submit">Submit only</option>
                      <option value="view_all">Full access</option>
                    </select>

                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={busy === req.id}
                      onClick={() => run(req.id, () => resolveRequest(req.id, 'approved', chosen))}
                    >
                      {busy === req.id ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className={styles.denyBtn}
                      disabled={busy === req.id}
                      onClick={() => run(req.id, () => resolveRequest(req.id, 'denied'))}
                    >
                      Deny
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>People &amp; access</h2>

        {members.length === 0 ? (
          <p className={styles.empty}>
            Nobody else has signed in yet. People appear here after their first
            magic-link sign-in.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.personCol}>Person</th>
                  {grantableForms.map((f) => (
                    <th key={f.slug}>{f.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((person) => (
                  <tr key={person.id}>
                    <td className={styles.personCol}>
                      <div className={styles.personEmail}>{person.email}</div>
                      {person.role === 'admin' ? (
                        <span className={styles.roleTag}>admin</span>
                      ) : (
                        <select
                          value={person.role}
                          disabled={busy === `role:${person.id}`}
                          className={styles.grantSelect}
                          aria-label={`Team role for ${person.email}`}
                          onChange={(e) => run(`role:${person.id}`, () => setUserRole(person.id, e.target.value))}
                        >
                          <option value="member">Member</option>
                          <option value="accounts">Accounts Team</option>
                        </select>
                      )}
                    </td>

                    {grantableForms.map((form) => {
                      const level = grantMap[person.id]?.[form.slug] ?? '';
                      const key = `${person.id}:${form.slug}`;
                      return (
                        <td key={form.slug}>
                          <select
                            value={level}
                            disabled={busy === key}
                            className={`${styles.grantSelect} ${level ? styles.granted : ''}`}
                            aria-label={`${form.name} access for ${person.email}`}
                            onChange={(e) => {
                              const next = e.target.value;
                              run(key, () =>
                                next
                                  ? setGrant(person.id, form.slug, next)
                                  : revokeGrant(person.id, form.slug)
                              );
                            }}
                          >
                            <option value="">No access</option>
                            <option value="submit">{LEVEL_LABEL.submit}</option>
                            <option value="view_all">{LEVEL_LABEL.view_all}</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.hint}>
          Only forms that are actually built are listed. Coming-soon forms become
          grantable once their route exists.
        </p>
      </section>
    </>
  );
}
