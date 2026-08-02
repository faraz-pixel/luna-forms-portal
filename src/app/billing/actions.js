'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAccounts } from '@/lib/auth';

export async function endorseVendorBill(billId, creditTermsDays) {
  const user = await requireAccounts();
  const days = Number(creditTermsDays);

  if (!billId || !Number.isInteger(days) || days < 0 || days > 3650) {
    return { ok: false, error: 'Enter valid credit terms in days.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('vendor_bills')
    .update({
      credit_terms_days: days,
      credit_terms_status: 'endorsed',
      terms_endorsed_by: user.id,
      terms_endorsed_at: new Date().toISOString(),
    })
    .eq('id', billId);

  if (error) {
    console.error('[billing] endorse bill failed', error);
    return { ok: false, error: 'Could not endorse credit terms.' };
  }

  revalidatePath('/billing');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function recordVendorPayment({ billId, paymentDate, amount, paymentReference = '', paymentMethod = '' }) {
  const user = await requireAccounts();
  const numericAmount = Number(String(amount ?? '').replaceAll(',', ''));

  if (!billId || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, error: 'Enter a valid payment date and amount.' };
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from('vendor_payments').insert({
    vendor_bill_id: billId,
    payment_date: paymentDate,
    amount: numericAmount,
    payment_reference: String(paymentReference).trim().slice(0, 160),
    payment_method: String(paymentMethod).trim().slice(0, 40),
    entered_by: user.id,
  });
  if (insertError) {
    console.error('[billing] record payment failed', insertError);
    return { ok: false, error: 'Could not record the payment.' };
  }

  const [{ data: bill }, { data: payments }] = await Promise.all([
    supabase.from('vendor_bills').select('id, bill_amount').eq('id', billId).single(),
    supabase.from('vendor_payments').select('amount').eq('vendor_bill_id', billId),
  ]);
  const paid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  await supabase
    .from('vendor_bills')
    .update({ status: paid >= Number(bill?.bill_amount || 0) ? 'paid' : 'partially_paid' })
    .eq('id', billId);

  revalidatePath('/billing');
  revalidatePath('/admin/kpi');
  return { ok: true };
}

/**
 * Fetch full read-only detail for a vendor bill for the View Entry modal.
 * Combines the vendor_bills row, the linked store-purchase submission (its
 * payload holds the saved form data), the payment history, and short-lived
 * signed URLs for any stored primary/secondary attachments.
 */
export async function getVendorBillDetail(billId) {
  const user = await requireAccounts();
  if (!billId) {
    return { ok: false, error: 'Bill ID is required.' };
  }

  const supabase = await createClient();

  const { data: bill, error: billError } = await supabase
    .from('vendor_bills')
    .select('*')
    .eq('id', billId)
    .single();

  if (billError || !bill) {
    return { ok: false, error: 'Vendor bill record not found.' };
  }

  // Payment history for this bill.
  const { data: payments } = await supabase
    .from('vendor_payments')
    .select('id, payment_date, amount, payment_reference, payment_method, created_at')
    .eq('vendor_bill_id', billId)
    .order('payment_date', { ascending: true });

  // Linked submission payload (the saved Store Purchase form data).
  const payload = {};
  let submission = null;
  if (bill.source_submission_id) {
    const { data: sub } = await supabase
      .from('submissions')
      .select('ref_number, user_email, created_at, payload')
      .eq('id', bill.source_submission_id)
      .single();
    submission = sub || null;
    if (sub?.payload && typeof sub.payload === 'object') {
      Object.assign(payload, sub.payload);
    }
  }

  // Both attachments use the same private bucket and authorized short-lived URLs.
  const makeSigned = async (path) => {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('store-purchase-attachments')
      .createSignedUrl(path, 300); // 5 mins
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const hasPrimaryStoragePath = Boolean(payload.vendorBillStoragePath);
  let primaryAttachment = null;
  if (hasPrimaryStoragePath) {
    primaryAttachment = {
      name: payload.vendorBillAttachmentName || bill.attachment_name || 'Attachment',
      available: true,
      predatesStorage: false,
      signedUrl: await makeSigned(payload.vendorBillStoragePath),
    };
  } else if (payload.vendorBillAttachmentName || bill.attachment_name) {
    primaryAttachment = {
      name: payload.vendorBillAttachmentName || bill.attachment_name,
      available: false,
      predatesStorage: !Object.prototype.hasOwnProperty.call(payload, 'vendorBillStoragePath'),
      signedUrl: null,
    };
  }

  const hasSecondaryStoragePath =
    Boolean(payload.proofStoragePath) && Boolean(payload.proofAttachmentName);
  let secondaryAttachment = null;
  if (hasSecondaryStoragePath) {
    secondaryAttachment = {
      name: payload.proofAttachmentName,
      available: true,
      predatesStorage: false,
      signedUrl: await makeSigned(payload.proofStoragePath),
    };
  } else if (payload.proofAttachmentName) {
    secondaryAttachment = {
      name: payload.proofAttachmentName,
      available: false,
      predatesStorage: !Object.prototype.hasOwnProperty.call(payload, 'proofAttachmentName'),
      signedUrl: null,
    };
  }

  const paidAmount = (payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return {
    ok: true,
    detail: {
      refNumber: submission?.ref_number || '',
      vendorName: bill.vendor_name,
      vendorNameFromPayload: payload.vendorName || bill.vendor_name,
      invoiceNumber: payload.vendorInvoiceNumber || bill.bill_number,
      billAmount: Number(payload.vendorBillAmount ?? bill.bill_amount),
      invoiceDate: payload.vendorInvoiceDate || bill.invoice_date,
      submittedBy: submission?.user_email || '',
      submittedAt: submission?.created_at || bill.created_at,
      entryType: payload.entryType || '',
      recordType: payload.transactionType || 'Inward',
      location: payload.location || '',
      products: Array.isArray(payload.products) ? payload.products : [],
      remarks: payload.remarks || '',
      primaryAttachment,
      secondaryAttachment,
      creditTermsStatus: bill.credit_terms_status,
      creditTermsDays: bill.credit_terms_days,
      dueDate: bill.due_date,
      billStatus: bill.status,
      billAmountStored: Number(bill.bill_amount),
      paidAmount,
      balance: Math.max(Number(bill.bill_amount) - paidAmount, 0),
      payments: (payments ?? []).map((p) => ({
        paymentDate: p.payment_date,
        amount: Number(p.amount),
        reference: p.payment_reference,
        method: p.payment_method,
      })),
    },
  };
}

export async function getBillAttachmentSignedUrl(billId) {
  const user = await requireAccounts();
  if (!billId) {
    return { ok: false, error: 'Bill ID is required.' };
  }

  const supabase = await createClient();
  const { data: bill, error: billError } = await supabase
    .from('vendor_bills')
    .select('id, attachment_name, source_submission_id')
    .eq('id', billId)
    .single();

  if (billError || !bill) {
    return { ok: false, error: 'Vendor bill record not found.' };
  }

  let storagePath = null;
  if (bill.source_submission_id) {
    const { data: submission } = await supabase
      .from('submissions')
      .select('payload')
      .eq('id', bill.source_submission_id)
      .single();

    storagePath = submission?.payload?.vendorBillStoragePath || null;
  }

  if (!storagePath) {
    return { ok: false, error: 'No stored binary attachment path associated with this bill.', available: false };
  }

  const { data, error: signedError } = await supabase.storage
    .from('store-purchase-attachments')
    .createSignedUrl(storagePath, 300); // 5 mins

  if (signedError || !data?.signedUrl) {
    console.error('[billing] createSignedUrl failed', signedError);
    return { ok: false, error: 'Could not generate secure view URL.' };
  }

  return { ok: true, signedUrl: data.signedUrl, fileName: bill.attachment_name };
}

