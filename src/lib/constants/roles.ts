export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  FRONT_DESK = 'front_desk',
  HOUSEKEEPING = 'housekeeping',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MANAGER]: 60,
  [UserRole.FRONT_DESK]: 40,
  [UserRole.HOUSEKEEPING]: 20,
};
