# AI Pool Bulk LLM Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local LLM preset manager in `/ai-pool` that can test a preset and apply it to the currently selected AI friends in bulk.

**Architecture:** Keep the risky state transformation out of `AiPoolClient.tsx` by adding a focused preset/apply helper with unit tests. Add a small server route for user-triggered LLM testing that reuses the existing OpenAI-compatible model path and redacts secrets. Then wire a responsive panel near the AI mode card while preserving the existing single-AI advanced configuration path.

**Tech Stack:** Next.js App Router route handlers, React client components, TypeScript, Vitest, localStorage, existing `callRoutedModelJson` OpenAI-compatible helper, existing Tailwind/global CSS conventions.

---

## File Structure

- Create `src/components/game/aiFriendLlmPresets.ts`
  - Owns preset types, localStorage read/write, preset sanitization, preset-to-LLM config conversion, and pure bulk apply rules.
  - Exports no React code.
- Create `src/components/game/aiFriendLlmPresets.test.ts`
  - Covers local storage parsing, malformed data fallback, fill-blanks-only behavior, overwrite behavior, default-AI-to-configured-copy behavior, secret updates, selected-id replacement, and result summaries.
- Create `src/app/api/ai-config/test-llm/route.ts`
  - Accepts one preset-like payload, runs a connectivity call and a minimal project speech call, returns only redacted status fields.
- Create `src/app/api/ai-config/test-llm/route.test.ts`
  - Mocks `fetch`, verifies success/failure results, and verifies the API key never appears in JSON responses.
- Modify `src/components/AiPoolClient.tsx`
  - Imports preset helpers.
  - Adds preset state hydration/persistence.
  - Adds a bulk LLM panel near `AiModeCard`.
  - Wires create/edit/delete/select/test/apply behavior.
- Modify `src/components/AiPoolClient.mobile.test.ts`
  - Confirms the bulk LLM entry appears near “对局 AI 模式”, contains the expected core controls, and keeps single-AI configuration as an advanced path.
- Modify `src/app/globals.css`
  - Adds responsive rules for the bulk LLM panel and mobile overlay, using the existing `mobile-ai-*` naming style.
- Modify `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`
  - Record implementation completion and verification evidence.
- Modify `feature_list.json`, `progress.md`, and `session-handoff.md`
  - Mark the feature status and handoff after verification.

---

### Task 1: Preset Storage And Bulk Apply Model

**Files:**
- Create: `src/components/game/aiFriendLlmPresets.ts`
- Create: `src/components/game/aiFriendLlmPresets.test.ts`
- Modify: none

- [ ] **Step 1: Write failing storage and apply tests**

Create `src/components/game/aiFriendLlmPresets.test.ts` with these tests:

```ts
import { describe, expect, it, vi } from "vitest";
import { copyAiFriend, getDefaultAiFriends } from "@/game/aiFriends";
import type { AiFriendConfig } from "@/game/types";
import { buildAiFriendOptions, type AiFriendLlmSecretMap } from "./aiFriendStorage";
import {
  AI_FRIEND_LLM_PRESETS_STORAGE_KEY,
  applyLlmPresetToSelectedAiFriends,
  readStoredAiFriendLlmPresetState,
  writeStoredAiFriendLlmPresetState,
  type AiFriendLlmPreset,
} from "./aiFriendLlmPresets";

const now = "2026-05-27T00:00:00.000Z";

const preset: AiFriendLlmPreset = {
  id: "preset-deepseek",
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "secret-key",
  mergeSystemIntoUser: true,
  createdAt: now,
  updatedAt: now,
};

describe("aiFriendLlmPresets storage", () => {
  it("round-trips sanitized presets and the last used preset id", () => {
    withFakeWindow(() => {
      writeStoredAiFriendLlmPresetState({
        presets: [
          {
            ...preset,
            name: "  DeepSeek   Main  ",
            baseUrl: "https://api.deepseek.com/v1/",
            apiKey: "  secret-key  ",
          },
        ],
        lastUsedPresetId: "preset-deepseek",
      });

      expect(readStoredAiFriendLlmPresetState()).toEqual({
        presets: [
          {
            ...preset,
            name: "DeepSeek Main",
            baseUrl: "https://api.deepseek.com/v1",
          },
        ],
        lastUsedPresetId: "preset-deepseek",
      });
    });
  });

  it("ignores malformed storage values", () => {
    withFakeWindow((fakeWindow) => {
      fakeWindow.localStorage.setItem(AI_FRIEND_LLM_PRESETS_STORAGE_KEY, "{bad json");

      expect(readStoredAiFriendLlmPresetState()).toEqual({ presets: [] });
    });
  });
});

describe("applyLlmPresetToSelectedAiFriends", () => {
  it("fills only selected friends without custom LLM configs", () => {
    const defaults = buildAiFriendOptions([]);
    const configured = copyAiFriend(getDefaultAiFriends(now)[1]!, {
      id: "friend-configured-llm:claude",
      now,
    });
    configured.llmConfig = {
      provider: "openai-compatible",
      label: "Existing",
      baseUrl: "https://existing.example.com/v1",
      model: "existing-model",
    };
    const options = buildAiFriendOptions([configured]);

    const result = applyLlmPresetToSelectedAiFriends({
      aiFriends: options,
      customAiFriends: [configured],
      selectedAiFriendIds: [defaults[0]!.id, configured.id],
      aiLlmSecrets: { [configured.id]: { apiKey: "existing-secret" } },
      preset,
      mode: "fill-blanks",
      now,
    });

    expect(result.results).toEqual([
      expect.objectContaining({ friendName: defaults[0]!.nickname, status: "filled" }),
      expect.objectContaining({ friendName: configured.nickname, status: "skipped" }),
    ]);
    expect(result.selectedAiFriendIds[0]).toBe(`friend-configured-llm:${defaults[0]!.basePersonaId}`);
    expect(result.aiLlmSecrets[result.selectedAiFriendIds[0]!]?.apiKey).toBe("secret-key");
    expect(result.aiLlmSecrets[configured.id]?.apiKey).toBe("existing-secret");
  });

  it("overwrites all selected friends and preserves non-LLM fields", () => {
    const custom = copyAiFriend(getDefaultAiFriends(now)[2]!, {
      id: "custom-friend",
      now,
    });
    custom.nickname = "自定义玩家";
    custom.avatarDataUrl = "data:image/webp;base64,AAAA";
    custom.ttsVoice = "default_zh";
    custom.llmConfig = {
      provider: "openai-compatible",
      label: "Old",
      baseUrl: "https://old.example.com/v1",
      model: "old-model",
    };

    const result = applyLlmPresetToSelectedAiFriends({
      aiFriends: buildAiFriendOptions([custom]),
      customAiFriends: [custom],
      selectedAiFriendIds: [custom.id],
      aiLlmSecrets: { [custom.id]: { apiKey: "old-secret", ttsApiKey: "tts-secret" } },
      preset,
      mode: "overwrite",
      now,
    });

    expect(result.results).toEqual([
      expect.objectContaining({ friendName: "自定义玩家", status: "overwritten" }),
    ]);
    expect(result.customAiFriends[0]).toMatchObject({
      id: "custom-friend",
      nickname: "自定义玩家",
      avatarDataUrl: "data:image/webp;base64,AAAA",
      ttsVoice: "default_zh",
      llmConfig: {
        provider: "openai-compatible",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        mergeSystemIntoUser: true,
      },
    });
    expect(result.aiLlmSecrets.custom-friend).toBeUndefined();
    expect(result.aiLlmSecrets["custom-friend"]).toEqual({ apiKey: "secret-key", ttsApiKey: "tts-secret" });
  });
});

type FakeWindow = {
  localStorage: Storage;
};

function withFakeWindow(run: (fakeWindow: FakeWindow) => void): void {
  const storage = new Map<string, string>();
  const fakeWindow: FakeWindow = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    },
  };

  vi.stubGlobal("window", fakeWindow);
  try {
    run(fakeWindow);
  } finally {
    vi.unstubAllGlobals();
  }
}
```

