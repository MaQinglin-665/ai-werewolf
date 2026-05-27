# AI Pool Character Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local AI character roster for `/ai-pool`, with role-card editing, safe role-only import/export, and real LLM speech/action prompts that receive the role-play instructions.

**Architecture:** Add role-card data to the existing `AiFriendConfig` path instead of creating a separate character-library system. Keep import/export and sanitization in focused helper modules, propagate role-card data through `/api/games` into `AgentView.persona`, and then render/edit the same fields in `AiPoolClient` while preserving existing LLM/TTS controls.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Zod, Vitest, existing ai-werewolf harness scripts.

---

## File Structure

- Create `src/components/game/aiFriendRoleRoster.ts`: role-roster export/import schema, sanitization, append/overwrite logic.
- Create `src/components/game/aiFriendRoleRoster.test.ts`: focused tests for role-only export/import and no secret leakage.
- Modify `src/game/types.ts`: add `AiFriendRoleCard`; add `roleCard?: AiFriendRoleCard` to `AiFriendConfig`, `AiFriendSeatSetup`, and `AiPersona`.
- Modify `src/game/aiFriends.ts`: sanitize role cards, preserve them when copying/applying templates, include them in resolved setup and persona.
- Modify `src/components/game/aiFriendStorage.ts`: no new storage key; role cards travel inside existing custom AI friend storage.
- Modify `src/app/api/games/route.ts`: accept validated `roleCard` in `aiFriends`.
- Modify `src/app/api/games/aiFriends.test.ts`: cover role-card API propagation.
- Modify `src/ai/speechProviders.ts` and `src/ai/speechProviders.test.ts`: include role-card guidance in real LLM speech input/prompt.
- Modify `src/ai/actionProviders.ts` and `src/ai/actionProviders.test.ts`: include role-card guidance in real LLM action input/prompt while preserving legal-action constraints.
- Modify `src/components/AiPoolClient.tsx`: roster layout, role-card fields, Mock warning, import/export controls.
- Modify `src/components/AiPoolClient.mobile.test.ts`: static coverage for roster, role-card fields, Mock warning, and import/export entry points.
- Modify `src/app/globals.css`: responsive styling hooks for the roster layout.
- Modify `feature_list.json`, `progress.md`, `session-handoff.md`, and this task card for harness state and evidence.

---

