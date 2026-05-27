# 学级裁判固定角色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the local-only `学级裁判主题局` to start a fixed 9-character AI table and inject each character card into real LLM speech and action decisions.

**Architecture:** Keep the feature local-first: the browser reads ignored `/class-trial-pack/personas.json`, builds a fixed `AiFriendConfig[]`, and sends it only when the theme is active. The game state stores a sanitized `roleCard` on AI seats, and the AI speech/action prompt builders read that role card as soft style and strategy guidance while the rules engine remains the final authority.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, existing AI provider pipeline in `src/ai/**`, ignored local assets under `local-assets/class-trial-pack`.

---

## File Structure

- Modify `src/game/types.ts`: add `AiCharacterRoleCard` and carry it on `AiFriendConfig`, `AiFriendSeatSetup`, `Seat`, `HumanGameView.seats[]`, and `AgentView`.
- Modify `src/game/aiFriends.ts`: sanitize role cards, preserve them through friend resolution, and keep base persona/model routing unchanged.
- Modify `src/app/api/games/route.ts`: accept sanitized role cards in `aiFriends`.
- Modify `src/components/game/classTrialTheme.ts`: add local `personas.json` types, validation, status, fixed-lineup construction, and combined status messaging.
- Modify `src/components/game/classTrialTheme.test.ts`: cover complete, missing, malformed, and fixed-lineup behavior.
- Modify `src/components/game/gameClientRequests.ts`: allow an explicit AI-friend override, board override, and human-seat override for theme starts.
- Modify `src/components/game/gameClientRequests.test.ts`: prove the override request body.
- Modify `src/components/GameClient.tsx`: fetch `personas.json`, show status, and start complete theme games as fixed 9-AI spectator games.
- Modify `src/components/game/LandingPanel.tsx`: adjust class-trial status copy so it reports both assets and role-card readiness.
- Modify `src/components/game/gamePanelsMobile.test.ts`: update the status-copy regression.
- Modify `src/ai/speechProviders.ts`: include `characterRole` in `LlmSpeechInput` and add role-card speech guidance.
- Modify `src/ai/speechProviders.test.ts`: prove a character role card reaches speech input with safety guidance.
- Modify `src/ai/actionProviders.ts`: include `characterRole` in `LlmActionInput` and add role-card decision constraints.
- Modify `src/ai/actionProviders.test.ts`: prove role-card action input affects constraints without exposing hidden info.
- Create local ignored `local-assets/class-trial-pack/personas.json`: 9 local role cards for private testing. Do not stage or commit this file.
- Create `docs/tasks/2026-05-class-trial-fixed-personas.md`: task card and acceptance record.
- Update `feature_list.json`, `progress.md`, and `session-handoff.md`: record plan, task status, and restart path.

---