Before running, correct the deliberately invalid assertion line `expect(result.aiLlmSecrets.custom-friend).toBeUndefined();` to this valid TypeScript assertion:

```ts
expect(result.aiLlmSecrets["custom-friend"]).toEqual({ apiKey: "secret-key", ttsApiKey: "tts-secret" });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/aiFriendLlmPresets.test.ts
```

Expected: FAIL because `./aiFriendLlmPresets` does not exist.

- [ ] **Step 3: Implement preset helper**

Create `src/components/game/aiFriendLlmPresets.ts`:

```ts
import type { AiFriendConfig, AiFriendLlmConfig } from "@/game/types";
import type { AiFriendOption } from "./clientTypes";
import type { AiFriendLlmSecretMap } from "./aiFriendStorage";

export const AI_FRIEND_LLM_PRESETS_STORAGE_KEY = "ai-werewolf-ai-friend-llm-presets-v1";
const CONFIGURED_AI_FRIEND_ID_PREFIX = "friend-configured-llm:";

export type AiFriendLlmPreset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  mergeSystemIntoUser?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiFriendLlmPresetState = {
  presets: AiFriendLlmPreset[];
  lastUsedPresetId?: string;
};

export type AiFriendLlmPresetApplyMode = "fill-blanks" | "overwrite";

export type AiFriendLlmPresetApplyResult = {
  friendId: string;
  nextFriendId?: string;
  friendName: string;
  status: "filled" | "overwritten" | "skipped";
  reason?: string;
};

export type ApplyLlmPresetInput = {
  aiFriends: AiFriendOption[];
  customAiFriends: AiFriendConfig[];
  selectedAiFriendIds: string[];
  aiLlmSecrets: AiFriendLlmSecretMap;
  preset: AiFriendLlmPreset;
  mode: AiFriendLlmPresetApplyMode;
  now: string;
};

export type ApplyLlmPresetOutput = {
  customAiFriends: AiFriendConfig[];
  selectedAiFriendIds: string[];
  aiLlmSecrets: AiFriendLlmSecretMap;
  results: AiFriendLlmPresetApplyResult[];
};

export function readStoredAiFriendLlmPresetState(): AiFriendLlmPresetState {
  if (typeof window === "undefined") return { presets: [] };
  const raw = window.localStorage.getItem(AI_FRIEND_LLM_PRESETS_STORAGE_KEY);
  if (!raw) return { presets: [] };
  try {
    return sanitizeAiFriendLlmPresetState(JSON.parse(raw));
  } catch {
    return { presets: [] };
  }
}

export function writeStoredAiFriendLlmPresetState(state: AiFriendLlmPresetState): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeAiFriendLlmPresetState(state);
  window.localStorage.setItem(AI_FRIEND_LLM_PRESETS_STORAGE_KEY, JSON.stringify(clean));
}

export function sanitizeAiFriendLlmPresetState(value: unknown): AiFriendLlmPresetState {
  if (!isRecord(value)) return { presets: [] };
  const presets = Array.isArray(value.presets)
    ? value.presets.map(sanitizeAiFriendLlmPreset).filter((preset): preset is AiFriendLlmPreset => Boolean(preset)).slice(0, 20)
    : [];
  const lastUsedPresetId = readString(value.lastUsedPresetId, 80);
  return {
    presets,
    ...(lastUsedPresetId && presets.some((preset) => preset.id === lastUsedPresetId) ? { lastUsedPresetId } : {}),
  };
}

export function sanitizeAiFriendLlmPreset(value: unknown): AiFriendLlmPreset | undefined {
  if (!isRecord(value)) return undefined;
  const id = sanitizeId(readString(value.id, 80));
  const name = sanitizeLabel(readString(value.name, 40));
  const baseUrl = sanitizeBaseUrl(readString(value.baseUrl, 260));
  const model = readString(value.model, 120);
  const apiKey = readString(value.apiKey, 4096);
  const createdAt = readString(value.createdAt, 40);
  const updatedAt = readString(value.updatedAt, 40);
  if (!id || !name || !baseUrl || !model || !createdAt || !updatedAt) return undefined;
  return {
    id,
    name,
    baseUrl,
    model,
    ...(apiKey ? { apiKey } : {}),
    ...(typeof value.mergeSystemIntoUser === "boolean" ? { mergeSystemIntoUser: value.mergeSystemIntoUser } : {}),
    createdAt,
    updatedAt,
  };
}

export function buildLlmConfigFromPreset(preset: AiFriendLlmPreset): AiFriendLlmConfig {
  return {
    provider: "openai-compatible",
    label: preset.name,
    baseUrl: preset.baseUrl,
    model: preset.model,
    ...(preset.mergeSystemIntoUser ? { mergeSystemIntoUser: true } : {}),
  };
}

export function applyLlmPresetToSelectedAiFriends(input: ApplyLlmPresetInput): ApplyLlmPresetOutput {
  const friendById = new Map(input.aiFriends.map((friend) => [friend.id, friend]));
  const customById = new Map(input.customAiFriends.map((friend) => [friend.id, friend]));
  const selectedSet = new Set(input.selectedAiFriendIds);
  const nextCustomById = new Map(customById);
  const nextSecrets: AiFriendLlmSecretMap = { ...input.aiLlmSecrets };
  const replacementIds = new Map<string, string>();
  const results: AiFriendLlmPresetApplyResult[] = [];

  for (const friendId of input.selectedAiFriendIds) {
    const friend = friendById.get(friendId);
    if (!friend) continue;
    if (input.mode === "fill-blanks" && friend.llmConfig) {
      results.push({
        friendId,
        friendName: friend.nickname,
        status: "skipped",
        reason: "已有自定义 LLM 配置",
      });
      continue;
    }

    const targetId = friend.isDefault ? configuredFriendId(friend) : friend.id;
    const nextFriend: AiFriendConfig = {
      id: targetId,
      nickname: friend.nickname,
      basePersonaId: friend.basePersonaId,
      avatarDataUrl: friend.avatarDataUrl,
      llmConfig: buildLlmConfigFromPreset(input.preset),
      ttsVoice: friend.ttsVoice,
      ttsConfig: friend.ttsConfig,
      riskTolerance: friend.riskTolerance,
      bluffing: friend.bluffing,
      preferences: friend.preferences,
      createdAt: friend.isDefault ? input.now : friend.createdAt,
      updatedAt: input.now,
    };

    nextCustomById.delete(friend.id);
    nextCustomById.set(targetId, nextFriend);
    replacementIds.set(friend.id, targetId);
    const currentSecret = nextSecrets[targetId] ?? nextSecrets[friend.id] ?? {};
    nextSecrets[targetId] = {
      ...currentSecret,
      ...(input.preset.apiKey ? { apiKey: input.preset.apiKey } : {}),
    };
    if (targetId !== friend.id) delete nextSecrets[friend.id];
    results.push({
      friendId,
      nextFriendId: targetId,
      friendName: friend.nickname,
      status: friend.llmConfig ? "overwritten" : "filled",
    });
  }

  const selectedAiFriendIds = input.selectedAiFriendIds
    .map((id) => replacementIds.get(id) ?? id)
    .filter((id, index, values) => selectedSet.has(id) || values.indexOf(id) === index);

  return {
    customAiFriends: [...nextCustomById.values()],
    selectedAiFriendIds,
    aiLlmSecrets: nextSecrets,
    results,
  };
}

function configuredFriendId(source: Pick<AiFriendOption, "basePersonaId">): string {
  return `${CONFIGURED_AI_FRIEND_ID_PREFIX}${source.basePersonaId}`.slice(0, 80);
}

function sanitizeBaseUrl(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, "").replace(/\/+$/, "");
  if (!clean) return undefined;
  try {
    const url = new URL(clean);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function sanitizeLabel(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/\s+/g, " ").slice(0, 40);
  return clean || undefined;
}

function sanitizeId(value: string | undefined): string | undefined {
  const clean = value?.trim().replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 80);
  return clean || undefined;
}

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run focused tests and fix compile errors**

Run:

```powershell
npm run test -- src/components/game/aiFriendLlmPresets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper slice**

