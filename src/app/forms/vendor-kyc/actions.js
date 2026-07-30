'use server';

import { persistFormSubmission } from '@/lib/forms/submission';
import { BANK_NAMES } from '@/lib/forms/validation-options';

const BUSINESS_STRUCTURES = [
  'Sole Proprietorship', 'Partnership / AOP', 'Private Limited Company',
  'Limited Company', 'Other',
];

const INDUSTRIES = [
  'Manufacturing', 'Retail', 'Professional Services', 'Technology', 'Logistics',
  'Food and Beverage', 'Meat/Chicken', 'Dairy / Farm', 'Others',
];

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export async function submitVendorKyc(raw) {
  const value = {
    businessName: text(raw?.businessName, 160),
    registrationNumber: text(raw?.registrationNumber, 160),
    taxNumber: text(raw?.taxNumber, 160),
    businessStructure: text(raw?.businessStructure, 80),
    primaryIndustry: text(raw?.primaryIndustry, 80),
    businessAddress: text(raw?.businessAddress, 1000),
    contactEmail: text(raw?.contactEmail, 240).toLowerCase(),
    contactPhone: text(raw?.contactPhone, 20),
    registrationFile: text(raw?.registrationFile, 240),
    billFile: text(raw?.billFile, 240),
    bankAccountTitle: text(raw?.bankAccountTitle, 160),
    iban: text(raw?.iban, 24).toUpperCase(),
    bankAccountNumber: text(raw?.bankAccountNumber, 80),
    bankName: text(raw?.bankName, 120),
    notes: text(raw?.notes, 1000),
  };
  const errors = {};

  if (!value.businessName) errors.businessName = 'Business name is required';
  if (!value.registrationNumber) errors.registrationNumber = 'Registration / NTN is required';
  if (!value.taxNumber) errors.taxNumber = 'SRB / PRA number is required';
  if (!BUSINESS_STRUCTURES.includes(value.businessStructure)) errors.businessStructure = 'Select business structure from list';
  if (!INDUSTRIES.includes(value.primaryIndustry)) errors.primaryIndustry = 'Select primary industry from list';
  if (!value.businessAddress) errors.businessAddress = 'Business address is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail)) errors.contactEmail = 'Valid email is required';
  if (!/^\d{4}-\d{7}$/.test(value.contactPhone)) errors.contactPhone = 'Use format 0300-1234567';
  if (!value.registrationFile) errors.registrationFile = 'Registration certificate is required';
  if (!value.billFile) errors.billFile = 'Bill / invoice upload is required';
  if (!value.bankAccountTitle) errors.bankAccountTitle = 'Bank account title is required';
  if (!/^[A-Z0-9]{24}$/.test(value.iban)) errors.iban = 'IBAN must be 24 alphanumeric characters';
  if (!BANK_NAMES.includes(value.bankName)) errors.bankName = 'Select bank from list';

  if (Object.keys(errors).length) {
    return { ok: false, fieldErrors: errors, error: 'Please fix the highlighted fields.' };
  }

  return persistFormSubmission({
    formSlug: 'vendor-kyc',
    prefix: 'KYC',
    payload: { ...value, vendorListTrigger: 'via KYC', approvalStatus: 'pending' },
  });
}