### Task 1: Role Card Data Model And Safe Import/Export

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/aiFriends.ts`
- Create: `src/components/game/aiFriendRoleRoster.ts`
- Create: `src/components/game/aiFriendRoleRoster.test.ts`

- [ ] **Step 1: Add failing role-card tests**

Add `src/components/game/aiFriendRoleRoster.test.ts`:

```ts
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
    const raw = JSON.stringify({
      version: 1,
      exportedAt: "2026-05-27T01:00:00.000Z",
      roles: [
        {
          nickname: "  侦探角色  ",
          avatarDataUrl: "data:image/webp;base64,AAAA",
          basePersonaId: "deepseek",
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
```

- [ ] **Step 2: Run role-roster tests and verify RED**

Run:

```powershell
npm run test -- src/components/game/aiFriendRoleRoster.test.ts
```

Expected: FAIL because `src/components/game/aiFriendRoleRoster.ts` and role-card exports do not exist.

- [ ] **Step 3: Add role-card types**

In `src/game/types.ts`, add this near `AiPersonaPreferences`:

```ts
export type AiFriendRoleCard = {
  source: string;
  speakingStyle: string;
  reasoningStyle: string;
  avoid: string;
};
```

Update `AiFriendConfig`:

```ts
export type AiFriendConfig = {
  id: string;
  nickname: string;
  basePersonaId: string;
  avatarDataUrl?: string;
  roleCard?: AiFriendRoleCard;
  llmConfig?: AiFriendLlmConfig;
  ttsVoice?: string;
  ttsConfig?: AiFriendTtsConfig;
  riskTolerance: number;
  bluffing: number;
  preferences: AiPersonaPreferences;
  createdAt: string;
  updatedAt: string;
};
```

Update `AiFriendSeatSetup`:

```ts
export type AiFriendSeatSetup = {
  seatId: number;
  friendId: string;
  nickname: string;
  basePersonaId: string;
  personaName: string;
  modelLabel?: string;
  avatarDataUrl?: string;
  roleCard?: AiFriendRoleCard;
  ttsVoice?: string;
  ttsConfig?: AiFriendTtsConfig;
  isDefault: boolean;
};
```

Update `AiPersona`:

```ts
export type AiPersona = {
  id: string;
  name: string;
  modelLabel: string;
  label: string;
  style: string;
  goal: string;
  riskTolerance: number;
  bluffing: number;
  preferences?: AiPersonaPreferences;
  roleCard?: AiFriendRoleCard;
};
```

- [ ] **Step 4: Sanitize role cards in `aiFriends.ts`**

Update the import:

```ts
import type { AiFriendConfig, AiFriendRoleCard, AiFriendSeatSetup, AiPersona, AiPersonaPreferences } from "./types";
```

Add constants near `AI_FRIEND_AVATAR_DATA_URL_PATTERN`:

```ts
export const AI_FRIEND_ROLE_SOURCE_MAX_LENGTH = 80;
export const AI_FRIEND_ROLE_FIELD_MAX_LENGTH = 240;
```

In `sanitizeAiFriendConfig`, add `roleCard`:

```ts
    avatarDataUrl: sanitizeAiFriendAvatarDataUrl(value.avatarDataUrl),
    roleCard: sanitizeAiFriendRoleCard(value.roleCard),
    llmConfig: sanitizeAiFriendLlmConfig(value.llmConfig),
```

In `buildAiPersonaFromFriend`, add `roleCard`:

```ts
    preferences: normalizePreferences(friend.preferences),
    roleCard: sanitizeAiFriendRoleCard(friend.roleCard),
```

In `resolveAiFriendsForGame`, add setup `roleCard`:

```ts
        avatarDataUrl: config.avatarDataUrl,
        roleCard: config.roleCard,
        ttsVoice: config.ttsVoice,
```

Add helper functions near `sanitizeTtsVoice`:

```ts
export function sanitizeAiFriendRoleCard(value: unknown): AiFriendRoleCard | undefined {
  if (!isRecord(value)) return undefined;
  const source = readString(value.source, AI_FRIEND_ROLE_SOURCE_MAX_LENGTH);
  const speakingStyle = readString(value.speakingStyle, AI_FRIEND_ROLE_FIELD_MAX_LENGTH);
  const reasoningStyle = readString(value.reasoningStyle, AI_FRIEND_ROLE_FIELD_MAX_LENGTH);
  const avoid = readString(value.avoid, AI_FRIEND_ROLE_FIELD_MAX_LENGTH);
  if (!source && !speakingStyle && !reasoningStyle && !avoid) return undefined;
  return {
    source: source ?? "",
    speakingStyle: speakingStyle ?? "",
    reasoningStyle: reasoningStyle ?? "",
    avoid: avoid ?? "",
  };
}
```

- [ ] **Step 5: Implement role-roster helper**

Create `src/components/game/aiFriendRoleRoster.ts`:

```ts
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
  return JSON.stringify({ version: AI_FRIENDS_EXPORT_VERSION, exportedAt, roles } satisfies AiFriendRoleRosterExport, null, 2);
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
```

- [ ] **Step 6: Run role-roster tests and verify GREEN**

Run:

```powershell
npm run test -- src/components/game/aiFriendRoleRoster.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit data model and helper**

Run:

```powershell
git add src/game/types.ts src/game/aiFriends.ts src/components/game/aiFriendRoleRoster.ts src/components/game/aiFriendRoleRoster.test.ts
git commit -m "feat: add ai friend role roster model"
```

Expected: commit succeeds.

---

### Task 2: API And Agent Persona Propagation

**Files:**
- Modify: `src/app/api/games/route.ts`
- Modify: `src/app/api/games/aiFriends.test.ts`
- Modify if needed: `src/game/aiFriends.ts`
- Modify if needed: `src/game/types.ts`

- [ ] **Step 1: Add failing API propagation test**

In `src/app/api/games/aiFriends.test.ts`, add:

```ts
  it("passes AI friend role cards into setup and seat personas", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends()[0]!, { id: "friend-role-card", now: "2026-05-27T00:00:00.000Z" }),
      nickname: "柯南",
      roleCard: {
        source: "名侦探角色",
        speakingStyle: "短句、直接、先落结论。",
        reasoningStyle: "先找证据链，再压关键矛盾。",
        avoid: "不要卖萌，不要说固定台词。",
      },
    };

    const response = await POST(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", aiFriends: [friend] }),
      }),
    );
    expect(response.status).toBe(200);

    const view = await response.json();
    const firstAiSeat = view.seats.find((seat: { isAi: boolean }) => seat.isAi);

    expect(view.setup.aiFriends[0]).toMatchObject({
      nickname: "柯南",
      roleCard: {
        source: "名侦探角色",
        speakingStyle: "短句、直接、先落结论。",
        reasoningStyle: "先找证据链，再压关键矛盾。",
        avoid: "不要卖萌，不要说固定台词。",
      },
    });
    expect(firstAiSeat).toMatchObject({
      name: "柯南",
      personaName: "DeepSeek",
    });
  });
```

- [ ] **Step 2: Run API test and verify RED**

Run:

```powershell
npm run test -- src/app/api/games/aiFriends.test.ts
```

Expected: FAIL because `roleCard` is rejected by the API schema or not present in setup.

- [ ] **Step 3: Accept role cards in create-game schema**

In `src/app/api/games/route.ts`, update the import:

```ts
import {
  AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH,
  AI_FRIEND_ROLE_FIELD_MAX_LENGTH,
  AI_FRIEND_ROLE_SOURCE_MAX_LENGTH,
} from "@/game/aiFriends";
```

Add this schema above `createGameSchema`:

```ts
const aiFriendRoleCardSchema = z.object({
  source: z.string().max(AI_FRIEND_ROLE_SOURCE_MAX_LENGTH),
  speakingStyle: z.string().max(AI_FRIEND_ROLE_FIELD_MAX_LENGTH),
  reasoningStyle: z.string().max(AI_FRIEND_ROLE_FIELD_MAX_LENGTH),
  avoid: z.string().max(AI_FRIEND_ROLE_FIELD_MAX_LENGTH),
});
```

Add `roleCard` to the `aiFriends` item schema:

```ts
          avatarDataUrl: z.string().min(1).max(AI_FRIEND_AVATAR_DATA_URL_MAX_LENGTH).startsWith("data:image/").optional(),
          roleCard: aiFriendRoleCardSchema.optional(),
          llmConfig: z
```

- [ ] **Step 4: Ensure setup snapshots include roleCard**

If Task 1 did not already add this, update `resolveAiFriendsForGame` in `src/game/aiFriends.ts`:

```ts
        avatarDataUrl: config.avatarDataUrl,
        roleCard: config.roleCard,
        ttsVoice: config.ttsVoice,
```

- [ ] **Step 5: Run API tests and verify GREEN**

Run:

```powershell
npm run test -- src/app/api/games/aiFriends.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API propagation**

Run:

```powershell
git add src/app/api/games/route.ts src/app/api/games/aiFriends.test.ts src/game/aiFriends.ts src/game/types.ts
git commit -m "feat: pass ai role cards into games"
```

Expected: commit succeeds.

---

### Task 3: Real LLM Speech And Action Role-Play Guidance

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Add failing speech prompt test**

In `src/ai/speechProviders.test.ts`, add or extend the existing real-model prompt construction tests with this assertion pattern:

```ts
  it("passes role-card guidance to routed speech models", async () => {
    process.env.AI_SPEECH_PROVIDER = "models";
    process.env.AI_LLM_PROVIDER = "models";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ message: "我先按证据链压一手2号。" }) } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = makeAgentView({
      persona: {
        id: "deepseek",
        name: "DeepSeek",
        modelLabel: "DeepSeek",
        label: "逻辑链推演型",
        style: "逻辑链推演",
        goal: "拆公开事实链",
        riskTolerance: 0.5,
        bluffing: 0.2,
        preferences: defaultPreferences(),
        roleCard: {
          source: "名侦探角色",
          speakingStyle: "短句、直接、先落结论。",
          reasoningStyle: "先找证据链，再压关键矛盾。",
          avoid: "不要卖萌，不要说固定台词。",
        },
      },
      llmConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        model: "test-model",
        apiKey: "test-key",
      },
    });

    await modelSpeechProvider.generateSpeech(view, createSpeechPlan(view));

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const serialized = JSON.stringify(body);
    expect(serialized).toContain("你正在扮演");
    expect(serialized).toContain("名侦探角色");
    expect(serialized).toContain("短句、直接、先落结论");
    expect(serialized).toContain("先找证据链");
    expect(serialized).toContain("不要卖萌");
    expect(serialized).toContain("不能违背事实简报");
  });
