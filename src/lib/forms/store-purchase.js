/**
 * Store Purchase form definition.
 *
 * Single source of truth for the option lists AND the validation rules. The
 * client renders from these arrays; the Server Action validates against the
 * same arrays, so a hand-crafted POST cannot smuggle in an unknown product or
 * location.
 */
import { APPROVED_VENDOR_NAMES, LOCATIONS, VENDOR_NAMES } from './validation-options';
import { parseAmount } from './amount';

export const FORM_SLUG = 'store-purchase';

export const ENTRY_TYPES = [
  'Vendor Billing / Direct Purchase',
  'Commissary Dispatch to Branch',
  'Branch to Branch Transfer',
];

export const TRANSACTION_TYPES = ['Inward', 'Outward'];

export const ENTRY_TYPE_TRANSACTION = {
  'Vendor Billing / Direct Purchase': 'Inward',
  'Commissary Dispatch to Branch': 'Outward',
  'Branch to Branch Transfer': 'Inward',
};

export { LOCATIONS, VENDOR_NAMES };

export const PRODUCTS = [
  'Coffee Beans', 'Sugar', 'Milk', 'Cups', 'Lids', 'Straws',
  'Napkins', 'Syrup', 'Cream', 'Tea', 'Other',
];

export const UNITS = ['Gram', 'KG', 'Box', 'Piece', 'Liter', 'Dozen', 'Pack'];

export const MAX_PRODUCT_ROWS = 50;
export const MAX_REMARKS = 1000;

/**
 * Validate a raw submission payload.
 * Returns { valid, errors, value } — `value` is the cleaned payload to persist.
 */
export function validateStorePurchase(raw, allowedVendors = APPROVED_VENDOR_NAMES) {
  const errors = {};
  const value = {};

  const entryType = String(raw?.entryType ?? '').trim();
  if (!ENTRY_TYPES.includes(entryType)) {
    errors.entryType = 'Select a valid entry type';
  } else {
    value.entryType = entryType;
  }

  const type = ENTRY_TYPE_TRANSACTION[entryType] || String(raw?.transactionType ?? '').trim();
  if (!TRANSACTION_TYPES.includes(type)) {
    errors.transactionType = 'Select a valid transaction type';
  } else {
    value.transactionType = type;
  }

  const vendorName = String(raw?.vendorName ?? '').trim().slice(0, 160);
  if (entryType === 'Vendor Billing / Direct Purchase') {
    if (!vendorName) {
      errors.vendorName = 'Vendor name is required for vendor entries';
    } else if (!allowedVendors.includes(vendorName)) {
      errors.vendorName = 'Select a vendor from the list';
    }
  }
  value.vendorName = vendorName;

  const vendorId = String(raw?.vendorId ?? '').trim();
  value.vendorId = vendorId || null;

  const vendorInvoiceNumber = String(raw?.vendorInvoiceNumber ?? '').trim().slice(0, 120);
  const vendorInvoiceDate = String(raw?.vendorInvoiceDate ?? '').trim();
  const vendorBillAmount = parseAmount(raw?.vendorBillAmount);
  const vendorBillAttachmentName = String(raw?.vendorBillAttachmentName ?? '').trim().slice(0, 240);
  if (entryType === 'Vendor Billing / Direct Purchase') {
    if (!vendorInvoiceNumber) errors.vendorInvoiceNumber = 'Vendor invoice number is required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vendorInvoiceDate) || Number.isNaN(Date.parse(vendorInvoiceDate))) {
      errors.vendorInvoiceDate = 'Enter bill / invoice date';
    }
    if (!Number.isFinite(vendorBillAmount) || vendorBillAmount <= 0) {
      errors.vendorBillAmount = 'Enter bill amount';
    }
    if (!vendorBillAttachmentName) errors.vendorBillAttachmentName = 'Attach vendor bill';
  }
  value.vendorInvoiceNumber = vendorInvoiceNumber;
  value.vendorInvoiceDate = vendorInvoiceDate;
  value.vendorBillAmount = Number.isFinite(vendorBillAmount) && vendorBillAmount > 0 ? vendorBillAmount : null;
  value.vendorBillAttachmentName = vendorBillAttachmentName;

  const fromLocation = String(raw?.fromLocation ?? '').trim();
  const toLocation = String(raw?.toLocation ?? '').trim();
  if (entryType === 'Branch to Branch Transfer') {
    if (!LOCATIONS.includes(fromLocation)) errors.fromLocation = 'Select from location';
    if (!LOCATIONS.includes(toLocation)) errors.toLocation = 'Select to location';
    value.fromLocation = fromLocation;
    value.toLocation = toLocation;
    value.location = toLocation;
  } else {
    const location = String(raw?.location ?? '').trim();
    if (!LOCATIONS.includes(location)) {
      errors.location = 'Select a valid location';
    } else {
      value.location = location;
    }
    value.fromLocation = '';
    value.toLocation = '';
  }

  const requestedBy = String(raw?.requestedBy ?? '').trim().slice(0, 160);
  if (entryType === 'Branch to Branch Transfer' && !requestedBy) {
    errors.requestedBy = 'Requested by name / employee ID is required';
  }
  value.requestedBy = requestedBy;

  const proofAttachmentName = String(raw?.proofAttachmentName ?? '').trim().slice(0, 240);
  if (entryType !== 'Vendor Billing / Direct Purchase' && !proofAttachmentName) {
    errors.proofAttachmentName = 'Attach proof';
  }
  value.proofAttachmentName = proofAttachmentName;

  const date = String(raw?.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    errors.date = 'Enter a valid date';
  } else {
    value.date = date;
  }

  const rows = Array.isArray(raw?.products) ? raw.products : [];
  if (rows.length === 0) {
    errors.products = 'Add at least one product';
  } else if (rows.length > MAX_PRODUCT_ROWS) {
    errors.products = `No more than ${MAX_PRODUCT_ROWS} product rows`;
  }

  const cleanRows = [];
  rows.slice(0, MAX_PRODUCT_ROWS).forEach((row, i) => {
    const name = String(row?.name ?? '').trim();
    const unit = String(row?.unit ?? '').trim();
    const countRaw = row?.count;
    const count = Number(countRaw);

    if (!PRODUCTS.includes(name)) errors[`product_${i}_name`] = 'Required';
    if (!UNITS.includes(unit)) errors[`product_${i}_unit`] = 'Required';
    if (!Number.isFinite(count) || count <= 0) {
      errors[`product_${i}_count`] = 'Must be > 0';
    }

    if (PRODUCTS.includes(name) && UNITS.includes(unit) && Number.isFinite(count) && count > 0) {
      cleanRows.push({ name, unit, count });
    }
  });
  value.products = cleanRows;

  const remarks = String(raw?.remarks ?? '').trim().slice(0, MAX_REMARKS);
  value.remarks = remarks;

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** SP-YYYYMMDD-NNNN — date-scoped so references stay meaningful and sortable. */
export function generateRef(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `SP-${y}${m}${d}-${n}`;
}
