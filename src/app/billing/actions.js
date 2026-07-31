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
