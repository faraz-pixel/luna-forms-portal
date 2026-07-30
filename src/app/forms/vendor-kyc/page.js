import { requireFormAccess } from '@/lib/auth';
import VendorKycForm from './VendorKycForm';

export const dynamic = 'force-dynamic';

export default async function VendorKycPage() {
  const { user } = await requireFormAccess('vendor-kyc');

  return <VendorKycForm userEmail={user.email} />;
}
