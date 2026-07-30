'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BANK_NAMES } from '@/lib/forms/validation-options';
import { submitVendorKyc } from './actions';
import styles from '../store-purchase/page.module.css';

const BUSINESS_STRUCTURES = [
  'Sole Proprietorship',
  'Partnership / AOP',
  'Private Limited Company',
  'Limited Company',
  'Other',
];

const INDUSTRIES = [
  'Manufacturing',
  'Retail',
  'Professional Services',
  'Technology',
  'Logistics',
  'Food and Beverage',
  'Meat/Chicken',
  'Dairy / Farm',
  'Others',
];

const initialForm = {
  businessName: '',
  registrationNumber: '',
  taxNumber: '',
  businessStructure: '',
  primaryIndustry: '',
  businessAddress: '',
  contactEmail: '',
  contactPhone: '',
  registrationFile: '',
  billFile: '',
  bankAccountTitle: '',
  iban: '',
  bankAccountNumber: '',
  bankName: '',
  notes: '',
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

export default function VendorKycForm({ userEmail }) {
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

  const handleFile = (e) => {
    const { name, files } = e.target;
    const value = files?.[0]?.name || '';
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const next = {};
    if (!formData.businessName.trim()) next.businessName = 'Business name is required';
    if (!formData.registrationNumber.trim()) next.registrationNumber = 'Registration / NTN is required';
    if (!formData.taxNumber.trim()) next.taxNumber = 'SRB / PRA number is required';
    if (!BUSINESS_STRUCTURES.includes(formData.businessStructure)) next.businessStructure = 'Select business structure from list';
    if (!INDUSTRIES.includes(formData.primaryIndustry)) next.primaryIndustry = 'Select primary industry from list';
    if (!formData.businessAddress.trim()) next.businessAddress = 'Business address is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
      next.contactEmail = 'Valid email is required';
    }
    if (!/^\d{4}-\d{7}$/.test(formData.contactPhone.trim())) {
      next.contactPhone = 'Use format 0300-1234567';
    }
    if (!formData.registrationFile) next.registrationFile = 'Registration certificate is required';
    if (!formData.billFile) next.billFile = 'Bill / invoice upload is required';
    if (!formData.bankAccountTitle.trim()) next.bankAccountTitle = 'Bank account title is required';
    if (!/^[A-Za-z0-9]{24}$/.test(formData.iban.trim())) {
      next.iban = 'IBAN must be 24 alphanumeric characters';
    }
    if (!BANK_NAMES.includes(formData.bankName)) next.bankName = 'Select bank from list';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError('');
    setIsSubmitting(true);
    const result = await submitVendorKyc(formData);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors || {});
      setSubmitError(result.error || 'Could not submit Vendor KYC.');
      return;
    }
    setReceipt({
      vendor: formData.businessName.trim(),
      source: 'via KYC',
      submittedAt: new Date().toLocaleString(),
      refNumber: result.refNumber,
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
            <h1>Vendor KYC Verification</h1>
            <div className={styles.breadcrumb}>Dashboard &gt; Forms &gt; Vendor KYC</div>
          </div>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{(userEmail[0] || '?').toUpperCase()}</div>
          <span>{userEmail}</span>
        </div>
      </header>

      <div className={styles.formCard}>
        <div className={styles.infoBar}>
          <div className={styles.infoItem}>Status: <span>local demo only</span></div>
          <div className={styles.infoItem}>Source: <span>via KYC</span></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Vendor Details</div>
            <div className={styles.grid}>
              <Field label="Full Legal Business Name *" name="businessName" value={formData.businessName} onChange={handleChange} error={errors.businessName} />
              <Field label="Business Registration Number / NTN *" name="registrationNumber" value={formData.registrationNumber} onChange={handleChange} error={errors.registrationNumber} />
              <Field label="SRB / PRA Number *" name="taxNumber" value={formData.taxNumber} onChange={handleChange} error={errors.taxNumber} />
              <SearchableInput label="Business Structure *" name="businessStructure" value={formData.businessStructure} onChange={handleChange} options={BUSINESS_STRUCTURES} error={errors.businessStructure} />
              <SearchableInput label="Primary Industry *" name="primaryIndustry" value={formData.primaryIndustry} onChange={handleChange} options={INDUSTRIES} error={errors.primaryIndustry} />
              <Field label="Primary Contact Email Address *" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleChange} error={errors.contactEmail} />
              <Field label="Primary Contact Phone Number *" name="contactPhone" value={formData.contactPhone} onChange={handleChange} error={errors.contactPhone} placeholder="0300-1234567" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="businessAddress">Registered Business Address *</label>
              <textarea id="businessAddress" name="businessAddress" value={formData.businessAddress} onChange={handleChange} className={`${styles.textarea} ${errors.businessAddress ? styles.inputError : ''}`} placeholder="Enter registered address..." />
              {errors.businessAddress && <span className={styles.errorText}>{errors.businessAddress}</span>}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>Documents</div>
            <div className={styles.grid}>
              <FileField label="Business Registration Certificate / NTN / CNIC *" name="registrationFile" value={formData.registrationFile} onChange={handleFile} error={errors.registrationFile} />
              <FileField label="Any bill / invoice *" name="billFile" value={formData.billFile} onChange={handleFile} error={errors.billFile} />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>Bank Details</div>
            <div className={styles.grid}>
              <Field label="Bank Account Title *" name="bankAccountTitle" value={formData.bankAccountTitle} onChange={handleChange} error={errors.bankAccountTitle} />
              <Field label="IBAN Number *" name="iban" value={formData.iban} onChange={handleChange} error={errors.iban} placeholder="PK12ABC..." maxLength={24} />
              <Field label="Bank Account Number" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} />
              <SearchableInput label="Bank Name *" name="bankName" value={formData.bankName} onChange={handleChange} options={BANK_NAMES} error={errors.bankName} />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>Additional Info</div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="notes">Other Notes</label>
              <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className={styles.textarea} placeholder="Add any notes..." />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={resetForm}>Reset</button>
            <button type="submit" className={styles.btnSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit KYC'}
            </button>
          </div>
          {submitError && <div className={styles.errorText} role="alert">{submitError}</div>}
        </form>
      </div>

      {receipt && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.checkIcon}>✓</div>
            <h2>Vendor KYC Submitted</h2>
            <p>{receipt.vendor} is ready for admin review.</p>
            <div className={styles.modalDetails}>
              <div><span>Vendor List Trigger:</span> {receipt.source}</div>
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

function Field({ label, name, value, onChange, error, type = 'text', placeholder = '', maxLength }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={value} onChange={onChange} className={`${styles.input} ${error ? styles.inputError : ''}`} placeholder={placeholder} maxLength={maxLength} />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

function FileField({ label, name, value, onChange, error }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>{label}</label>
      <input id={name} name={name} type="file" onChange={onChange} className={`${styles.input} ${error ? styles.inputError : ''}`} />
      {value && <span className={styles.description}>{value}</span>}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}