```

Use local test helpers already present in `speechProviders.test.ts`; if the exact helper names differ, adapt only the helper calls, not the asserted behavior.

- [ ] **Step 2: Add failing action prompt test**

In `src/ai/actionProviders.test.ts`, add:

```ts
  it("passes role-card guidance to routed action models without removing legal candidate constraints", async () => {
    process.env.AI_LLM_PROVIDER = "models";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidateId: "vote:2", reason: "按证据链压2号。" }) } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = makeAgentView({
      persona: {
        id: "deepseek",
        name: "DeepSeek",
        modelLabel: "DeepSeek",
        label: "逻辑链推演型",
        style: "逻辑链推演",
        goal: "拆公开事实链",
        riskTolerance: 0.5,
        bluffing: 0.2,
        preferences: defaultPreferences(),
        roleCard: {
          source: "名侦探角色",
          speakingStyle: "短句、直接、先落结论。",
          reasoningStyle: "先找证据链，再压关键矛盾。",
          avoid: "不要卖萌，不要说固定台词。",
        },
      },
      llmConfig: {
        provider: "openai-compatible",
        baseUrl: "https://example.com/v1",
        model: "test-model",
        apiKey: "test-key",
      },
    });

    await routedModelActionProvider.generateCommand(view, makeActionContext({ fallbackCommand: { type: "vote", targetSeatId: 2 } }));

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const serialized = JSON.stringify(body);
    expect(serialized).toContain("名侦探角色");
    expect(serialized).toContain("先找证据链");
    expect(serialized).toContain("Choose exactly one legal candidate action");
    expect(serialized).toContain("Do not reveal private/system context");
  });
