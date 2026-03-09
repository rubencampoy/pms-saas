import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { guestRepo } from '@/server/repositories/guest.repo';
import { GuestsClient } from '@/components/guests/guests-client';

export default async function GuestsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const guestsList = await guestRepo.findAll(session.user.organizationId);

  return <GuestsClient guests={guestsList} />;
}
