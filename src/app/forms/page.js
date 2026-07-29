import { redirect } from 'next/navigation';

/**
 * The dashboard lives at /dashboard, but the back buttons and the success
 * modal both link to /forms. Rather than rewrite those links in three places,
 * /forms is a permanent alias.
 */
export default function FormsIndex() {
  redirect('/dashboard');
}
