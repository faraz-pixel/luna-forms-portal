'use client';

import { useState, useTransition } from 'react';
import { endorseVendorBill, recordVendorPayment } from './actions';
import styles from './page.module.css';

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function BillingClient({ bills }) {
  const [terms, setTerms] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [payment, setPayment] = useState({});
  const [, startTransition] = useTransition();

  const submitTerms = (billId) => {
    setBusy(billId);
    setError('');
    startTransition(async () => {
      const result = await endorseVendorBill(billId, terms[billId]);
      setBusy(null);
      if (!result.ok) setError(result.error);
    });
  };

  const submitPayment = (billId) => {
    setBusy(`payment:${billId}`);
    setError('');
    startTransition(async () => {
      const result = await recordVendorPayment({ billId, ...payment[billId] });
      setBusy(null);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Bill No.</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status / Accounts action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>{bill.vendor_name}</td>
                <td>{bill.bill_number}</td>
                <td>{bill.invoice_date}</td>
                <td>{bill.due_date || 'Hidden until endorsed'}</td>
                <td>{money(bill.bill_amount)}</td>
                <td>{money(bill.paid_amount)}</td>
                <td>{money(bill.balance)}</td>
                <td>
                  {bill.credit_terms_status !== 'endorsed' ? (
                    <div className={styles.termAction}>
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        placeholder="Days"
                        value={terms[bill.id] ?? ''}
                        onChange={(e) => setTerms((prev) => ({ ...prev, [bill.id]: e.target.value }))}
                        aria-label={`Credit terms days for ${bill.bill_number}`}
                      />
                      <button type="button" disabled={busy === bill.id} onClick={() => submitTerms(bill.id)}>
                        {busy === bill.id ? 'Saving…' : 'Endorse'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <span className={styles.status}>{bill.payable_status}</span>
                      {bill.balance > 0 && (
                        <div className={styles.paymentAction}>
                          <input type="date" value={payment[bill.id]?.paymentDate ?? ''} onChange={(e) => setPayment((prev) => ({ ...prev, [bill.id]: { ...prev[bill.id], paymentDate: e.target.value } }))} aria-label={`Payment date for ${bill.bill_number}`} />
                          <input type="number" min="0" step="0.01" placeholder="Amount" value={payment[bill.id]?.amount ?? ''} onChange={(e) => setPayment((prev) => ({ ...prev, [bill.id]: { ...prev[bill.id], amount: e.target.value } }))} aria-label={`Payment amount for ${bill.bill_number}`} />
                          <input type="text" placeholder="Ref" value={payment[bill.id]?.paymentReference ?? ''} onChange={(e) => setPayment((prev) => ({ ...prev, [bill.id]: { ...prev[bill.id], paymentReference: e.target.value } }))} aria-label={`Payment reference for ${bill.bill_number}`} />
                          <button type="button" disabled={busy === `payment:${bill.id}`} onClick={() => submitPayment(bill.id)}>{busy === `payment:${bill.id}` ? 'Saving…' : 'Record payment'}</button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bills.length === 0 && <p className={styles.empty}>No vendor bills match these filters.</p>}
      </div>
    </>
  );
}