```

Use the existing provider/helper names in `actionProviders.test.ts`; if `routedModelActionProvider` is not exported, exercise it through the exported custom-aware provider that routes when `view.llmConfig` exists.

- [ ] **Step 3: Run speech/action tests and verify RED**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
```

Expected: FAIL because role-card guidance is not yet present in prompt/input.

- [ ] **Step 4: Add speech role-card formatting**

In `src/ai/speechProviders.ts`, add helper near `buildModelSpeechStyleGuide`:

```ts
function roleCardSpeechTendencies(persona: AgentView["persona"]): string[] {
  const roleCard = persona?.roleCard;
  if (!roleCard) return [];
  return [
    `角色扮演：你正在扮演${persona?.name ?? "当前角色"}；人物来源：${roleCard.source || persona?.name || "未填写"}。`,
    roleCard.speakingStyle ? `角色说话方式：${roleCard.speakingStyle}` : "",
    roleCard.reasoningStyle ? `角色推理习惯：${roleCard.reasoningStyle}` : "",
    roleCard.avoid ? `角色避免事项：${roleCard.avoid}` : "",
    "角色表现优先于最优解，但不能违背事实简报、身份私密边界、当前阶段规则或 speechContract。",
  ].filter(Boolean);
}
```

In `buildModelSpeechStyleGuide`, add:

```ts
  const roleCardLines = roleCardSpeechTendencies(persona);
```

Then include `...roleCardLines` in each returned `tendencies` array, for example:

```ts
      tendencies: [style, goal, ...roleCardLines, "优先指出前后不一致、结论缺过程、票型和发言是否闭环。"],
```

For the default return:

```ts
    tendencies: [style, goal, preferenceLine, ...roleCardLines],
```

- [ ] **Step 5: Add action role-card system guidance**

In `src/ai/actionProviders.ts`, add helper near `callRoutedModelAction`:

```ts
function roleCardActionSystemLine(input: LlmActionInput): string {
  const roleCard = input.persona?.roleCard;
  if (!roleCard) return "";
  return [
    `Role-play layer: the player is acting as ${input.persona?.name ?? "the configured character"} inspired by ${roleCard.source || "the configured source"}.`,
    roleCard.speakingStyle ? `Speaking style: ${roleCard.speakingStyle}.` : "",
    roleCard.reasoningStyle ? `Reasoning habit: ${roleCard.reasoningStyle}. Use this only to choose among legal candidates.` : "",
    roleCard.avoid ? `Avoid: ${roleCard.avoid}.` : "",
    "Character expression may affect preference among legal candidates, but never invent actions, reveal private/system context, or override candidates.",
  ]
    .filter(Boolean)
    .join(" ");
}
```

Update `callRoutedModelAction`:

```ts
  const roleCardLine = roleCardActionSystemLine(input);
  return callRoutedModelJsonWithFallbacks({
    personaName: primaryPersonaName,
    fallbackPersonaNames: readActionFallbackPersonaNames(primaryPersonaName),
    task: "action",
    system: [
      "You are the decision brain for an AI Werewolf player. Choose exactly one legal candidate action from candidates using inferenceLayers, persona.preferences, expertStrategy, advancedReasoning, and publicContext.decisionSummary as soft strategy guidance. Return strict JSON only: {\"candidateId\":\"...\",\"reason\":\"...\"}. Do not reveal private/system context.",
      roleCardLine,
    ]
      .filter(Boolean)
      .join(" "),
    input: modelInput,
    maxTokens: 220,
    customLlm: input.llmConfig,
  });
```

- [ ] **Step 6: Run speech/action tests and verify GREEN**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit LLM role-play guidance**

Run:

```powershell
git add src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts
git commit -m "feat: add role cards to llm prompts"
```

Expected: commit succeeds.

---

### Task 4: AI Pool Character Roster UI

**Files:**
- Modify: `src/components/AiPoolClient.tsx`
- Modify: `src/components/AiPoolClient.mobile.test.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add failing static UI tests**

In `src/components/AiPoolClient.mobile.test.ts`, add tests that render the page HTML and assert:

```ts
it("renders the AI pool as a character roster with role-card fields", () => {
  const html = renderAiPoolClientHtml();

  expect(html).toContain("角色名册");
  expect(html).toContain("角色详情");
  expect(html).toContain("人物来源");
  expect(html).toContain("说话方式");
  expect(html).toContain("推理习惯");
  expect(html).toContain("不要做什么");
  expect(html).toContain("导入角色");
  expect(html).toContain("导出角色");
});

it("warns that role-play instructions require real LLM mode", () => {
  const html = renderAiPoolClientHtml();

  expect(html).toContain("人设和打法扮演只在真实 LLM 生效");
});
```

Use the existing render helper name in the file. If no helper exists with that exact name, use the existing static render helper and keep the same assertions.

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```powershell
npm run test -- src/components/AiPoolClient.mobile.test.ts
```

Expected: FAIL because the roster labels and role-card fields are not yet rendered.

- [ ] **Step 3: Add role-card form helper inside `AiPoolClient.tsx`**

Add this helper near other small formatting helpers:

```ts
function updateRoleCardField(friend: AiFriendOption, field: keyof NonNullable<AiFriendConfig["roleCard"]>, value: string): Partial<AiFriendConfig> {
  const roleCard = {
    source: friend.roleCard?.source ?? "",
    speakingStyle: friend.roleCard?.speakingStyle ?? "",
    reasoningStyle: friend.roleCard?.reasoningStyle ?? "",
    avoid: friend.roleCard?.avoid ?? "",
    [field]: value,
  };
  return { roleCard };
}
```

- [ ] **Step 4: Wire import/export state and handlers**

Import helpers:

```ts
import {
  appendImportedRoleRoster,
  exportAiFriendRoleRoster,
  overwriteImportedRoleRoster,
  parseAiFriendRoleRosterExport,
} from "./game/aiFriendRoleRoster";
```

Add state near other `useState` calls:

```ts
  const [roleRosterImportText, setRoleRosterImportText] = useState("");
  const [roleRosterImportOpen, setRoleRosterImportOpen] = useState(false);
  const [roleRosterError, setRoleRosterError] = useState<string | null>(null);
