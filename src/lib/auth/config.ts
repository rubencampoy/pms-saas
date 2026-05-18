import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { db } from '@/server/db';
import { users, memberships, organizations } from '@/server/db/schema';
import { verifyPendingToken } from './pending-token';

/**
 * The Credentials provider here is a thin "session minter": it accepts a
 * short-lived, server-signed pending token whose `purpose` is 'trusted',
 * meaning every authentication factor (password + TOTP / recovery code /
 * trusted device) has already been verified in a server action.
 *
 * Real credential checks live in `src/server/actions/auth.ts`, never here.
 *
 * On mint we also load the user's memberships and pick an active one so the
 * rest of the app can read `session.user.organizationId` like before.
 */

type MembershipSummary = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string;
};

async function loadMemberships(userId: string): Promise<MembershipSummary[]> {
  return db
    .select({
      organizationId: memberships.organizationId,
      organizationSlug: organizations.slug,
      organizationName: organizations.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.isActive, true),
        isNotNull(memberships.acceptedAt),
        eq(organizations.status, 'active'),
      ),
    )
    .orderBy(desc(memberships.createdAt));
}

function pickActiveMembership(
  ms: MembershipSummary[],
  preferredOrgId: string | null,
): MembershipSummary | null {
  if (ms.length === 0) return null;
  if (preferredOrgId) {
    const preferred = ms.find((m) => m.organizationId === preferredOrgId);
    if (preferred) return preferred;
  }
  return ms[0]!;
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        pendingToken: { label: 'Pending token', type: 'text' },
      },
      async authorize(credentials) {
        const token = typeof credentials?.pendingToken === 'string'
          ? credentials.pendingToken
          : null;
        if (!token) return null;

        const payload = verifyPendingToken(token);
        if (!payload || payload.purpose !== 'trusted') return null;

        const user = await db.query.users.findFirst({
          where: and(eq(users.id, payload.userId), eq(users.isActive, true)),
        });
        if (!user) return null;

        const ms = await loadMemberships(user.id);
        const active = pickActiveMembership(ms, user.lastActiveOrganizationId);

        // No memberships and not a super admin → not allowed in
        if (!active && !user.isSuperAdmin) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          isSuperAdmin: user.isSuperAdmin,
          organizationId: active?.organizationId ?? '',
          role: active?.role ?? '',
          memberships: ms,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id: string;
          isSuperAdmin?: boolean;
          organizationId?: string;
          role?: string;
          memberships?: MembershipSummary[];
        };
        token.id = u.id;
        token.isSuperAdmin = u.isSuperAdmin ?? false;
        token.organizationId = u.organizationId ?? '';
        token.role = u.role ?? '';
        token.memberships = u.memberships ?? [];
        return token;
      }

      if (trigger === 'update' && session) {
        const updatePayload = session as { activeOrganizationId?: string };
        const targetOrgId = updatePayload.activeOrganizationId;
        if (targetOrgId && token.id) {
          const ms = await loadMemberships(token.id as string);
          const next = ms.find((m) => m.organizationId === targetOrgId);
          if (next) {
            token.organizationId = next.organizationId;
            token.role = next.role;
            token.memberships = ms;
            await db
              .update(users)
              .set({ lastActiveOrganizationId: next.organizationId })
              .where(eq(users.id, token.id as string));
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isSuperAdmin = (token.isSuperAdmin as boolean) ?? false;
        session.user.organizationId = (token.organizationId as string) ?? '';
        session.user.role = (token.role as string) ?? '';
        session.user.memberships = (token.memberships as MembershipSummary[]) ?? [];
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith('/login') ||
        nextUrl.pathname.startsWith('/forgot-password') ||
        nextUrl.pathname.startsWith('/setup-2fa') ||
        nextUrl.pathname.startsWith('/accept-invite');

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
        return true;
      }

      if (!isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.AUTH_SECRET,
};
