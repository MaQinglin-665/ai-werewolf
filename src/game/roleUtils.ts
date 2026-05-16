import type { Role } from "./types";

const DEFAULT_WOLF_ROLES: readonly Role[] = ["WEREWOLF", "WOLF_KING", "WHITE_WOLF_KING", "WOLF_BEAUTY"];

export function isWolfRole(role: Role | undefined, wolfRoles?: readonly Role[]): boolean {
  return Boolean(role && (wolfRoles ?? DEFAULT_WOLF_ROLES).includes(role));
}
