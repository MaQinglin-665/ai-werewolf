import { describe, expect, it } from "vitest";

import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";

import {
  appendImportedRoleRoster,
  exportAiFriendRoleRoster,
  overwriteImportedRoleRoster,
  parseAiFriendRoleRosterExport,
} from "./aiFriendRoleRoster";

describe("ai friend role roster", () => {
  it("exports only role roster fields and excludes provider configuration", () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends()[0]!, { id: "friend-role-1", now: "2026-05-27T00:00:00.000Z" }),
      nickname: "柯南",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      llmConfig: {
        provider: "openai-compatible" as const,
        label: "secret model",
        baseUrl: "https://example.com/v1",
        model: "secret-model",
      },
      ttsVoice: "secret-voice",
      ttsConfig: {
        provider: "mimo-compatible" as const,
        baseUrl: "https://tts.example.com",
        model: "secret-tts",
        voice: "secret-voice",
      },
      roleCard: {
        source: "名侦探角色",
        speakingStyle: "短句、直接、先落结论。",
        reasoningStyle: "先找证据链，再压关键矛盾。",
        avoid: "不要卖萌，不要说固定台词。",
      },
    };

    const raw = exportAiFriendRoleRoster([friend], "2026-05-27T01:00:00.000Z");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const text = JSON.stringify(parsed);

    expect(parsed.version).toBe(1);
    expect(text).toContain("柯南");
    expect(text).toContain("名侦探角色");
    expect(text).not.toContain("secret-model");
    expect(text).not.toContain("secret-tts");
    expect(text).not.toContain("https://example.com");
    expect(text).not.toContain("secret-voice");
  });

  it("parses role roster exports and sanitizes long fields", () => {
    const defaultPersonaId = getDefaultAiFriends()[0]!.basePersonaId;
    const raw = JSON.stringify({
      version: 1,
      exportedAt: "2026-05-27T01:00:00.000Z",
      roles: [
        {
          nickname: "  侦探角色  ",
          avatarDataUrl: "data:image/webp;base64,AAAA",
          basePersonaId: defaultPersonaId,
          roleCard: {
            source: "x".repeat(100),
            speakingStyle: "y".repeat(300),
            reasoningStyle: "z".repeat(300),
            avoid: "w".repeat(300),
          },
        },
      ],
    });

    const roles = parseAiFriendRoleRosterExport(raw);

    expect(roles).toHaveLength(1);
    expect(roles[0]!.nickname).toBe("侦探角色");
    expect(roles[0]!.roleCard?.source).toHaveLength(80);
    expect(roles[0]!.roleCard?.speakingStyle).toHaveLength(240);
    expect(roles[0]!.roleCard?.reasoningStyle).toHaveLength(240);
    expect(roles[0]!.roleCard?.avoid).toHaveLength(240);
  });

  it("filters imported roles with unsupported base persona ids", () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: "2026-05-27T01:00:00.000Z",
      roles: [
        {
          nickname: "无效模板",
          basePersonaId: "missing-persona",
          roleCard: {
            source: "角色来源",
            speakingStyle: "像角色说话。",
            reasoningStyle: "像角色推理。",
            avoid: "不要出戏。",
          },
        },
      ],
    });

    const roles = parseAiFriendRoleRosterExport(raw);

    expect(roles).toEqual([]);
  });

  it("preserves base persona tuning when parsing role-only imports", () => {
    const baseFriend = getDefaultAiFriends().find((friend) => friend.basePersonaId === "doubao-pressure-bluffer")!;
    const raw = JSON.stringify({
      version: 1,
      exportedAt: "2026-05-27T01:00:00.000Z",
      roles: [
        {
          nickname: "压迫角色",
          basePersonaId: baseFriend.basePersonaId,
          roleCard: {
            source: "角色来源",
            speakingStyle: "像角色说话。",
            reasoningStyle: "像角色推理。",
            avoid: "不要出戏。",
          },
        },
      ],
    });

    const roles = parseAiFriendRoleRosterExport(raw);

    expect(roles).toHaveLength(1);
    expect(roles[0]!.riskTolerance).toBe(baseFriend.riskTolerance);
    expect(roles[0]!.bluffing).toBe(baseFriend.bluffing);
    expect(roles[0]!.preferences).toEqual(baseFriend.preferences);
  });

  it("appends imported roles with new ids and preserves existing roles", () => {
    const existing = [
      {
        ...copyAiFriend(getDefaultAiFriends()[0]!, { id: "friend-existing", now: "2026-05-27T00:00:00.000Z" }),
        nickname: "旧角色",
      },
    ];
    const imported = [
      {
        ...copyAiFriend(getDefaultAiFriends()[1]!, { id: "friend-imported", now: "2026-05-27T00:00:00.000Z" }),
        nickname: "新角色",
        roleCard: {
          source: "角色来源",
          speakingStyle: "像角色说话。",
          reasoningStyle: "像角色推理。",
          avoid: "不要出戏。",
        },
      },
    ];

    const result = appendImportedRoleRoster(existing, imported, {
      now: "2026-05-27T02:00:00.000Z",
      createId: (index) => `friend-appended-${index}`,
    });

    expect(result.map((friend) => friend.nickname)).toEqual(["旧角色", "新角色"]);
    expect(result[1]!.id).toBe("friend-appended-0");
    expect(result[1]!.llmConfig).toBeUndefined();
    expect(result[1]!.ttsConfig).toBeUndefined();
  });

  it("overwrites current custom roles with imported role-only configs", () => {
    const imported = [
      {
        ...copyAiFriend(getDefaultAiFriends()[2]!, { id: "friend-imported", now: "2026-05-27T00:00:00.000Z" }),
        nickname: "覆盖角色",
        roleCard: {
          source: "角色来源",
          speakingStyle: "像角色说话。",
          reasoningStyle: "像角色推理。",
          avoid: "不要出戏。",
        },
      },
    ];

    const result = overwriteImportedRoleRoster(imported, {
      now: "2026-05-27T02:00:00.000Z",
      createId: (index) => `friend-overwrite-${index}`,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("friend-overwrite-0");
    expect(result[0]!.nickname).toBe("覆盖角色");
    expect(result[0]!.llmConfig).toBeUndefined();
    expect(result[0]!.ttsConfig).toBeUndefined();
  });
});