Run:

```powershell
git add src/components/game/aiFriendLlmPresets.ts src/components/game/aiFriendLlmPresets.test.ts
git commit -m "feat: add ai pool llm preset model"
```

Expected: commit succeeds.

---

### Task 2: LLM Connection Test API

**Files:**
- Create: `src/app/api/ai-config/test-llm/route.ts`
- Create: `src/app/api/ai-config/test-llm/route.test.ts`
- Modify: none

- [ ] **Step 1: Write failing API tests**

Create `src/app/api/ai-config/test-llm/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/ai-config/test-llm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tests connectivity and project speech format without exposing the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: "我是3号，先听发言。" } }] }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/ai-config/test-llm", {
        method: "POST",
        body: JSON.stringify({
          name: "DeepSeek",
          baseUrl: "https://llm.example.com/v1",
          model: "deepseek-chat",
          apiKey: "secret-api-key",
          mergeSystemIntoUser: true,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connectivity.ok).toBe(true);
    expect(body.projectFormat.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-api-key");
  });

  it("redacts the API key from upstream error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "invalid key secret-api-key",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/ai-config/test-llm", {
        method: "POST",
        body: JSON.stringify({
          name: "Broken",
          baseUrl: "https://llm.example.com/v1",
          model: "broken-model",
          apiKey: "secret-api-key",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connectivity.ok).toBe(false);
    expect(body.projectFormat.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("secret-api-key");
    expect(body.connectivity.error).toContain("***");
  });

  it("rejects malformed payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai-config/test-llm", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: "not a url",
          model: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/app/api/ai-config/test-llm/route.test.ts
```

