export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  FRONT_DESK = 'front_desk',
  HOUSEKEEPING = 'housekeeping',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MANAGER]: 60,
  [UserRole.FRONT_DESK]: 40,
  [UserRole.HOUSEKEEPING]: 20,
};

export const MEMBERSHIP_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.FRONT_DESK,
  UserRole.HOUSEKEEPING,
] as const;
