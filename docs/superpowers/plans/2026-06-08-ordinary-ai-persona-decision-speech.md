# Ordinary AI Persona Decision Speech Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared ordinary Werewolf AI player-type layer so single-player and room AI use the same readable, first-person, personality-aware decisions and speech.

**Architecture:** Add a focused ordinary player profile model on top of existing AI friend tuning, then feed it through game creation, room creation, `tableRead`, `actionProviders`, `speechProviders`, and fallback speech. Keep model routing separate from player personality: model names decide provider config, ordinary player profiles decide speaking style, reasoning bias, and action tendencies.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing localStorage AI friend store, existing `AgentView` / game engine / room service AI provider pipeline.

---

## Current Context

Read these before executing:

- `AGENTS.md`
- `docs/superpowers/specs/2026-06-08-ordinary-ai-persona-decision-speech-design.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/working-agreements.md`
- `docs/verification-matrix.md`

Important repo state:

- The working tree may contain unrelated edits, including audio and AI files. Run `git status --short` before each task and only stage files listed by that task.
- `src/components/AiPoolClient.tsx` is already large. Keep UI edits narrowly scoped and prefer helper functions where practical.
- Do not edit `.env`, generated audio caches, database files, `.next`, `node_modules`, or production deploy scripts.

## File Structure

Create:

- `src/game/ordinaryPlayerProfiles.ts`: owns ordinary player type ids, preset labels, default profiles, sanitization, inference from legacy tuning, and applying presets to AI friends.
- `src/game/ordinaryPlayerProfiles.test.ts`: focused tests for defaults, sanitization, legacy inference, and preset application.
- `scripts/audit-ordinary-speech-quality.mjs`: local transcript/JSON scanner for fallback count, black jargon, observer wording, and repeat issues.

Modify:

- `src/game/types.ts`: add `AiOrdinaryPlayerTypeId`, `AiOrdinaryPlayerProfile`, and optional `ordinaryPlayerProfile` fields on `AiFriendConfig`, `AiFriendSeatSetup`, and `AiPersona`.
- `src/game/aiFriends.ts`: sanitize, copy, export/import, resolve, and build runtime persona with ordinary player profile.
- `src/game/aiFriends.test.ts`: verify default stable player types, old-config compatibility, export/import, and resolved personas.
- `src/game/personas.ts`: keep model roster, but add ordinary player profile defaults that describe player type rather than model personality.
- `src/components/game/clientTypes.ts`: expose ordinary profile summary on `AiFriendOption`.
- `src/components/game/aiFriendStorage.ts`: pass profile summaries to AI pool options.
- `src/components/AiPoolClient.tsx`: add preset/slider controls for speaking, reasoning, and action tendencies.
- `src/components/AiPoolClient.mobile.test.ts`: cover the visible AI pool player-type controls and labels.
- `src/app/api/games/route.ts`: accept safe `ordinaryPlayerProfile` input for single-player game creation.
- `src/app/api/games/aiFriends.test.ts`: prove API accepts and exposes ordinary player profile safely.
- `src/components/RoomClient.tsx`: include selected AI friends and runtime mode/config when creating rooms.
- `src/server/roomService.ts`: persist room AI friends and use them when creating the room game.
- `src/app/api/rooms/api.test.ts`: prove room-created games preserve the same ordinary profile as single-player setup.
- `src/ai/personaStrategyCards.ts`: adapt strategy cards from ordinary player profiles, avoiding model-name identity.
- `src/ai/personaStrategyCards.test.ts`: verify stable player type strategy, camp adaptation, and public-safe wording.
- `src/ai/tableRead.ts`: use ordinary profile preferences for seat attention and speech-plan persona cues.
- `src/ai/tableRead.test.ts`: verify profile-specific focus without extra private knowledge.
- `src/ai/actionProviders.ts`: rename ordinary constraints to player-type strategy, enforce public-safe readable action reasons.
- `src/ai/actionProviders.test.ts`: verify action input carries player profile and still constrains legal candidates.
- `src/ai/seatMemory.ts`: store public-facing memory wording instead of internal strategy labels.
- `src/ai/seatMemory.test.ts`: verify memory lines do not leak internal field names or black jargon.
- `src/ai/speechProviders.ts`: add ordinary player voice guidance, repair guidance, validation, and profile-shaped fallback.
- `src/ai/speechProviders.test.ts`: verify first-person prompt, jargon repair, low-info peace-night handling, non-repeating later seats, and fallback mouth.
- `package.json`: add an audit script only if useful after the scanner is created.
- `feature_list.json`, `progress.md`, `session-handoff.md`, and a new task card after implementation begins.

---

### Task 1: Ordinary Player Profile Model

**Files:**
- Modify: `src/game/types.ts`
- Create: `src/game/ordinaryPlayerProfiles.ts`
- Create/Modify Test: `src/game/ordinaryPlayerProfiles.test.ts`
- Modify Test: `src/game/aiFriends.test.ts`

- [ ] **Step 1: Write failing type/model tests**

Create `src/game/ordinaryPlayerProfiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAiPersonaById } from "./personas";
import {
  ORDINARY_PLAYER_TYPE_PRESETS,
  applyOrdinaryPlayerTypePreset,
  inferOrdinaryPlayerTypeId,
  ordinaryPlayerProfileSummary,
  sanitizeOrdinaryPlayerProfile,
} from "./ordinaryPlayerProfiles";
import { copyAiFriend, getDefaultAiFriends } from "./aiFriends";

describe("ordinary player profiles", () => {
  it("defines stable route-player presets with readable labels", () => {
    expect(Object.keys(ORDINARY_PLAYER_TYPE_PRESETS)).toEqual([
      "impatient-pusher",
      "cautious-backpacker",
      "one-line-catcher",
      "soft-follower",
      "role-sensitive",
      "quiet-watcher",
      "emotional-reactor",
      "pivot-admitter",
    ]);
    expect(ORDINARY_PLAYER_TYPE_PRESETS["one-line-catcher"].label).toBe("爱抓一句话");
    expect(ORDINARY_PLAYER_TYPE_PRESETS["cautious-backpacker"].sliders.caution).toBeGreaterThan(0.7);
  });

  it("sanitizes invalid profile values without losing a valid player type", () => {
    const sanitized = sanitizeOrdinaryPlayerProfile({
      playerTypeId: "one-line-catcher",
      sliders: {
        directness: 2,
        emotion: -1,
        speechLength: 0.2,
        questionBias: 0.9,
        factBias: 0.8,
        identityBias: 0.6,
        voteBias: 0.4,
        memoryBias: 0.7,
        nightAggression: 1.4,
        voteFollow: -0.2,
        deception: 0.5,
        caution: 0.3,
      },
    });

    expect(sanitized.playerTypeId).toBe("one-line-catcher");
    expect(sanitized.sliders.directness).toBe(1);
    expect(sanitized.sliders.emotion).toBe(0);
    expect(sanitized.sliders.nightAggression).toBe(1);
    expect(sanitized.sliders.voteFollow).toBe(0);
  });

  it("infers legacy tuning into a route-player type", () => {
    const persona = getAiPersonaById("gemini-quiet-observer")!;
    const inferred = inferOrdinaryPlayerTypeId({
      riskTolerance: persona.riskTolerance,
      bluffing: persona.bluffing,
      preferences: persona.preferences!,
    });

    expect(inferred).toBe("quiet-watcher");
  });

  it("applies a preset while preserving the friend identity and model config", () => {
    const source = copyAiFriend(getDefaultAiFriends("test")[0], {
      id: "friend-one-line",
      now: "2026-06-08T00:00:00.000Z",
    });
    const updated = applyOrdinaryPlayerTypePreset(source, "one-line-catcher");

    expect(updated.id).toBe("friend-one-line");
    expect(updated.basePersonaId).toBe(source.basePersonaId);
    expect(updated.ordinaryPlayerProfile?.playerTypeId).toBe("one-line-catcher");
    expect(updated.preferences.memory).toBeGreaterThan(0.65);
    expect(ordinaryPlayerProfileSummary(updated.ordinaryPlayerProfile)).toContain("爱抓一句话");
  });
});
```

Add to `src/game/aiFriends.test.ts`:

