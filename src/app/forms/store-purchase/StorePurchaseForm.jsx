'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { submitStorePurchase } from './actions';
import {
  TRANSACTION_TYPES,
  LOCATIONS,
  PRODUCTS,
  UNITS,
} from '@/lib/forms/store-purchase';
import styles from './page.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
};

const getTodayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** Receipt HTML is built by string concatenation, so every value must be escaped. */
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const initialProduct = { name: '', unit: '', count: '' };

export default function StorePurchaseForm({ userEmail }) {
  const dateInputRef = useRef(null);

  const [currentTime, setCurrentTime] = useState('');
  const [formData, setFormData] = useState({
    transactionType: '',
    location: '',
    date: '',
    products: [{ ...initialProduct }],
    remarks: '',
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString());
    setFormData((prev) => ({ ...prev, date: getTodayISO() }));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleProductChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }));
    const errKey = `product_${index}_${field}`;
    if (errors[errKey]) setErrors((prev) => ({ ...prev, [errKey]: null }));
  };

  const addProduct = () =>
    setFormData((prev) => ({ ...prev, products: [...prev.products, { ...initialProduct }] }));

  const removeProduct = (index) =>
    setFormData((prev) =>
      prev.products.length <= 1
        ? prev
        : { ...prev, products: prev.products.filter((_, i) => i !== index) }
    );

  const validateForm = () => {
    const next = {};
    if (!formData.transactionType) next.transactionType = 'Transaction Type is required';
    if (!formData.location) next.location = 'Location is required';
    if (!formData.date) next.date = 'Date is required';

    formData.products.forEach((p, i) => {
      if (!p.name) next[`product_${i}_name`] = 'Required';
      if (!p.unit) next[`product_${i}_unit`] = 'Required';
      if (!p.count || Number(p.count) <= 0) next[`product_${i}_count`] = 'Must be > 0';
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;

    setIsSubmitting(true);
    const result = await submitStorePurchase(formData);
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) setErrors(result.fieldErrors);
      setSubmitError(result.error || 'Submission failed.');
      return;
    }

    setReceipt({
      refNumber: result.refNumber,
      createdAt: result.createdAt,
      sheetSynced: result.sheetSynced,
      sheetSkipped: result.sheetSkipped,
      data: formData,
    });
  };

  const openDatePicker = () => dateInputRef.current?.showPicker?.();

  const resetForm = () => {
    setFormData({
      transactionType: '',
      location: '',
      date: getTodayISO(),
      products: [{ ...initialProduct }],
      remarks: '',
    });
    setErrors({});
    setSubmitError('');
    setReceipt(null);
  };

  const handlePrint = useCallback(() => {
    if (!receipt) return;
    const { refNumber, data } = receipt;

    const rows = data.products
      .map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${esc(p.unit)}</td><td>${esc(p.count)}</td></tr>`)
      .join('');

    const html = `
      <html>
      <head>
        <title>Store Purchase Receipt - ${esc(refNumber)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; max-width: 700px; margin: 0 auto; }
          .receipt-header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #d4af37; }
          .receipt-header h1 { font-size: 22px; color: #111; margin-bottom: 4px; }
          .receipt-header p { font-size: 12px; color: #666; }
          .meta-row { display: flex; justify-content: space-between; background: #f8f8f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; }
          .meta-row div span { font-weight: 600; color: #111; }
          .section-title { font-size: 14px; font-weight: 600; color: #d4af37; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px; }
          .info-item label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-item p { font-size: 15px; font-weight: 500; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
          th { background: #f8f8f6; text-align: left; padding: 10px 14px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eee; }
          td { padding: 10px 14px; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
          tr:last-child td { border-bottom: none; }
          .remarks { background: #f8f8f6; padding: 14px 16px; border-radius: 8px; font-size: 13px; color: #555; margin-bottom: 28px; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>&#9749; Coffee Cartel</h1>
          <p>Store Purchase Receipt</p>
        </div>
        <div class="meta-row">
          <div>Ref: <span>${esc(refNumber)}</span></div>
          <div>Date: <span>${esc(formatDate(data.date))}</span></div>
        </div>
        <div class="section-title">Transaction Details</div>
        <div class="info-grid">
          <div class="info-item"><label>Type</label><p>${esc(data.transactionType)}</p></div>
          <div class="info-item"><label>Location</label><p>${esc(data.location)}</p></div>
          <div class="info-item"><label>Submitted By</label><p>${esc(userEmail)}</p></div>
        </div>
        <div class="section-title">Products</div>
        <table>
          <thead><tr><th>#</th><th>Product</th><th>Unit</th><th>Count</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${data.remarks ? `<div class="section-title">Remarks</div><div class="remarks">${esc(data.remarks)}</div>` : ''}
        <div class="footer">Generated on ${esc(new Date().toLocaleString())} &bull; Luna Forms Portal</div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }, [receipt, userEmail]);

  const handleDownloadImage = useCallback(async () => {
    const el = document.getElementById('receiptCapture');
    if (!el || !receipt) return;

    Object.assign(el.style, {
      position: 'fixed', left: '-9999px', top: '0',
      display: 'block', width: '700px', zIndex: '-1',
    });

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `Receipt_${receipt.refNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[receipt] image export failed', err);
    } finally {
      el.style.display = 'none';
    }
  }, [receipt]);

  const receiptData = receipt?.data ?? formData;

  return (
    <div className={styles.container}>
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard" className={styles.backBtn} aria-label="Back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <div className={styles.titleWrapper}>
            <h1>Store Purchase Form</h1>
            <div className={styles.breadcrumb}>Dashboard &gt; Forms &gt; Store Purchase</div>
          </div>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{(userEmail[0] || '?').toUpperCase()}</div>
          <span>{userEmail}</span>
        </div>
      </header>

      <div className={styles.formCard}>
        <div className={styles.infoBar}>
          <div className={styles.infoItem}>
            Ref: <span>{receipt ? receipt.refNumber : 'assigned on submit'}</span>
          </div>
          <div className={styles.infoItem}>Time: <span>{currentTime}</span></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Transaction Details
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="transactionType">Transaction Type *</label>
                <select
                  id="transactionType"
                  name="transactionType"
                  value={formData.transactionType}
                  onChange={handleInputChange}
                  className={`${styles.select} ${errors.transactionType ? styles.inputError : ''}`}
                >
                  <option value="">Select Type</option>
                  {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.transactionType && <span className={styles.errorText}>{errors.transactionType}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="location">Location *</label>
                <select
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={`${styles.select} ${errors.location ? styles.inputError : ''}`}
                >
                  <option value="">Select Location</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                {errors.location && <span className={styles.errorText}>{errors.location}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Entry Date *</label>
                <div className={styles.datePickerWrapper}>
                  <button
                    type="button"
                    className={`${styles.dateDisplay} ${errors.date ? styles.inputError : ''}`}
                    onClick={openDatePicker}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span className={formData.date ? styles.dateValue : styles.datePlaceholder}>
                      {formData.date ? formatDate(formData.date) : 'Select date...'}
                    </span>
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={styles.hiddenDateInput}
                    tabIndex={-1}
                    aria-label="Entry date"
                  />
                </div>
                {errors.date && <span className={styles.errorText}>{errors.date}</span>}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
              Products
            </div>

            <div className={styles.productsContainer}>
              {formData.products.map((product, index) => (
                <div key={index} className={styles.productRow}>
                  <div className={styles.rowNum}>{index + 1}</div>

                  <div className={styles.field}>
                    <select
                      value={product.name}
                      onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                      className={`${styles.select} ${errors[`product_${index}_name`] ? styles.inputError : ''}`}
                      aria-label={`Product ${index + 1}`}
                    >
                      <option value="">Select Product...</option>
                      {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {errors[`product_${index}_name`] && <span className={styles.errorText}>{errors[`product_${index}_name`]}</span>}
                  </div>

                  <div className={styles.field}>
                    <select
                      value={product.unit}
                      onChange={(e) => handleProductChange(index, 'unit', e.target.value)}
                      className={`${styles.select} ${errors[`product_${index}_unit`] ? styles.inputError : ''}`}
                      aria-label={`Unit ${index + 1}`}
                    >
                      <option value="">Unit...</option>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {errors[`product_${index}_unit`] && <span className={styles.errorText}>{errors[`product_${index}_unit`]}</span>}
                  </div>

                  <div className={styles.field}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Count"
                      value={product.count}
                      onChange={(e) => handleProductChange(index, 'count', e.target.value)}
                      className={`${styles.input} ${errors[`product_${index}_count`] ? styles.inputError : ''}`}
                      aria-label={`Count ${index + 1}`}
                    />
                    {errors[`product_${index}_count`] && <span className={styles.errorText}>{errors[`product_${index}_count`]}</span>}
                  </div>

                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeProduct(index)}
                    disabled={formData.products.length <= 1}
                    title="Remove Product"
                    aria-label={`Remove product ${index + 1}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}

              <button type="button" className={styles.addBtn} onClick={addProduct}>
                + Add Product
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Additional Info
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="remarks">Remarks</label>
              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                className={styles.textarea}
                placeholder="Add any notes..."
                maxLength={1000}
              ></textarea>
            </div>
          </div>

          {submitError && <div className={styles.submitError} role="alert">{submitError}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={resetForm}>Reset</button>
            <button type="submit" className={styles.btnSubmit} disabled={isSubmitting}>
              {isSubmitting ? <div className={styles.spinner}></div> : 'Submit Form'}
            </button>
          </div>
        </form>
      </div>

      {receipt && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.checkIcon}>✓</div>
            <h2>Submission Successful!</h2>
            <p>Your store purchase form has been recorded.</p>

            <div className={styles.modalDetails}>
              <div><span>Ref Number:</span> {receipt.refNumber}</div>
              <div><span>Date:</span> {formatDate(receipt.data.date)}</div>
              <div><span>Products:</span> {receipt.data.products.length} item(s)</div>
            </div>

            {!receipt.sheetSynced && !receipt.sheetSkipped && (
              <p className={styles.sheetWarning}>
                Saved, but the Google Sheet copy did not go through. The record is
                safe — ask the admin to re-sync it.
              </p>
            )}

            <div className={styles.receiptActions}>
              <button className={styles.btnIcon} onClick={handlePrint} title="Print Receipt">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print
              </button>
              <button className={styles.btnIcon} onClick={handleDownloadImage} title="Download as Image">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download
              </button>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={resetForm} style={{ flex: 1 }}>
                Submit Another
              </button>
              <Link href="/dashboard" style={{ flex: 1, display: 'block' }}>
                <button className={styles.btnSubmit} style={{ width: '100%' }}>
                  Back to Dashboard
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt used only for the PNG export */}
      <div id="receiptCapture" style={{ display: 'none', background: '#fff', padding: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', color: '#1a1a1a' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px', paddingBottom: '16px', borderBottom: '2px solid #d4af37' }}>
          <h1 style={{ fontSize: '22px', margin: '0 0 4px 0' }}>☕ Coffee Cartel</h1>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Store Purchase Receipt</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f8f6', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
          <div>Ref: <strong>{receipt?.refNumber ?? ''}</strong></div>
          <div>Date: <strong>{formatDate(receiptData.date)}</strong></div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4af37', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Type</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{receiptData.transactionType || '—'}</div></div>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Location</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{receiptData.location || '—'}</div></div>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Submitted By</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{userEmail}</div></div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4af37', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Products</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
          <thead>
            <tr>
              {['#', 'Product', 'Unit', 'Count'].map((h) => (
                <th key={h} style={{ background: '#f8f8f6', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#666', textTransform: 'uppercase', borderBottom: '2px solid #eee' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receiptData.products.map((p, i) => (
              <tr key={i}>
                <td style={{ padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>{i + 1}</td>
                <td style={{ padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>{p.name}</td>
                <td style={{ padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>{p.unit}</td>
                <td style={{ padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {receiptData.remarks && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4af37', marginBottom: '8px', textTransform: 'uppercase' }}>Remarks</div>
            <div style={{ background: '#f8f8f6', padding: '14px 16px', borderRadius: '8px', fontSize: '13px', color: '#555', marginBottom: '28px' }}>{receiptData.remarks}</div>
          </>
        )}
        <div style={{ textAlign: 'center', paddingTop: '16px', borderTop: '1px solid #eee', fontSize: '11px', color: '#aaa' }}>
          Luna Forms Portal • Coffee Cartel
        </div>
      </div>
    </div>
  );
}
