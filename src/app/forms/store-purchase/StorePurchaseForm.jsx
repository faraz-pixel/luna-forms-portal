'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { submitStorePurchase } from './actions';
import {
  ENTRY_TYPES,
  ENTRY_TYPE_TRANSACTION,
  LOCATIONS,
  PRODUCTS,
  UNITS,
  VENDOR_NAMES,
} from '@/lib/forms/store-purchase';
import { formatAmount, parseAmount } from '@/lib/forms/amount';
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
const VENDOR_KYC_FORM_URL = '/forms/vendor-kyc';

function SearchableInput({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  className,
  error,
  ariaLabel,
  onValidate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const search = String(value || '').toLowerCase();
  const filteredOptions = search
    ? options.filter((option) => option.toLowerCase().includes(search))
    : options;

  const handleSelect = (option) => {
    onChange({ target: { name, value: option } });
    setIsOpen(false);
  };

  return (
    <div className={styles.comboBox}>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 120);
          onValidate?.(value);
        }}
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
      />
      <button
        type="button"
        className={styles.comboButton}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Show options"
      >
        ▾
      </button>
      {isOpen && (
        <div className={styles.comboMenu}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={styles.comboOption}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                {option}
              </button>
            ))
          ) : (
            <div className={styles.comboEmpty}>No matching option</div>
          )}
        </div>
      )}
      {error}
    </div>
  );
}