```ts
it("gives default friends stable ordinary player types independent of model labels", () => {
  const friends = getDefaultAiFriends("test");

  expect(friends.map((friend) => friend.ordinaryPlayerProfile?.playerTypeId)).toEqual([
    "one-line-catcher",
    "cautious-backpacker",
    "soft-follower",
    "impatient-pusher",
    "pivot-admitter",
    "quiet-watcher",
    "emotional-reactor",
    "role-sensitive",
  ]);
});

it("round-trips ordinary player profiles through AI friend export", () => {
  const custom = {
    ...copyAiFriend(getDefaultAiFriends("test")[0], {
      id: "friend-profile",
      now: "2026-06-08T00:00:00.000Z",
    }),
    ordinaryPlayerProfile: {
      playerTypeId: "emotional-reactor" as const,
      sliders: {
        directness: 0.78,
        emotion: 0.86,
        speechLength: 0.45,
        questionBias: 0.7,
        factBias: 0.42,
        identityBias: 0.44,
        voteBias: 0.52,
        memoryBias: 0.48,
        nightAggression: 0.64,
        voteFollow: 0.36,
        deception: 0.5,
        caution: 0.24,
      },
    },
  };

  const imported = parseAiFriendExport(serializeAiFriendExport([custom]));
  const resolved = resolveAiFriendsForGame(imported, 1);

  expect(imported[0]?.ordinaryPlayerProfile?.playerTypeId).toBe("emotional-reactor");
  expect(resolved[0]?.persona.ordinaryPlayerProfile?.playerTypeId).toBe("emotional-reactor");
});
```

- [ ] **Step 2: Run model tests and verify they fail**

Run:

```powershell
npm run test -- src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.test.ts
```

Expected: FAIL because `ordinaryPlayerProfiles.ts`, `ordinaryPlayerProfile`, and helper exports do not exist.

- [ ] **Step 3: Add ordinary player profile types**

In `src/game/types.ts`, add after `AiPersonaPreferences`:

```ts
export type AiOrdinaryPlayerTypeId =
  | "impatient-pusher"
  | "cautious-backpacker"
  | "one-line-catcher"
  | "soft-follower"
  | "role-sensitive"
  | "quiet-watcher"
  | "emotional-reactor"
  | "pivot-admitter";

export type AiOrdinaryPlayerProfileSliders = {
  directness: number;
  emotion: number;
  speechLength: number;
  questionBias: number;
  factBias: number;
  identityBias: number;
  voteBias: number;
  memoryBias: number;
  nightAggression: number;
  voteFollow: number;
  deception: number;
  caution: number;
};

export type AiOrdinaryPlayerProfile = {
  playerTypeId: AiOrdinaryPlayerTypeId;
  sliders: AiOrdinaryPlayerProfileSliders;
};
```

In `AiFriendConfig`, add:

```ts
  ordinaryPlayerProfile?: AiOrdinaryPlayerProfile;
```

In `AiFriendSeatSetup`, add:

```ts
  ordinaryPlayerProfile?: AiOrdinaryPlayerProfile;
```

In `AiPersona`, add:

```ts
  ordinaryPlayerProfile?: AiOrdinaryPlayerProfile;
```

- [ ] **Step 4: Create ordinary player profile helpers**

Create `src/game/ordinaryPlayerProfiles.ts`:

```ts
import type {
  AiFriendConfig,
  AiOrdinaryPlayerProfile,
  AiOrdinaryPlayerProfileSliders,
  AiOrdinaryPlayerTypeId,
  AiPersonaPreferences,
} from "./types";

type OrdinaryPlayerTypePreset = {
  id: AiOrdinaryPlayerTypeId;
  label: string;
  shortLabel: string;
  summary: string;
  speechCue: string;
  reasoningCue: string;
  actionCue: string;
  sliders: AiOrdinaryPlayerProfileSliders;
};

const UNIT_KEYS: Array<keyof AiOrdinaryPlayerProfileSliders> = [
  "directness",
  "emotion",
  "speechLength",
  "questionBias",
  "factBias",
  "identityBias",
  "voteBias",
  "memoryBias",
  "nightAggression",
  "voteFollow",
  "deception",
  "caution",
];

export const ORDINARY_PLAYER_TYPE_PRESETS: Record<AiOrdinaryPlayerTypeId, OrdinaryPlayerTypePreset> = {
  "impatient-pusher": {
    id: "impatient-pusher",
    label: "急性子冲票型",
    shortLabel: "急性子",
    summary: "说话直接，容易先怀疑一个人，投票偏激进。",
    speechCue: "短句直接，说出自己卡谁，不绕成复盘报告。",
    reasoningCue: "优先看刚刚发生的发言反应和当前投票压力。",
    actionCue: "白天更敢压票，夜晚更愿意处理公开威胁。",
    sliders: {
      directness: 0.86,
      emotion: 0.72,
      speechLength: 0.42,
      questionBias: 0.68,
      factBias: 0.48,
      identityBias: 0.44,
      voteBias: 0.74,
      memoryBias: 0.42,
      nightAggression: 0.78,
      voteFollow: 0.38,
      deception: 0.56,
      caution: 0.18,
    },
  },
  "cautious-backpacker": {
    id: "cautious-backpacker",
    label: "谨慎怕背锅型",
    shortLabel: "谨慎位",
    summary: "经常保留判断，怕投错，会要求别人先说清楚。",
    speechCue: "可以犹豫，但必须说明哪句话没听懂。",
    reasoningCue: "优先找硬公开事实，软状态只做保留。",
    actionCue: "投票和夜间动作偏保守，改票需要公开新增理由。",
    sliders: {
      directness: 0.38,
      emotion: 0.28,
      speechLength: 0.58,
      questionBias: 0.54,
      factBias: 0.74,
      identityBias: 0.56,
      voteBias: 0.48,
      memoryBias: 0.6,
      nightAggression: 0.28,
      voteFollow: 0.44,
      deception: 0.32,
      caution: 0.88,
    },
  },
  "one-line-catcher": {
    id: "one-line-catcher",
    label: "爱抓一句话",
    shortLabel: "抓话位",
    summary: "会盯住某句没听懂的话追问，但不能无限复读。",
    speechCue: "引用一句具体话，再说自己为什么没听明白。",
    reasoningCue: "优先看前后两句话是否自然，不铺全桌。",
    actionCue: "行动倾向延续自己抓过的具体矛盾。",
    sliders: {
      directness: 0.64,
      emotion: 0.44,
      speechLength: 0.5,
      questionBias: 0.86,
      factBias: 0.66,
      identityBias: 0.48,
      voteBias: 0.54,
      memoryBias: 0.82,
      nightAggression: 0.46,
      voteFollow: 0.34,
      deception: 0.42,
      caution: 0.56,
    },
  },
  "soft-follower": {
    id: "soft-follower",
    label: "容易跟风型",
    shortLabel: "跟风位",
    summary: "会受前面发言影响，但需要能解释为什么跟或改口。",
    speechCue: "可以承认被前面的人影响，但要说哪句话影响了自己。",
    reasoningCue: "优先看多数压力里有没有自己也听懂的理由。",
    actionCue: "更容易跟进成形票型，但不能无理由跟票。",
    sliders: {
      directness: 0.46,
      emotion: 0.46,
      speechLength: 0.48,
      questionBias: 0.42,
      factBias: 0.52,
      identityBias: 0.5,
      voteBias: 0.7,
      memoryBias: 0.48,
      nightAggression: 0.42,
      voteFollow: 0.82,
      deception: 0.46,
      caution: 0.52,
    },
  },
  "role-sensitive": {
    id: "role-sensitive",
    label: "身份信息敏感型",
    shortLabel: "身份敏感",
    summary: "更重视预言家、女巫、银水、查杀和对跳。",
    speechCue: "围绕公开身份信息说清自己认不认、为什么暂时认或不认。",
    reasoningCue: "优先处理公开身份声明、查验结果和银水反应。",
    actionCue: "投票和夜晚动作更看重身份信息带来的价值。",
    sliders: {
      directness: 0.58,
      emotion: 0.34,
      speechLength: 0.54,
      questionBias: 0.56,
      factBias: 0.62,
      identityBias: 0.92,
      voteBias: 0.58,
      memoryBias: 0.72,
      nightAggression: 0.52,
      voteFollow: 0.46,
      deception: 0.5,
      caution: 0.58,
    },
  },
  "quiet-watcher": {
    id: "quiet-watcher",
    label: "低调观察型",
    shortLabel: "观察位",
    summary: "发言短，不急着打死别人，但必须留下一个真实疑惑。",
    speechCue: "短发言，少站死，留下一个能回看的具体疑惑。",
    reasoningCue: "优先收集信息，不把软感觉当铁证。",
    actionCue: "行动偏稳，只有公开理由够清楚才明显转向。",
    sliders: {
      directness: 0.34,
      emotion: 0.26,
      speechLength: 0.3,
      questionBias: 0.44,
      factBias: 0.6,
      identityBias: 0.54,
      voteBias: 0.42,
      memoryBias: 0.66,
      nightAggression: 0.3,
      voteFollow: 0.46,
      deception: 0.38,
      caution: 0.86,
    },
  },
  "emotional-reactor": {
    id: "emotional-reactor",
    label: "情绪反应型",
    shortLabel: "情绪位",
    summary: "容易对离谱发言急、不满或犹豫，但不能把情绪当铁证。",
    speechCue: "可以有不满和困惑，但要把情绪落到一句公开话上。",
    reasoningCue: "优先看即时反应、态度变化和防守姿态。",
    actionCue: "更容易压反应差的位置，夜间更愿意处理强压迫位。",
    sliders: {
      directness: 0.72,
      emotion: 0.88,
      speechLength: 0.46,
      questionBias: 0.62,
      factBias: 0.42,
      identityBias: 0.44,
      voteBias: 0.56,
      memoryBias: 0.42,
      nightAggression: 0.66,
      voteFollow: 0.34,
      deception: 0.58,
      caution: 0.24,
    },
  },
  "pivot-admitter": {
    id: "pivot-admitter",
    label: "临场改口型",
    shortLabel: "改口位",
    summary: "能承认自己刚才想错了，用新公开信息说明为什么转向。",
    speechCue: "自然承认想法变化，说出哪条新信息让自己改口。",
    reasoningCue: "优先看前后变化、站边转向和新增公开信息。",
    actionCue: "允许转票，但必须说明公开证据为什么变硬。",
    sliders: {
      directness: 0.56,
      emotion: 0.5,
      speechLength: 0.56,
      questionBias: 0.58,
      factBias: 0.62,
      identityBias: 0.56,
      voteBias: 0.64,
      memoryBias: 0.84,
      nightAggression: 0.48,
      voteFollow: 0.52,
      deception: 0.5,
      caution: 0.5,
    },
  },
};

export function defaultOrdinaryPlayerProfile(typeId: AiOrdinaryPlayerTypeId): AiOrdinaryPlayerProfile {
  const preset = ORDINARY_PLAYER_TYPE_PRESETS[typeId];
  return {
    playerTypeId: preset.id,
    sliders: { ...preset.sliders },
  };
}

export function sanitizeOrdinaryPlayerProfile(value: unknown, fallbackTypeId: AiOrdinaryPlayerTypeId = "soft-follower"): AiOrdinaryPlayerProfile {
  const record = isRecord(value) ? value : {};
  const requestedTypeId = typeof record.playerTypeId === "string" && isOrdinaryPlayerTypeId(record.playerTypeId)
    ? record.playerTypeId
    : fallbackTypeId;
  const fallback = defaultOrdinaryPlayerProfile(requestedTypeId);
  const rawSliders = isRecord(record.sliders) ? record.sliders : {};
  const sliders = UNIT_KEYS.reduce((next, key) => {
    next[key] = clampUnit(rawSliders[key], fallback.sliders[key]);
    return next;
  }, {} as AiOrdinaryPlayerProfileSliders);
  return { playerTypeId: requestedTypeId, sliders };
}

export function inferOrdinaryPlayerTypeId(input: {
  riskTolerance: number;
  bluffing: number;
  preferences: AiPersonaPreferences;
}): AiOrdinaryPlayerTypeId {
  if (input.preferences.emotion >= 0.78 && input.riskTolerance >= 0.6) return "emotional-reactor";
  if (input.preferences.identity >= 0.82) return "role-sensitive";
  if (input.preferences.memory >= 0.78 && input.preferences.logic >= 0.65) return "one-line-catcher";
  if (input.preferences.memory >= 0.76) return "pivot-admitter";
  if (input.preferences.caution >= 0.78 && input.riskTolerance <= 0.35) return "quiet-watcher";
  if (input.preferences.caution >= 0.68) return "cautious-backpacker";
  if (input.riskTolerance >= 0.72 || input.preferences.leadership >= 0.75) return "impatient-pusher";
  return "soft-follower";
}

export function applyOrdinaryPlayerTypePreset(friend: AiFriendConfig, typeId: AiOrdinaryPlayerTypeId): AiFriendConfig {
  const profile = defaultOrdinaryPlayerProfile(typeId);
  return {
    ...friend,
    ordinaryPlayerProfile: profile,
    riskTolerance: profile.sliders.nightAggression * 0.55 + profile.sliders.directness * 0.45,
    bluffing: profile.sliders.deception,
    preferences: {
      logic: profile.sliders.factBias,
      identity: profile.sliders.identityBias,
      vote: profile.sliders.voteBias,
      emotion: profile.sliders.emotion,
      memory: profile.sliders.memoryBias,
      leadership: profile.sliders.directness,
      deception: profile.sliders.deception,
      caution: profile.sliders.caution,
    },
  };
}

export function ordinaryPlayerProfileSummary(profile: AiOrdinaryPlayerProfile | undefined): string {
  const safe = sanitizeOrdinaryPlayerProfile(profile);
  const preset = ORDINARY_PLAYER_TYPE_PRESETS[safe.playerTypeId];
  return `${preset.label}：${preset.summary}`;
}

export function isOrdinaryPlayerTypeId(value: string): value is AiOrdinaryPlayerTypeId {
  return Object.prototype.hasOwnProperty.call(ORDINARY_PLAYER_TYPE_PRESETS, value);
}

function clampUnit(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 5: Wire model helpers into AI friend defaults**

In `src/game/aiFriends.ts`, import the new helpers:

```ts
import {
  defaultOrdinaryPlayerProfile,
  inferOrdinaryPlayerTypeId,
  sanitizeOrdinaryPlayerProfile,
} from "./ordinaryPlayerProfiles";
```

Add a default type mapping near constants:

```ts
const DEFAULT_ORDINARY_PLAYER_TYPES = [
  "one-line-catcher",
  "cautious-backpacker",
  "soft-follower",
  "impatient-pusher",
  "pivot-admitter",
  "quiet-watcher",
  "emotional-reactor",
  "role-sensitive",
] as const;
```

In `getDefaultAiFriends`, include:

```ts
ordinaryPlayerProfile: defaultOrdinaryPlayerProfile(DEFAULT_ORDINARY_PLAYER_TYPES[index] ?? "soft-follower"),
```

Use this implementation shape:

```ts
export function getDefaultAiFriends(now = "built-in"): AiFriendConfig[] {
  return getAiRoster().map((persona, index) => ({
    id: `${DEFAULT_AI_FRIEND_ID_PREFIX}${persona.id}`,
    nickname: persona.name,
    basePersonaId: persona.id,
    ordinaryPlayerProfile: defaultOrdinaryPlayerProfile(DEFAULT_ORDINARY_PLAYER_TYPES[index] ?? "soft-follower"),
    riskTolerance: persona.riskTolerance,
    bluffing: persona.bluffing,
    preferences: normalizePreferences(persona.preferences),
    createdAt: now,
    updatedAt: now,
  }));
}
```

In `applyAiFriendPersonaTemplate`, preserve or infer ordinary profile:

```ts
ordinaryPlayerProfile:
  friend.ordinaryPlayerProfile ??
  defaultOrdinaryPlayerProfile(
    inferOrdinaryPlayerTypeId({
      riskTolerance: basePersona.riskTolerance,
      bluffing: basePersona.bluffing,
      preferences: normalizePreferences(basePersona.preferences),
    }),
  ),
```

In `sanitizeAiFriendConfig`, add:

```ts
const basePreferences = normalizePreferences(basePersona.preferences);
const fallbackType = inferOrdinaryPlayerTypeId({
  riskTolerance: clampUnit(value.riskTolerance, basePersona.riskTolerance),
  bluffing: clampUnit(value.bluffing, basePersona.bluffing),
  preferences: normalizePreferences(isRecord(value.preferences) ? value.preferences : basePreferences),
});
```

Then include:

```ts
ordinaryPlayerProfile: sanitizeOrdinaryPlayerProfile(value.ordinaryPlayerProfile, fallbackType),
```

In `buildAiPersonaFromFriend`, include:

```ts
ordinaryPlayerProfile: sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile),
```

In `resolveAiFriendsForGame().setup`, include:

```ts
ordinaryPlayerProfile: config.ordinaryPlayerProfile,
```

- [ ] **Step 6: Run Task 1 tests**

Run:

```powershell
npm run test -- src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- src/game/types.ts src/game/ordinaryPlayerProfiles.ts src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.ts src/game/aiFriends.test.ts
git commit -m "feat: add ordinary ai player profiles"
```

---

### Task 2: AI Pool Presets And Slider Surface

**Files:**
- Modify: `src/components/game/clientTypes.ts`
- Modify: `src/components/game/aiFriendStorage.ts`
- Modify: `src/components/AiPoolClient.tsx`
- Modify Test: `src/components/AiPoolClient.mobile.test.ts`
- Modify Test: `src/game/aiFriends.test.ts`

- [ ] **Step 1: Write failing UI/storage tests**

In `src/components/AiPoolClient.mobile.test.ts`, add:

```ts
it("shows ordinary player type controls with readable route-player labels", () => {
  const source = readAiPoolClientSource();

  expect(source).toContain("普通局玩家类型");
  expect(source).toContain("急性子冲票型");
  expect(source).toContain("谨慎怕背锅型");
  expect(source).toContain("说话方式");
  expect(source).toContain("思考偏好");
  expect(source).toContain("行动策略");
});

