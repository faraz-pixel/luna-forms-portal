/**
 * Mirrors a submission into the Google Sheet via the Apps Script web app.
 *
 * Optional and best-effort: Postgres is the source of truth. If the Sheet write
 * fails the submission has already been saved, so we log and report back rather
 * than throwing. The caller records the outcome in submissions.sheet_synced.
 */
export async function mirrorToSheet({ formSlug, refNumber, userEmail, createdAt, payload }) {
  const endpoint = process.env.SHEETS_ENDPOINT;
  if (!endpoint) return { skipped: true };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: process.env.SHEETS_TOKEN || '',
        form: formSlug,
        ref: refNumber,
        email: userEmail,
        submittedAt: createdAt,
        ...payload,
      }),
      // Apps Script can be slow to wake; don't hang the request forever.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error('[sheets] non-OK response', res.status);
      return { ok: false };
    }

    const body = await res.json().catch(() => ({}));
    if (body?.ok === false) {
      console.error('[sheets] script reported failure', body);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.error('[sheets] mirror failed', err?.message || err);
    return { ok: false };
  }
}