Expected: FAIL because `./route` does not exist.

- [ ] **Step 3: Implement route**

Create `src/app/api/ai-config/test-llm/route.ts`:

```ts
import { callRoutedModelJson } from "@/ai/modelLlms";
import { sanitizeAiFriendRuntimeLlmConfig } from "@/game/llmConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestResult = {
  ok: boolean;
  providerId?: string;
  textPreview?: string;
  error?: string;
};

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "请求体不是有效 JSON。" }, { status: 400 });
  }

  const config = sanitizeAiFriendRuntimeLlmConfig({
    provider: "openai-compatible",
    ...(isRecord(raw) && typeof raw.name === "string" ? { label: raw.name } : {}),
    ...(isRecord(raw) ? raw : {}),
  });
  if (!config) {
    return Response.json({ error: "需要有效的 Base URL 和模型名。" }, { status: 400 });
  }

  const connectivity = await runLlmProbe({
    label: config.label ?? "自定义大模型",
    apiKey: config.apiKey,
    taskInput: { prompt: "Reply with one short Chinese sentence." },
    system: "你是一个连通性测试助手。只返回一句简短中文。",
    customLlm: config,
  });

  const projectFormat = connectivity.ok
    ? await runLlmProbe({
        label: config.label ?? "自定义大模型",
        apiKey: config.apiKey,
        taskInput: {
          seat: 3,
          phase: "DAY_SPEECH",
          publicFacts: ["1号昨晚死亡", "2号发言偏谨慎"],
          instruction: "用狼人杀玩家口吻发一句短发言，不要输出 JSON。",
        },
        system: "你是 AI 狼人杀发言测试助手。返回一句可直接展示给玩家的中文发言，不要解释。",
        customLlm: config,
      })
    : {
        ok: false,
        error: "连通性测试未通过，未继续测试项目发言格式。",
      };

  return Response.json({ connectivity, projectFormat });
}

async function runLlmProbe(input: {
  label: string;
  apiKey?: string;
  system: string;
  taskInput: unknown;
  customLlm: NonNullable<ReturnType<typeof sanitizeAiFriendRuntimeLlmConfig>>;
}): Promise<TestResult> {
  try {
    const result = await callRoutedModelJson({
      personaName: input.label,
      task: "speech",
      system: input.system,
      input: input.taskInput,
      maxTokens: 160,
      customLlm: input.customLlm,
    });
    const text = result.text.trim();
    return {
      ok: text.length > 0,
      providerId: result.providerId,
      textPreview: text.slice(0, 80),
      ...(text.length > 0 ? {} : { error: "模型响应为空。" }),
    };
  } catch (error) {
    return {
      ok: false,
      error: redactSecret(error instanceof Error ? error.message : String(error), input.apiKey),
    };
  }
}

function redactSecret(message: string, secret: string | undefined): string {
  let clean = message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
  if (secret && secret.length >= 4) clean = clean.split(secret).join("***");
  return clean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run API tests**

Run:

```powershell
npm run test -- src/app/api/ai-config/test-llm/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API slice**

Run:

```powershell
git add src/app/api/ai-config/test-llm/route.ts src/app/api/ai-config/test-llm/route.test.ts
git commit -m "feat: add ai pool llm preset test route"
```

Expected: commit succeeds.

---

### Task 3: Bulk LLM Panel UI

