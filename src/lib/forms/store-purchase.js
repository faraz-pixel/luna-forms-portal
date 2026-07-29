/**
 * Store Purchase form definition.
 *
 * Single source of truth for the option lists AND the validation rules. The
 * client renders from these arrays; the Server Action validates against the
 * same arrays, so a hand-crafted POST cannot smuggle in an unknown product or
 * location.
 */
export const FORM_SLUG = 'store-purchase';

export const TRANSACTION_TYPES = ['Inward', 'Outward'];

export const LOCATIONS = ['Commissary-KHI', 'Malir', 'KHI-DHA-P8'];

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
export function validateStorePurchase(raw) {
  const errors = {};
  const value = {};

  const type = String(raw?.transactionType ?? '').trim();
  if (!TRANSACTION_TYPES.includes(type)) {
    errors.transactionType = 'Select a valid transaction type';
  } else {
    value.transactionType = type;
  }

  const location = String(raw?.location ?? '').trim();
  if (!LOCATIONS.includes(location)) {
    errors.location = 'Select a valid location';
  } else {
    value.location = location;
  }

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