export default function StorePurchaseForm({ userEmail }) {
  const dateInputRef = useRef(null);
  const vendorInvoiceDateInputRef = useRef(null);

  const [currentTime, setCurrentTime] = useState('');
  const [formData, setFormData] = useState({
    entryType: '',
    transactionType: '',
    vendorName: '',
    vendorInvoiceNumber: '',
    vendorInvoiceDate: '',
    vendorBillAmount: '',
    vendorBillAttachmentName: '',
    location: '',
    fromLocation: '',
    toLocation: '',
    date: '',
    products: [{ ...initialProduct }],
    requestedBy: '',
    proofAttachmentName: '',
    remarks: '',
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const transactionType = ENTRY_TYPE_TRANSACTION[formData.entryType] || '';
  const isVendorEntry = formData.entryType === 'Vendor Billing / Direct Purchase';
  const isBranchTransferReceiving = formData.entryType === 'Branch to Branch Transfer';

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString());
    setFormData((prev) => ({ ...prev, date: getTodayISO() }));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'entryType') {
        next.transactionType = ENTRY_TYPE_TRANSACTION[value] || '';
        next.vendorName = '';
        next.vendorInvoiceNumber = '';
        next.vendorInvoiceDate = '';
        next.vendorBillAmount = '';
        next.vendorBillAttachmentName = '';
        next.fromLocation = '';
        next.toLocation = '';
      }
      return next;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const value = files?.[0]?.name || '';
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleAmountChange = (e) => {
    const { name, value } = e.target;
    const raw = value.replaceAll(',', '').replace(/[^0-9()-]/g, '');
    setFormData((prev) => ({ ...prev, [name]: raw }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleAmountBlur = (e) => {
    const { name, value } = e.target;
    const formatted = formatAmount(value);
    setFormData((prev) => ({ ...prev, [name]: formatted || value }));
  };

  const handleProductChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }));
    const errKey = `product_${index}_${field}`;
    if (errors[errKey]) setErrors((prev) => ({ ...prev, [errKey]: null }));
  };

  const validateOptionField = (field, value, options, message) => {
    const trimmed = String(value || '').trim();
    setErrors((prev) => {
      if (!trimmed || options.includes(trimmed)) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: message };
    });
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
    if (!formData.entryType) next.entryType = 'Entry Type is required';
    if (!transactionType) next.transactionType = 'Transaction Type is required';
    if (isVendorEntry && !formData.vendorName.trim()) {
      next.vendorName = 'Vendor Name is required';
    } else if (isVendorEntry && !VENDOR_NAMES.includes(formData.vendorName.trim())) {
      next.vendorName = 'Select a vendor from the list';
    }
    if (isVendorEntry && !formData.vendorInvoiceNumber.trim()) {
      next.vendorInvoiceNumber = 'Vendor Invoice Number is required';
    }
    if (isVendorEntry && !formData.vendorInvoiceDate) {
      next.vendorInvoiceDate = 'Bill / Invoice Date is required';
    }
    if (isVendorEntry && (!formData.vendorBillAmount || parseAmount(formData.vendorBillAmount) <= 0)) {
      next.vendorBillAmount = 'Bill Amount is required';
    }
    if (isVendorEntry && !formData.vendorBillAttachmentName) {
      next.vendorBillAttachmentName = 'Vendor Bill attachment is required';
    }
    if (isBranchTransferReceiving) {
      if (!formData.fromLocation) {
        next.fromLocation = 'From Location is required';
      } else if (!LOCATIONS.includes(formData.fromLocation)) {
        next.fromLocation = 'Select from the location list';
      }
      if (!formData.toLocation) {
        next.toLocation = 'To Location is required';
      } else if (!LOCATIONS.includes(formData.toLocation)) {
        next.toLocation = 'Select from the location list';
      }
    } else if (!formData.location) {
      next.location = 'Location is required';
    } else if (!LOCATIONS.includes(formData.location)) {
      next.location = 'Select from the location list';
    }
    if (!formData.date) next.date = 'Date is required';
    if (isBranchTransferReceiving && !formData.requestedBy.trim()) {
      next.requestedBy = 'Requested By is required';
    }
    if (!formData.proofAttachmentName) next.proofAttachmentName = 'Proof attachment is required';

    formData.products.forEach((p, i) => {
      if (!p.name) {
        next[`product_${i}_name`] = 'Required';
      } else if (!PRODUCTS.includes(p.name)) {
        next[`product_${i}_name`] = 'Select from list';
      }
      if (!p.unit) {
        next[`product_${i}_unit`] = 'Required';
      } else if (!UNITS.includes(p.unit)) {
        next[`product_${i}_unit`] = 'Select from list';
      }
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
    // Keep the accounting display (for example, "12,389") in the field,
    // but submit a numeric value so formatted commas can never break saving.
    const submissionData = {
      ...formData,
      transactionType,
      vendorBillAmount: formData.vendorBillAmount
        ? parseAmount(formData.vendorBillAmount)
        : formData.vendorBillAmount,
    };
    const result = await submitStorePurchase(submissionData);
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
      data: submissionData,
    });
  };

  const openDatePicker = () => dateInputRef.current?.showPicker?.();
  const openVendorInvoiceDatePicker = () => vendorInvoiceDateInputRef.current?.showPicker?.();

  const resetForm = () => {
    setFormData({
      entryType: '',
      transactionType: '',
      vendorName: '',
      vendorInvoiceNumber: '',
      vendorInvoiceDate: '',
      vendorBillAmount: '',
      vendorBillAttachmentName: '',
      location: '',
      fromLocation: '',
      toLocation: '',
      date: getTodayISO(),
      products: [{ ...initialProduct }],
      requestedBy: '',
      proofAttachmentName: '',
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
        <title>Stock Inward Receipt - ${esc(refNumber)}</title>
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
          <p>Stock Inward Receipt</p>
        </div>
        <div class="meta-row">
          <div>Ref: <span>${esc(refNumber)}</span></div>
          <div>Date: <span>${esc(formatDate(data.date))}</span></div>
        </div>
        <div class="section-title">Transaction Details</div>
        <div class="info-grid">
          <div class="info-item"><label>Entry Type</label><p>${esc(data.entryType)}</p></div>
          <div class="info-item"><label>Type</label><p>${esc(data.transactionType)}</p></div>
          <div class="info-item"><label>Location</label><p>${esc(data.location)}</p></div>
          <div class="info-item"><label>Submitted By</label><p>${esc(userEmail)}</p></div>
          ${data.vendorName ? `<div class="info-item"><label>Vendor Name</label><p>${esc(data.vendorName)}</p></div>` : ''}
          ${data.vendorInvoiceNumber ? `<div class="info-item"><label>Vendor Bill No.</label><p>${esc(data.vendorInvoiceNumber)}</p></div>` : ''}
          ${data.vendorBillAmount ? `<div class="info-item"><label>Bill Amount</label><p>${esc(Number(data.vendorBillAmount).toLocaleString())}</p></div>` : ''}
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
            <h1>Stock Inward Entry</h1>
            <div className={styles.breadcrumb}>Dashboard &gt; Forms &gt; Stock Inward</div>
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
                <label className={styles.label} htmlFor="entryType">Entry Type *</label>
                <select
                  id="entryType"
                  name="entryType"
                  value={formData.entryType}
                  onChange={handleInputChange}
                  className={`${styles.select} ${errors.entryType ? styles.inputError : ''}`}
                >
                  <option value="">Select Entry Type</option>
                  {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.entryType && <span className={styles.errorText}>{errors.entryType}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Transaction Type *</label>
                <div className={`${styles.readOnlyValue} ${errors.transactionType ? styles.inputError : ''}`}>
                  {transactionType || 'Select Entry Type first'}
                </div>
                {errors.transactionType && <span className={styles.errorText}>{errors.transactionType}</span>}
              </div>

              {isBranchTransferReceiving ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="fromLocation">From Location *</label>
                    <SearchableInput
                      id="fromLocation"
                      name="fromLocation"
                      value={formData.fromLocation}
                      onChange={handleInputChange}
                      className={`${styles.select} ${errors.fromLocation ? styles.inputError : ''}`}
                      placeholder="From Location..."
                      options={LOCATIONS}
                      onValidate={(value) => validateOptionField('fromLocation', value, LOCATIONS, 'Select from the location list')}
                    />
                    {errors.fromLocation && <span className={styles.errorText}>{errors.fromLocation}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="toLocation">To Location *</label>
                    <SearchableInput
                      id="toLocation"
                      name="toLocation"
                      value={formData.toLocation}
                      onChange={handleInputChange}
                      className={`${styles.select} ${errors.toLocation ? styles.inputError : ''}`}
                      placeholder="To Location..."
                      options={LOCATIONS}
                      onValidate={(value) => validateOptionField('toLocation', value, LOCATIONS, 'Select from the location list')}
                    />
                    {errors.toLocation && <span className={styles.errorText}>{errors.toLocation}</span>}
                  </div>
                </>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="location">Location *</label>
                  <SearchableInput
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className={`${styles.select} ${errors.location ? styles.inputError : ''}`}
                    placeholder="Location..."
                    options={LOCATIONS}
                    onValidate={(value) => validateOptionField('location', value, LOCATIONS, 'Select from the location list')}
                  />
                  {errors.location && <span className={styles.errorText}>{errors.location}</span>}
                </div>
              )}

              {isVendorEntry && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="vendorName">Vendor Name *</label>
                    <SearchableInput
                      id="vendorName"
                      name="vendorName"
                      value={formData.vendorName}
                      onChange={handleInputChange}
                      className={`${styles.input} ${errors.vendorName ? styles.inputError : ''}`}
                      placeholder="Search vendor name..."
                      options={VENDOR_NAMES}
                      onValidate={(value) => validateOptionField('vendorName', value, VENDOR_NAMES, 'Select a vendor from the list')}
                    />
                    {errors.vendorName && <span className={styles.errorText}>{errors.vendorName}</span>}
                    {formData.vendorName === 'Add New Vendor' && (
                      <a
                        href={VENDOR_KYC_FORM_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.inlineAction}
                      >
                        Open Vendor KYC
                      </a>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="vendorInvoiceNumber">Vendor Invoice Number *</label>
                    <input
                      id="vendorInvoiceNumber"
                      name="vendorInvoiceNumber"
                      type="text"
                      value={formData.vendorInvoiceNumber}
                      onChange={handleInputChange}
                      className={`${styles.input} ${errors.vendorInvoiceNumber ? styles.inputError : ''}`}
                      placeholder="Enter invoice number..."
                      maxLength={120}
                    />
                    {errors.vendorInvoiceNumber && <span className={styles.errorText}>{errors.vendorInvoiceNumber}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Bill / Invoice Date *</label>
                    <div className={styles.datePickerWrapper}>
                      <button
                        type="button"
                        className={`${styles.dateDisplay} ${errors.vendorInvoiceDate ? styles.inputError : ''}`}
                        onClick={openVendorInvoiceDatePicker}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span className={formData.vendorInvoiceDate ? styles.dateValue : styles.datePlaceholder}>
                          {formData.vendorInvoiceDate ? formatDate(formData.vendorInvoiceDate) : 'Select date...'}
                        </span>
                      </button>
                      <input
                        ref={vendorInvoiceDateInputRef}
                        type="date"
                        name="vendorInvoiceDate"
                        value={formData.vendorInvoiceDate}
                        onChange={handleInputChange}
                        className={styles.hiddenDateInput}
                        tabIndex={-1}
                        aria-label="Bill / invoice date"
                      />
                    </div>
                    {errors.vendorInvoiceDate && <span className={styles.errorText}>{errors.vendorInvoiceDate}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="vendorBillAmount">Bill Amount *</label>
                    <input
                      id="vendorBillAmount"
                      name="vendorBillAmount"
                      type="text"
                      inputMode="numeric"
                      value={formData.vendorBillAmount}
                      onChange={handleAmountChange}
                      onBlur={handleAmountBlur}
                      className={`${styles.input} ${errors.vendorBillAmount ? styles.inputError : ''}`}
                      placeholder="Enter bill amount..."
                    />
                    {errors.vendorBillAmount && <span className={styles.errorText}>{errors.vendorBillAmount}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="vendorBillAttachmentName">Vendor Bill *</label>
                    <input
                      id="vendorBillAttachmentName"
                      name="vendorBillAttachmentName"
                      type="file"
                      onChange={handleFileChange}
                      className={`${styles.input} ${errors.vendorBillAttachmentName ? styles.inputError : ''}`}
                    />
                    {formData.vendorBillAttachmentName && <span className={styles.description}>{formData.vendorBillAttachmentName}</span>}
                    {errors.vendorBillAttachmentName && <span className={styles.errorText}>{errors.vendorBillAttachmentName}</span>}
                  </div>
                </>
              )}

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
              <div className={styles.productHeaderRow}>
                <div></div>
                <div>Product / Item</div>
                <div>Unit - Weight / Measure</div>
                <div>Qty</div>
                <div></div>
              </div>
              {formData.products.map((product, index) => (
                <div key={index} className={styles.productRow}>
                  <div className={styles.rowNum}>{index + 1}</div>

                  <div className={styles.field}>
                    <SearchableInput
                      id={`product-${index}-name`}
                      value={product.name}
                      onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                      className={`${styles.select} ${errors[`product_${index}_name`] ? styles.inputError : ''}`}
                      aria-label={`Product ${index + 1}`}
                      placeholder="Select..."
                      options={PRODUCTS}
                      onValidate={(value) => validateOptionField(`product_${index}_name`, value, PRODUCTS, 'Select from list')}
                    />
                    {errors[`product_${index}_name`] && <span className={styles.errorText}>{errors[`product_${index}_name`]}</span>}
                  </div>

                  <div className={styles.field}>
                    <SearchableInput
                      id={`product-${index}-unit`}
                      value={product.unit}
                      onChange={(e) => handleProductChange(index, 'unit', e.target.value)}
                      className={`${styles.select} ${errors[`product_${index}_unit`] ? styles.inputError : ''}`}
                      aria-label={`Unit ${index + 1}`}
                      placeholder="Select..."
                      options={UNITS}
                      onValidate={(value) => validateOptionField(`product_${index}_unit`, value, UNITS, 'Select from list')}
                    />
                    {errors[`product_${index}_unit`] && <span className={styles.errorText}>{errors[`product_${index}_unit`]}</span>}
                  </div>

                  <div className={styles.field}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Enter qty..."
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

          {!isVendorEntry && <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Proof Details
            </div>

            <div className={styles.grid}>
              {isBranchTransferReceiving && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="requestedBy">Requested By Name / Employee ID *</label>
                  <input
                    id="requestedBy"
                    name="requestedBy"
                    type="text"
                    value={formData.requestedBy}
                    onChange={handleInputChange}
                    className={`${styles.input} ${errors.requestedBy ? styles.inputError : ''}`}
                    placeholder="Name or Employee ID..."
                    maxLength={160}
                  />
                  {errors.requestedBy && <span className={styles.errorText}>{errors.requestedBy}</span>}
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="proofAttachmentName">Attach Proof *</label>
                <input
                  id="proofAttachmentName"
                  name="proofAttachmentName"
                  type="file"
                  onChange={handleFileChange}
                  className={`${styles.input} ${errors.proofAttachmentName ? styles.inputError : ''}`}
                />
                {formData.proofAttachmentName && <span className={styles.description}>{formData.proofAttachmentName}</span>}
                {errors.proofAttachmentName && <span className={styles.errorText}>{errors.proofAttachmentName}</span>}
              </div>
            </div>
          </div>}

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
            <p>Your stock inward entry has been recorded.</p>

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
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Stock Inward Receipt</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8f8f6', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
          <div>Ref: <strong>{receipt?.refNumber ?? ''}</strong></div>
          <div>Date: <strong>{formatDate(receiptData.date)}</strong></div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4af37', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Entry Type</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{receiptData.entryType || '—'}</div></div>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Type</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{receiptData.transactionType || '—'}</div></div>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Location</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{receiptData.location || '—'}</div></div>
          <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Submitted By</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{userEmail}</div></div>
          {receiptData.vendorName && <div><div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Vendor Name</div><div style={{ fontSize: '15px', fontWeight: 500, marginTop: '4px' }}>{receiptData.vendorName}</div></div>}
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