it("keeps model labels separate from ordinary player type labels", () => {
  const source = readAiPoolClientSource();

  expect(source).toContain("模型只决定调用接口");
  expect(source).toContain("玩家类型决定发言和打法");
  expect(source).not.toContain("DeepSeek 冷静事实派");
});
```

In `src/game/aiFriends.test.ts`, add:

```ts
it("copies ordinary player profiles when saving editable friend config", () => {
  const source = getDefaultAiFriends("test")[0]!;
  const copy = copyAiFriend(source, { id: "friend-copy-profile", now: "2026-06-08T00:00:00.000Z" });

  expect(copy.ordinaryPlayerProfile).toEqual(source.ordinaryPlayerProfile);
});
```

- [ ] **Step 2: Run UI/storage tests and verify they fail**

Run:

```powershell
npm run test -- src/components/AiPoolClient.mobile.test.ts src/game/aiFriends.test.ts
```

Expected: FAIL because the UI source does not yet include ordinary player type labels and copy/save paths do not preserve every profile field.

- [ ] **Step 3: Extend AI friend option shape**

In `src/components/game/clientTypes.ts`, add fields to `AiFriendOption`:

```ts
  ordinaryPlayerProfile?: AiOrdinaryPlayerProfile;
  ordinaryPlayerTypeLabel: string;
  ordinaryPlayerTypeSummary: string;
```

Import `AiOrdinaryPlayerProfile` from `@/game/types`.

In `src/components/game/aiFriendStorage.ts`, import:

```ts
import { ordinaryPlayerProfileSummary, ORDINARY_PLAYER_TYPE_PRESETS, sanitizeOrdinaryPlayerProfile } from "@/game/ordinaryPlayerProfiles";
```

In `toAiFriendOption`, add:

```ts
const ordinaryProfile = sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile);
const ordinaryPreset = ORDINARY_PLAYER_TYPE_PRESETS[ordinaryProfile.playerTypeId];
```

Then return:

```ts
ordinaryPlayerProfile: ordinaryProfile,
ordinaryPlayerTypeLabel: ordinaryPreset.label,
ordinaryPlayerTypeSummary: ordinaryPlayerProfileSummary(ordinaryProfile),
```

- [ ] **Step 4: Preserve ordinary profiles in existing save paths**

In `src/components/AiPoolClient.tsx`, every local `nextFriend: AiFriendConfig = { ... }` created from a `friend` must include:

```ts
ordinaryPlayerProfile: friend.ordinaryPlayerProfile,
```

Apply this to these save/copy-like paths:

- `saveAiFriendLlmConfig`
- `saveAiFriendTtsConfig`
- `saveAiFriendAvatar`
- quick-add custom friend creation when it copies a source friend
- any `updateCustomAiFriend` patch path that constructs a full config object

- [ ] **Step 5: Add ordinary profile controls**

In `src/components/AiPoolClient.tsx`, import:

```ts
import {
  ORDINARY_PLAYER_TYPE_PRESETS,
  applyOrdinaryPlayerTypePreset,
  sanitizeOrdinaryPlayerProfile,
} from "@/game/ordinaryPlayerProfiles";
```

Add helper:

```tsx
function OrdinaryPlayerProfilePanel({
  friend,
  onApplyPreset,
  onPatchSliders,
}: {
  friend: AiFriendOption;
  onApplyPreset: (typeId: keyof typeof ORDINARY_PLAYER_TYPE_PRESETS) => void;
  onPatchSliders: (sliders: Partial<NonNullable<AiFriendOption["ordinaryPlayerProfile"]>["sliders"]>) => void;
}) {
  const profile = sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile);
  const preset = ORDINARY_PLAYER_TYPE_PRESETS[profile.playerTypeId];
  return (
    <section className="mobile-ai-ordinary-profile mt-3 rounded-2xl border border-[#77d898]/14 bg-[#0f2118]/36 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-[#a8f0b6]">普通局玩家类型</h3>
        <span className="text-[11px] text-[#a8f0b6]/66">模型只决定调用接口，玩家类型决定发言和打法</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(ORDINARY_PLAYER_TYPE_PRESETS).map((option) => (
          <button
            key={option.id}
            type="button"
            className={`rounded-2xl border px-3 py-2 text-left ${option.id === profile.playerTypeId ? "border-[#77d898]/34 bg-[#10291d]/78" : "border-[#77d898]/10 bg-black/16"}`}
            onClick={() => onApplyPreset(option.id)}
            aria-pressed={option.id === profile.playerTypeId}
          >
            <div className="text-xs font-semibold text-[#d9ffe2]">{option.label}</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#a8f0b6]/76">{option.summary}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3">
        <SliderControl label="说话方式" value={profile.sliders.directness} onChange={(value) => onPatchSliders({ directness: value })} />
        <SliderControl label="情绪强度" value={profile.sliders.emotion} onChange={(value) => onPatchSliders({ emotion: value })} />
        <SliderControl label="追问倾向" value={profile.sliders.questionBias} onChange={(value) => onPatchSliders({ questionBias: value })} />
        <SliderControl label="思考偏好" value={profile.sliders.factBias} onChange={(value) => onPatchSliders({ factBias: value })} />
        <SliderControl label="行动策略" value={profile.sliders.nightAggression} onChange={(value) => onPatchSliders({ nightAggression: value })} />
      </div>
      <p className="mt-2 text-xs leading-5 text-[#a8f0b6]/78">{preset.speechCue} {preset.actionCue}</p>
    </section>
  );
}

function SliderControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs text-[#dcc9a7]">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full accent-[#77d898]"
      />
    </label>
  );
}
```

Wire callbacks near existing AI friend update helpers:

```ts
const applyOrdinaryPlayerPresetToFriend = useCallback(
  (friend: AiFriendOption, typeId: keyof typeof ORDINARY_PLAYER_TYPE_PRESETS) => {
    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const next = applyOrdinaryPlayerTypePreset(
      {
        ...friend,
        id: targetId,
        createdAt: friend.isDefault ? new Date().toISOString() : friend.createdAt,
        updatedAt: new Date().toISOString(),
      },
      typeId,
    );
    setCustomAiFriends((current) => [...current.filter((item) => item.id !== targetId && item.id !== friend.id), next]);
    setSelectedAiFriendIds((current) => current.map((id) => (id === friend.id ? targetId : id)));
  },
  [],
);

const patchOrdinaryPlayerSliders = useCallback((friend: AiFriendOption, sliders: Partial<NonNullable<AiFriendOption["ordinaryPlayerProfile"]>["sliders"]>) => {
  const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
  const profile = sanitizeOrdinaryPlayerProfile(friend.ordinaryPlayerProfile);
  const nextFriend: AiFriendConfig = {
    ...friend,
    id: targetId,
    ordinaryPlayerProfile: {
      ...profile,
      sliders: {
        ...profile.sliders,
        ...sliders,
      },
    },
    createdAt: friend.isDefault ? new Date().toISOString() : friend.createdAt,
    updatedAt: new Date().toISOString(),
  };
  setCustomAiFriends((current) => [...current.filter((item) => item.id !== targetId && item.id !== friend.id), nextFriend]);
  setSelectedAiFriendIds((current) => current.map((id) => (id === friend.id ? targetId : id)));
}, []);
```

Render `OrdinaryPlayerProfilePanel` inside each AI config panel, near the current strategy card section:

```tsx
<OrdinaryPlayerProfilePanel
  friend={friend}
  onApplyPreset={(typeId) => applyOrdinaryPlayerPresetToFriend(friend, typeId)}
  onPatchSliders={(sliders) => patchOrdinaryPlayerSliders(friend, sliders)}