```

Add handlers inside `AiPoolClient`:

```ts
  const exportRoleRoster = useCallback(() => {
    const raw = exportAiFriendRoleRoster(aiPoolFriends);
    void navigator.clipboard?.writeText(raw);
    setRoleRosterImportText(raw);
    setRoleRosterError("角色名册 JSON 已生成；如果浏览器允许，也已复制到剪贴板。");
  }, [aiPoolFriends]);

  const importRoleRoster = useCallback(
    (mode: "append" | "overwrite") => {
      try {
        const imported = parseAiFriendRoleRosterExport(roleRosterImportText);
        setCustomAiFriends((current) =>
          mode === "append" ? appendImportedRoleRoster(current, imported) : overwriteImportedRoleRoster(imported),
        );
        setRoleRosterError(mode === "append" ? "已追加导入角色。" : "已覆盖当前本地角色。");
        setRoleRosterImportOpen(false);
      } catch (error) {
        setRoleRosterError(error instanceof Error ? error.message : "角色名册导入失败。");
      }
    },
    [roleRosterImportText],
  );
```

- [ ] **Step 5: Rename list surface and add role-card fields**

In `AiPoolList`, change the heading:

```tsx
<h2 className="text-lg font-semibold text-[#dff4df]">角色名册</h2>
<p className="mobile-ai-pool-description mt-1 text-sm text-[#9fc8a7]">
  勾选后会按顺序加入下一局；角色名、头像和真实 LLM 人设会随开局配置进入牌桌。
</p>
```

Inside each editable friend card, add a `details` block before LLM/TTS advanced sections:

```tsx
<details className="rounded-2xl border border-[#f1c76e]/14 bg-black/16 p-3" open={!friend.isDefault}>
  <summary className="cursor-pointer text-sm font-semibold text-[#f1d796]">角色详情</summary>
  <div className="mt-3 grid gap-3">
    <label className="grid gap-1 text-xs text-[#ad9c7d]">
      人物来源
      <input
        value={friend.roleCard?.source ?? ""}
        maxLength={80}
        placeholder="例如：名侦探角色 / 三国谋士 / 你喜欢的人物"
        disabled={friend.isDefault}
        onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "source", event.target.value))}
        className="rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
      />
    </label>
    <label className="grid gap-1 text-xs text-[#ad9c7d]">
      说话方式
      <textarea
        value={friend.roleCard?.speakingStyle ?? ""}
        maxLength={240}
        rows={2}
        placeholder="例如：短句、直接、先落结论。"
        disabled={friend.isDefault}
        onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "speakingStyle", event.target.value))}
        className="resize-none rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
      />
    </label>
    <label className="grid gap-1 text-xs text-[#ad9c7d]">
      推理习惯
      <textarea
        value={friend.roleCard?.reasoningStyle ?? ""}
        maxLength={240}
        rows={2}
        placeholder="例如：先找证据链，再压关键矛盾。"
        disabled={friend.isDefault}
        onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "reasoningStyle", event.target.value))}
        className="resize-none rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
      />
    </label>
    <label className="grid gap-1 text-xs text-[#ad9c7d]">
      不要做什么
      <textarea
        value={friend.roleCard?.avoid ?? ""}
        maxLength={240}
        rows={2}
        placeholder="例如：不要复读固定台词，不要出戏说自己是 AI。"
        disabled={friend.isDefault}
        onChange={(event) => onUpdate(friend.id, updateRoleCardField(friend, "avoid", event.target.value))}
        className="resize-none rounded-xl border border-[#f1c76e]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#f1c76e]/45 disabled:opacity-55"
      />
    </label>
  </div>
