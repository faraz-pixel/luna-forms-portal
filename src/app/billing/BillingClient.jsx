'use client';

import { useRef, useState, useTransition } from 'react';
import {
  endorseVendorBill,
  recordVendorPayment,
  getBillAttachmentSignedUrl,
  getVendorBillDetail,
} from './actions';
import { formatDate } from '@/lib/date';
import styles from './page.module.css';

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function money2(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function DatePicker({ value, onChange, label }) {
  const inputRef = useRef(null);
  return (
    <span className={styles.datePicker}>
      <button type="button" className={styles.dateButton} onClick={() => inputRef.current?.showPicker?.()}>
        {formatDate(value) || 'Select date'}
      </button>
      <input ref={inputRef} className={styles.datePickerInput} type="date" value={value || ''} onChange={onChange} aria-label={label} />
    </span>
  );
}

function Field({ label, value, mono }) {
  return (
    <div className={styles.detailField}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={`${styles.detailValue} ${mono ? styles.detailMono : ''}`}>{value || '—'}</span>
    </div>
  );
}

function AttachmentLink({ attachment, onClick }) {
  if (!attachment) return <span className={styles.detailMuted}>—</span>;
  return (
    <button type="button" className={styles.attachmentLink} onClick={() => onClick(attachment)}>
      📎 {attachment.name || 'Attachment'}
    </button>
  );
}

export default function BillingClient({ bills }) {
  const [terms, setTerms] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [payment, setPayment] = useState({});
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [, startTransition] = useTransition();

  const openDetail = async (billId) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await getVendorBillDetail(billId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDetail(res.detail);
    } catch (e) {
      setError('Could not load entry details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleViewAttachment = async (attachment) => {
    setError('');
    if (!attachment?.signedUrl) {
      setError('No stored file for this attachment.');
      return;
    }
    window.open(attachment.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrimaryView = async (billId) => {
    try {
      const res = await getBillAttachmentSignedUrl(billId);
      if (!res.ok) setError(res.error);
      else window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not open attachment.');
    }
  };

  const submitTerms = (billId) => {
    setBusy(billId);
    setError('');
    startTransition(async () => {
      const result = await endorseVendorBill(billId, terms[billId]);
      setBusy(null);
      if (!result.ok) setError(result.error);
    });
  };

  const submitPayment = (billId) => {
    setBusy(`payment:${billId}`);
    setError('');
    startTransition(async () => {
      const result = await recordVendorPayment({ billId, ...payment[billId] });
      setBusy(null);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Bill No.</th>
              <th>Attachment</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status / Accounts action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>
                  <button type="button" className={styles.detailLink} onClick={() => openDetail(bill.id)}>
                    {bill.vendor_name}
                  </button>
                </td>
                <td>
                  <button type="button" className={styles.detailLink} onClick={() => openDetail(bill.id)}>
                    {bill.bill_number}
                  </button>
                </td>
                <td>
                  {bill.attachment_name ? (
                    <button
                      type="button"
                      onClick={() => handlePrimaryView(bill.id)}
                      disabled={busy === `file:${bill.id}`}
                      className={styles.attachmentLink}
                    >
                      {busy === `file:${bill.id}` ? 'Loading...' : `📎 ${bill.attachment_name}`}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{formatDate(bill.invoice_date)}</td>
                <td>{bill.due_date ? formatDate(bill.due_date) : 'Hidden until endorsed'}</td>
                <td>{money(bill.bill_amount)}</td>
                <td>{money(bill.paid_amount)}</td>
                <td>{money(bill.balance)}</td>
                <td>
                  {bill.credit_terms_status !== 'endorsed' ? (
                    <div className={styles.termAction}>
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        placeholder="Days"
                        value={terms[bill.id] ?? ''}
                        onChange={(e) => setTerms((prev) => ({ ...prev, [bill.id]: e.target.value }))}
                        aria-label={`Credit terms days for ${bill.bill_number}`}
                      />
                      <button type="button" disabled={busy === bill.id} onClick={() => submitTerms(bill.id)}>
                        {busy === bill.id ? 'Saving…' : 'Endorse'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <span className={styles.status}>{bill.payable_status}</span>
                      {bill.balance > 0 && (
                        <div className={styles.paymentAction}>
                          <DatePicker value={payment[bill.id]?.paymentDate ?? ''} onChange={(e) => setPayment((prev) => ({ ...prev, [bill.id]: { ...prev[bill.id], paymentDate: e.target.value } }))} label={`Payment date for ${bill.bill_number}`} />
                          <input type="number" min="0" step="0.01" placeholder="Amount" value={payment[bill.id]?.amount ?? ''} onChange={(e) => setPayment((prev) => ({ ...prev, [bill.id]: { ...prev[bill.id], amount: e.target.value } }))} aria-label={`Payment amount for ${bill.bill_number}`} />
                          <input type="text" placeholder="Ref" value={payment[bill.id]?.paymentReference ?? ''} onChange={(e) => setPayment((prev) => ({ ...prev, [bill.id]: { ...prev[bill.id], paymentReference: e.target.value } }))} aria-label={`Payment reference for ${bill.bill_number}`} />
                          <button type="button" disabled={busy === `payment:${bill.id}`} onClick={() => submitPayment(bill.id)}>{busy === `payment:${bill.id}` ? 'Saving…' : 'Record payment'}</button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bills.length === 0 && <p className={styles.empty}>No vendor bills match these filters.</p>}
      </div>

      {/* Read-only View Entry modal */}
      {detail && (
        <div className={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Entry details" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Entry Details</h2>
                <span className={styles.modalSub}>
                  {detail.vendorName} · {detail.invoiceNumber}
                </span>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setDetail(null)} aria-label="Close">&times;</button>
            </div>

            {loadingDetail ? (
              <p className={styles.empty}>Loading…</p>
            ) : (
              <>
                {/* Top reference bar */}
                <div className={styles.detailMeta}>
                  <Field label="Store / Stock Ref" value={detail.refNumber} mono />
                  <Field label="Invoice Date" value={formatDate(detail.invoiceDate)} />
                </div>

                {/* Two-column sections */}
                <div className={styles.detailColumns}>
                  <div className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Vendor Details</h3>
                    <Field label="Vendor Name" value={detail.vendorNameFromPayload} />
                    <Field label="Vendor Invoice Number" value={detail.invoiceNumber} mono />
                    <Field label="Bill Amount" value={money2(detail.billAmount)} />
                    <Field label="Submitted By" value={detail.submittedBy} />
                  </div>
                  <div className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Transaction Details</h3>
                    <Field label="Entry Type" value={detail.entryType} />
                    <Field label="Record Type" value={detail.recordType} />
                    <Field label="Location" value={detail.location} />
                  </div>
                </div>

                <div className={styles.detailColumns}>
                  <div className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Submission</h3>
                    <Field label="Submitted At" value={formatDateTime(detail.submittedAt)} />
                    <Field label="Reference" value={detail.refNumber} mono />
                  </div>
                  <div className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Endorsement & Payment</h3>
                    <Field
                      label="Endorsement Status"
                      value={detail.creditTermsStatus === 'endorsed'
                        ? `Endorsed${detail.creditTermsDays ? ` (${detail.creditTermsDays} days)` : ''}`
                        : 'Pending'}
                    />
                    <Field label="Due Date" value={detail.dueDate ? formatDate(detail.dueDate) : ''} />
                    <Field label="Paid Amount" value={money2(detail.paidAmount)} />
                    <Field label="Balance" value={money2(detail.balance)} />
                  </div>
                </div>

                {/* Products */}
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Product / Item Breakup</h3>
                  {detail.products.length > 0 ? (
                    <table className={styles.detailTable}>
                      <thead>
                        <tr><th>#</th><th>Product</th><th>Unit</th><th>Quantity</th></tr>
                      </thead>
                      <tbody>
                        {detail.products.map((p, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{p.name}</td>
                            <td>{p.unit}</td>
                            <td>{p.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className={styles.detailMuted}>No product data.</p>
                  )}
                </div>

                {/* Remarks */}
                {detail.remarks && (
                  <div className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Remarks</h3>
                    <p className={styles.detailRemarks}>{detail.remarks}</p>
                  </div>
                )}

                {/* Attachments */}
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>Attachments</h3>
                  <div className={styles.detailFieldsGrid}>
                    <div>
                      <span className={styles.detailLabel}>Primary Attachment</span>
                      <AttachmentLink attachment={detail.primaryAttachment} onClick={handleViewAttachment} />
                    </div>
                    <div>
                      <span className={styles.detailLabel}>Secondary Attachment</span>
                      <AttachmentLink attachment={detail.secondaryAttachment} onClick={handleViewAttachment} />
                    </div>
                  </div>
                </div>

                {/* Payment history */}
                {detail.payments && detail.payments.length > 0 && (
                  <div className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Payment History</h3>
                    <table className={styles.detailTable}>
                      <thead>
                        <tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr>
                      </thead>
                      <tbody>
                        {detail.payments.map((p, i) => (
                          <tr key={i}>
                            <td>{formatDate(p.paymentDate)}</td>
                            <td>{money2(p.amount)}</td>
                            <td>{p.method || '—'}</td>
                            <td>{p.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalBtn} onClick={() => setDetail(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}