### Task 1: Persist Safe Character Role Cards

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/aiFriends.ts`
- Modify: `src/app/api/games/route.ts`
- Test: `src/app/api/games/aiFriends.test.ts`

- [ ] **Step 1: Write the failing API/persistence test**

Append this test to `src/app/api/games/aiFriends.test.ts`:

```ts
  it("accepts a local character role card and exposes only safe setup metadata", async () => {
    const friend = {
      ...copyAiFriend(getDefaultAiFriends("test")[2], { id: "class-trial:monokuma", now: "2026-05-27T00:00:00.000Z" }),
      nickname: "黑白熊",
      roleCard: {
        id: "monokuma",
        displayName: "黑白熊",
        theme: "class-trial",
        styleTags: ["taunting", "chaotic", "rule-bound"],
        speechStyleZh: "语气轻佻、爱嘲讽和挑拨，但必须像普通狼人杀玩家一样围绕公开桌面发言。",
        reasoningBias: "优先寻找矛盾、放大冲突、逼迫别人站边。",
        voteBias: "倾向推动高互动票口，但不能无理由乱投。",
        nightActionBias: "夜晚行动可以偏激进，但仍优先服务阵营胜利。",
        asVillager: "作为好人时用嘲讽压迫可疑位，不能假装知道隐藏身份。",
        asWerewolf: "作为狼人时用挑拨制造混乱，但公开理由必须来自桌面证据。",
        pressureResponse: "被怀疑时反咬对方逻辑漏洞，并要求对方落票口。",
        relationshipHints: ["可以调侃全场紧张气氛，但不能以主持人身份说话。"],
        catchphrasePolicy: "允许极短口癖式感叹，不复刻大段原台词。",
        forbidden: ["不能泄露隐藏身份。", "不能以主持人身份干预规则。"],
        voiceProfileId: "monokuma-ja-local",
        voiceLocale: "ja-JP",
        voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
      },
    };

    const response = await createGame(
      new Request("http://localhost/api/games", {
        method: "POST",
        body: JSON.stringify({ boardId: "9p-seer-witch-hunter", humanSeatId: null, aiFriends: [friend] }),
      }),
    );
    const view = (await response.json()) as HumanGameView;
    const firstAiSeat = view.seats.find((seat) => seat.seatId === 1);

    expect(response.status).toBe(200);
    expect(firstAiSeat?.name).toBe("黑白熊");
    expect(firstAiSeat?.roleCard?.displayName).toBe("黑白熊");
    expect(firstAiSeat?.roleCard?.forbidden.join(" ")).toContain("不能泄露隐藏身份");
    expect(view.setup?.aiFriends[0]?.roleCard?.id).toBe("monokuma");
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(JSON.stringify(view)).not.toContain("apiKey");
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm run test -- src/app/api/games/aiFriends.test.ts
```

Expected: FAIL because `roleCard` is not accepted by the API schema and is not carried through `AiFriendConfig`.

- [ ] **Step 3: Add the shared role-card type**

In `src/game/types.ts`, add this type after `AiPersonaPreferences`:

```ts
export type AiCharacterRoleCard = {
  id: string;
  displayName: string;
  theme: "class-trial";
  styleTags: string[];
  speechStyleZh: string;
  reasoningBias: string;
  voteBias: string;
  nightActionBias: string;
  asVillager: string;
  asWerewolf: string;
  pressureResponse: string;
  relationshipHints: string[];
  catchphrasePolicy: string;
  forbidden: string[];
  voiceProfileId?: string;
  voiceLocale?: string;
  voiceRewritePolicy?: string;
};
```

Then add `roleCard?: AiCharacterRoleCard;` to `Seat`, `AiFriendConfig`, `AiFriendSeatSetup`, each item in `HumanGameView["seats"]`, and `AgentView`.

- [ ] **Step 4: Sanitize and preserve role cards in AI friends**

In `src/game/aiFriends.ts`, update the import:

```ts
import type { AiCharacterRoleCard, AiFriendConfig, AiFriendSeatSetup, AiPersona, AiPersonaPreferences } from "./types";
```

In `sanitizeAiFriendConfig`, add:

```ts
    roleCard: sanitizeAiCharacterRoleCard(value.roleCard),
```

In `resolveAiFriendsForGame`, add `roleCard: config.roleCard,` to `setup`.

At the end of `src/game/aiFriends.ts`, before `clampUnit`, add:

```ts
function sanitizeAiCharacterRoleCard(value: unknown): AiCharacterRoleCard | undefined {
  if (!isRecord(value)) return undefined;
  const theme = value.theme === "class-trial" ? "class-trial" : undefined;
  const id = sanitizeRoleCardId(readString(value.id, 80));
  const displayName = sanitizeRoleCardText(readString(value.displayName, 24), 24);
  if (!theme || !id || !displayName) return undefined;

  return {
    id,
    displayName,
    theme,
    styleTags: sanitizeRoleCardList(value.styleTags, 8, 28),
    speechStyleZh: sanitizeRoleCardText(readString(value.speechStyleZh, 260), 260),
    reasoningBias: sanitizeRoleCardText(readString(value.reasoningBias, 220), 220),
    voteBias: sanitizeRoleCardText(readString(value.voteBias, 220), 220),
    nightActionBias: sanitizeRoleCardText(readString(value.nightActionBias, 220), 220),
    asVillager: sanitizeRoleCardText(readString(value.asVillager, 220), 220),
    asWerewolf: sanitizeRoleCardText(readString(value.asWerewolf, 220), 220),
    pressureResponse: sanitizeRoleCardText(readString(value.pressureResponse, 220), 220),
    relationshipHints: sanitizeRoleCardList(value.relationshipHints, 8, 120),
    catchphrasePolicy: sanitizeRoleCardText(readString(value.catchphrasePolicy, 180), 180),
    forbidden: sanitizeRoleCardList(value.forbidden, 10, 120),
    voiceProfileId: sanitizeRoleCardId(readString(value.voiceProfileId, 80)),
    voiceLocale: sanitizeRoleCardText(readString(value.voiceLocale, 16), 16),
    voiceRewritePolicy: sanitizeRoleCardText(readString(value.voiceRewritePolicy, 120), 120),
  };
}

function sanitizeRoleCardList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeRoleCardText(typeof item === "string" ? item : undefined, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeRoleCardText(value: string | undefined, maxLength: number): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sanitizeRoleCardId(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, "-").slice(0, 80);
  return clean && /^[A-Za-z0-9:_-]+$/.test(clean) ? clean : undefined;
}
```

- [ ] **Step 5: Store role cards on seats and views**

In `src/game/engine.ts`, add `roleCard: resolvedFriend?.config.roleCard,` to each created `Seat`, and add `roleCard: seat.roleCard,` in `buildLegacySetupSnapshot`.

In `src/game/projection.ts`, add `roleCard: seat.isAi ? seat.roleCard : undefined,` to each human-view seat and add `roleCard: seat.roleCard,` to `buildAgentView`.

- [ ] **Step 6: Accept role cards in game creation API**

In `src/app/api/games/route.ts`, add this schema near `createGameSchema`:

```ts
const roleCardSchema = z.object({
  id: z.string().min(1).max(80),
  displayName: z.string().min(1).max(24),
  theme: z.literal("class-trial"),
  styleTags: z.array(z.string().min(1).max(28)).max(8).default([]),
  speechStyleZh: z.string().max(260).default(""),
  reasoningBias: z.string().max(220).default(""),
  voteBias: z.string().max(220).default(""),
  nightActionBias: z.string().max(220).default(""),
  asVillager: z.string().max(220).default(""),
  asWerewolf: z.string().max(220).default(""),
  pressureResponse: z.string().max(220).default(""),
  relationshipHints: z.array(z.string().min(1).max(120)).max(8).default([]),
  catchphrasePolicy: z.string().max(180).default(""),
  forbidden: z.array(z.string().min(1).max(120)).max(10).default([]),
  voiceProfileId: z.string().min(1).max(80).optional(),
  voiceLocale: z.string().min(1).max(16).optional(),
  voiceRewritePolicy: z.string().min(1).max(120).optional(),
});
```

Inside each `aiFriends` object schema, add:

```ts
          roleCard: roleCardSchema.optional(),
```

- [ ] **Step 7: Run the focused test to verify it passes**

Run:

```powershell
npm run test -- src/app/api/games/aiFriends.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```powershell
git add src/game/types.ts src/game/aiFriends.ts src/game/engine.ts src/game/projection.ts src/app/api/games/route.ts src/app/api/games/aiFriends.test.ts
git commit -m "feat: persist local character role cards"
```

---

### Task 2: Add Class-Trial Persona Parsing And Fixed Lineup

**Files:**
- Modify: `src/components/game/classTrialTheme.ts`
- Test: `src/components/game/classTrialTheme.test.ts`

- [ ] **Step 1: Write failing class-trial persona tests**

Append these tests to `src/components/game/classTrialTheme.test.ts`:

```ts
  it("validates a complete local personas file for the fixed 9-character roster", () => {
    const personas = makeCompletePersonas();
    const status = getClassTrialPersonasStatus(personas);

    expect(status).toEqual({
      available: true,
      message: "本地角色卡已就绪。",
      missingCharacterIds: [],
      invalidCharacterIds: [],
    });
  });

  it("reports missing and malformed local personas without blocking visual theme mode", () => {
    expect(getClassTrialPersonasStatus(undefined)).toEqual({
      available: false,
      message: "未找到本地角色卡。视觉主题可继续，AI 将使用普通行为。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
      invalidCharacterIds: [],
    });

    const partial = sanitizeClassTrialPersonas({
      id: "class-trial-personas",
      version: "local-test",
      characters: [{ id: "naegi", displayName: "苗木诚", seatId: 1, basePersonaId: "gpt-balanced-organizer" }],
    });

    expect(getClassTrialPersonasStatus(partial).message).toBe("本地角色卡缺少 8 个角色。");
  });

  it("builds fixed class-trial AI friends in the approved seat order", () => {
    const friends = buildClassTrialAiFriends(makeCompletePersonas(), "2026-05-27T00:00:00.000Z");

    expect(friends).toHaveLength(9);
    expect(friends.map((friend) => friend.nickname)).toEqual([
      "苗木诚",
      "雾切响子",
      "腐川冬子",
      "黑白熊",
      "江之岛盾子",
      "塞蕾丝缇雅",
      "十神白夜",
      "叶隐康比吕",
      "千早爱音",
    ]);
    expect(friends[3]?.id).toBe("class-trial:monokuma");
    expect(friends[3]?.basePersonaId).toBe("doubao-pressure-bluffer");
    expect(friends[3]?.roleCard?.displayName).toBe("黑白熊");
    expect(friends[3]?.roleCard?.forbidden.join(" ")).toContain("不能以主持人身份干预规则");
  });

  it("combines asset and role-card status for the landing page", () => {
    const packStatus = getClassTrialPackStatus(undefined);
    const personaStatus = getClassTrialPersonasStatus(makeCompletePersonas());

    expect(getClassTrialThemeStatusMessage(packStatus, personaStatus)).toContain("素材包");
    expect(getClassTrialThemeStatusMessage(packStatus, personaStatus)).toContain("角色卡已就绪");
  });
```

Add this helper at the bottom of the test file:

```ts
function makeCompletePersonas() {
  return sanitizeClassTrialPersonas({
    id: "class-trial-personas",
    version: "local-test",
    characters: CLASS_TRIAL_CHARACTER_ROSTER.map((character, index) => ({
      id: character.id,
      displayName: character.displayName,
      seatId: index + 1,
      basePersonaId: character.id === "monokuma" ? "doubao-pressure-bluffer" : "gpt-balanced-organizer",
      styleTags: ["class-trial"],
      speechStyleZh: `${character.displayName} 的中文狼人杀发言风格。`,
      reasoningBias: "优先依据公开桌面推理。",
      voteBias: "认真服务阵营胜利。",
      nightActionBias: "夜晚行动遵守合法候选。",
      asVillager: "作为好人时按公开证据找狼。",
      asWerewolf: "作为狼人时只用公开理由伪装。",
      pressureResponse: "被怀疑时解释公开逻辑。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短口癖，不复刻大段原台词。",
      forbidden: character.id === "monokuma" ? ["不能以主持人身份干预规则。"] : ["不能泄露隐藏身份。"],
    })),
  })!;
}
```

Update the import list in the test to include the new functions and types.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: FAIL because persona parsing and fixed-lineup helpers do not exist.

- [ ] **Step 3: Add persona types and status helpers**

In `src/components/game/classTrialTheme.ts`, add:

```ts
import { getDefaultAiFriends } from "@/game/aiFriends";
import type { AiCharacterRoleCard, AiFriendConfig } from "@/game/types";

export const CLASS_TRIAL_DEFAULT_BOARD_ID = "9p-seer-witch-hunter";

export type ClassTrialCharacterPersona = {
  id: ClassTrialCharacterId;
  displayName: string;
  seatId: number;
  basePersonaId: string;
  styleTags: string[];
  speechStyleZh: string;
  reasoningBias: string;
  voteBias: string;
  nightActionBias: string;
  asVillager: string;
  asWerewolf: string;
  pressureResponse: string;
  relationshipHints: string[];
  catchphrasePolicy: string;
  forbidden: string[];
  voiceProfileId?: string;
  voiceLocale?: string;
  voiceRewritePolicy?: string;
};

export type ClassTrialPersonasFile = {
  id: string;
  version: string;
  characters: ClassTrialCharacterPersona[];
};

export type ClassTrialPersonasStatus = {
  available: boolean;
  message: string;
  missingCharacterIds: readonly string[];
  invalidCharacterIds: readonly string[];
};
```

Add these helpers:

```ts
export function sanitizeClassTrialPersonas(value: unknown): ClassTrialPersonasFile | undefined {
  if (!isRecord(value) || !Array.isArray(value.characters)) return undefined;
  const characters = value.characters
    .map(sanitizeClassTrialCharacterPersona)
    .filter((character): character is ClassTrialCharacterPersona => Boolean(character));
  return {
    id: readString(value.id, 80) || "class-trial-personas",
    version: readString(value.version, 80) || "local",
    characters,
  };
}

export function getClassTrialPersonasStatus(personas: ClassTrialPersonasFile | undefined): ClassTrialPersonasStatus {
  if (!personas) {
    return {
      available: false,
      message: "未找到本地角色卡。视觉主题可继续，AI 将使用普通行为。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
      invalidCharacterIds: [],
    };
  }

  const byId = new Map(personas.characters.map((character) => [character.id, character]));
  const missingCharacterIds = CLASS_TRIAL_CHARACTER_IDS.filter((id) => !byId.has(id));
  const invalidCharacterIds = CLASS_TRIAL_CHARACTER_IDS.filter((id, index) => {
    const character = byId.get(id);
    return Boolean(character && character.seatId !== index + 1);
  });

  return {
    available: missingCharacterIds.length === 0 && invalidCharacterIds.length === 0,
    message:
      missingCharacterIds.length > 0
        ? `本地角色卡缺少 ${missingCharacterIds.length} 个角色。`
        : invalidCharacterIds.length > 0
          ? `本地角色卡有 ${invalidCharacterIds.length} 个座位顺序不一致。`
          : "本地角色卡已就绪。",
    missingCharacterIds,
    invalidCharacterIds,
  };
}

export function getClassTrialThemeStatusMessage(
  packStatus: ClassTrialPackStatus,
  personasStatus: ClassTrialPersonasStatus,
): string {
  return `${packStatus.message} ${personasStatus.message}`;
}
```

- [ ] **Step 4: Add fixed-lineup construction**

In `src/components/game/classTrialTheme.ts`, add:

```ts
export function buildClassTrialAiFriends(personas: ClassTrialPersonasFile | undefined, now = "class-trial-local"): AiFriendConfig[] {
  const status = getClassTrialPersonasStatus(personas);
  if (!personas || !status.available) return [];

  const defaults = getDefaultAiFriends(now);
  const defaultByPersonaId = new Map(defaults.map((friend) => [friend.basePersonaId, friend]));
  const byId = new Map(personas.characters.map((character) => [character.id, character]));

  return CLASS_TRIAL_CHARACTER_ROSTER.map((rosterCharacter) => {
    const character = byId.get(rosterCharacter.id)!;
    const base = defaultByPersonaId.get(character.basePersonaId) ?? defaults[0]!;
    return {
      ...base,
      id: `class-trial:${character.id}`,
      nickname: character.displayName.slice(0, 16),
      basePersonaId: base.basePersonaId,
      roleCard: toAiCharacterRoleCard(character),
      createdAt: now,
      updatedAt: now,
    };
  });
}

function toAiCharacterRoleCard(character: ClassTrialCharacterPersona): AiCharacterRoleCard {
  return {
    id: character.id,
    displayName: character.displayName,
    theme: "class-trial",
    styleTags: character.styleTags,
    speechStyleZh: character.speechStyleZh,
    reasoningBias: character.reasoningBias,
    voteBias: character.voteBias,
    nightActionBias: character.nightActionBias,
    asVillager: character.asVillager,
    asWerewolf: character.asWerewolf,
    pressureResponse: character.pressureResponse,
    relationshipHints: character.relationshipHints,
    catchphrasePolicy: character.catchphrasePolicy,
    forbidden: character.forbidden,
    voiceProfileId: character.voiceProfileId,
    voiceLocale: character.voiceLocale,
    voiceRewritePolicy: character.voiceRewritePolicy,
  };
}
```

Add local parsing helpers:

```ts
function sanitizeClassTrialCharacterPersona(value: unknown): ClassTrialCharacterPersona | undefined {
  if (!isRecord(value)) return undefined;
  const id = parseClassTrialCharacterId(value.id);
  if (!id) return undefined;
  const rosterIndex = CLASS_TRIAL_CHARACTER_IDS.indexOf(id);
  const displayName = readString(value.displayName, 24) || CLASS_TRIAL_CHARACTER_ROSTER[rosterIndex]?.displayName;
  const seatId = readNumber(value.seatId, rosterIndex + 1);
  const basePersonaId = readString(value.basePersonaId, 80);
  if (!displayName || !basePersonaId) return undefined;

  return {
    id,
    displayName,
    seatId,
    basePersonaId,
    styleTags: readStringArray(value.styleTags, 8, 28),
    speechStyleZh: readString(value.speechStyleZh, 260) || "像狼人杀玩家一样自然发言，角色风格只作软约束。",
    reasoningBias: readString(value.reasoningBias, 220) || "优先依据公开桌面推理。",
    voteBias: readString(value.voteBias, 220) || "投票认真服务阵营胜利。",
    nightActionBias: readString(value.nightActionBias, 220) || "夜晚行动遵守合法候选。",
    asVillager: readString(value.asVillager, 220) || "作为好人时只按公开信息找狼。",
    asWerewolf: readString(value.asWerewolf, 220) || "作为狼人时只用公开理由伪装。",
    pressureResponse: readString(value.pressureResponse, 220) || "被怀疑时回应公开逻辑。",
    relationshipHints: readStringArray(value.relationshipHints, 8, 120),
    catchphrasePolicy: readString(value.catchphrasePolicy, 180) || "允许极短口癖，不复刻大段原台词。",
    forbidden: readStringArray(value.forbidden, 10, 120),
    voiceProfileId: readString(value.voiceProfileId, 80),
    voiceLocale: readString(value.voiceLocale, 16),
    voiceRewritePolicy: readString(value.voiceRewritePolicy, 120),
  };
}

function parseClassTrialCharacterId(value: unknown): ClassTrialCharacterId | undefined {
  return typeof value === "string" && CLASS_TRIAL_CHARACTER_IDS.includes(value as ClassTrialCharacterId)
    ? (value as ClassTrialCharacterId)
    : undefined;
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : undefined;
}

function readNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 9 ? number : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/components/game/classTrialTheme.ts src/components/game/classTrialTheme.test.ts
git commit -m "feat: build class trial fixed lineup"
```

---

### Task 3: Start Theme Games With Fixed 9 AI Players

**Files:**
- Modify: `src/components/game/gameClientRequests.ts`
- Modify: `src/components/GameClient.tsx`
- Modify: `src/components/game/LandingPanel.tsx`
- Modify: `src/components/game/gamePanelsMobile.test.ts`
- Test: `src/components/game/gameClientRequests.test.ts`

- [ ] **Step 1: Write failing request override test**

Append this test to `src/components/game/gameClientRequests.test.ts`:

```ts
  it("creates a class-trial game with fixed 9 AI friends, fixed board, and spectator mode", async () => {
    const view = { id: "class-trial-game" } as HumanGameView;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(view));
    const classTrialAiFriends = Array.from({ length: 9 }, (_, index) => ({
      id: `class-trial:${index + 1}`,
      nickname: `角色${index + 1}`,
      basePersonaId: "gpt-balanced-organizer",
      riskTolerance: 0.5,
      bluffing: 0.5,
      preferences: {
        logic: 0.5,
        identity: 0.5,
        vote: 0.5,
        emotion: 0.5,
        memory: 0.5,
        leadership: 0.5,
        deception: 0.5,
        caution: 0.5,
      },
      createdAt: "class-trial-local",
      updatedAt: "class-trial-local",
    })) as AiFriendConfig[];

    await createGameView({
      boardId: undefined,
      selectedBoardId: "6p-beginner-seer",
      humanSeatMode: "fixed",
      selectedHumanSeatId: 2,
      selectedAiFriends: [],
      boardIdOverride: "9p-seer-witch-hunter",
      humanSeatModeOverride: "none",
      aiFriendsOverride: classTrialAiFriends,
      fetcher: fetchMock,
    });

    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      boardId: "9p-seer-witch-hunter",
      humanSeatId: null,
      aiFriends: classTrialAiFriends,
    });
  });
```

- [ ] **Step 2: Run the focused request test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/gameClientRequests.test.ts
```

Expected: FAIL because `createGameView` does not accept override options.

- [ ] **Step 3: Add override options to game creation request**

In `src/components/game/gameClientRequests.ts`, extend the `createGameView` options with:

```ts
  boardIdOverride?: string;
  humanSeatModeOverride?: HumanSeatMode;
  aiFriendsOverride?: AiFriendConfig[];
```

Replace the request body with:

```ts
    body: JSON.stringify({
      boardId: options.boardIdOverride ?? options.boardId ?? options.selectedBoardId ?? undefined,
      humanSeatId:
        (options.humanSeatModeOverride ?? options.humanSeatMode) === "none"
          ? null
          : options.selectedHumanSeatId ?? undefined,
      aiFriends: options.aiFriendsOverride ?? options.selectedAiFriends,
    }),
```

- [ ] **Step 4: Fetch local personas in GameClient**

In `src/components/GameClient.tsx`, import:

```ts
  CLASS_TRIAL_DEFAULT_BOARD_ID,
  buildClassTrialAiFriends,
  getClassTrialPersonasStatus,
  getClassTrialThemeStatusMessage,
  sanitizeClassTrialPersonas,
  type ClassTrialPersonasFile,
```

Add state:

```ts
  const [classTrialPersonas, setClassTrialPersonas] = useState<ClassTrialPersonasFile | undefined>();
```

Add this effect near the existing manifest fetch:

```ts
  useEffect(() => {
    let cancelled = false;
    void fetch("/class-trial-pack/personas.json")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => {
        if (!cancelled) setClassTrialPersonas(sanitizeClassTrialPersonas(raw));
      })
      .catch(() => {
        if (!cancelled) setClassTrialPersonas(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

Add memos near `classTrialPackStatus`:

```ts
  const classTrialPersonasStatus = useMemo(() => getClassTrialPersonasStatus(classTrialPersonas), [classTrialPersonas]);
  const classTrialStatusMessage = useMemo(
    () => getClassTrialThemeStatusMessage(classTrialPackStatus, classTrialPersonasStatus),
    [classTrialPackStatus, classTrialPersonasStatus],
  );
  const classTrialAiFriends = useMemo(
    () => buildClassTrialAiFriends(classTrialPersonas),
    [classTrialPersonas],
  );
```

- [ ] **Step 5: Start complete theme games as fixed spectator games**

In `startGame`, before `createGameView`, add:

```ts
      const useFixedClassTrialLineup =
        classTrialThemeMode === "class-trial" && classTrialPersonasStatus.available && classTrialAiFriends.length === 9;
```

Pass these options into `createGameView`:

```ts
        boardIdOverride: useFixedClassTrialLineup ? CLASS_TRIAL_DEFAULT_BOARD_ID : undefined,
        humanSeatModeOverride: useFixedClassTrialLineup ? "none" : undefined,
        aiFriendsOverride: useFixedClassTrialLineup ? classTrialAiFriends : undefined,
```

Update the `useCallback` dependency list to include `classTrialAiFriends`, `classTrialPersonasStatus.available`, and `classTrialThemeMode`.

- [ ] **Step 6: Show combined readiness in the landing panel**

In the `LandingPanel` call in `GameClient`, change:

```tsx
            classTrialPackAvailable={classTrialPackStatus.available}
            classTrialPackMessage={classTrialPackStatus.message}
```

to:

```tsx
            classTrialPackAvailable={classTrialPackStatus.available && classTrialPersonasStatus.available}
            classTrialPackMessage={classTrialStatusMessage}
```

In `src/components/game/LandingPanel.tsx`, change the theme description to:

```tsx
                    本地限定主题，只影响单机/观战局的固定角色、视觉和演出，不进入公网房间。
```

- [ ] **Step 7: Update the landing-panel regression test**

In `src/components/game/gamePanelsMobile.test.ts`, update the existing class-trial status expectation to include:

```ts
        classTrialPackMessage:
          "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。 未找到本地角色卡。视觉主题可继续，AI 将使用普通行为。",
```

Expected rendered text should contain both `未找到本地主题素材包` and `未找到本地角色卡`.

- [ ] **Step 8: Run focused UI/request tests**

Run:

```powershell
npm run test -- src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git add src/components/game/gameClientRequests.ts src/components/game/gameClientRequests.test.ts src/components/GameClient.tsx src/components/game/LandingPanel.tsx src/components/game/gamePanelsMobile.test.ts
git commit -m "feat: start class trial fixed persona games"
```

---

### Task 4: Inject Role Cards Into Speech And Action Prompts

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/actionProviders.ts`
- Test: `src/ai/speechProviders.test.ts`
- Test: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Write failing speech prompt test**

Append this test to `src/ai/speechProviders.test.ts`:

```ts
  it("includes local character role-card guidance in real LLM speech input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const monokuma = state.seats.find((seat) => seat.isAi)!;
    monokuma.name = "黑白熊";
    monokuma.roleCard = {
      id: "monokuma",
      displayName: "黑白熊",
      theme: "class-trial",
      styleTags: ["taunting", "chaotic"],
      speechStyleZh: "强烈嘲讽、挑拨，但仍像狼人杀玩家。",
      reasoningBias: "放大矛盾，逼迫他人站边。",
      voteBias: "推动高互动票口。",
      nightActionBias: "夜晚偏激进但不送局。",
      asVillager: "作为好人时用公开证据施压。",
      asWerewolf: "作为狼人时只用公开理由伪装。",
      pressureResponse: "被怀疑时反咬对方逻辑漏洞。",
      relationshipHints: ["不能以主持人身份说话。"],
      catchphrasePolicy: "允许极短口癖，不复刻大段原台词。",
      forbidden: ["不能泄露隐藏身份。", "不能以主持人身份干预规则。"],
    };
    state.phase = "DAY_SPEECH";
    state.speechQueue = [monokuma.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, monokuma.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");

    expect(input.characterRole?.displayName).toBe("黑白熊");
    expect(input.playerSpeechGuide.tablePlayerStyle.join("\n")).toContain("强烈嘲讽");
    expect(input.playerSpeechGuide.avoid.join("\n")).toContain("不能以主持人身份干预规则");
  });
```

- [ ] **Step 2: Write failing action prompt test**

Append this test to `src/ai/actionProviders.test.ts`:

```ts
  it("includes local character role-card guidance in real LLM action input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    state.phase = "DAY_VOTE";
    const actor = state.seats.find((seat) => seat.isAi)!;
    actor.name = "雾切响子";
    actor.roleCard = {
      id: "kirigiri",
      displayName: "雾切响子",
      theme: "class-trial",
      styleTags: ["calm", "deductive"],
      speechStyleZh: "冷静、简短、抓证据。",
      reasoningBias: "优先审查证据链和发言矛盾。",
      voteBias: "更愿意投公开证据闭合的位置。",
      nightActionBias: "夜晚行动谨慎，优先高信息收益。",
      asVillager: "作为好人时保持事实边界。",
      asWerewolf: "作为狼人时用冷静逻辑伪装。",
      pressureResponse: "被怀疑时要求对方给出证据链。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短角色感，不复刻大段原台词。",
      forbidden: ["不能泄露隐藏身份。"],
    };
    const view = buildAgentView(state, actor.seatId);
    const tableRead = buildAiTableRead(view);
    const votePlan = createVotePlan(view, tableRead);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      votePlan,
      fallbackCommand: createMockCommand(view, tableRead, votePlan),
    });

    expect(input.characterRole?.displayName).toBe("雾切响子");
    expect(input.constraints.join("\n")).toContain("role card is soft guidance");
    expect(JSON.stringify(input)).not.toContain("真实身份");
  });
```

- [ ] **Step 3: Run focused AI tests to verify they fail**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
```

Expected: FAIL because `characterRole` is not part of LLM speech/action input.

- [ ] **Step 4: Add character role to speech input**

In `src/ai/speechProviders.ts`, add to `LlmSpeechInput`:

```ts
  characterRole?: NonNullable<AgentView["roleCard"]>;
```

In `buildConstrainedSpeechInput`, add:

```ts
    characterRole: view.roleCard,
```

In `buildPlayerSpeechGuide`, compute:

```ts
  const roleCard = view.roleCard;
  const roleCardStyleLines = roleCard
    ? [
        `本地主题角色：${roleCard.displayName}。中文对白风格：${roleCard.speechStyleZh}`,
        `角色推理偏好：${roleCard.reasoningBias}`,
        `被怀疑时反应：${roleCard.pressureResponse}`,
        `口癖边界：${roleCard.catchphrasePolicy}`,
      ]
    : [];
```

Prepend `...roleCardStyleLines` into `tablePlayerStyle`.

Append these lines to `avoid` when `roleCard` exists:

```ts
      ...(roleCard
        ? [
            "角色卡只影响语气和轻度取舍，不能覆盖阵营胜利目标、公开事实边界或狼人杀规则。",
            ...roleCard.forbidden,
          ]
        : []),
```

- [ ] **Step 5: Add character role to action input**

In `src/ai/actionProviders.ts`, add to `LlmActionInput`:

```ts
  characterRole?: NonNullable<AgentView["roleCard"]>;
```

In `buildConstrainedActionInput`, add:

```ts
    characterRole: view.roleCard,
```

In `buildActionConstraints`, after the base constraints are created, add:

```ts
  if (view.roleCard) {
    constraints.push(
      `The local character role card is soft guidance for this player: ${view.roleCard.displayName}.`,
      `Use role-card reasoningBias, voteBias, nightActionBias, asVillager/asWerewolf, and pressureResponse only to break close strategic ties.`,
      "The role card is soft guidance; it must not override legal candidates, public evidence, hidden-information boundaries, or the player's camp win condition.",
      ...view.roleCard.forbidden,
    );
  }
```

- [ ] **Step 6: Run focused AI tests to verify they pass**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts
git commit -m "feat: inject character role cards into ai prompts"
```

---

### Task 5: Create The Ignored Local Personas File

**Files:**
- Create ignored local file: `local-assets/class-trial-pack/personas.json`

- [ ] **Step 1: Confirm local-assets is ignored**

Run:

```powershell
git check-ignore -v local-assets/class-trial-pack/personas.json
```

Expected: output references `.gitignore` and `/local-assets/`.

- [ ] **Step 2: Create the local personas file**

Create `local-assets/class-trial-pack/personas.json` with:

```json
{
  "id": "class-trial-personas",
  "version": "local-2026-05-27",
  "characters": [
    {
      "id": "naegi",
      "displayName": "苗木诚",
      "seatId": 1,
      "basePersonaId": "gpt-balanced-organizer",
      "styleTags": ["hopeful", "earnest", "mediator"],
      "speechStyleZh": "真诚、努力把话说清楚，常用温和但坚定的方式把桌面拉回公开证据。",
      "reasoningBias": "优先寻找能让大家共同验证的公开线索，不轻易把人打死。",
      "voteBias": "倾向投公开矛盾更明确的位置，但会给可疑位一次解释空间。",
      "nightActionBias": "夜晚行动偏稳健，优先选择信息收益和阵营收益更高的合法目标。",
      "asVillager": "作为好人时鼓励桌面统一标准，用公开发言和票型找狼。",
      "asWerewolf": "作为狼人时装作在调和矛盾，避免过度强压，必要时保护狼队节奏。",
      "pressureResponse": "被怀疑时先承认可疑点，再解释自己的公开逻辑和投票边界。",
      "relationshipHints": ["对雾切的推理会更愿意认真参考，但不能无条件认好。"],
      "catchphrasePolicy": "允许极短希望感表达，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能用主角光环否定公开证据。"],
      "voiceProfileId": "naegi-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "kirigiri",
      "displayName": "雾切响子",
      "seatId": 2,
      "basePersonaId": "deepseek-calm-analyst",
      "styleTags": ["calm", "deductive", "precise"],
      "speechStyleZh": "冷静、克制、少废话，优先指出证据链缺口和逻辑跳步。",
      "reasoningBias": "更看重发言前后是否闭合、查验线是否自洽、票型是否能解释。",
      "voteBias": "倾向投证据链最完整的可疑位，不被单纯情绪带动。",
      "nightActionBias": "夜晚行动谨慎，优先高信息收益或保护关键结构。",
      "asVillager": "作为好人时保持事实边界，逼迫他人给出可复核证据。",
      "asWerewolf": "作为狼人时用冷静逻辑包装公开理由，避免情绪化破绽。",
      "pressureResponse": "被怀疑时要求对方指出具体证据链，并逐条拆解。",
      "relationshipHints": ["对苗木的真诚会保持观察，不把态度直接当铁好。"],
      "catchphrasePolicy": "允许极短冷静收束句，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能假装掌握系统外证据。"],
      "voiceProfileId": "kirigiri-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "fukawa",
      "displayName": "腐川冬子",
      "seatId": 3,
      "basePersonaId": "glm-structured-voter",
      "styleTags": ["nervous", "sharp", "defensive"],
      "speechStyleZh": "紧张、敏感、容易自我防御，但会突然抓住别人话里的刺。",
      "reasoningBias": "更容易注意语气、轻视、回避和前后态度变化。",
      "voteBias": "被压迫时容易反打压力来源，但仍需要公开理由支撑。",
      "nightActionBias": "夜晚行动略保守，偏向处理对自己或阵营威胁明显的位置。",
      "asVillager": "作为好人时把被忽视的细节和态度矛盾摆上桌。",
      "asWerewolf": "作为狼人时用委屈和防御掩护自己，但不能无理由乱咬。",
      "pressureResponse": "被怀疑时先尖锐反应，再回到对方逻辑漏洞。",
      "relationshipHints": ["面对十神容易语气失衡，但投票仍要依据桌面。"],
      "catchphrasePolicy": "允许短促敏感式语气，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能因角色关系无证据投票。"],
      "voiceProfileId": "fukawa-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "monokuma",
      "displayName": "黑白熊",
      "seatId": 4,
      "basePersonaId": "doubao-pressure-bluffer",
      "styleTags": ["taunting", "chaotic", "provocative"],
      "speechStyleZh": "嘲讽、挑拨、轻度夸张，喜欢把矛盾推到台前，但仍像狼人杀玩家发言。",
      "reasoningBias": "优先放大冲突和矛盾，逼迫别人站边或解释票口。",
      "voteBias": "倾向推动高互动、高压力的票口，但不能无理由乱投。",
      "nightActionBias": "夜晚行动偏激进，优先制造白天可操作的焦点。",
      "asVillager": "作为好人时用嘲讽压迫可疑位，要求对方落明确立场。",
      "asWerewolf": "作为狼人时制造混乱和对立，但公开理由必须来自桌面证据。",
      "pressureResponse": "被怀疑时反咬对方逻辑漏洞，并把压力转成新的投票问题。",
      "relationshipHints": ["可以调侃全场，但不能以主持人身份宣布结果。"],
      "catchphrasePolicy": "允许极短怪笑或嘲讽口癖，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能以主持人身份干预规则。", "不能暗示自己知道全场身份。"],
      "voiceProfileId": "monokuma-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "enoshima",
      "displayName": "江之岛盾子",
      "seatId": 5,
      "basePersonaId": "doubao-pressure-bluffer",
      "styleTags": ["dramatic", "volatile", "manipulative"],
      "speechStyleZh": "戏剧化、挑衅、节奏变化大，喜欢把桌面情绪推高。",
      "reasoningBias": "关注谁在借势、谁在逃避冲突、谁的发言能被转化成票口。",
      "voteBias": "愿意打强势票口和反转票口，但必须给公开理由。",
      "nightActionBias": "夜晚行动偏进攻，优先选择能改变白天格局的目标。",
      "asVillager": "作为好人时用高压语言逼出站边和反应。",
      "asWerewolf": "作为狼人时擅长煽动互踩和转移焦点。",
      "pressureResponse": "被怀疑时先戏剧化回应，再把怀疑反转成对方的动机问题。",
      "relationshipHints": ["与黑白熊都爱拱火，但不能共享隐藏信息。"],
      "catchphrasePolicy": "允许极短戏剧化感叹，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能为了表演持续送局。"],
      "voiceProfileId": "enoshima-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "celestia",
      "displayName": "塞蕾丝缇雅",
      "seatId": 6,
      "basePersonaId": "claude-careful-leader",
      "styleTags": ["elegant", "calculating", "controlled"],
      "speechStyleZh": "优雅、克制、带一点压迫感，喜欢把概率和收益讲清楚。",
      "reasoningBias": "更看重行为收益、票型分布和谁在下注式站边。",
      "voteBias": "倾向选择收益解释最差的位置，愿意做冷静归票。",
      "nightActionBias": "夜晚行动重视风险收益，优先处理关键威胁。",
      "asVillager": "作为好人时用收益分析约束桌面乱票。",
      "asWerewolf": "作为狼人时用优雅理性包装狼队收益。",
      "pressureResponse": "被怀疑时保持礼貌，反问对方的收益链是否成立。",
      "relationshipHints": [],
      "catchphrasePolicy": "允许极短礼貌式嘲讽，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能把赌徒直觉当铁证。"],
      "voiceProfileId": "celestia-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "togami",
      "displayName": "十神白夜",
      "seatId": 7,
      "basePersonaId": "claude-careful-leader",
      "styleTags": ["arrogant", "commanding", "analytical"],
      "speechStyleZh": "强势、自信、居高临下，习惯要求别人给出清晰标准。",
      "reasoningBias": "重视身份格局、站边标准和谁在逃避责任。",
      "voteBias": "倾向主导票口，投自己认为结构最差的位置。",
      "nightActionBias": "夜晚行动偏目标明确，优先高价值目标或关键威胁。",
      "asVillager": "作为好人时用强势标准压缩狼队生存空间。",
      "asWerewolf": "作为狼人时用领导感抢桌面话语权。",
      "pressureResponse": "被怀疑时反问对方资格和证据，再给出自己的标准。",
      "relationshipHints": ["面对腐川可能更强势，但不能无证据定性。"],
      "catchphrasePolicy": "允许极短傲慢语气，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能把傲慢当作免死理由。"],
      "voiceProfileId": "togami-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "hagakure",
      "displayName": "叶隐康比吕",
      "seatId": 8,
      "basePersonaId": "gemini-quiet-observer",
      "styleTags": ["intuitive", "loose", "lucky"],
      "speechStyleZh": "直觉化、略散漫、偶尔说出歪打正着的观察，但不能装成真预知。",
      "reasoningBias": "更依赖听感和直觉，但需要补一个公开事实落点。",
      "voteBias": "容易先挂观察位，真正投票时需要回到公开证据。",
      "nightActionBias": "夜晚行动偏保守或凭直觉，但不能违背合法候选和阵营目标。",
      "asVillager": "作为好人时可以说直觉，但要给可验证条件。",
      "asWerewolf": "作为狼人时用直觉口吻降低攻击性，避免过度暴露目的。",
      "pressureResponse": "被怀疑时先慌一下，再补公开理由。",
      "relationshipHints": [],
      "catchphrasePolicy": "允许极短玄学式口吻，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能假装预知系统真相。"],
      "voiceProfileId": "hagakure-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    },
    {
      "id": "anon",
      "displayName": "千早爱音",
      "seatId": 9,
      "basePersonaId": "mimo-logic-checker",
      "styleTags": ["energetic", "social", "adaptive"],
      "speechStyleZh": "活泼、社交感强，善于接住别人话题并把焦点转成可讨论问题。",
      "reasoningBias": "关注谁在带节奏、谁被孤立、谁的发言和投票不连贯。",
      "voteBias": "倾向投无法解释自己前后变化的位置，也会考虑桌面协作。",
      "nightActionBias": "夜晚行动兼顾阵营收益和后续白天可解释性。",
      "asVillager": "作为好人时用社交观察和发言连贯性找狼。",
      "asWerewolf": "作为狼人时用亲和力缓和压力并转移焦点。",
      "pressureResponse": "被怀疑时先解释情绪和动机，再给出可验证的公开逻辑。",
      "relationshipHints": [],
      "catchphrasePolicy": "允许极短轻快口癖，不复刻长段原台词。",
      "forbidden": ["不能泄露隐藏身份。", "不能用人设关系替代狼人杀证据。"],
      "voiceProfileId": "anon-ja-local",
      "voiceLocale": "ja-JP",
      "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
    }
  ]
}
```

- [ ] **Step 3: Verify the file stays ignored**

Run:

```powershell
git status --short --ignored local-assets/class-trial-pack/personas.json
```

Expected: the file appears as ignored (`!!`), not staged.

---

### Task 6: Verification, Browser Flow, And Harness Updates

**Files:**
- Create: `docs/tasks/2026-05-class-trial-fixed-personas.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run the full focused verification set**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts
npm run lint
npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md
npm run harness:check
```

Expected: all commands pass.

- [ ] **Step 2: Attempt TypeScript confidence check**

Run:

```powershell
npx tsc --noEmit
```

Expected: if the existing unrelated `src/server/gameService.ts(739,36)` implicit-any failure still appears, record it as known unrelated noise and do not edit `gameService.ts` unless the task changes it directly.

- [ ] **Step 3: Browser verify the local flow**

Start or reuse the local dev server and open the in-app Browser:

```text
http://127.0.0.1:<port>/
```

Manual flow:

1. Homepage shows `学级裁判主题局`.
2. Status text reports both local image pack and local role-card readiness.
3. Select `学级裁判主题局`.
4. Click `进入牌桌`.
5. Confirm the game is `9人预女猎` and spectator mode.
6. Confirm the 9 seats are, in order: 苗木诚、雾切响子、腐川冬子、黑白熊、江之岛盾子、塞蕾丝缇雅、十神白夜、叶隐康比吕、千早爱音。
7. Continue into at least one AI speech.
8. Confirm the dialogue box displays Chinese text and no identity labels.
9. Open `/rooms` and confirm `学级裁判主题局` is not present.

- [ ] **Step 4: Create the task card**

Create `docs/tasks/2026-05-class-trial-fixed-personas.md` using the task-card content below:

```md
# 学级裁判主题局固定角色 AI