**Files:**
- Modify: `src/components/AiPoolClient.tsx`
- Modify: `src/components/AiPoolClient.mobile.test.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add failing component tests for entry placement and controls**

Append these expectations to `src/components/AiPoolClient.mobile.test.ts` in the test named `puts AI mode before the pool and keeps quick add behind an overlay entry`:

```ts
expect(html.indexOf("对局 AI 模式")).toBeLessThan(html.indexOf("批量 LLM 配置"));
expect(html.indexOf("批量 LLM 配置")).toBeLessThan(html.indexOf("AI池</h2>"));
expect(html).toContain("LLM 预设");
expect(html).toContain("只填空白");
expect(html).toContain("覆盖所选");
expect(html).toContain("测试连接");
expect(html).toContain("可能产生少量费用");
```

Add a new CSS-focused test:

```ts
it("styles the bulk LLM preset panel as a responsive AI pool surface", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  expect(css).toContain(".mobile-ai-bulk-llm-card");
  expect(css).toContain(".mobile-ai-bulk-llm-panel");
  expect(css).toContain(".mobile-ai-bulk-llm-results");
});
```

- [ ] **Step 2: Run component test to verify it fails**

Run:

```powershell
npm run test -- src/components/AiPoolClient.mobile.test.ts
```

Expected: FAIL because the UI labels/classes do not exist yet.

- [ ] **Step 3: Import helpers and hydrate preset state**

Modify the imports in `src/components/AiPoolClient.tsx` to include:

```ts
import {
  applyLlmPresetToSelectedAiFriends,
  readStoredAiFriendLlmPresetState,
  writeStoredAiFriendLlmPresetState,
  type AiFriendLlmPreset,
  type AiFriendLlmPresetApplyResult,
} from "./game/aiFriendLlmPresets";
```

Add state near the existing quick-add state:

```ts
const [llmPresetState, setLlmPresetState] = useState<{ presets: AiFriendLlmPreset[]; lastUsedPresetId?: string }>({
  presets: [],
});
const [bulkLlmOpen, setBulkLlmOpen] = useState(false);
const [bulkLlmName, setBulkLlmName] = useState("");
const [bulkLlmBaseUrl, setBulkLlmBaseUrl] = useState(DEFAULT_CUSTOM_LLM_BASE_URL);
const [bulkLlmModel, setBulkLlmModel] = useState("");
const [bulkLlmApiKey, setBulkLlmApiKey] = useState("");
const [bulkLlmMergeSystemIntoUser, setBulkLlmMergeSystemIntoUser] = useState(false);
const [bulkLlmSelectedPresetId, setBulkLlmSelectedPresetId] = useState("");
const [bulkLlmError, setBulkLlmError] = useState<string | null>(null);
const [bulkLlmResults, setBulkLlmResults] = useState<AiFriendLlmPresetApplyResult[]>([]);
const [bulkLlmTestStatus, setBulkLlmTestStatus] = useState<string | null>(null);
```

In the existing first hydration effect, after reading runtime mode, add:

```ts
const storedPresetState = readStoredAiFriendLlmPresetState();
setLlmPresetState(storedPresetState);
const selectedPreset = storedPresetState.presets.find((preset) => preset.id === storedPresetState.lastUsedPresetId) ?? storedPresetState.presets[0];
if (selectedPreset) {
  loadBulkLlmPresetIntoForm(selectedPreset);
}
```

Define `loadBulkLlmPresetIntoForm` before the effect:

```ts
const loadBulkLlmPresetIntoForm = useCallback((preset: AiFriendLlmPreset) => {
  setBulkLlmSelectedPresetId(preset.id);
  setBulkLlmName(preset.name);
  setBulkLlmBaseUrl(preset.baseUrl);
  setBulkLlmModel(preset.model);
  setBulkLlmApiKey(preset.apiKey ?? "");
  setBulkLlmMergeSystemIntoUser(Boolean(preset.mergeSystemIntoUser));
  setBulkLlmError(null);
}, []);
```

Add persistence:

```ts
useEffect(() => {
  if (!loaded) return;
  writeStoredAiFriendLlmPresetState(llmPresetState);
}, [llmPresetState, loaded]);
```

- [ ] **Step 4: Add preset save/delete/test/apply callbacks**

Add these callbacks inside `AiPoolClient`:

```ts
const currentBulkLlmPreset = useMemo((): AiFriendLlmPreset | undefined => {
  const now = new Date().toISOString();
  const name = bulkLlmName.trim().replace(/\s+/g, " ").slice(0, 40);
  const baseUrl = bulkLlmBaseUrl.trim().replace(/\s+/g, "").replace(/\/+$/, "").slice(0, 260);
  const model = bulkLlmModel.trim().slice(0, 120);
  if (!name || !baseUrl || !model) return undefined;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return {
    id: bulkLlmSelectedPresetId || `llm-preset:${Date.now().toString(36)}`,
    name,
    baseUrl,
    model,
    ...(bulkLlmApiKey.trim() ? { apiKey: bulkLlmApiKey.trim().slice(0, 4096) } : {}),
    ...(bulkLlmMergeSystemIntoUser ? { mergeSystemIntoUser: true } : {}),
    createdAt: llmPresetState.presets.find((preset) => preset.id === bulkLlmSelectedPresetId)?.createdAt ?? now,
    updatedAt: now,
  };
}, [bulkLlmApiKey, bulkLlmBaseUrl, bulkLlmMergeSystemIntoUser, bulkLlmModel, bulkLlmName, bulkLlmSelectedPresetId, llmPresetState.presets]);

const saveBulkLlmPreset = useCallback(() => {
  if (!currentBulkLlmPreset) {
    setBulkLlmError("需要填写有效的预设名、Base URL 和模型名。");
    return;
  }
  setLlmPresetState((current) => {
    const withoutPreset = current.presets.filter((preset) => preset.id !== currentBulkLlmPreset.id);
    return {
      presets: [...withoutPreset, currentBulkLlmPreset],
      lastUsedPresetId: currentBulkLlmPreset.id,
    };
  });
  setBulkLlmSelectedPresetId(currentBulkLlmPreset.id);
  setBulkLlmError(null);
}, [currentBulkLlmPreset]);