</details>
```

For default friends, keep the fields disabled and rely on the existing copy/customize flow.

- [ ] **Step 6: Add Mock warning and import/export controls**

Near the AI mode or list header, add:

```tsx
{aiRuntimeMode === "mock" && (
  <div className="rounded-2xl border border-[#f1c76e]/25 bg-[#2b2110]/58 px-4 py-3 text-sm leading-6 text-[#f1d796]">
    当前是 Mock 试玩：角色名和头像会显示，人设和打法扮演只在真实 LLM 生效。
  </div>
)}
```

Add buttons near the roster header:

```tsx
<div className="flex flex-wrap gap-2">
  <button type="button" onClick={exportRoleRoster} className="rounded-full border border-[#f1c76e]/25 bg-[#f1c76e]/10 px-3 py-2 text-xs font-semibold text-[#f1d796]">
    导出角色
  </button>
  <button type="button" onClick={() => setRoleRosterImportOpen(true)} className="rounded-full border border-[#7da8e3]/25 bg-[#7da8e3]/10 px-3 py-2 text-xs font-semibold text-[#b8d6ff]">
    导入角色
  </button>
</div>
```

Add import dialog:

```tsx
{roleRosterImportOpen && (
  <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] overflow-y-auto bg-black/84 px-3 py-5 backdrop-blur-md">
    <section className="mx-auto grid w-full max-w-3xl gap-4 rounded-[28px] border border-[#7da8e3]/28 bg-[#0d1623]/96 p-4 shadow-2xl shadow-black/70">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#e4efff]">导入角色名册</h2>
        <button type="button" onClick={() => setRoleRosterImportOpen(false)} className="rounded-full border border-white/12 px-3 py-2 text-sm text-[#dcc9a7]">关闭</button>
      </div>
      <textarea
        value={roleRosterImportText}
        onChange={(event) => setRoleRosterImportText(event.target.value)}
        rows={12}
        className="w-full resize-y rounded-2xl border border-[#7da8e3]/18 bg-black/32 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
        placeholder="粘贴角色名册 JSON"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => importRoleRoster("append")} className="rounded-full bg-[#2f8157] px-4 py-2 text-sm font-semibold text-white">追加导入</button>
        <button type="button" onClick={() => importRoleRoster("overwrite")} className="rounded-full border border-[#e46d55]/30 bg-[#2b1110]/60 px-4 py-2 text-sm font-semibold text-[#ffb1a4]">覆盖当前角色</button>
      </div>
    </section>
  </div>
)}
{roleRosterError && <div className="rounded-2xl border border-[#f1c76e]/20 bg-black/22 px-4 py-3 text-sm text-[#f1d796]">{roleRosterError}</div>}
```

- [ ] **Step 7: Add responsive CSS hooks**

Append within the existing AI pool mobile CSS section in `src/app/globals.css`:

```css
.mobile-ai-role-roster textarea {
  min-height: 4.25rem;
}

@media (max-width: 720px) {
  .mobile-ai-role-roster {
    gap: 0.75rem;
  }

  .mobile-ai-role-roster textarea {
    min-height: 5rem;
  }
}
```

Apply `mobile-ai-role-roster` to the roster section container.

- [ ] **Step 8: Run UI tests and verify GREEN**

Run:

```powershell
npm run test -- src/components/AiPoolClient.mobile.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit roster UI**

Run:

```powershell
git add src/components/AiPoolClient.tsx src/components/AiPoolClient.mobile.test.ts src/app/globals.css
git commit -m "feat: add ai pool character roster UI"
```

Expected: commit succeeds.

---

