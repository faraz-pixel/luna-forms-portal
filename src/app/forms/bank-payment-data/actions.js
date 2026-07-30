'use server';

import { persistFormSubmission } from '@/lib/forms/submission';
import {
  LUNA_BANKS,
  PAYMENT_CATEGORIES,
  PAYMENT_LOCATIONS,
  APPROVED_VENDOR_NAMES,
} from '@/lib/forms/validation-options';

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export async function submitBankPaymentData(raw) {
  const value = {
    paymentDate: text(raw?.paymentDate, 10),
    pocDate: text(raw?.pocDate, 10),
    payerFullName: text(raw?.payerFullName, 160),
    paymentMode: text(raw?.paymentMode, 20),
    chequeRefNumber: text(raw?.chequeRefNumber, 160),
    transferReference: text(raw?.transferReference, 160),
    paymentDescription: text(raw?.paymentDescription, 1000),
    paymentAmount: Number(raw?.paymentAmount),
    bank: text(raw?.bank, 120),
    location: text(raw?.location, 160),
    paymentCategory: text(raw?.paymentCategory, 120),
    remarks: text(raw?.remarks, 1000),
  };
  const errors = {};
  const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));

  if (!validDate(value.paymentDate)) errors.paymentDate = 'Payment date is required';
  if (!validDate(value.pocDate)) errors.pocDate = 'POC date is required';
  if (!APPROVED_VENDOR_NAMES.includes(value.payerFullName)) errors.payerFullName = 'Select payer from Vendor List';
  if (!['Cheque', 'Online'].includes(value.paymentMode)) errors.paymentMode = 'Select payment mode';
  if (!value.chequeRefNumber) errors.chequeRefNumber = 'Cheque / Online Ref No is required';
  if (!value.transferReference) errors.transferReference = 'Vendor Bill Ref is required';
  if (!value.paymentDescription) errors.paymentDescription = 'Payment description is required';
  if (!Number.isFinite(value.paymentAmount) || value.paymentAmount <= 0) errors.paymentAmount = 'Payment amount is required';
  if (!LUNA_BANKS.includes(value.bank)) errors.bank = 'Select bank from list';
  if (!PAYMENT_LOCATIONS.includes(value.location)) errors.location = 'Select location from list';
  if (!PAYMENT_CATEGORIES.includes(value.paymentCategory)) errors.paymentCategory = 'Select payment category from list';

  if (Object.keys(errors).length) {
    return { ok: false, fieldErrors: errors, error: 'Please fix the highlighted fields.' };
  }

  return persistFormSubmission({ formSlug: 'bank-payment-data', prefix: 'BP', payload: value });
}