const deleteBulkLlmPreset = useCallback(() => {
  if (!bulkLlmSelectedPresetId) return;
  const preset = llmPresetState.presets.find((item) => item.id === bulkLlmSelectedPresetId);
  if (!preset) return;
  if (!window.confirm(`删除 LLM 预设「${preset.name}」？`)) return;
  setLlmPresetState((current) => {
    const presets = current.presets.filter((item) => item.id !== preset.id);
    return { presets, lastUsedPresetId: presets[0]?.id };
  });
  setBulkLlmSelectedPresetId("");
  setBulkLlmName("");
  setBulkLlmModel("");
  setBulkLlmApiKey("");
  setBulkLlmResults([]);
}, [bulkLlmSelectedPresetId, llmPresetState.presets]);

const testBulkLlmPreset = useCallback(async () => {
  if (!currentBulkLlmPreset) {
    setBulkLlmError("需要填写有效的预设名、Base URL 和模型名后再测试。");
    return;
  }
  setBulkLlmTestStatus("测试中...");
  setBulkLlmError(null);
  try {
    const response = await fetch("/api/ai-config/test-llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentBulkLlmPreset),
    });
    const data = (await response.json()) as {
      connectivity?: { ok?: boolean; error?: string };
      projectFormat?: { ok?: boolean; error?: string };
      error?: string;
    };
    if (!response.ok) {
      setBulkLlmTestStatus(data.error ?? "测试请求失败。");
      return;
    }
    setBulkLlmTestStatus(
      `接口${data.connectivity?.ok ? "可用" : "失败"} · 项目格式${data.projectFormat?.ok ? "可用" : "失败"}${
        data.connectivity?.error ? ` · ${data.connectivity.error}` : data.projectFormat?.error ? ` · ${data.projectFormat.error}` : ""
      }`,
    );
  } catch {
    setBulkLlmTestStatus("测试请求失败，请检查本地服务和网络。");
  }
}, [currentBulkLlmPreset]);

