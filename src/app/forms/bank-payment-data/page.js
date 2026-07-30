import { requireFormAccess } from '@/lib/auth';
import BankPaymentDataForm from './BankPaymentDataForm';

export const dynamic = 'force-dynamic';

export default async function BankPaymentDataPage() {
  const { user } = await requireFormAccess('bank-payment-data');

  return <BankPaymentDataForm userEmail={user.email} />;
}
