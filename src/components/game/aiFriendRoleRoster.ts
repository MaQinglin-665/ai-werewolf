import {
  AI_FRIENDS_EXPORT_VERSION,
  createAiFriendId,
  sanitizeAiFriendConfig,
  sanitizeAiFriendRoleCard,
} from "@/game/aiFriends";
import type { AiFriendConfig } from "@/game/types";

export type AiFriendRoleRosterExport = {
  version: 1;
  exportedAt: string;
  roles: AiFriendRoleRosterEntry[];
};

export type AiFriendRoleRosterEntry = Pick<AiFriendConfig, "nickname" | "basePersonaId" | "avatarDataUrl" | "roleCard">;

export type RoleRosterImportOptions = {
  now?: string;
  createId?: (index: number) => string;
};

export function exportAiFriendRoleRoster(friends: AiFriendConfig[], exportedAt = new Date().toISOString()): string {
  const roles = friends
    .map((friend) => sanitizeAiFriendConfig(friend))
    .filter((friend): friend is AiFriendConfig => Boolean(friend))
    .map((friend) => ({
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      ...(friend.avatarDataUrl ? { avatarDataUrl: friend.avatarDataUrl } : {}),
      ...(friend.roleCard ? { roleCard: sanitizeAiFriendRoleCard(friend.roleCard) } : {}),
    }));

  return JSON.stringify(
    {
      version: AI_FRIENDS_EXPORT_VERSION,
      exportedAt,
      roles,
    } satisfies AiFriendRoleRosterExport,
    null,
    2,
  );
}

export function parseAiFriendRoleRosterExport(raw: string): AiFriendConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("角色名册 JSON 格式不正确。");
  }

  if (!isRecord(parsed) || parsed.version !== AI_FRIENDS_EXPORT_VERSION || !Array.isArray(parsed.roles)) {
    throw new Error("角色名册导入数据版本不正确。");
  }

  return parsed.roles
    .map((value, index) => toRoleOnlyFriend(value, index))
    .filter((friend): friend is AiFriendConfig => Boolean(friend));
}

export function appendImportedRoleRoster(
  current: AiFriendConfig[],
  imported: AiFriendConfig[],
  options: RoleRosterImportOptions = {},
): AiFriendConfig[] {
  return [...current, ...roleOnlyCopies(imported, options)];
}

export function overwriteImportedRoleRoster(imported: AiFriendConfig[], options: RoleRosterImportOptions = {}): AiFriendConfig[] {
  return roleOnlyCopies(imported, options);
}

function roleOnlyCopies(imported: AiFriendConfig[], options: RoleRosterImportOptions): AiFriendConfig[] {
  const now = options.now ?? new Date().toISOString();
  return imported
    .map((friend, index) =>
      sanitizeAiFriendConfig({
        id: options.createId?.(index) ?? createAiFriendId(),
        nickname: friend.nickname,
        basePersonaId: friend.basePersonaId,
        avatarDataUrl: friend.avatarDataUrl,
        roleCard: friend.roleCard,
        riskTolerance: friend.riskTolerance,
        bluffing: friend.bluffing,
        preferences: friend.preferences,
        createdAt: now,
        updatedAt: now,
      }),
    )
    .filter((friend): friend is AiFriendConfig => Boolean(friend));
}

function toRoleOnlyFriend(value: unknown, index: number): AiFriendConfig | undefined {
  if (!isRecord(value)) return undefined;
  return sanitizeAiFriendConfig({
    id: `role-import:${index}`,
    nickname: value.nickname,
    basePersonaId: value.basePersonaId,
    avatarDataUrl: value.avatarDataUrl,
    roleCard: value.roleCard,
    riskTolerance: 0.5,
    bluffing: 0.5,
    preferences: {},
    createdAt: "import",
    updatedAt: "import",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