/>
```

- [ ] **Step 6: Run Task 2 tests**

Run:

```powershell
npm run test -- src/components/AiPoolClient.mobile.test.ts src/game/aiFriends.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- src/components/game/clientTypes.ts src/components/game/aiFriendStorage.ts src/components/AiPoolClient.tsx src/components/AiPoolClient.mobile.test.ts src/game/aiFriends.test.ts
git commit -m "feat: expose ordinary ai player controls"
```

---

### Task 3: Single-Player And Room AI Config Consistency

**Files:**
- Modify: `src/app/api/games/route.ts`
- Modify Test: `src/app/api/games/aiFriends.test.ts`
- Modify: `src/components/RoomClient.tsx`
- Modify: `src/server/roomService.ts`
- Modify Test: `src/app/api/rooms/api.test.ts`

- [ ] **Step 1: Write failing API and room tests**

In `src/app/api/games/aiFriends.test.ts`, add:

```ts
it("accepts ordinary player profiles and exposes safe setup metadata", async () => {
  const response = await POST(
    new Request("http://localhost/api/games", {
      method: "POST",
      body: JSON.stringify({
        boardId: "9p-seer-witch-hunter",
        humanSeatId: null,
        aiFriends: [
          {
            id: "friend-ordinary-profile",
            nickname: "抓话玩家",
            basePersonaId: "deepseek-calm-analyst",
            riskTolerance: 0.5,
            bluffing: 0.4,
            preferences: {
              logic: 0.7,
              identity: 0.5,
              vote: 0.5,
              emotion: 0.4,
              memory: 0.8,
              leadership: 0.4,
              deception: 0.3,
              caution: 0.6,
            },
            ordinaryPlayerProfile: {
              playerTypeId: "one-line-catcher",
              sliders: {
                directness: 0.64,
                emotion: 0.44,
                speechLength: 0.5,
                questionBias: 0.86,
                factBias: 0.66,
                identityBias: 0.48,
                voteBias: 0.54,
                memoryBias: 0.82,
                nightAggression: 0.46,
                voteFollow: 0.34,
                deception: 0.42,
                caution: 0.56,
              },
            },
            createdAt: "2026-06-08T00:00:00.000Z",
            updatedAt: "2026-06-08T00:00:00.000Z",
          },
        ],
      }),
    }),
  );

  expect(response.status).toBe(200);
  const view = await response.json();
  expect(view.setup.aiFriends[0].ordinaryPlayerProfile.playerTypeId).toBe("one-line-catcher");
  expect(view.seats.find((seat: { name: string }) => seat.name === "抓话玩家")?.personaLabel).toBeTruthy();
});
```

In `src/app/api/rooms/api.test.ts`, add:

```ts
it("starts room games with the same ordinary AI friend profiles used by single-player", async () => {
  const createdResponse = await createRoom(
    new Request("http://localhost/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        boardId: "9p-seer-witch-hunter",
        hostName: "Host",
        hostSeatId: 1,
        aiFriends: [
          {
            id: "friend-room-profile",
            nickname: "房间抓话玩家",
            basePersonaId: "deepseek-calm-analyst",
            riskTolerance: 0.5,
            bluffing: 0.4,
            preferences: {
              logic: 0.7,
              identity: 0.5,
              vote: 0.5,
              emotion: 0.4,
              memory: 0.8,
              leadership: 0.4,
              deception: 0.3,
              caution: 0.6,
            },
            ordinaryPlayerProfile: {
              playerTypeId: "one-line-catcher",
              sliders: {
                directness: 0.64,
                emotion: 0.44,
                speechLength: 0.5,
                questionBias: 0.86,
                factBias: 0.66,
                identityBias: 0.48,
                voteBias: 0.54,
                memoryBias: 0.82,
                nightAggression: 0.46,
                voteFollow: 0.34,
                deception: 0.42,
                caution: 0.56,
              },
            },
            createdAt: "2026-06-08T00:00:00.000Z",
            updatedAt: "2026-06-08T00:00:00.000Z",
          },
        ],
      }),
    }),
  );
  const created = await createdResponse.json();

  const startedResponse = await startRoom(
    new Request(`http://localhost/api/rooms/${created.room.id}/start`, {
      method: "POST",
      body: JSON.stringify({
        expectedRevision: created.room.revision,
        playerId: created.playerId,
        playerToken: created.playerToken,
      }),
    }),
    { params: Promise.resolve({ roomId: created.room.id }) },
  );
  const started = await startedResponse.json();

  expect(started.game.setup.aiFriends[0].ordinaryPlayerProfile.playerTypeId).toBe("one-line-catcher");
  expect(started.game.seats.some((seat: { name: string }) => seat.name === "房间抓话玩家")).toBe(true);
});
```

- [ ] **Step 2: Run API/room tests and verify they fail**

Run:

```powershell
npm run test -- src/app/api/games/aiFriends.test.ts src/app/api/rooms/api.test.ts
```

Expected: FAIL because route schemas and room client/service do not fully accept or propagate `ordinaryPlayerProfile`.

- [ ] **Step 3: Update game API schema**

In `src/app/api/games/route.ts`, add:

```ts
const ordinaryPlayerProfileSchema = z.object({
  playerTypeId: z.enum([
    "impatient-pusher",
    "cautious-backpacker",
    "one-line-catcher",
    "soft-follower",
    "role-sensitive",
    "quiet-watcher",
    "emotional-reactor",
    "pivot-admitter",
  ]),
  sliders: z.object({
    directness: z.number().min(0).max(1),
    emotion: z.number().min(0).max(1),
    speechLength: z.number().min(0).max(1),
    questionBias: z.number().min(0).max(1),
    factBias: z.number().min(0).max(1),
    identityBias: z.number().min(0).max(1),
    voteBias: z.number().min(0).max(1),
    memoryBias: z.number().min(0).max(1),
    nightAggression: z.number().min(0).max(1),
    voteFollow: z.number().min(0).max(1),
    deception: z.number().min(0).max(1),
    caution: z.number().min(0).max(1),
  }),
});
```

Inside the existing `aiFriends` item schema, add:

```ts
ordinaryPlayerProfile: ordinaryPlayerProfileSchema.optional(),
```

- [ ] **Step 4: Send AI friends when creating rooms**

In `src/components/RoomClient.tsx`, import:

```ts
import {
  buildRuntimeAiLlmConfigs,
  readStoredAiFriendLlmSecrets,
  readStoredAiRuntimeMode,
  readStoredCustomAiFriends,
  readStoredSelectedAiFriendIds,
  resolveSelectedAiFriends,
  buildAiFriendOptions,
} from "./game/aiFriendStorage";
```

Add helper near room request helpers:

```ts
function readRoomAiFriendPayload() {
  const customAiFriends = readStoredCustomAiFriends();
  const aiFriends = buildAiFriendOptions(customAiFriends);
  const selectedAiFriendIds = readStoredSelectedAiFriendIds();
  const selectedAiFriends = resolveSelectedAiFriends(aiFriends, selectedAiFriendIds);
  const aiLlmSecrets = readStoredAiFriendLlmSecrets();
  return {
    aiFriends: selectedAiFriends,
    aiRuntimeMode: readStoredAiRuntimeMode(),
    runtimeAiLlmConfigs: buildRuntimeAiLlmConfigs(selectedAiFriends, aiLlmSecrets),
  };
}
```

In `handleCreateRoom`, change the request body:

```ts
const view = await postRoomView("/api/rooms", {
  boardId,
  hostName,
  hostSeatId: preferredSeatId,
  ...readRoomAiFriendPayload(),
});
```

- [ ] **Step 5: Make room route/service accept and persist AI friends**

If `src/app/api/rooms/route.ts` uses a schema that does not include AI friend fields, add the same `ordinaryPlayerProfileSchema` shape or reuse a route-safe schema from `src/app/api/games/route.ts` if it is exported cleanly.

In `src/server/roomService.ts`, `CreateRoomOptions` already has `aiFriends?: AiFriendConfig[]`; make sure `createRoomSession()` writes:

```ts
aiFriends: options.aiFriends,
```

and `startRoomSession()` already passes:

```ts
aiFriends: room.aiFriends,
```

If the room create route strips fields before `createRoomSession`, update it so `aiFriends`, `aiRuntimeMode`, and runtime LLM configs reach room creation and later room AI advancement. Keep secrets out of room views.

- [ ] **Step 6: Run Task 3 tests**

Run:

```powershell
npm run test -- src/app/api/games/aiFriends.test.ts src/app/api/rooms/api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- src/app/api/games/route.ts src/app/api/games/aiFriends.test.ts src/components/RoomClient.tsx src/server/roomService.ts src/app/api/rooms src/app/api/rooms/api.test.ts
git commit -m "feat: align room ai friend profiles with single player"
```

---

### Task 4: Player-Type Strategy In Table Read And Actions

**Files:**
- Modify: `src/ai/personaStrategyCards.ts`
- Modify Test: `src/ai/personaStrategyCards.test.ts`
- Modify: `src/ai/tableRead.ts`
- Modify Test: `src/ai/tableRead.test.ts`
- Modify: `src/ai/actionProviders.ts`
- Modify Test: `src/ai/actionProviders.test.ts`
- Modify: `src/ai/seatMemory.ts`
- Modify Test: `src/ai/seatMemory.test.ts`

- [ ] **Step 1: Write failing strategy/action tests**

In `src/ai/personaStrategyCards.test.ts`, change the model-name test into player-type behavior and add:

```ts
it("builds ordinary strategy from player type instead of model name stereotypes", () => {
  const persona = {
    ...getAiPersonaById("deepseek-calm-analyst")!,
    ordinaryPlayerProfile: {
      playerTypeId: "emotional-reactor" as const,
      sliders: {
        directness: 0.72,
        emotion: 0.88,
        speechLength: 0.46,
        questionBias: 0.62,
        factBias: 0.42,
        identityBias: 0.44,
        voteBias: 0.56,
        memoryBias: 0.42,
        nightAggression: 0.66,
        voteFollow: 0.34,
        deception: 0.58,
        caution: 0.24,
      },
    },
  };

  const card = inferPersonaStrategyCard({ persona });

  expect(card.summary).toContain("情绪反应型");
  expect(card.summary).not.toContain("逻辑链推演");
  expect(card.antiTemplateMoves.join(" ")).toContain("公开话");
});
```

In `src/ai/actionProviders.test.ts`, add:

```ts
it("describes ordinary player type in action input without model-name stereotypes", () => {
  const view = viewFixture({
    persona: {
      ...getAiPersonaById("deepseek-calm-analyst")!,
      ordinaryPlayerProfile: {
        playerTypeId: "impatient-pusher",
        sliders: {
          directness: 0.86,
          emotion: 0.72,
          speechLength: 0.42,
          questionBias: 0.68,
          factBias: 0.48,
          identityBias: 0.44,
          voteBias: 0.74,
          memoryBias: 0.42,
          nightAggression: 0.78,
          voteFollow: 0.38,
          deception: 0.56,
          caution: 0.18,
        },
      },
    },
  });
  const input = buildConstrainedActionInput(view, {
    tableRead: buildAiTableRead(view),
    fallbackCommand: { type: "vote", targetSeatId: 3 },
    votePlan: {
      target: { seatId: 3, name: "GPT" },
      reason: "3号刚才解释不清楚为什么转去打4号",
      confidence: 0.65,
      alternatives: [],
    },
  });

  const constraints = input.constraints.join("\n");
  expect(constraints).toContain("普通局玩家类型策略");
  expect(constraints).toContain("急性子冲票型");
  expect(constraints).toContain("合法候选");
  expect(constraints).not.toContain("模型人格策略");
});
```

In `src/ai/seatMemory.test.ts`, add:

```ts
it("stores ordinary public memory in table-player wording", () => {
  const next = updateAiSeatMemoryAfterDecision(
    {
      seatId: 2,
      day: 1,
      beliefs: [],
    },
    {
      view: viewFixture(),
      speechPlan: {
        kind: "pressure",
        target: { seatId: 4, name: "豆包" },
        stance: "4号这句没有说清楚为什么怀疑1号",
        targetSpeechStatus: "spoken",
        allowedInteraction: "review_spoken",
        speechMove: "pressure",
      },
    },
  );

  expect(next.liveIntentPublicReason).toContain("没说清楚");
  expect(next.liveIntentPublicReason).not.toMatch(/收益|闭合|发言链|publicReason|commitment|liveIntent/);
});
```

- [ ] **Step 2: Run strategy/action tests and verify they fail**

Run:

```powershell
npm run test -- src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts
```

Expected: FAIL because current strategy text is still model-persona oriented and still uses internal terms.

- [ ] **Step 3: Refactor persona strategy formatting**

In `src/ai/personaStrategyCards.ts`, import:

```ts
import { ORDINARY_PLAYER_TYPE_PRESETS, sanitizeOrdinaryPlayerProfile } from "@/game/ordinaryPlayerProfiles";
```

At the start of `inferPersonaStrategyCard`, add:

```ts
const profile = sanitizeOrdinaryPlayerProfile(persona.ordinaryPlayerProfile);
const preset = ORDINARY_PLAYER_TYPE_PRESETS[profile.playerTypeId];
return {
  id: `ordinary:${profile.playerTypeId}:${persona.id}`,
  modelName: persona.name,
  personaLabel: preset.label,
  summary: `${preset.label}：${preset.summary}`,
  temperament: [preset.shortLabel, profile.sliders.emotion >= 0.7 ? "情绪明显" : "情绪克制", profile.sliders.caution >= 0.7 ? "保守" : "敢给判断"],
  antiTemplateMoves: buildOrdinaryAntiTemplateMoves(preset.id),
  camp: buildCampStrategies(`${preset.label}：${preset.summary}`, buildOrdinaryAntiTemplateMoves(preset.id), {
    goodFailure: profile.sliders.caution >= 0.75 ? "太怕背锅，容易只保留不推进" : "容易把软怀疑说得太重",
    wolfFailure: profile.sliders.deception >= 0.65 ? "伪装过满，容易显得在控焦点" : "狼面太收，像在躲责任",
    powerFailure: "只报身份信息，没有说明今天怎么用这条信息投票或观察",
  }),
};
```

Add helper:

```ts
function buildOrdinaryAntiTemplateMoves(typeId: string): string[] {
  switch (typeId) {
    case "impatient-pusher":
      return ["直接说自己卡谁和原因", "把投票压力落到一句公开话上", "承认自己可能急但先给判断"];
    case "cautious-backpacker":
      return ["说出自己没听懂哪一句", "保留判断但给下一步看什么", "不把平安夜硬说成攻击理由"];
    case "one-line-catcher":
      return ["引用一句具体发言再追问", "只抓一个没听懂的转折", "如果前面已经问过就换成自己的疑惑"];
    case "soft-follower":
      return ["说明自己被哪句话影响", "跟票时说清楚自己听懂的理由", "改口时承认新信息改变判断"];
    case "role-sensitive":
      return ["把女巫银水查杀这些信息说成人话", "先说暂时认不认身份", "不把身份术语堆成复盘"];
    case "quiet-watcher":
      return ["短句留下一个真实疑惑", "不急着打死别人", "说清下一轮会看谁怎么接"];
    case "emotional-reactor":
      return ["把不满落到一句公开话", "先说自己为什么觉得别扭", "情绪不能替代证据"];
    case "pivot-admitter":
      return ["承认自己想法变了", "说清哪条新信息让自己转向", "投票转向必须给普通玩家能懂的理由"];
    default:
      return ["说清自己怀疑谁和为什么", "把内部判断改成牌桌口语", "不要复读前面同一个空问题"];
  }
}
```

Update `formatPersonaStrategyForPrompt` to avoid black jargon:

```ts
export function formatPersonaStrategyForPrompt(strategy: AdaptedPersonaStrategyCard): string {
  return [
    strategy.activeSummary,
    `说话习惯：${strategy.activeSpeechMotives.join("；")}`,
    `投票习惯：${strategy.activeVoteMotives.join("；")}`,
    `夜晚取舍：${strategy.activeNightMotives.join("；")}`,
    `本轮不要套模板：${strategy.antiTemplateMoves.join("；")}`,
    `容易犯的真实玩家错误：${strategy.activeFailureModes.join("；")}`,
  ].join("\n");
}
```

- [ ] **Step 4: Update action constraints wording**

In `src/ai/actionProviders.ts`, change ordinary constraints from:

```ts
constraints.push(`普通局模型人格策略：${formatPersonaStrategyForPrompt(personaStrategyCard)}`);
```

to:

```ts
constraints.push(`普通局玩家类型策略：${formatPersonaStrategyForPrompt(personaStrategyCard)}`);
constraints.push("普通局行动理由要像玩家自己说得出口的话：说清为什么投、为什么改口、为什么夜里处理这个目标，不要写收益来源、发言链、闭合、收口这些内部词。");
```

Keep the strict candidate legality lines unchanged.

- [ ] **Step 5: Naturalize seat memory wording**

In `src/ai/seatMemory.ts`, add:

```ts
function naturalizePublicMemoryLine(value: string): string {
  return cleanPublicMemoryLine(value)
    .replace(/收益来源/g, "为什么这么怀疑")
    .replace(/发言链/g, "前后说法")
    .replace(/闭合/g, "说清楚")
    .replace(/缺口/g, "没解释清楚的地方")
    .replace(/收口/g, "最后想投谁")
    .replace(/压力源/g, "让人开始怀疑他的点")
    .replace(/liveIntent|publicReason|commitment/g, "我自己的判断");
}
```

Use `naturalizePublicMemoryLine(...)` where `liveIntentPublicReason` and `liveIntentCommitment` are assigned.

- [ ] **Step 6: Run Task 4 tests**

Run:

```powershell
npm run test -- src/ai/personaStrategyCards.test.ts src/ai/tableRead.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- src/ai/personaStrategyCards.ts src/ai/personaStrategyCards.test.ts src/ai/tableRead.ts src/ai/tableRead.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/seatMemory.ts src/ai/seatMemory.test.ts
git commit -m "feat: drive ordinary ai decisions from player types"
```

---

### Task 5: Ordinary Speech Prompt, Repair, Validation, And Fallback

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Modify Test: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write failing speech tests**

In `src/ai/speechProviders.test.ts`, add tests near ordinary speech tests:

```ts
it("guides ordinary speech toward first-person route-player wording", () => {
  const view = viewFixture({
    day: 1,
    phase: "DAY_SPEECH",
    persona: {
      ...personaFixture("DeepSeek"),
      ordinaryPlayerProfile: {
        playerTypeId: "one-line-catcher",
        sliders: {
          directness: 0.64,
          emotion: 0.44,
          speechLength: 0.5,
          questionBias: 0.86,
          factBias: 0.66,
          identityBias: 0.48,
          voteBias: 0.54,
          memoryBias: 0.82,
          nightAggression: 0.46,
          voteFollow: 0.34,
          deception: 0.42,
          caution: 0.56,
        },
      },
    },
  });
  const input = buildConstrainedSpeechInput(view);
  const style = input.tablePlayerStyle.join("\n");

  expect(style).toContain("普通局玩家类型策略");
  expect(style).toContain("爱抓一句话");
  expect(style).toContain("第一人称");
  expect(style).toContain("普通玩家能听懂");
  expect(style).toContain("必要术语可以保留");
  expect(style).not.toContain("模型人格策略");
});

