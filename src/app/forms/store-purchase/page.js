import { requireFormAccess } from '@/lib/auth';
import { FORM_SLUG } from '@/lib/forms/store-purchase';
import StorePurchaseForm from './StorePurchaseForm';

export const dynamic = 'force-dynamic';

/**
 * Server shell. Access is decided here, before any form markup is produced —
 * a user without a grant is redirected and never receives this page's HTML.
 */
export default async function StorePurchasePage() {
  const { user, level } = await requireFormAccess(FORM_SLUG);

  return (
    <StorePurchaseForm
      userEmail={user.email}
      canViewAll={level === 'view_all' || user.isAdmin}
    />
  );
}