## Task

Short name: class-trial-fixed-personas

Goal: Add a local-only fixed 9-character AI persona layer for 学级裁判主题局.

Why it matters: The theme should feel like fixed characters seriously playing狼人杀, not normal AI with swapped images.

## Task Gate

Task type: Frontend/UI + AI behavior + AI speech

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> start game -> confirm fixed 9-character spectator table -> continue to at least one AI speech -> confirm /rooms does not expose the theme.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production/release check
- Reason: this slice is local-only and must not change Public Alpha or deployment.
- Residual risk: browser verification cannot prove every future GPT-SoVITS voice path.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/threads/ai-behavior.md`
- `docs/threads/ai-speech.md`
- `docs/superpowers/specs/2026-05-27-class-trial-fixed-personas-design.md`
- `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/game/types.ts`
- `src/game/aiFriends.ts`
- `src/game/engine.ts`
- `src/game/projection.ts`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/components/GameClient.tsx`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `local-assets/class-trial-pack/personas.json` as ignored local-only data
- `docs/tasks/2026-05-class-trial-fixed-personas.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- committed image/audio assets
- generated caches
- `src/game/engine.ts` rule behavior beyond carrying role-card metadata
- `src/app/rooms/**`
- `src/server/roomService.ts`
- Public Alpha deployment docs unless a later release task asks for it

## Definition Of Done

This task is complete when:

- `local-assets/class-trial-pack/personas.json` exists locally and remains ignored.
- The homepage reports local role-card readiness.
- Complete role cards cause theme games to start as fixed 9-AI spectator games on `9p-seer-witch-hunter`.
- Seat order matches the approved 9-character roster.
- Role cards are stored on AI seats and passed into `AgentView`.
- Real LLM speech input includes role-card speech guidance and safety boundaries.
- Real LLM action input includes role-card decision guidance and safety boundaries.
- Missing or malformed role cards degrade to visual theme plus ordinary AI behavior.
- Default mode and `/rooms` are unchanged.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/components/game/gamePanelsMobile.test.ts src/app/api/games/aiFriends.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/app/class-trial-pack/[...assetPath]/route.test.ts`
- `npm run lint`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-fixed-personas.md`
- `npm run harness:check`
- Browser/manual local flow.

Optional deeper checks:

- `npx tsc --noEmit`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:<port>`

If a check cannot be run, record the reason in the handoff.
```

- [ ] **Step 5: Update feature state and handoff**

In `feature_list.json`, update `class-trial-fixed-personas.evidence` to include this plan and task card while keeping status `not-started` until implementation starts:

```json
"evidence": "docs/superpowers/specs/2026-05-27-class-trial-fixed-personas-design.md; docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md; docs/tasks/2026-05-class-trial-fixed-personas.md"
```

In `progress.md`, set:

```md
**Last Updated:** 2026-05-27 22:10 Asia/Shanghai
**Session ID:** class-trial fixed personas plan
**Active Feature:** class-trial-fixed-personas - Class Trial Fixed Personas
```

Move the fixed-persona spec review item from “In Progress” to done and add:

```md
- [x] Implementation plan recorded in `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`.
- [x] Task card created at `docs/tasks/2026-05-class-trial-fixed-personas.md`.
```

Set “What’s In Progress” to:

```md
- [ ] Awaiting user choice of execution mode for the fixed-persona implementation plan.
```

In `session-handoff.md`, update the current status to say the plan and task card exist, and the next step is choosing execution mode.

- [ ] **Step 6: Commit Task 6**

```powershell
git add docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md docs/tasks/2026-05-class-trial-fixed-personas.md feature_list.json progress.md session-handoff.md
git commit -m "docs: plan class trial fixed personas"
```

---

## Self-Review

- Spec coverage: fixed seats, local-only scope, ignored `personas.json`, fixed AI lineup, prompt injection for speech/action, missing-file degradation, Public Alpha exclusion, and future Japanese voice boundary are all covered.
- Placeholder scan: no task relies on unspecified fields or unnamed future work; GPT-SoVITS, public Alpha, rooms, memory, and Japanese voice rewriting remain outside this implementation slice.
- Type consistency: `AiCharacterRoleCard` is the shared game-layer type; `ClassTrialCharacterPersona` is the local file type; `roleCard` is the property passed from local persona file to AI friend, seat, setup, human view, and agent view.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-class-trial-fixed-personas.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