it("repairs stacked ordinary jargon before relying on fallback", async () => {
  const outputs = [
    JSON.stringify({
      speech: "我会看1号的收益来源和发言链有没有闭合，后面谁收口不清就压谁。",
    }),
    JSON.stringify({
      speech: "我没听懂1号为什么现在就怀疑4号。你如果要打4号，先说是哪句话让你不信。",
    }),
  ];
  const provider = createConstrainedLlmSpeechProvider({
    providerId: "test-speech",
    render: async () => outputs.shift()!,
  });
  const result = await provider.generateSpeech(viewFixture({ day: 1, phase: "DAY_SPEECH" }));

  expect(result.isFallback).toBe(false);
  expect(result.speech).toContain("没听懂");
  expect(result.speech).not.toMatch(/收益来源|发言链|闭合|收口|缺口|压力源/);
});

it("rejects ordinary global observer speeches", () => {
  const errors = validateRenderedSpeech(
    viewFixture({ day: 1, phase: "DAY_SPEECH" }),
    createSpeechPlan(viewFixture({ day: 1, phase: "DAY_SPEECH" })),
    "从全桌视角看，1号的发言链没有闭合，后置位都应该围绕这个压力源收口。",
  );

  expect(errors.join(" ")).toContain("普通局发言不要像全桌复盘");
});

