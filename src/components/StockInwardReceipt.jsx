'use client';

import React from 'react';
import styles from './StockInwardReceipt.module.css';

/**
 * Shared Stock Inward receipt renderer.
 *
 * Used by:
 *   - Store Purchase form success preview (screen + print + PNG export)
 *   - Billing Vendor Payables View Entry modal (Reprint / Download)
 *
 * It is a pure presentational component: no data fetching, no writes. Callers
 * pass a normalized `data` object plus identity fields so the same professional
 * receipt layout is rendered everywhere.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function formatAmount(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return value || '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}



export default function StockInwardReceipt({
  refNumber = '',
  date = '',
  submittedBy = '',
  vendorName = '',
  vendorInvoiceNumber = '',
  billAmount = '',
  entryType = '',
  transactionType = 'Inward',
  location = '',
  products = [],
  remarks = '',
  attachments = null,
  footer = 'Luna Forms Portal • Coffee Cartel',
}) {
  return (
    <div className={styles.receiptDoc}>
      <div className={styles.receiptHeader}>
        <div className={styles.receiptBrand}>☕ Coffee Cartel</div>
        <div className={styles.receiptTitle}>Stock Inward Receipt</div>
      </div>

      <div className={styles.receiptMeta}>
        <div className={styles.receiptMetaItem}>
          <span>Store / Stock Ref:</span>
          <strong>{refNumber || '—'}</strong>
        </div>
        <div className={styles.receiptMetaItem}>
          <span>Date:</span>
          <strong>{formatDate(date) || '—'}</strong>
        </div>
      </div>

      <div className={styles.receiptColumns}>
        <div className={styles.receiptSection}>
          <div className={styles.receiptSectionTitle}>Vendor Details</div>
          <div className={styles.receiptField}>
            <label>Vendor Name</label>
            <p>{vendorName || '—'}</p>
          </div>
          <div className={styles.receiptField}>
            <label>Vendor Invoice Number</label>
            <p>{vendorInvoiceNumber || '—'}</p>
          </div>
          <div className={styles.receiptField}>
            <label>Bill Amount</label>
            <p>{formatAmount(billAmount)}</p>
          </div>
          <div className={styles.receiptField}>
            <label>Submitted By</label>
            <p>{submittedBy || '—'}</p>
          </div>
        </div>

        <div className={styles.receiptSection}>
          <div className={styles.receiptSectionTitle}>Transaction Details</div>
          <div className={styles.receiptField}>
            <label>Entry Type</label>
            <p>{entryType || '—'}</p>
          </div>
          <div className={styles.receiptField}>
            <label>Record Type</label>
            <p>{transactionType || 'Inward'}</p>
          </div>
          <div className={styles.receiptField}>
            <label>Location</label>
            <p>{location || '—'}</p>
          </div>
          <div className={styles.receiptField}>
            <label>Date</label>
            <p>{formatDate(date) || '—'}</p>
          </div>
        </div>
      </div>

      <div className={styles.receiptSectionTitle}>Products</div>
      <table className={styles.receiptTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Unit</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {(products || []).map((p, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{p?.name || '—'}</td>
              <td>{p?.unit || '—'}</td>
              <td>{p?.count ?? p?.quantity ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {remarks && (
        <div className={styles.receiptRemarksBlock}>
          <div className={styles.receiptSectionTitle}>Remarks</div>
          <div className={styles.receiptRemarks}>{remarks}</div>
        </div>
      )}

      {Array.isArray(attachments) && attachments.length > 0 && (
        <div className={styles.receiptSection}>
          <div className={styles.receiptSectionTitle}>Attachments</div>
          {attachments.map((a, i) => (
            <div className={styles.receiptField} key={i}>
              <label>{a.label || 'Attachment'}</label>
              <p>
                {a.available && a.onClick ? (
                  <a
                    href="#"
                    className={styles.attachmentLink}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      a.onClick(a);
                    }}
                  >
                    {a.name || 'View'}
                  </a>
                ) : (
                  <span>{a.unavailableText || a.emptyText || 'Attachment not available for this entry.'}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className={styles.receiptFooter}>{footer}</div>
    </div>
  );
}