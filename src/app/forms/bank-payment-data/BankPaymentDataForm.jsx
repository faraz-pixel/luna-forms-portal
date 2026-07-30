'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { submitBankPaymentData } from './actions';
import {
  LUNA_BANKS,
  PAYMENT_CATEGORIES,
  PAYMENT_LOCATIONS,
  APPROVED_VENDOR_NAMES,
} from '@/lib/forms/validation-options';
import { formatAmount, parseAmount } from '@/lib/forms/amount';
import styles from '../store-purchase/page.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
};

const getTodayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const initialForm = {
  paymentDate: getTodayISO(),
  pocDate: '',
  payerFullName: '',
  paymentMode: '',
  chequeRefNumber: '',
  transferReference: '',
  paymentDescription: '',
  paymentAmount: '',
  bank: '',
  location: '',
  paymentCategory: '',
  remarks: '',
};

function SearchableInput({ label, name, value, onChange, options, error, placeholder = 'Select...' }) {
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
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>{label}</label>
      <div className={styles.comboBox}>
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          placeholder={placeholder}
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
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

function DateField({ label, name, value, onChange, error }) {
  const ref = useRef(null);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>{label}</label>
      <button
        type="button"
        className={`${styles.dateDisplay} ${error ? styles.inputError : ''}`}
        onClick={() => ref.current?.showPicker?.()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        {value ? formatDate(value) : 'Select date...'}
      </button>
      <input
        ref={ref}
        id={name}
        name={name}
        type="date"
        value={value}
        onChange={onChange}
        className={styles.hiddenDateInput}
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

function Field({ label, name, value, onChange, onBlur, error, type = 'text', placeholder = '' }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        placeholder={placeholder}
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

export default function BankPaymentDataForm({ userEmail }) {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [receipt, setReceipt] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const next = {};
    if (!formData.paymentDate) next.paymentDate = 'Payment date is required';
    if (!formData.pocDate) next.pocDate = 'POC date is required';
    if (!APPROVED_VENDOR_NAMES.includes(formData.payerFullName)) next.payerFullName = 'Select payer from Vendor List';
    if (!['Cheque', 'Online'].includes(formData.paymentMode)) next.paymentMode = 'Select payment mode';
    if (!formData.chequeRefNumber.trim()) next.chequeRefNumber = 'Cheque / Online Ref No is required';
    if (!formData.transferReference.trim()) next.transferReference = 'Vendor Bill Ref is required';
    if (!formData.paymentDescription.trim()) next.paymentDescription = 'Payment description is required';
    if (!formData.paymentAmount || parseAmount(formData.paymentAmount) <= 0) next.paymentAmount = 'Payment amount is required';
    if (!LUNA_BANKS.includes(formData.bank)) next.bank = 'Select bank from list';
    if (!PAYMENT_LOCATIONS.includes(formData.location)) next.location = 'Select location from list';
    if (!PAYMENT_CATEGORIES.includes(formData.paymentCategory)) next.paymentCategory = 'Select payment category from list';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError('');
    setIsSubmitting(true);
    const result = await submitBankPaymentData(formData);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors || {});
      setSubmitError(result.error || 'Could not submit payment data.');
      return;
    }
    setReceipt({
      refNumber: result.refNumber,
      amount: formatAmount(formData.paymentAmount),
      category: formData.paymentCategory,
      submittedAt: new Date().toLocaleString(),
    });
  };

  const resetForm = () => {
    setFormData(initialForm);
    setErrors({});
    setReceipt(null);
    setSubmitError('');
  };

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
            <h1>Bank Payment Data</h1>
            <div className={styles.breadcrumb}>Dashboard &gt; Forms &gt; Bank Payment Data</div>
          </div>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{(userEmail[0] || '?').toUpperCase()}</div>
          <span>{userEmail}</span>
        </div>
      </header>

      <div className={styles.formCard}>
        <div className={styles.infoBar}>
          <div className={styles.infoItem}>Ref: <span>{receipt ? receipt.refNumber : 'assigned on submit'}</span></div>
          <div className={styles.infoItem}>Status: <span>local demo only</span></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Payment Details</div>
            <div className={styles.grid}>
              <DateField label="Payment Date *" name="paymentDate" value={formData.paymentDate} onChange={handleChange} error={errors.paymentDate} />
              <DateField label="POC Date *" name="pocDate" value={formData.pocDate} onChange={handleChange} error={errors.pocDate} />
              <SearchableInput label="Payer Full Name *" name="payerFullName" value={formData.payerFullName} onChange={handleChange} options={APPROVED_VENDOR_NAMES} error={errors.payerFullName} placeholder="Search payer..." />
              <SearchableInput label="Payment Mode *" name="paymentMode" value={formData.paymentMode} onChange={handleChange} options={['Cheque', 'Online']} error={errors.paymentMode} placeholder="Select payment mode..." />
              <Field label="Cheque / Online Ref No *" name="chequeRefNumber" value={formData.chequeRefNumber} onChange={handleChange} error={errors.chequeRefNumber} placeholder="Enter cheque or online ref no..." />
              <Field label="Vendor Bill Ref *" name="transferReference" value={formData.transferReference} onChange={handleChange} error={errors.transferReference} placeholder="Enter vendor bill ref..." />
              <Field label="Payment Amount *" name="paymentAmount" type="text" value={formData.paymentAmount} onChange={(e) => {
                const raw = e.target.value.replaceAll(',', '').replace(/[^0-9()-]/g, '');
                handleChange({ target: { name: 'paymentAmount', value: raw } });
              }} onBlur={(e) => handleChange({ target: { name: 'paymentAmount', value: formatAmount(e.target.value) || e.target.value } })} error={errors.paymentAmount} placeholder="Enter amount..." />
              <SearchableInput label="Payment From Luna Bank *" name="bank" value={formData.bank} onChange={handleChange} options={LUNA_BANKS} error={errors.bank} placeholder="Search Luna bank..." />
              <SearchableInput label="Location *" name="location" value={formData.location} onChange={handleChange} options={PAYMENT_LOCATIONS} error={errors.location} placeholder="Search location..." />
              <SearchableInput label="Payment Category *" name="paymentCategory" value={formData.paymentCategory} onChange={handleChange} options={PAYMENT_CATEGORIES} error={errors.paymentCategory} placeholder="Search category..." />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>Additional Info</div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="paymentDescription">Payment Description *</label>
              <textarea
                id="paymentDescription"
                name="paymentDescription"
                value={formData.paymentDescription}
                onChange={handleChange}
                className={`${styles.textarea} ${errors.paymentDescription ? styles.inputError : ''}`}
                placeholder="Enter payment details..."
              />
              {errors.paymentDescription && <span className={styles.errorText}>{errors.paymentDescription}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="remarks">Remarks</label>
              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                className={styles.textarea}
                placeholder="Add any notes..."
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={resetForm}>Reset</button>
            <button type="submit" className={styles.btnSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </div>
          {submitError && <div className={styles.errorText} role="alert">{submitError}</div>}
        </form>
      </div>

      {receipt && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.checkIcon}>✓</div>
            <h2>Payment Data Submitted</h2>
            <p>{receipt.category} payment for PKR {receipt.amount} is ready for review.</p>
            <div className={styles.modalDetails}>
              <div><span>Reference:</span> {receipt.refNumber}</div>
              <div><span>Submitted:</span> {receipt.submittedAt}</div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={resetForm} style={{ flex: 1 }}>Submit Another</button>
              <Link href="/dashboard" style={{ flex: 1, display: 'block' }}>
                <button className={styles.btnSubmit} style={{ width: '100%' }}>Back to Dashboard</button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