it("keeps ordinary fallback in player-mouth wording", async () => {
  const provider = createConstrainedLlmSpeechProvider({
    providerId: "test-speech",
    render: async () => {
      throw new Error("provider unavailable");
    },
  });
  const result = await provider.generateSpeech(viewFixture({ day: 1, phase: "DAY_SPEECH" }));

  expect(result.isFallback).toBe(true);
  expect(result.speech).not.toMatch(/收益来源|发言链|闭合|收口|缺口|压力源|我先按公开信息盘/);
  expect(result.speech).toMatch(/我|听不懂|没听明白|先不站死|为什么|哪句/);
});
```

- [ ] **Step 2: Run speech tests and verify they fail**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ordinary speech toward first-person|stacked ordinary jargon|global observer|ordinary fallback"
```

Expected: FAIL because prompt/repair/fallback still allow model-strategy wording and black jargon.

- [ ] **Step 3: Add ordinary player-mouth guide**

In `src/ai/speechProviders.ts`, add:

```ts
function buildOrdinaryPlayerMouthGuide(view: AgentView): string | undefined {
  if (view.roleCard?.theme === "class-trial") return undefined;
  const strategy = adaptPersonaStrategyForView(view);
  return [
    `普通局玩家类型策略：${formatPersonaStrategyForPrompt(strategy)}`,
    "第一人称发言：只说我听到了什么、我现在怎么想、我想问谁什么；不要像裁判或复盘工具总结全桌。",
    "普通玩家能听懂：必要术语可以保留，例如平安夜、女巫、银水、对跳、查杀、金水、投票。",
    "把内部黑话换成口语：收益来源=为什么现在怀疑他；发言链/闭合=前后有没有说清楚；收口=最后想投谁；缺口=哪句话没解释清楚；压力源=让人开始怀疑他的点。",
    "本轮只讲一到两个真实想法：我怀疑谁、为什么怀疑、我想让谁回答什么。不要列第一第二第三，不要把每个人都审一遍。",
  ].join("\n");
}
```

In `buildSpeechConstraints`, replace ordinary `普通局模型人格策略` line with:

```ts
buildOrdinaryPlayerMouthGuide(view),
```

Keep class-trial role-card lines unchanged.

- [ ] **Step 4: Add ordinary jargon repair and observer validation**

Add helpers:

```ts
const ORDINARY_INTERNAL_JARGON_PATTERN = /收益来源|发言链|闭合|收口|缺口|压力源|全桌视角|从全桌|桌面审计|复盘视角/;

function validateOrdinaryObserverOrJargon(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme === "class-trial") return [];
  const errors: string[] = [];
  const jargonHits = (speech.match(/收益来源|发言链|闭合|收口|缺口|压力源/g) ?? []).length;
  if (/(?:全桌视角|从全桌|复盘视角|作为旁观者|桌面审计)/.test(speech)) {
    errors.push("普通局发言不要像全桌复盘，要用第一人称玩家视角");
  }
  if (jargonHits >= 2) {
    errors.push("普通局发言黑话堆叠，改成普通玩家听得懂的话");
  }
  return errors;
}
```

Call it inside `validateRenderedSpeech` after generic formatting checks:

```ts
errors.push(...validateOrdinaryObserverOrJargon(view, normalized));
```

In retry guidance construction, ensure validation errors containing `黑话堆叠` or `第一人称玩家视角` are included in the next `stability.previousIssue`, which existing retry machinery already passes through.

- [ ] **Step 5: Naturalize ordinary fallback**

Add:

```ts
function naturalizeOrdinarySpeechText(text: string): string {
  return text
    .replace(/收益来源/g, "为什么这么怀疑")
    .replace(/发言链/g, "前后说法")
    .replace(/闭合/g, "说清楚")
    .replace(/收口/g, "最后想投谁")
    .replace(/缺口/g, "没解释清楚的地方")
    .replace(/压力源/g, "让人开始怀疑他的点")
    .replace(/我先按公开信息盘/g, "我先说我听到的东西")
    .replace(/按当前公开发言和票型走/g, "按我听到的发言和投票来判断");
}
```

In `createLooseFallbackSpeech` or the ordinary branch returning fallback text, wrap ordinary speech:

```ts
if (view.roleCard?.theme !== "class-trial") {
  return compactSpeechToLimit(limitSpeechSentences(naturalizeOrdinarySpeechText(speech), limits.maxSentences), limits.maxChars);
}
```

In `buildOrdinaryLiveIntentMockLead`, ensure return strings use these shapes:

```ts
if (intent.intent === "observe") {
  return focusText
    ? `我先不把${focusText}打死，卡我的是他刚才那句话没说清楚`
    : "我现在信息少，只留一个能回看的疑惑";
}
if (intent.intent === "push_vote" && focusText) {
  return `我现在更怀疑${focusText}，因为${reason}`;
}
```

- [ ] **Step 6: Run Task 5 tests**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "ordinary speech toward first-person|stacked ordinary jargon|global observer|ordinary fallback"
npm run test -- src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```powershell
git add -- src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "feat: make ordinary ai speech player-readable"
```

---

### Task 6: Verification, Transcript Audit, And Handoff State

**Files:**
- Create: `scripts/audit-ordinary-speech-quality.mjs`
- Modify: `package.json`
- Create: `docs/tasks/2026-06-ordinary-ai-persona-decision-speech.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Add a task card**

Create `docs/tasks/2026-06-ordinary-ai-persona-decision-speech.md`:

```md
# Task

