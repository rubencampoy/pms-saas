import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq, and } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { verifyPendingToken } from './pending-token';

/**
 * The Credentials provider here is a thin "session minter": it accepts a
 * short-lived, server-signed pending token whose `purpose` is 'trusted',
 * meaning every authentication factor (password + TOTP / recovery code /
 * trusted device) has already been verified in a server action.
 *
 * Real credential checks live in `src/server/actions/auth.ts`, never here.
 */
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? '';
        token.organizationId = (user as { organizationId?: string }).organizationId ?? '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith('/login')
        || nextUrl.pathname.startsWith('/register')
        || nextUrl.pathname.startsWith('/forgot-password')
        || nextUrl.pathname.startsWith('/setup-2fa');

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
