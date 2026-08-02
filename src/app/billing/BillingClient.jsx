'use client';

import { useRef, useState, useTransition } from 'react';
import {
  endorseVendorBill,
  recordVendorPayment,
  getBillAttachmentSignedUrl,
  getVendorBillDetail,
} from './actions';
import StockInwardReceipt from '@/components/StockInwardReceipt';
import { formatDate } from '@/lib/date';
import styles from './page.module.css';

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

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function money2(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      if (!res.ok) {
        if (res.available === false) setError('Attachment not available for this entry.');
        else setError(res.error);
      } else {
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError('Could not open attachment.');
    }
  };

  const handleReprint = () => {
    window.print();
  };

  const handleDownloadReceipt = async () => {
    const el = document.getElementById('billingReceiptCapture');
    if (!el) return;
    Object.assign(el.style, {
      position: 'fixed', left: '-9999px', top: '0',
      display: 'block', width: '700px', zIndex: '-1',
    });
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `Receipt_${detail?.refNumber || 'bill'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[billing] receipt export failed', err);
    } finally {
      el.style.display = 'none';
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

  const attachments = [];
  if (detail?.primaryAttachment) attachments.push({ label: 'Primary Attachment', att: detail.primaryAttachment });
  if (detail?.secondaryAttachment) attachments.push({ label: 'Secondary Attachment', att: detail.secondaryAttachment });

  return (
    <>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Bill No.</th>
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
              <tr
                key={bill.id}
                className={styles.clickableRow}
                onClick={() => openDetail(bill.id)}
                tabIndex={0}
                role="link"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(bill.id);
                  }
                }}
              >
                <td>{bill.vendor_name}</td>
                <td>{bill.bill_number}</td>
                <td>{formatDate(bill.invoice_date)}</td>
                <td>{bill.due_date ? formatDate(bill.due_date) : 'Hidden until endorsed'}</td>
                <td>{money(bill.bill_amount)}</td>
                <td>{money(bill.paid_amount)}</td>
                <td>{money(bill.balance)}</td>
                <td className={styles.rowAction} onClick={(e) => e.stopPropagation()}>
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
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Stock Inward Receipt" onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.modalHeader} noPrint`}>
              <div>
                <h2>Receipt · {detail.vendorName || detail.vendorNameFromPayload}</h2>
                <span className={styles.modalSub}>
                  {detail.vendorNameFromPayload} · {detail.invoiceNumber}
                </span>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setDetail(null)} aria-label="Close">&times;</button>
            </div>

            {loadingDetail ? (
              <p className={`${styles.empty} noPrint`}>Loading…</p>
            ) : (
              <>
                <div className={`${styles.receiptActions} noPrint`}>
                  <button type="button" className={styles.modalBtn} onClick={handleReprint}>
                    Reprint
                  </button>
                  <button type="button" className={styles.modalBtn} onClick={handleDownloadReceipt}>
                    Download
                  </button>
                  <button type="button" className={styles.modalBtn} onClick={() => setDetail(null)}>
                    Close
                  </button>
                </div>

                <StockInwardReceipt
                  refNumber={detail.refNumber}
                  date={detail.invoiceDate}
                  submittedBy={detail.submittedBy}
                  vendorName={detail.vendorNameFromPayload}
                  vendorInvoiceNumber={detail.invoiceNumber}
                  billAmount={detail.billAmount}
                  entryType={detail.entryType}
                  transactionType={detail.recordType}
                  location={detail.location}
                  products={detail.products}
                  remarks={detail.remarks}
                />

                {/* Read-only endorsement & payment status */}
                <div className={`${styles.statusSection} noPrint`}>
                  <h3 className={styles.detailSectionTitle}>Endorsement &amp; Payment</h3>
                  <div className={styles.detailFieldsGrid}>
                    <div>
                      <span className={styles.detailLabel}>Endorsement Status</span>
                      <div className={styles.detailValue}>
                        {detail.creditTermsStatus === 'endorsed'
                          ? `Endorsed${detail.creditTermsDays ? ` (${detail.creditTermsDays} days)` : ''}`
                          : 'Pending'}
                      </div>
                    </div>
                    <div>
                      <span className={styles.detailLabel}>Due Date</span>
                      <div className={styles.detailValue}>{detail.dueDate ? formatDate(detail.dueDate) : '—'}</div>
                    </div>
                    <div>
                      <span className={styles.detailLabel}>Paid Amount</span>
                      <div className={styles.detailValue}>{money2(detail.paidAmount)}</div>
                    </div>
                    <div>
                      <span className={styles.detailLabel}>Balance</span>
                      <div className={styles.detailValue}>{money2(detail.balance)}</div>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className={`${styles.detailFieldsGrid}`} style={{ marginTop: '16px' }}>
                      {attachments.map(({ label, att }) => (
                        <div key={label}>
                          <span className={styles.detailLabel}>{label}</span>
                          <div className={styles.detailValue}>
                            {att.available ? (
                              <button
                                type="button"
                                className={styles.attachmentLink}
                                onClick={() => handleViewAttachment(att)}
                              >
                                📎 {att.name || 'View'}
                              </button>
                            ) : (
                              <span className={styles.detailMuted}>
                                {att.predatesStorage
                                  ? 'This entry was created before attachment storage was enabled.'
                                  : 'Attachment not available for this entry.'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {detail.payments && detail.payments.length > 0 && (
                    <table className={styles.detailTable} style={{ marginTop: '16px' }}>
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
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden receipt copy used only for PNG download */}
      {detail && (
        <div id="billingReceiptCapture" style={{ display: 'none' }}>
          <StockInwardReceipt
            refNumber={detail.refNumber}
            date={detail.invoiceDate}
            submittedBy={detail.submittedBy}
            vendorName={detail.vendorNameFromPayload}
            vendorInvoiceNumber={detail.invoiceNumber}
            billAmount={detail.billAmount}
            entryType={detail.entryType}
            transactionType={detail.recordType}
            location={detail.location}
            products={detail.products}
            remarks={detail.remarks}
          />
        </div>
      )}
    </>
  );
}