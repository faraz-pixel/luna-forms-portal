/**
 * Admin email alerts.
 *
 * Optional by design: if RESEND_API_KEY is unset the portal still works and
 * requests simply wait in /admin. Every function here swallows its own errors —
 * a notification failure must never fail the user action that triggered it.
 */
const ENDPOINT = 'https://api.resend.com/emails';

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL && process.env.MAIL_FROM);
}

async function send({ subject, html }) {
  if (!isConfigured()) return { skipped: true };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [process.env.ADMIN_EMAIL],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('[notify] send failed', res.status, await res.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[notify] send threw', err);
    return { ok: false };
  }
}

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export async function notifyAdminOfRequest({ email, formSlug, message }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || '';
  return send({
    subject: `Access request: ${formSlug} — ${email}`,
    html: `
      <p><strong>${escapeHtml(email)}</strong> has requested access to
      <strong>${escapeHtml(formSlug)}</strong>.</p>
      ${message ? `<p>Message: ${escapeHtml(message)}</p>` : ''}
      <p><a href="${escapeHtml(base)}/admin">Review it in the admin page</a></p>
    `,
  });
}