const applyBulkLlmPreset = useCallback(
  (mode: "fill-blanks" | "overwrite") => {
    if (!currentBulkLlmPreset) {
      setBulkLlmError("需要先保存或填写一个有效 LLM 预设。");
      return;
    }
    const result = applyLlmPresetToSelectedAiFriends({
      aiFriends,
      customAiFriends,
      selectedAiFriendIds,
      aiLlmSecrets,
      preset: currentBulkLlmPreset,
      mode,
      now: new Date().toISOString(),
    });
    setCustomAiFriends(result.customAiFriends);
    setAiLlmSecrets(result.aiLlmSecrets);
    setSelectedAiFriendIds(result.selectedAiFriendIds);
    setBulkLlmResults(result.results);
    setLlmPresetState((current) => ({
      presets: current.presets.some((preset) => preset.id === currentBulkLlmPreset.id)
        ? current.presets
        : [...current.presets, currentBulkLlmPreset],
      lastUsedPresetId: currentBulkLlmPreset.id,
    }));
    setBulkLlmError(null);
  },
  [aiFriends, aiLlmSecrets, currentBulkLlmPreset, customAiFriends, selectedAiFriendIds],
);
```

- [ ] **Step 5: Add `BulkLlmPresetCard` component**

Add this component below `AiModeCard`:

```tsx
function BulkLlmPresetCard({
  open,
  presets,
  selectedPresetId,
  selectedCount,
  name,
  baseUrl,
  model,
  apiKey,
  mergeSystemIntoUser,
  error,
  testStatus,
  results,
  onOpenChange,
  onPresetSelect,
  onNameChange,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
  onMergeSystemIntoUserChange,
  onSave,
  onDelete,
  onTest,
  onApplyFillBlanks,
  onApplyOverwrite,
}: {
  open: boolean;
  presets: AiFriendLlmPreset[];
  selectedPresetId: string;
  selectedCount: number;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  mergeSystemIntoUser: boolean;
  error: string | null;
  testStatus: string | null;
  results: AiFriendLlmPresetApplyResult[];
  onOpenChange: (open: boolean) => void;
  onPresetSelect: (preset: AiFriendLlmPreset) => void;
  onNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onMergeSystemIntoUserChange: (value: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onTest: () => void;
  onApplyFillBlanks: () => void;
  onApplyOverwrite: () => void;
}) {
  return (
    <section className="mobile-ai-bulk-llm-card rounded-[24px] border border-[#7da8e3]/22 bg-[#0d1623]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#e4efff]">批量 LLM 配置</h2>
          <p className="mt-1 text-xs leading-5 text-[#b8d6ff]/72">
            给当前勾选的 {selectedCount} 位 AI 套用同一个 LLM 预设；API Key 仅保存在本机浏览器。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="rounded-full border border-[#7da8e3]/25 bg-[#7da8e3]/10 px-3 py-2 text-xs font-semibold text-[#b8d6ff] transition hover:bg-[#7da8e3]/16"
        >
          {open ? "收起" : "配置"}
        </button>
      </div>
      {open && (
        <div className="mobile-ai-bulk-llm-panel mt-4 grid gap-3 rounded-2xl border border-[#7da8e3]/14 bg-black/16 p-3">
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            LLM 预设
            <select
              value={selectedPresetId}
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) onPresetSelect(preset);
              }}
              className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45"
            >
              <option value="">新建预设</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} · {preset.model}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              预设名
              <input value={name} onChange={(event) => onNameChange(event.target.value)} className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45" />
            </label>
            <label className="grid gap-1 text-xs text-[#ad9c7d]">
              模型名
              <input value={model} onChange={(event) => onModelChange(event.target.value)} placeholder="deepseek-chat / gpt-4o-mini" className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45" />
            </label>
          </div>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            Base URL
            <input value={baseUrl} onChange={(event) => onBaseUrlChange(event.target.value)} className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45" />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["OpenAI", "https://api.openai.com/v1"],
              ["DeepSeek", "https://api.deepseek.com/v1"],
              ["OpenRouter", "https://openrouter.ai/api/v1"],
              ["本地", "http://localhost:11434/v1"],
            ].map(([label, value]) => (
              <button key={value} type="button" onClick={() => onBaseUrlChange(value)} className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/8 px-3 py-1.5 text-xs text-[#b8d6ff]">
                {label}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-xs text-[#ad9c7d]">
            API Key
            <input type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="仅保存在本机浏览器" className="rounded-xl border border-[#7da8e3]/18 bg-black/28 px-3 py-2 text-sm text-[#f7ead5] outline-none focus:border-[#7da8e3]/45" />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#ad9c7d]">
            <input type="checkbox" checked={mergeSystemIntoUser} onChange={(event) => onMergeSystemIntoUserChange(event.target.checked)} className="h-4 w-4 accent-[#7da8e3]" />
            将系统提示合并进用户消息
          </label>
          {error && <div className="rounded-xl border border-[#e46d55]/28 bg-[#2b1110]/55 px-3 py-2 text-xs text-[#ffb1a4]">{error}</div>}
          {testStatus && <div className="rounded-xl border border-[#7da8e3]/18 bg-[#0d1623]/55 px-3 py-2 text-xs text-[#d8e7ff]">{testStatus}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSave} className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white">保存预设</button>
            <button type="button" onClick={onDelete} disabled={!selectedPresetId} className="rounded-full border border-[#e46d55]/25 bg-[#2b1110]/50 px-4 py-2 text-xs font-semibold text-[#ffb1a4] disabled:opacity-45">删除预设</button>
            <button type="button" onClick={onTest} className="rounded-full border border-[#f1c76e]/24 bg-black/18 px-4 py-2 text-xs font-semibold text-[#f1d796]">测试连接</button>
          </div>
          <p className="text-[11px] leading-5 text-[#ad9c7d]">测试连接会调用一次模型，可能产生少量费用；保存和套用不强制要求测试通过。</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onApplyFillBlanks} disabled={selectedCount === 0} className="rounded-full border border-[#77d898]/25 bg-[#0f2118]/55 px-4 py-2 text-xs font-semibold text-[#a8f0b6] disabled:opacity-45">只填空白</button>
            <button type="button" onClick={onApplyOverwrite} disabled={selectedCount === 0} className="rounded-full bg-[#2f8157] px-4 py-2 text-xs font-semibold text-white disabled:opacity-45">覆盖所选</button>
          </div>
          {results.length > 0 && (
            <div className="mobile-ai-bulk-llm-results grid gap-2 rounded-2xl border border-[#77d898]/14 bg-black/18 p-3">
              {results.map((result) => (
                <div key={`${result.friendId}:${result.nextFriendId ?? result.friendId}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-[#f7ead5]">{result.friendName}</span>
                  <span className="shrink-0 text-[#a8f0b6]">
                    {result.status === "filled" ? "已填空白" : result.status === "overwritten" ? "已覆盖" : "已跳过"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Render `BulkLlmPresetCard` near `AiModeCard`**

In `AiPoolClient` JSX, immediately after `AiModeCard`, render:

```tsx
<BulkLlmPresetCard
  open={bulkLlmOpen}
  presets={llmPresetState.presets}
  selectedPresetId={bulkLlmSelectedPresetId}
  selectedCount={selectedAiFriendIds.length}
  name={bulkLlmName}
  baseUrl={bulkLlmBaseUrl}
  model={bulkLlmModel}
  apiKey={bulkLlmApiKey}
  mergeSystemIntoUser={bulkLlmMergeSystemIntoUser}
  error={bulkLlmError}
  testStatus={bulkLlmTestStatus}
  results={bulkLlmResults}
  onOpenChange={setBulkLlmOpen}
  onPresetSelect={loadBulkLlmPresetIntoForm}
  onNameChange={setBulkLlmName}
  onBaseUrlChange={setBulkLlmBaseUrl}
  onModelChange={setBulkLlmModel}
  onApiKeyChange={setBulkLlmApiKey}
  onMergeSystemIntoUserChange={setBulkLlmMergeSystemIntoUser}
  onSave={saveBulkLlmPreset}
  onDelete={deleteBulkLlmPreset}
  onTest={testBulkLlmPreset}
  onApplyFillBlanks={() => applyBulkLlmPreset("fill-blanks")}
  onApplyOverwrite={() => applyBulkLlmPreset("overwrite")}
/>
```

- [ ] **Step 7: Add responsive CSS hooks**

Append to the existing AI pool mobile CSS section in `src/app/globals.css`:

```css
  .mobile-ai-bulk-llm-card {
    min-width: 0;
  }

  .mobile-ai-bulk-llm-panel {
    max-height: min(72svh, 680px);
    overflow: auto;
  }

  .mobile-ai-bulk-llm-results {
    max-height: 180px;
    overflow: auto;
  }
```

If these rules are inside an existing media query, keep them with adjacent `.mobile-ai-mode-card` and `.mobile-ai-pool-side` rules.

- [ ] **Step 8: Run component test**

Run:

```powershell
npm run test -- src/components/AiPoolClient.mobile.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit UI slice**

Run:

```powershell
git add src/components/AiPoolClient.tsx src/components/AiPoolClient.mobile.test.ts src/app/globals.css
git commit -m "feat: add ai pool bulk llm preset panel"
```

Expected: commit succeeds.

---

### Task 4: Integration Verification And Browser Check

**Files:**
- Modify: `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test -- src/components/game/aiFriendLlmPresets.test.ts src/app/api/ai-config/test-llm/route.test.ts src/components/AiPoolClient.mobile.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint and typecheck**

Run:

```powershell
npm run lint
npx tsc --noEmit
```

Expected: both PASS.

- [ ] **Step 3: Start local dev server**

Run:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Expected: server reports it is ready at `http://127.0.0.1:3010`. If port 3010 is occupied, use the next free port and record it in the handoff.

- [ ] **Step 4: Browser-check desktop `/ai-pool`**

Use the Browser plugin for `http://127.0.0.1:3010/ai-pool`.

Verify:

- “批量 LLM 配置” appears near “对局 AI 模式”.
- Opening the panel shows preset fields, Base URL shortcuts, `测试连接`, `只填空白`, and `覆盖所选`.
- Text does not overlap at desktop width.
- Existing single-AI card configuration remains reachable.

- [ ] **Step 5: Browser-check mobile `/ai-pool`**

Use the Browser plugin with a phone-sized viewport.

Verify:

- The bulk entry is reachable without opening an AI card.
- Opening the panel is scrollable and does not hide the save/apply buttons.
- AI pool cards still render in compact mobile layout.
- No text spills out of buttons or cards.

- [ ] **Step 6: Run build if type surface changed across route boundaries**

Run:

```powershell
npm run build
```

Expected: PASS. Existing Turbopack/NFT warning is acceptable if unchanged.

- [ ] **Step 7: Update task card and status files**

Update `docs/tasks/2026-05-ai-pool-bulk-llm-presets.md`:

```markdown
## Implementation Record

Completed:
- Added local LLM preset storage and bulk apply rules.
- Added user-triggered LLM preset test route with API key redaction.
- Added `/ai-pool` bulk LLM preset panel near the AI mode card.
- Verified desktop and mobile `/ai-pool` layout.

Verification:
- `npm run test -- src/components/game/aiFriendLlmPresets.test.ts src/app/api/ai-config/test-llm/route.test.ts src/components/AiPoolClient.mobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- Browser desktop `/ai-pool`: passed at `<local-url>`
- Browser mobile `/ai-pool`: passed at `<local-url>`
- `npm run build`

Skipped checks:
- Real provider test was not run unless the user provided a safe key; this avoids accidental model cost.
```

Update `feature_list.json` entry `ai-pool-bulk-llm-presets`:

```json
"status": "done",
"evidence": "src/components/game/aiFriendLlmPresets.ts; src/components/game/aiFriendLlmPresets.test.ts; src/app/api/ai-config/test-llm/route.ts; src/app/api/ai-config/test-llm/route.test.ts; src/components/AiPoolClient.tsx; src/components/AiPoolClient.mobile.test.ts; docs/tasks/2026-05-ai-pool-bulk-llm-presets.md; focused tests; npm run lint; npx tsc --noEmit; browser /ai-pool desktop/mobile"
```

Update `progress.md` current state to:

```markdown
**Last Updated:** 2026-05-27 HH:MM Asia/Shanghai
**Session ID:** ai-pool bulk llm presets
**Active Feature:** ai-pool-bulk-llm-presets - AI Pool Bulk LLM Presets
```

Update `session-handoff.md` current objective to say implementation is complete and list the verification evidence.

- [ ] **Step 8: Final cleanliness checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-ai-pool-bulk-llm-presets.md
npm run harness:check
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"
git diff --check
git status --short
```

Expected:

- Task-card gate passes.
- Harness check passes.
- Feature list JSON parses.
- `git diff --check` has no whitespace errors. CRLF warnings are acceptable on this Windows repo.
- `git status --short` only shows intentional files.

- [ ] **Step 9: Commit final status update**

Run:

```powershell
git add docs/tasks/2026-05-ai-pool-bulk-llm-presets.md feature_list.json progress.md session-handoff.md
git commit -m "docs: record ai pool llm preset rollout"
```

Expected: commit succeeds.

---

## Self-Review

Spec coverage:

- Multiple local LLM presets: Task 1 and Task 3.
- Remember last used preset: Task 1 storage and Task 3 persistence.
- Entry near AI mode card: Task 3 component test and render step.
- Same desktop/mobile functionality: Task 3 component, Task 4 browser checks.
- Manual connection test with cost warning: Task 2 API and Task 3 UI text.
- API key local storage and server non-persistence: Task 1 localStorage, Task 2 redaction tests.
- `fill blanks only` and `overwrite selected`: Task 1 pure tests and Task 3 buttons.
- Per-AI result list: Task 1 result model and Task 3 rendered results.
- TTS future compatibility: preserved in design docs; no first-version TTS implementation.

Placeholder scan:

- No `TBD`, `TODO`, or undefined future work placeholders are used in implementation steps.
- Real-provider testing is explicitly optional and gated by a user-provided safe key.

Type consistency:

- Preset type names use `AiFriendLlmPreset`.
- Apply modes use `"fill-blanks"` and `"overwrite"` consistently.
- Result statuses use `"filled"`, `"overwritten"`, and `"skipped"` consistently.