### Task 5: Harness State, Verification, And Browser Smoke

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-ai-pool-character-roster.md`

- [ ] **Step 1: Add feature-list entry**

In `feature_list.json`, append this feature object after `ai-pool-bulk-llm-presets`:

```json
{
  "id": "ai-pool-character-roster",
  "name": "AI Pool Character Roster",
  "description": "Upgrade /ai-pool into a local character roster with role-card editing, safe role-only import/export, and real LLM speech/action role-play guidance.",
  "dependencies": [
    "ai-pool-bulk-llm-presets"
  ],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-05-27-ai-pool-character-roster-design.md; docs/tasks/2026-05-ai-pool-character-roster.md; docs/superpowers/plans/2026-05-27-ai-pool-character-roster.md; src/components/game/aiFriendRoleRoster.ts; role-card API/prompt/UI tests; /ai-pool browser desktop/mobile"
}
```

- [ ] **Step 2: Update progress and handoff**

In `progress.md`, set:

```md
**Last Updated:** 2026-05-27 HH:mm Asia/Shanghai
**Session ID:** ai-pool character roster
**Active Feature:** ai-pool-character-roster - AI Pool Character Roster
```

Add done bullets:

```md
- [x] AI Pool Character Roster implemented for `/ai-pool`: role-card fields, safe role-only import/export, prompt propagation, and responsive roster UI.
```

Add evidence bullets after verification runs:

```md
- [x] AI pool character roster focused tests: `npm run test -- src/components/game/aiFriendRoleRoster.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/AiPoolClient.mobile.test.ts`
- [x] AI pool character roster lint/type/build: `npm run lint`; `npx tsc --noEmit`; `npm run build`
- [x] AI pool character roster browser checks: desktop and 390x844 mobile viewport at local `/ai-pool`
```

Mirror the same completion record in `session-handoff.md`.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm run test -- src/components/game/aiFriendRoleRoster.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/AiPoolClient.mobile.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run harness and static checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-ai-pool-character-roster.md
npm run harness:check
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"
git diff --check
```

Expected: all PASS. `git diff --check` may report only known CRLF replacement warnings; no whitespace errors should remain.

- [ ] **Step 5: Run lint, typecheck, and build**

Run:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Expected: PASS. If build shows the existing Turbopack NFT warning, record it as existing warning rather than a new failure.

- [ ] **Step 6: Browser verify `/ai-pool`**

Start a local server if one is not already running:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Use the in-app Browser to open:

```text
http://127.0.0.1:3010/ai-pool
```

Desktop checks:

- Page title/header reads as an AI character roster.
- Roster entries show avatar, role name, source/persona info, and LLM status.
- Role-card fields are visible and editable for custom AI.
- Existing LLM and TTS advanced controls remain reachable.
- Mock warning appears when mode is Mock.
- Export button produces JSON that does not include LLM/TTS/API Key/Base URL/model/voice.
- Import dialog offers append and overwrite.

Mobile viewport `390x844` checks:

- No horizontal overflow.
- Roster and role-card edit controls remain reachable.
- Import dialog is usable.

- [ ] **Step 7: Update task implementation record**

Append to `docs/tasks/2026-05-ai-pool-character-roster.md`:

```md
## Implementation Record

Completed:
- Added role-card data model and safe role-only roster import/export.
- Passed role cards through local game creation into AI personas.
- Added role-card guidance to real LLM speech and action prompts.
- Updated `/ai-pool` into a character roster with role-card editing and Mock warning.
- Verified desktop and mobile `/ai-pool` layout through browser/manual checks.

Changed files:
- ...

Verification:
- ...

Skipped checks:
- Real provider role-play game test was not run because no safe disposable API key was provided and testing may produce model cost.
```

- [ ] **Step 8: Commit harness state**

Run:

```powershell
git add feature_list.json progress.md session-handoff.md docs/tasks/2026-05-ai-pool-character-roster.md
git commit -m "docs: record ai pool character roster rollout"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: Tasks 1 and 4 cover the roster and import/export UX; Task 2 covers game setup propagation; Task 3 covers real LLM speech/action role-play; Task 5 covers harness, verification, and handoff.
- Placeholder scan: this plan contains no unresolved placeholder markers or unspecified implementation steps. Helper names and paths are concrete.
- Type consistency: `AiFriendRoleCard`, `roleCard`, `source`, `speakingStyle`, `reasoningStyle`, and `avoid` are used consistently across types, helpers, API schema, prompts, and UI.
- Scope check: the plan stays in local AI pool, `/api/games`, and real LLM prompt propagation. It does not add server-side profile storage, room sync, rules-engine changes, or real-provider tests by default.
