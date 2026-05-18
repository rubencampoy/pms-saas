import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { userRepo } from '@/server/repositories/user.repo';
import { invitationRepo } from '@/server/repositories/invitation.repo';
import { TeamClient } from '@/components/settings/team-client';

export default async function TeamSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  const [members, pendingInvitations] = await Promise.all([
    userRepo.findAll(orgId),
    invitationRepo.findPendingByOrg(orgId),
  ]);

  const canManage = session.user.role === 'owner' || session.user.role === 'admin';

  return (
    <TeamClient
      members={members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
      }))}
      pendingInvitations={pendingInvitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      }))}
      currentUserId={session.user.id}
      canManage={canManage}
    />
  );
}
