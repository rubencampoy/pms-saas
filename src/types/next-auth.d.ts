import 'next-auth';
import 'next-auth/jwt';

type MembershipSummary = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string;
};

declare module 'next-auth' {
  interface User {
    role: string;
    organizationId: string;
    isSuperAdmin: boolean;
    memberships: MembershipSummary[];
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
      organizationId: string;
      isSuperAdmin: boolean;
      memberships: MembershipSummary[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    isSuperAdmin: boolean;
    memberships: MembershipSummary[];
  }
}