Short name: Ordinary AI persona, decision, and speech quality

Goal: Make ordinary Werewolf single-player and room AI use the same player-type strategy layer for readable first-person speech, voting, and night actions.

Why it matters: Real LLM ordinary speeches can sound like template reports and later seats repeat the same abstract pressure. The AI should sound like different ordinary players while keeping legal actions and information boundaries.

## Task Gate

Task type: AI speech / LLM contract + AI behavior + AI Pool UI + Room / multiplayer flow

Risk level: high

Required verification tier:

- [x] Focused automated tests
- [x] Lint/type/build confidence
- [x] Room smoke or room API regression
- [x] Real transcript review when provider credentials are available

Browser/manual verification:

- Required? yes for AI pool UI after visual changes
- If skipped, record why and include screenshot or source-level test coverage.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] This task card

## Context To Read First

- `docs/superpowers/specs/2026-06-08-ordinary-ai-persona-decision-speech-design.md`
- `docs/superpowers/plans/2026-06-08-ordinary-ai-persona-decision-speech.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/verification-matrix.md`

## Allowed Scope

- `src/game/types.ts`
- `src/game/ordinaryPlayerProfiles.ts`
- `src/game/aiFriends.ts`
- `src/game/personas.ts`
- `src/components/game/aiFriendStorage.ts`
- `src/components/game/clientTypes.ts`
- `src/components/AiPoolClient.tsx`
- `src/app/api/games/route.ts`
- `src/app/api/games/aiFriends.test.ts`
- `src/components/RoomClient.tsx`
- `src/server/roomService.ts`
- `src/app/api/rooms/api.test.ts`
- `src/ai/personaStrategyCards.ts`
- `src/ai/tableRead.ts`
- `src/ai/actionProviders.ts`
- `src/ai/seatMemory.ts`
- `src/ai/speechProviders.ts`
- Related focused tests and audit scripts

## Definition Of Done

- Default AI friends have stable ordinary player types not tied to model-name stereotypes.
- AI Pool exposes preset/slider controls for ordinary player type tuning.
- Single-player and room game creation preserve the same ordinary player profile.
- Speech/action inputs include ordinary player type strategy in player-readable wording.
- Ordinary fallback avoids abstract table jargon.
- Focused tests, room regression, and real or skipped transcript verification are recorded.
```

- [ ] **Step 2: Create transcript audit script**

Create `scripts/audit-ordinary-speech-quality.mjs`:

```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/audit-ordinary-speech-quality.mjs <transcript.md|json>");
  process.exit(1);
}

const text = readFileSync(path, "utf8");
const jargon = ["收益来源", "发言链", "收口", "闭合", "缺口", "压力源", "我先按公开信息盘"];
const observer = ["全桌视角", "从全桌", "复盘视角", "桌面审计", "作为旁观者"];
const repeats = new Map();
for (const line of text.split(/\r?\n/)) {
  const clean = line.trim();
  if (!clean || clean.length < 12) continue;
  const normalized = clean.replace(/\d+号/g, "X号").replace(/[，。！？；、\s]/g, "");
  repeats.set(normalized, (repeats.get(normalized) ?? 0) + 1);
}

const result = {
  file: path,
  fallbackCount: (text.match(/Fallback:\s*yes|isFallback["']?\s*:\s*true/g) ?? []).length,
  jargonHits: Object.fromEntries(jargon.map((word) => [word, (text.match(new RegExp(word, "g")) ?? []).length])),
  observerHits: Object.fromEntries(observer.map((word) => [word, (text.match(new RegExp(word, "g")) ?? []).length])),
  repeatedFragments: [...repeats.entries()]
    .filter(([, count]) => count >= 2)
    .slice(0, 12)
    .map(([fragment, count]) => ({ fragment: fragment.slice(0, 80), count })),
};

console.log(JSON.stringify(result, null, 2));
```

In `package.json`, add:

```json
"audit:ordinary-speech": "node scripts/audit-ordinary-speech-quality.mjs"
```

- [ ] **Step 3: Run focused automated verification**

Run:

```powershell
npm run test -- src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.test.ts src/components/AiPoolClient.mobile.test.ts src/app/api/games/aiFriends.test.ts src/app/api/rooms/api.test.ts src/ai/personaStrategyCards.test.ts src/ai/tableRead.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run lint/type/build**

Run:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Expected: PASS. If an existing unrelated blocker appears, capture exact error text in `progress.md` and final handoff.

- [ ] **Step 5: Run room smoke or room regression**

Run:

```powershell
npm run smoke:room-action:vote
```

Expected: PASS with vote resolved. If no local server is running, start the existing app server according to repo practice and pass `ROOM_SMOKE_BASE_URL` to the smoke command.

- [ ] **Step 6: Run real transcript review when approved**

If the user approves real LLM spend and credentials are available only through temporary process env, run a fixed `seed91` ordinary 9p transcript using the existing project harness or the current equivalent script. Save output under `tmp/ordinary-player-profile-seed91-day1-<timestamp>.md`.

Then run:

```powershell
npm run audit:ordinary-speech -- tmp/ordinary-player-profile-seed91-day1-<timestamp>.md
```

Expected:

- fallback count does not increase from the prior comparable Mimo run.
- `收益来源`, `发言链`, `收口`, `闭合`, `缺口`, and `压力源` are zero or explainable quoted prior text.
- no repeated low-info peace-night axis dominates Day 1.
- subjective read: speeches sound like ordinary players with distinct player types.

- [ ] **Step 7: Update state files**

In `feature_list.json`, add or update feature:

```json
{
  "id": "ordinary-ai-persona-decision-speech",
  "name": "Ordinary AI Persona Decision And Speech",
  "description": "Shared ordinary Werewolf AI player-type layer for single-player and room decisions, actions, and readable first-person speech.",
  "dependencies": ["ai-pool-character-roster", "speech-de-template-persona-layer"],
  "status": "done",
  "evidence": "List exact tests, room smoke, and transcript audit paths after verification."
}
```

In `progress.md`, append a concise status block with commands and residual risks.

In `session-handoff.md`, add the restart path:

```md
## Ordinary AI Persona Decision Speech

- Latest plan: `docs/superpowers/plans/2026-06-08-ordinary-ai-persona-decision-speech.md`
- Latest task card: `docs/tasks/2026-06-ordinary-ai-persona-decision-speech.md`
- Main verification: focused AI/game/UI tests, room smoke, and fixed seed91 transcript audit.
- Do not rerun real LLM transcript without explicit user approval for spend.
```

- [ ] **Step 8: Commit Task 6**

```powershell
git add -- scripts/audit-ordinary-speech-quality.mjs package.json docs/tasks/2026-06-ordinary-ai-persona-decision-speech.md feature_list.json progress.md session-handoff.md
git commit -m "chore: verify ordinary ai persona speech quality"
```

---

## Final Verification Bundle

Run after all tasks:

```powershell
npm run test -- src/game/ordinaryPlayerProfiles.test.ts src/game/aiFriends.test.ts src/components/AiPoolClient.mobile.test.ts src/app/api/games/aiFriends.test.ts src/app/api/rooms/api.test.ts src/ai/personaStrategyCards.test.ts src/ai/tableRead.test.ts src/ai/actionProviders.test.ts src/ai/seatMemory.test.ts src/ai/speechProviders.test.ts
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:room-action:vote
```

If real provider approval is available:

```powershell
npm run audit:ordinary-speech -- tmp/ordinary-player-profile-seed91-day1-<timestamp>.md
```

Record exact command output summaries in `progress.md` and final handoff.

## Self-Review

Spec coverage:

- AI Pool preset/slider configuration: Task 1 and Task 2.
- Stable default route-player types: Task 1.
- Model/personality separation: Task 1, Task 2, Task 4.
- Single-player and room consistency: Task 3.
- Read/write of AI friend profile through game setup: Task 1 and Task 3.
- Table read and actions affected by profile: Task 4.
- First-person ordinary player speech and jargon reduction: Task 5.
- fallback口语化 and reduced fallback reliance: Task 5 and Task 6.
- Automated plus transcript verification: Task 6.

Placeholder scan:

- No placeholder steps remain.
- Every code-changing step includes concrete code or exact text to add.
- Every test step includes command and expected result.

Type consistency:

- `AiOrdinaryPlayerProfile` and `AiOrdinaryPlayerTypeId` are defined in `src/game/types.ts`.
- Storage and UI use `ordinaryPlayerProfile`.
- AI prompt layers read `view.persona.ordinaryPlayerProfile`.
- Existing `riskTolerance`, `bluffing`, and `preferences` remain compatibility fields.
