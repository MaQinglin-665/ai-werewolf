# Class Trial Opening Character Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only class-trial opening intro that preloads 9 character audio clips, plays a 40-60 second reverse-order Japanese character montage before the court table, and supports skip-to-table.

**Architecture:** Add a focused intro config/parser module, a local intro audio generation endpoint, a standalone intro player component, and a narrow `GameClient` integration point before `ClassTrialGameTable`. Keep generated portraits and audio under ignored `local-assets/class-trial-pack/intro`, while tracked code renders text, backgrounds, and animation dynamically.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, existing `/class-trial-pack` local asset route, existing GPT-SoVITS helpers, CSS in `src/app/globals.css`.

---

## File Structure

- Create `docs/tasks/2026-06-class-trial-opening-character-intro.md`
  - Task card and acceptance checklist for this feature.
- Create `src/components/game/classTrialIntro.ts`
  - Pure config catalog, parser, status helpers, and typed intro entry model.
- Create `src/components/game/classTrialIntro.test.ts`
  - Unit coverage for reverse order, config parsing, status messages, and defaults.
- Modify `src/app/class-trial-pack/[...assetPath]/route.ts`
  - Serve local intro audio files from the existing ignored pack route.
- Modify `src/app/class-trial-pack/[...assetPath]/route.test.ts`
  - Cover `.wav`, `.mp3`, and traversal blocking.
- Create `src/app/api/class-trial-intro/audio/route.ts`
  - Generate/cache GPT-SoVITS intro audio for the 7 generated-audio entries.
- Create `src/app/api/class-trial-intro/audio/route.test.ts`
  - Mock GPT-SoVITS and file I/O to cover generation, existing-cache, and external-audio rejection.
- Create `src/components/game/classTrialIntroAudio.ts`
  - Browser helper for checking audio URLs, requesting generation, and reporting readiness.
- Create `src/components/game/classTrialIntroAudio.test.ts`
  - Mock `fetch` and `Audio`-free helpers to cover readiness and failure state.
- Create `src/components/game/ClassTrialOpeningIntro.tsx`
  - Fullscreen intro player with skip, timed slide advancement, reduced-motion support, and audio stop.
- Create `src/components/game/ClassTrialOpeningIntro.test.tsx`
  - Static markup plus pure timing helper tests.
- Modify `src/components/game/GamePanels.tsx`
  - Export the new intro player if the local barrel stays the preferred import path.
- Modify `src/components/game/LandingPanel.tsx`
  - Show class-trial intro readiness under the existing local theme card.
- Modify `src/components/game/gamePanelsMobile.test.ts`
  - Cover the readiness copy.
- Modify `src/components/GameClient.tsx`
  - Fetch `intro.json`, prepare intro audio after selecting the theme, and gate the themed table behind the intro player per new game.
- Modify `src/app/globals.css`
  - Add responsive intro montage, reduced-motion, and waiting-state styles.

Do not track files under `local-assets/class-trial-pack/intro/**`. Those files are private local assets.

---

### Task 1: Create The Task Card

**Files:**
- Create: `docs/tasks/2026-06-class-trial-opening-character-intro.md`

- [ ] **Step 1: Write the task card**

Create `docs/tasks/2026-06-class-trial-opening-character-intro.md` with:

```markdown
# 学级裁判开场角色片头

## Task Type

Frontend/UI + local-only asset/audio pipeline.

## Goal

学级裁判主题局每局开局后先播放 9 人倒序角色片头，再进入裁判席。片头全日文显示称号、名字和字幕，可跳过，只影响本地主题局。

## In Scope

- 本地 `class-trial` 单机/观战局。
- `local-assets/class-trial-pack/intro/intro.json` 解析。
- 本地 ignored 片头人物透明立绘和音频路径。
- 首页主题选择后的片头音频准备状态。
- 开局后的片头等待态、播放器、跳过和自然结束。
- GPT-SoVITS 生成 7 个弹丸角色开场音频。
- `/class-trial-pack` 路由服务本地音频。

## Out Of Scope

- `/rooms` 和 Public Alpha。
- 普通狼人杀模式。
- 狼人杀规则、投票、AI 决策、胜负。
- 提交 B 站截取音频、imagegen 立绘、缓存音频。
- 每个角色首次发言前弹窗。

## Allowed Files

- `src/components/GameClient.tsx`
- `src/components/game/classTrialIntro.ts`
- `src/components/game/classTrialIntro.test.ts`
- `src/components/game/classTrialIntroAudio.ts`
- `src/components/game/classTrialIntroAudio.test.ts`
- `src/components/game/ClassTrialOpeningIntro.tsx`
- `src/components/game/ClassTrialOpeningIntro.test.tsx`
- `src/components/game/GamePanels.tsx`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/app/class-trial-pack/[...assetPath]/route.ts`
- `src/app/class-trial-pack/[...assetPath]/route.test.ts`
- `src/app/api/class-trial-intro/audio/route.ts`
- `src/app/api/class-trial-intro/audio/route.test.ts`
- `src/app/globals.css`
- `docs/tasks/2026-06-class-trial-opening-character-intro.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

## Acceptance

- 选择 `学级裁判主题局` 后，首页显示开场片头音频准备状态。
- 创建学级裁判主题局后，进入裁判席前显示片头或片头准备等待态。
- 片头按 `anon -> tomori -> togami -> celestia -> enoshima -> monokuma -> fukawa -> kirigiri -> naegi` 播放。
- 片头只显示日文称号、日文角色名和日文字幕，不显示座位号。
- 片头自然结束进入 `ClassTrialGameTable`。
- 点击跳过停止当前音频并进入 `ClassTrialGameTable`。
- `/rooms` 不读取或显示片头入口。
- 本地素材和缓存音频保持 untracked/ignored。

## Verification

- `npm run test -- src/components/game/classTrialIntro.test.ts src/components/game/classTrialIntroAudio.test.ts src/components/game/ClassTrialOpeningIntro.test.tsx src/app/class-trial-pack/[...assetPath]/route.test.ts src/app/api/class-trial-intro/audio/route.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- Browser smoke: homepage -> 学级裁判主题局 -> audio ready/waiting -> opening intro -> skip -> court table.
- Browser smoke: `/rooms` has no opening intro entry.

## Notes

- Before staging, run `git status --short` and verify no `local-assets/class-trial-pack/intro/**` files are staged.
- The local image/audio assets are private and must not enter Git.
```

- [ ] **Step 2: Review the task card**

Run:

```powershell
Get-Content -Raw -Encoding UTF8 'docs\tasks\2026-06-class-trial-opening-character-intro.md'
npm run harness:task-card -- docs/tasks/2026-06-class-trial-opening-character-intro.md
```

Expected: the task card is readable and `harness:task-card` passes.

- [ ] **Step 3: Commit the task card**

```powershell
git add docs/tasks/2026-06-class-trial-opening-character-intro.md
git commit -m "docs: add class trial opening intro task"
```

Expected: commit contains only the new task card.

---

### Task 2: Intro Config Model And Parser

**Files:**
- Create: `src/components/game/classTrialIntro.ts`
- Create: `src/components/game/classTrialIntro.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/components/game/classTrialIntro.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CLASS_TRIAL_OPENING_INTRO_ORDER,
  buildClassTrialIntroSourcePath,
  getClassTrialIntroStatus,
  sanitizeClassTrialIntroConfig,
} from "./classTrialIntro";

describe("classTrialIntro", () => {
  it("uses the confirmed reverse character order", () => {
    expect(CLASS_TRIAL_OPENING_INTRO_ORDER).toEqual([
      "anon",
      "tomori",
      "togami",
      "celestia",
      "enoshima",
      "monokuma",
      "fukawa",
      "kirigiri",
      "naegi",
    ]);
  });

  it("sanitizes a complete intro config", () => {
    const config = sanitizeClassTrialIntroConfig({
      id: "class-trial-opening-intro",
      version: "local",
      characters: CLASS_TRIAL_OPENING_INTRO_ORDER.map((id, index) => ({
        id,
        displayNameJa: `${id}-ja`,
        titleJa: `超高校級の${index}`,
        subtitleJa: `line-${index}`,
        portraitUrl: `/class-trial-pack/intro/portraits/${id}.png`,
        audioUrl: `/class-trial-pack/intro/audio/${id}.wav`,
        themeColor: index === 0 ? "#ef4c6a" : "#f6c94a",
        accentColor: "#101014",
        pattern: index % 2 === 0 ? "shards" : "rings",
        durationMs: 5200,
        audioMode: id === "anon" || id === "tomori" ? "external" : "generated",
      })),
    });

    expect(config?.characters.map((item) => item.id)).toEqual(CLASS_TRIAL_OPENING_INTRO_ORDER);
    expect(config?.characters[0]?.displayNameJa).toBe("anon-ja");
    expect(config?.characters[0]?.durationMs).toBe(5200);
  });

  it("rejects configs that are missing confirmed characters or reverse order", () => {
    const config = sanitizeClassTrialIntroConfig({
      characters: [
        {
          id: "naegi",
          displayNameJa: "苗木 誠",
          titleJa: "超高校級の幸運",
          subtitleJa: "それは違うよ!",
          portraitUrl: "/class-trial-pack/intro/portraits/naegi.png",
          audioUrl: "/class-trial-pack/intro/audio/naegi.wav",
          themeColor: "#f6c94a",
          accentColor: "#111111",
          pattern: "rings",
          durationMs: 5200,
          audioMode: "generated",
        },
      ],
    });

    expect(config).toBeUndefined();
  });

  it("reports missing portrait and audio readiness", () => {
    const status = getClassTrialIntroStatus(undefined);

    expect(status.available).toBe(false);
    expect(status.message).toContain("未找到本地开场片头配置");
    expect(status.readyCharacterIds).toEqual([]);
    expect(status.missingCharacterIds).toEqual(CLASS_TRIAL_OPENING_INTRO_ORDER);
  });

  it("builds local pack source paths without path traversal", () => {
    expect(buildClassTrialIntroSourcePath(["intro", "audio", "naegi.wav"])).toBe("/class-trial-pack/intro/audio/naegi.wav");
    expect(buildClassTrialIntroSourcePath(["intro", "..", ".env"])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm run test -- src/components/game/classTrialIntro.test.ts
```

Expected: FAIL because `classTrialIntro.ts` does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/components/game/classTrialIntro.ts`:

```ts
import type { ClassTrialCharacterId } from "./classTrialTheme";

export const CLASS_TRIAL_OPENING_INTRO_ORDER = [
  "anon",
  "tomori",
  "togami",
  "celestia",
  "enoshima",
  "monokuma",
  "fukawa",
  "kirigiri",
  "naegi",
] as const satisfies readonly ClassTrialCharacterId[];

export type ClassTrialIntroPattern = "shards" | "rings" | "checker" | "scanlines" | "spotlight";
export type ClassTrialIntroAudioMode = "external" | "generated";

export type ClassTrialIntroCharacter = {
  id: (typeof CLASS_TRIAL_OPENING_INTRO_ORDER)[number];
  displayNameJa: string;
  titleJa: string;
  subtitleJa: string;
  portraitUrl: string;
  audioUrl: string;
  themeColor: string;
  accentColor: string;
  pattern: ClassTrialIntroPattern;
  durationMs: number;
  audioMode: ClassTrialIntroAudioMode;
  externalSourceUrl?: string;
  externalSourceRange?: string;
};

export type ClassTrialIntroConfig = {
  id: string;
  version: string;
  characters: ClassTrialIntroCharacter[];
};

export type ClassTrialIntroStatus = {
  available: boolean;
  message: string;
  readyCharacterIds: string[];
  missingCharacterIds: string[];
};

const INTRO_PATTERNS = ["shards", "rings", "checker", "scanlines", "spotlight"] as const;

export function sanitizeClassTrialIntroConfig(value: unknown): ClassTrialIntroConfig | undefined {
  if (!isRecord(value) || !Array.isArray(value.characters)) return undefined;
  const characters = value.characters
    .map(sanitizeIntroCharacter)
    .filter((character): character is ClassTrialIntroCharacter => Boolean(character));
  if (!hasConfirmedIntroOrder(characters)) return undefined;

  return {
    id: readString(value.id, 80) ?? "class-trial-opening-intro",
    version: readString(value.version, 80) ?? "local",
    characters,
  };
}

export function getClassTrialIntroStatus(config: ClassTrialIntroConfig | undefined): ClassTrialIntroStatus {
  if (!config) {
    return {
      available: false,
      message: "未找到本地开场片头配置。请准备 local-assets/class-trial-pack/intro/intro.json。",
      readyCharacterIds: [],
      missingCharacterIds: [...CLASS_TRIAL_OPENING_INTRO_ORDER],
    };
  }

  const readyCharacterIds = config.characters
    .filter((character) => character.portraitUrl && character.audioUrl)
    .map((character) => character.id);
  const readySet = new Set(readyCharacterIds);
  const missingCharacterIds = CLASS_TRIAL_OPENING_INTRO_ORDER.filter((id) => !readySet.has(id));

  return {
    available: missingCharacterIds.length === 0,
    message:
      missingCharacterIds.length === 0
        ? "开场片头素材已就绪。"
        : `开场片头素材缺少 ${missingCharacterIds.length} 个角色。`,
    readyCharacterIds,
    missingCharacterIds,
  };
}

export function buildClassTrialIntroSourcePath(segments: string[]): string | undefined {
  if (!segments.length) return undefined;
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return undefined;
  }
  return `/class-trial-pack/${segments.join("/")}`;
}

function sanitizeIntroCharacter(value: unknown): ClassTrialIntroCharacter | undefined {
  if (!isRecord(value)) return undefined;
  const id = parseIntroCharacterId(value.id);
  const displayNameJa = readString(value.displayNameJa, 40);
  const titleJa = readString(value.titleJa, 80);
  const subtitleJa = readString(value.subtitleJa, 160);
  const portraitUrl = readLocalAssetUrl(value.portraitUrl);
  const audioUrl = readLocalAssetUrl(value.audioUrl);
  const themeColor = readColor(value.themeColor) ?? "#f6c94a";
  const accentColor = readColor(value.accentColor) ?? "#101014";
  const pattern = parsePattern(value.pattern);
  const audioMode = parseAudioMode(value.audioMode);
  if (!id || !displayNameJa || !titleJa || !subtitleJa || !portraitUrl || !audioUrl || !pattern || !audioMode) return undefined;

  return {
    id,
    displayNameJa,
    titleJa,
    subtitleJa,
    portraitUrl,
    audioUrl,
    themeColor,
    accentColor,
    pattern,
    durationMs: readDurationMs(value.durationMs),
    audioMode,
    externalSourceUrl: readString(value.externalSourceUrl, 260),
    externalSourceRange: readString(value.externalSourceRange, 40),
  };
}

function hasConfirmedIntroOrder(characters: ClassTrialIntroCharacter[]): boolean {
  return (
    characters.length === CLASS_TRIAL_OPENING_INTRO_ORDER.length &&
    characters.every((character, index) => character.id === CLASS_TRIAL_OPENING_INTRO_ORDER[index])
  );
}

function parseIntroCharacterId(value: unknown): ClassTrialIntroCharacter["id"] | undefined {
  return typeof value === "string" && CLASS_TRIAL_OPENING_INTRO_ORDER.includes(value as ClassTrialIntroCharacter["id"])
    ? (value as ClassTrialIntroCharacter["id"])
    : undefined;
}

function parsePattern(value: unknown): ClassTrialIntroPattern | undefined {
  return typeof value === "string" && INTRO_PATTERNS.includes(value as ClassTrialIntroPattern)
    ? (value as ClassTrialIntroPattern)
    : undefined;
}

function parseAudioMode(value: unknown): ClassTrialIntroAudioMode | undefined {
  return value === "external" || value === "generated" ? value : undefined;
}

function readDurationMs(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 5200;
  return Math.min(6400, Math.max(4000, Math.round(number)));
}

function readLocalAssetUrl(value: unknown): string | undefined {
  const clean = readString(value, 240);
  return clean?.startsWith("/class-trial-pack/intro/") ? clean : undefined;
}

function readColor(value: unknown): string | undefined {
  const clean = readString(value, 16);
  return clean && /^#[0-9a-fA-F]{6}$/.test(clean) ? clean : undefined;
}

function readString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) || undefined : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run parser tests**

Run:

```powershell
npm run test -- src/components/game/classTrialIntro.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit parser**

```powershell
git add src/components/game/classTrialIntro.ts src/components/game/classTrialIntro.test.ts
git commit -m "feat: add class trial intro config model"
```

Expected: commit contains only the parser and parser test.

---

### Task 3: Serve Local Intro Audio From The Pack Route

**Files:**
- Modify: `src/app/class-trial-pack/[...assetPath]/route.ts`
- Modify: `src/app/class-trial-pack/[...assetPath]/route.test.ts`

- [ ] **Step 1: Add failing route tests**

Edit `src/app/class-trial-pack/[...assetPath]/route.test.ts` with `-LiteralPath` if reading in PowerShell. Add:

```ts
  it("allows local intro audio files while still blocking traversal", () => {
    expect(resolveClassTrialPackPath(["intro", "audio", "naegi.wav"])).toBe(
      path.resolve(process.cwd(), "local-assets", "class-trial-pack", "intro", "audio", "naegi.wav"),
    );
    expect(resolveClassTrialPackPath(["intro", "audio", "naegi.mp3"])).toBe(
      path.resolve(process.cwd(), "local-assets", "class-trial-pack", "intro", "audio", "naegi.mp3"),
    );
    expect(resolveClassTrialPackPath(["intro", "audio", "..", ".env"])).toBeNull();
  });
```

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```powershell
npm run test -- src/app/class-trial-pack/[...assetPath]/route.test.ts
```

Expected: FAIL because `.wav` and `.mp3` are unsupported.

- [ ] **Step 3: Add audio content types**

Modify `CONTENT_TYPES` in `src/app/class-trial-pack/[...assetPath]/route.ts`:

```ts
const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};
```

- [ ] **Step 4: Run the route test**

Run:

```powershell
npm run test -- src/app/class-trial-pack/[...assetPath]/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the route change**

```powershell
git add src/app/class-trial-pack/[...assetPath]/route.ts src/app/class-trial-pack/[...assetPath]/route.test.ts
git commit -m "feat: serve class trial intro audio assets"
```

Expected: commit contains only the route and route test.

---

### Task 4: Intro Audio Generation Endpoint

**Files:**
- Create: `src/app/api/class-trial-intro/audio/route.ts`
- Create: `src/app/api/class-trial-intro/audio/route.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Create `src/app/api/class-trial-intro/audio/route.test.ts`:

```ts
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, resolveClassTrialIntroAudioPath } from "./route";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() }));
vi.mock("@/ai/classTrialVoiceProfiles", () => ({
  resolveClassTrialGptSoVitsVoiceProfile: vi.fn(() => ({
    available: true,
    profile: {
      characterId: "naegi",
      displayName: "苗木诚",
      weightKey: "miao_mu",
      gptWeightsPath: "gpt.ckpt",
      sovitsWeightsPath: "sovits.pth",
      refAudioPath: "ref.wav",
      promptText: "prompt",
      promptLang: "ja",
      textLang: "ja",
      mediaType: "wav",
    },
  })),
}));
vi.mock("@/server/gptSoVitsTts", () => ({
  generateGptSoVitsTtsAudio: vi.fn(async () => Buffer.from("wav")),
  runGptSoVitsSynthesisExclusive: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  switchGptSoVitsWeights: vi.fn(async () => ({
    gpt: { durationMs: 1, skipped: false },
    sovits: { durationMs: 1, skipped: false },
  })),
}));

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);

describe("class-trial intro audio route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockRejectedValue(new Error("missing"));
  });

  it("resolves intro audio paths inside local-assets", () => {
    expect(resolveClassTrialIntroAudioPath("naegi")).toContain("local-assets");
    expect(resolveClassTrialIntroAudioPath("naegi")).toContain("intro");
    expect(resolveClassTrialIntroAudioPath("naegi")).toContain("naegi.wav");
    expect(resolveClassTrialIntroAudioPath("../secret")).toBeUndefined();
  });

  it("rejects external-audio characters that should be supplied by local clips", async () => {
    const response = await POST(new Request("http://local/api/class-trial-intro/audio", {
      method: "POST",
      body: JSON.stringify({ characterId: "anon" }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("本地截取音频") });
  });

  it("returns an existing cached generated audio URL", async () => {
    mockedExistsSync.mockReturnValue(true);

    const response = await POST(new Request("http://local/api/class-trial-intro/audio", {
      method: "POST",
      body: JSON.stringify({ characterId: "naegi" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      url: "/class-trial-pack/intro/audio/naegi.wav",
      cached: true,
    });
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it("generates and writes a missing generated intro audio clip", async () => {
    const response = await POST(new Request("http://local/api/class-trial-intro/audio", {
      method: "POST",
      body: JSON.stringify({ characterId: "naegi" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      url: "/class-trial-pack/intro/audio/naegi.wav",
      cached: false,
    });
    expect(mockedWriteFile).toHaveBeenCalledWith(expect.stringContaining("naegi.wav"), Buffer.from("wav"));
  });
});
```

- [ ] **Step 2: Run endpoint tests to verify they fail**

Run:

```powershell
npm run test -- src/app/api/class-trial-intro/audio/route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/class-trial-intro/audio/route.ts`:

```ts
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveClassTrialGptSoVitsVoiceProfile } from "@/ai/classTrialVoiceProfiles";
import { generateGptSoVitsTtsAudio, runGptSoVitsSynthesisExclusive, switchGptSoVitsWeights } from "@/server/gptSoVitsTts";
import type { AiCharacterRoleCard } from "@/game/types";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  characterId: z.enum(["anon", "tomori", "togami", "celestia", "enoshima", "monokuma", "fukawa", "kirigiri", "naegi"]),
});

const GENERATED_INTRO_LINES: Record<string, { displayName: string; textJa: string; roleCard: AiCharacterRoleCard }> = {
  naegi: entry("naegi", "苗木诚", "それは違うよ!"),
  kirigiri: entry("kirigiri", "雾切响子", "ここまで言えば分かるわね?"),
  fukawa: entry("fukawa", "腐川冬子", "どうせ私なんて..."),
  monokuma: entry("monokuma", "黑白熊", "うぷぷぷぷ。"),
  enoshima: entry("enoshima", "江之岛盾子", "絶望的に飽きちゃった。"),
  celestia: entry("celestia", "塞蕾丝缇雅", "わたくしはセレスティア・ルーデンベルクですわ。"),
  togami: entry("togami", "十神白夜", "俺が導いてやる。"),
};

const EXTERNAL_AUDIO_CHARACTERS = new Set(["anon", "tomori"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "开场片头音频参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  const characterId = parsed.data.characterId;
  if (EXTERNAL_AUDIO_CHARACTERS.has(characterId)) {
    return Response.json({ error: "该角色使用本地截取音频，请先准备 intro/audio 中的本地文件。" }, { status: 409 });
  }

  const filePath = resolveClassTrialIntroAudioPath(characterId);
  const line = GENERATED_INTRO_LINES[characterId];
  if (!filePath || !line) {
    return Response.json({ error: "未配置该角色的开场片头台词。" }, { status: 404 });
  }
  if (existsSync(filePath)) {
    return Response.json({ url: buildClassTrialIntroAudioUrl(characterId), cached: true });
  }

  const resolved = resolveClassTrialGptSoVitsVoiceProfile(line.roleCard);
  if (!resolved.available) {
    return Response.json({ error: resolved.reason }, { status: 503 });
  }

  const baseUrl = process.env.CLASS_TRIAL_GPT_SOVITS_BASE_URL?.trim() || "http://127.0.0.1:9880";
  const audio = await runGptSoVitsSynthesisExclusive(async () => {
    await switchGptSoVitsWeights({
      baseUrl,
      gptWeightsPath: resolved.profile.gptWeightsPath,
      sovitsWeightsPath: resolved.profile.sovitsWeightsPath,
    });
    return generateGptSoVitsTtsAudio({
      baseUrl,
      text: line.textJa,
      textLang: resolved.profile.textLang,
      refAudioPath: resolved.profile.refAudioPath,
      promptLang: resolved.profile.promptLang,
      promptText: resolved.profile.promptText,
      mediaType: resolved.profile.mediaType,
    });
  });

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, audio);

  return Response.json({ url: buildClassTrialIntroAudioUrl(characterId), cached: false });
}

export function resolveClassTrialIntroAudioPath(characterId: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(characterId)) return undefined;
  return path.resolve(process.cwd(), "local-assets", "class-trial-pack", "intro", "audio", `${characterId}.wav`);
}

function buildClassTrialIntroAudioUrl(characterId: string): string {
  return `/class-trial-pack/intro/audio/${characterId}.wav`;
}

function entry(id: string, displayName: string, textJa: string): { displayName: string; textJa: string; roleCard: AiCharacterRoleCard } {
  return {
    displayName,
    textJa,
    roleCard: {
      id,
      displayName,
      theme: "class-trial",
      styleTags: [],
      speechStyleZh: "",
      reasoningBias: "",
      voteBias: "",
      nightActionBias: "",
      asVillager: "",
      asWerewolf: "",
      pressureResponse: "",
      relationshipHints: [],
      catchphrasePolicy: "",
      forbidden: [],
      voiceLocale: "ja-JP",
    },
  };
}
```

- [ ] **Step 4: Run endpoint tests**

Run:

```powershell
npm run test -- src/app/api/class-trial-intro/audio/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the endpoint**

```powershell
git add src/app/api/class-trial-intro/audio/route.ts src/app/api/class-trial-intro/audio/route.test.ts
git commit -m "feat: generate class trial intro audio"
```

Expected: commit contains only the endpoint and endpoint test.

---

### Task 5: Browser Audio Preparation Helper

**Files:**
- Create: `src/components/game/classTrialIntroAudio.ts`
- Create: `src/components/game/classTrialIntroAudio.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/components/game/classTrialIntroAudio.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { ClassTrialIntroConfig } from "./classTrialIntro";
import { prepareClassTrialIntroAudio } from "./classTrialIntroAudio";

function makeConfig(): ClassTrialIntroConfig {
  return {
    id: "class-trial-opening-intro",
    version: "local",
    characters: [
      {
        id: "anon",
        displayNameJa: "千早 愛音",
        titleJa: "超高校級のギタリスト",
        subtitleJa: "あはは...",
        portraitUrl: "/class-trial-pack/intro/portraits/anon.png",
        audioUrl: "/class-trial-pack/intro/audio/anon.wav",
        themeColor: "#ef4c6a",
        accentColor: "#101014",
        pattern: "shards",
        durationMs: 5200,
        audioMode: "external",
      },
      {
        id: "naegi",
        displayNameJa: "苗木 誠",
        titleJa: "超高校級の幸運",
        subtitleJa: "それは違うよ!",
        portraitUrl: "/class-trial-pack/intro/portraits/naegi.png",
        audioUrl: "/class-trial-pack/intro/audio/naegi.wav",
        themeColor: "#f6c94a",
        accentColor: "#101014",
        pattern: "rings",
        durationMs: 5200,
        audioMode: "generated",
      },
    ] as ClassTrialIntroConfig["characters"],
  };
}

describe("classTrialIntroAudio", () => {
  it("marks ready when every intro audio URL is reachable", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));

    const result = await prepareClassTrialIntroAudio(makeConfig(), { fetcher });

    expect(result.ready).toBe(true);
    expect(result.readyCharacterIds).toEqual(["anon", "naegi"]);
    expect(result.failedCharacterIds).toEqual([]);
  });

  it("requests generated audio when a generated clip is missing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ url: "/class-trial-pack/intro/audio/naegi.wav" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await prepareClassTrialIntroAudio(makeConfig(), { fetcher });

    expect(result.ready).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("/api/class-trial-intro/audio", expect.objectContaining({ method: "POST" }));
  });

  it("does not generate external clips and reports them as failed when missing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await prepareClassTrialIntroAudio(makeConfig(), { fetcher });

    expect(result.ready).toBe(false);
    expect(result.failedCharacterIds).toEqual(["anon"]);
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```powershell
npm run test -- src/components/game/classTrialIntroAudio.test.ts
```

Expected: FAIL because `classTrialIntroAudio.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/components/game/classTrialIntroAudio.ts`:

```ts
import type { ClassTrialIntroConfig } from "./classTrialIntro";

export type ClassTrialIntroAudioPreparation = {
  ready: boolean;
  message: string;
  readyCharacterIds: string[];
  failedCharacterIds: string[];
};

type PrepareOptions = {
  fetcher?: typeof fetch;
};

export async function prepareClassTrialIntroAudio(
  config: ClassTrialIntroConfig | undefined,
  options: PrepareOptions = {},
): Promise<ClassTrialIntroAudioPreparation> {
  if (!config) {
    return {
      ready: false,
      message: "未找到开场片头配置。",
      readyCharacterIds: [],
      failedCharacterIds: [],
    };
  }

  const fetcher = options.fetcher ?? fetch;
  const readyCharacterIds: string[] = [];
  const failedCharacterIds: string[] = [];

  for (const character of config.characters) {
    if (await urlExists(fetcher, character.audioUrl)) {
      readyCharacterIds.push(character.id);
      continue;
    }

    if (character.audioMode === "generated") {
      const generated = await requestGeneratedIntroAudio(fetcher, character.id);
      if (generated && (await urlExists(fetcher, character.audioUrl))) {
        readyCharacterIds.push(character.id);
        continue;
      }
    }

    failedCharacterIds.push(character.id);
  }

  return {
    ready: failedCharacterIds.length === 0,
    message:
      failedCharacterIds.length === 0
        ? "开场片头音频已就绪。"
        : `开场片头音频缺少 ${failedCharacterIds.length} 个角色。`,
    readyCharacterIds,
    failedCharacterIds,
  };
}

async function urlExists(fetcher: typeof fetch, url: string): Promise<boolean> {
  const response = await fetcher(url, { method: "GET", cache: "no-store" }).catch(() => undefined);
  return Boolean(response?.ok);
}

async function requestGeneratedIntroAudio(fetcher: typeof fetch, characterId: string): Promise<boolean> {
  const response = await fetcher("/api/class-trial-intro/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
  }).catch(() => undefined);
  return Boolean(response?.ok);
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
npm run test -- src/components/game/classTrialIntroAudio.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper**

```powershell
git add src/components/game/classTrialIntroAudio.ts src/components/game/classTrialIntroAudio.test.ts
git commit -m "feat: prepare class trial intro audio"
```

Expected: commit contains only the helper and helper test.

---

### Task 6: Opening Intro Player Component

**Files:**
- Create: `src/components/game/ClassTrialOpeningIntro.tsx`
- Create: `src/components/game/ClassTrialOpeningIntro.test.tsx`
- Modify: `src/components/game/GamePanels.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/components/game/ClassTrialOpeningIntro.test.tsx`:

```tsx
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ClassTrialIntroConfig } from "./classTrialIntro";
import { ClassTrialOpeningIntro, getNextClassTrialIntroIndex } from "./ClassTrialOpeningIntro";

function makeConfig(): ClassTrialIntroConfig {
  return {
    id: "class-trial-opening-intro",
    version: "local",
    characters: [
      {
        id: "anon",
        displayNameJa: "千早 愛音",
        titleJa: "超高校級のギタリスト",
        subtitleJa: "あはは...",
        portraitUrl: "/class-trial-pack/intro/portraits/anon.png",
        audioUrl: "/class-trial-pack/intro/audio/anon.wav",
        themeColor: "#ef4c6a",
        accentColor: "#101014",
        pattern: "shards",
        durationMs: 5200,
        audioMode: "external",
      },
      {
        id: "naegi",
        displayNameJa: "苗木 誠",
        titleJa: "超高校級の幸運",
        subtitleJa: "それは違うよ!",
        portraitUrl: "/class-trial-pack/intro/portraits/naegi.png",
        audioUrl: "/class-trial-pack/intro/audio/naegi.wav",
        themeColor: "#f6c94a",
        accentColor: "#101014",
        pattern: "rings",
        durationMs: 5200,
        audioMode: "generated",
      },
    ] as ClassTrialIntroConfig["characters"],
  };
}

describe("ClassTrialOpeningIntro", () => {
  it("renders the active character title, name, subtitle, and skip button", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialOpeningIntro, {
        config: makeConfig(),
        onComplete: () => undefined,
        onSkip: () => undefined,
      }),
    );

    expect(html).toContain("class-trial-opening-intro");
    expect(html).toContain("超高校級のギタリスト");
    expect(html).toContain("千早 愛音");
    expect(html).toContain("あはは...");
    expect(html).toContain("跳过");
    expect(html).not.toContain("1号");
  });

  it("computes next indices and completion", () => {
    expect(getNextClassTrialIntroIndex(0, 2)).toEqual({ index: 1, complete: false });
    expect(getNextClassTrialIntroIndex(1, 2)).toEqual({ index: 1, complete: true });
  });
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```powershell
npm run test -- src/components/game/ClassTrialOpeningIntro.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/game/ClassTrialOpeningIntro.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ClassTrialIntroCharacter, ClassTrialIntroConfig } from "./classTrialIntro";

type IntroCssVars = CSSProperties & {
  "--class-trial-intro-theme": string;
  "--class-trial-intro-accent": string;
};

export function getNextClassTrialIntroIndex(currentIndex: number, total: number): { index: number; complete: boolean } {
  if (currentIndex >= total - 1) return { index: Math.max(0, total - 1), complete: true };
  return { index: currentIndex + 1, complete: false };
}

export function ClassTrialOpeningIntro({
  config,
  onComplete,
  onSkip,
}: {
  config: ClassTrialIntroConfig;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [motionReduced, setMotionReduced] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0);
  const character = config.characters[index] ?? config.characters[0]!;
  const style = useMemo<IntroCssVars>(
    () => ({
      "--class-trial-intro-theme": character.themeColor,
      "--class-trial-intro-accent": character.accentColor,
    }),
    [character.accentColor, character.themeColor],
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const runId = runRef.current + 1;
    runRef.current = runId;
    const audio = new Audio(character.audioUrl);
    audioRef.current = audio;
    audio.volume = 0.96;
    audio.play().catch(() => undefined);

    const timer = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      const next = getNextClassTrialIntroIndex(index, config.characters.length);
      if (next.complete) {
        onComplete();
      } else {
        setIndex(next.index);
      }
    }, motionReduced ? Math.max(2200, Math.min(character.durationMs, 3600)) : character.durationMs);

    return () => {
      window.clearTimeout(timer);
      audio.pause();
      audio.src = "";
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [character, config.characters.length, index, motionReduced, onComplete]);

  const skip = () => {
    runRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    onSkip();
  };

  return (
    <section
      className={["class-trial-opening-intro", `class-trial-opening-intro-${character.pattern}`].join(" ")}
      style={style}
      aria-label="学级裁判开场角色片头"
    >
      <div className="class-trial-opening-intro-bg" aria-hidden="true" />
      <div className="class-trial-opening-intro-slice" aria-hidden="true" />
      <div className="class-trial-opening-intro-character">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={character.portraitUrl} alt={character.displayNameJa} className="class-trial-opening-intro-portrait" />
      </div>
      <div className="class-trial-opening-intro-title-band">
        <span>{character.titleJa}</span>
        <strong>{character.displayNameJa}</strong>
      </div>
      <p className="class-trial-opening-intro-subtitle">{character.subtitleJa}</p>
      <div className="class-trial-opening-intro-progress">
        {config.characters.map((item, itemIndex) => (
          <span key={item.id} className={itemIndex <= index ? "class-trial-opening-intro-progress-active" : ""} />
        ))}
      </div>
      <button type="button" className="class-trial-opening-intro-skip" onClick={skip}>
        跳过
      </button>
    </section>
  );
}
```

Modify `src/components/game/GamePanels.tsx`:

```ts
export { ClassTrialGameTable } from "./ClassTrialGameTable";
export { ClassTrialOpeningIntro } from "./ClassTrialOpeningIntro";
```

Keep the existing exports in `GamePanels.tsx`; add only the new line if `ClassTrialGameTable` is already exported.

- [ ] **Step 4: Run component tests**

Run:

```powershell
npm run test -- src/components/game/ClassTrialOpeningIntro.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the component**

```powershell
git add src/components/game/ClassTrialOpeningIntro.tsx src/components/game/ClassTrialOpeningIntro.test.tsx src/components/game/GamePanels.tsx
git commit -m "feat: add class trial opening intro player"
```

Expected: commit contains only component files and barrel export.

---

### Task 7: Landing Readiness Copy

**Files:**
- Modify: `src/components/game/LandingPanel.tsx`
- Modify: `src/components/game/gamePanelsMobile.test.ts`

- [ ] **Step 1: Write failing landing test**

In `src/components/game/gamePanelsMobile.test.ts`, update the class-trial landing test props:

```ts
        classTrialIntroMessage: "开场片头音频准备中：7 / 9",
```

Then add the expectation inside that test:

```ts
    expect(html).toContain("开场片头音频准备中：7 / 9");
```

- [ ] **Step 2: Run landing test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/gamePanelsMobile.test.ts -t "local-only class trial theme entry"
```

Expected: FAIL because `LandingPanel` does not accept or render `classTrialIntroMessage`.

- [ ] **Step 3: Add the prop and render it**

Modify `LandingPanel` parameters and props type:

```ts
  classTrialIntroMessage,
```

Add to the type block:

```ts
  classTrialIntroMessage?: string;
```

Render under `classTrialPackMessage`:

```tsx
              {classTrialIntroMessage && (
                <p className="mt-2 text-xs leading-5 text-[#b8d6ff]">
                  {classTrialIntroMessage}
                </p>
              )}
```

- [ ] **Step 4: Run landing test**

Run:

```powershell
npm run test -- src/components/game/gamePanelsMobile.test.ts -t "local-only class trial theme entry"
```

Expected: PASS.

- [ ] **Step 5: Commit landing copy**

```powershell
git add src/components/game/LandingPanel.tsx src/components/game/gamePanelsMobile.test.ts
git commit -m "feat: show class trial intro readiness"
```

Expected: commit contains only landing panel and test.

---

### Task 8: GameClient Integration

**Files:**
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Add state and imports**

Add imports near existing class-trial imports:

```ts
import { ClassTrialOpeningIntro } from "./game/ClassTrialOpeningIntro";
import {
  getClassTrialIntroStatus,
  sanitizeClassTrialIntroConfig,
  type ClassTrialIntroConfig,
} from "./game/classTrialIntro";
import { prepareClassTrialIntroAudio, type ClassTrialIntroAudioPreparation } from "./game/classTrialIntroAudio";
```

Add state near existing class-trial state:

```ts
  const [classTrialIntroConfig, setClassTrialIntroConfig] = useState<ClassTrialIntroConfig | undefined>();
  const [classTrialIntroAudioPreparation, setClassTrialIntroAudioPreparation] = useState<ClassTrialIntroAudioPreparation | null>(null);
  const [classTrialIntroGameId, setClassTrialIntroGameId] = useState<string | null>(null);
  const [completedClassTrialIntroGameId, setCompletedClassTrialIntroGameId] = useState<string | null>(null);
```

Add memoized status:

```ts
  const classTrialIntroStatus = useMemo(() => getClassTrialIntroStatus(classTrialIntroConfig), [classTrialIntroConfig]);
  const classTrialIntroMessage = classTrialIntroAudioPreparation
    ? classTrialIntroAudioPreparation.message
    : classTrialIntroStatus.message;
```

- [ ] **Step 2: Fetch intro config**

Add an effect after the existing `manifest.json` and `personas.json` effects:

```ts
  useEffect(() => {
    let cancelled = false;
    void fetch("/class-trial-pack/intro/intro.json")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => {
        if (!cancelled) setClassTrialIntroConfig(sanitizeClassTrialIntroConfig(raw));
      })
      .catch(() => {
        if (!cancelled) setClassTrialIntroConfig(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

- [ ] **Step 3: Prepare audio when the theme is selected**

Add:

```ts
  useEffect(() => {
    let cancelled = false;
    if (classTrialThemeMode !== "class-trial") return;
    if (!classTrialIntroConfig) {
      setClassTrialIntroAudioPreparation(null);
      return;
    }

    setClassTrialIntroAudioPreparation({
      ready: false,
      message: "开场片头音频准备中。",
      readyCharacterIds: [],
      failedCharacterIds: [],
    });

    void prepareClassTrialIntroAudio(classTrialIntroConfig).then((result) => {
      if (!cancelled) setClassTrialIntroAudioPreparation(result);
    });

    return () => {
      cancelled = true;
    };
  }, [classTrialIntroConfig, classTrialThemeMode]);
```

- [ ] **Step 4: Mark new class-trial games as needing intro**

Inside `startGame`, after `setRoleIntroGameId(...)`, add:

```ts
      if (useFixedClassTrialLineup) {
        setClassTrialIntroGameId(view.id);
        setCompletedClassTrialIntroGameId(null);
      } else {
        setClassTrialIntroGameId(null);
        setCompletedClassTrialIntroGameId(null);
      }
```

Inside `loadGameById`, after `setRoleIntroGameId(null);`, add:

```ts
        setClassTrialIntroGameId(null);
        setCompletedClassTrialIntroGameId(null);
```

Inside `returnHome`, add:

```ts
    setClassTrialIntroGameId(null);
    setCompletedClassTrialIntroGameId(null);
```

- [ ] **Step 5: Add completion handlers**

Add callbacks near other callbacks:

```ts
  const completeClassTrialIntro = useCallback(() => {
    if (!game) return;
    setCompletedClassTrialIntroGameId(game.id);
  }, [game]);

  const skipClassTrialIntro = useCallback(() => {
    if (!game) return;
    setCompletedClassTrialIntroGameId(game.id);
  }, [game]);
```

- [ ] **Step 6: Pass landing readiness copy**

Add prop to `LandingPanel`:

```tsx
            classTrialIntroMessage={classTrialThemeMode === "class-trial" ? classTrialIntroMessage : undefined}
```

- [ ] **Step 7: Gate the themed table**

Before rendering `ClassTrialGameTable`, compute in render scope:

```ts
  const classTrialIntroPending =
    classTrialThemeActive &&
    game &&
    classTrialIntroGameId === game.id &&
    completedClassTrialIntroGameId !== game.id;
  const classTrialIntroReady =
    Boolean(classTrialIntroConfig) &&
    classTrialIntroStatus.available &&
    Boolean(classTrialIntroAudioPreparation?.ready);
```

Replace the `classTrialThemeActive ? <ClassTrialGameTable ... /> : ...` branch with:

```tsx
            {classTrialThemeActive && classTrialIntroPending && classTrialIntroReady && classTrialIntroConfig ? (
              <ClassTrialOpeningIntro
                config={classTrialIntroConfig}
                onComplete={completeClassTrialIntro}
                onSkip={skipClassTrialIntro}
              />
            ) : classTrialThemeActive && classTrialIntroPending ? (
              <section className="class-trial-opening-wait class-trial-court-stage">
                <div className="class-trial-table-background" aria-hidden="true" />
                <div className="class-trial-opening-wait-panel">
                  <span>Opening Intro</span>
                  <h2>正在准备开场片头</h2>
                  <p>{classTrialIntroMessage}</p>
                  <button type="button" onClick={skipClassTrialIntro}>
                    跳过片头，进入裁判席
                  </button>
                </div>
              </section>
            ) : classTrialThemeActive ? (
              <ClassTrialGameTable
                game={game}
                loading={loading || Boolean(aiSpeechAudioStatus) || Boolean(bufferedClassTrialContinueKey)}
                manifest={classTrialPackManifest}
                audioTypewriter={aiSpeechAudioStatus ?? undefined}
                manualAudioPlayback={
                  manualAiSpeechPlayback ? { ...manualAiSpeechPlayback, onPlay: resumeManualAiSpeechPlayback } : null
                }
                liveAiSpeech={liveAiSpeech}
                aiRuntimeMode={effectiveAiRuntimeMode}
                onReturnHome={returnHome}
                onSubmit={submitCommand}
              />
            ) : (
```

Keep the existing `MobileGameTable` branch after the final `:`.

- [ ] **Step 8: Run TypeScript to catch integration errors**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS. Fix import ordering or render-scope placement issues if TypeScript reports them.

- [ ] **Step 9: Commit GameClient integration**

```powershell
git add src/components/GameClient.tsx
git commit -m "feat: gate class trial table behind opening intro"
```

Expected: commit contains only `GameClient.tsx`.

---

### Task 9: Intro CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add intro styles**

Append a clearly labeled section near existing class-trial CSS:

```css
/* Class trial opening intro */
.class-trial-opening-intro {
  --class-trial-intro-theme: #f6c94a;
  --class-trial-intro-accent: #101014;
  position: relative;
  min-height: min(760px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--class-trial-intro-theme) 45%, transparent);
  background: #08080b;
  color: #fff;
  isolation: isolate;
}

.class-trial-opening-intro-bg,
.class-trial-opening-intro-slice {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.class-trial-opening-intro-bg {
  background:
    radial-gradient(circle at 72% 42%, color-mix(in srgb, var(--class-trial-intro-theme) 42%, transparent) 0 22%, transparent 23%),
    linear-gradient(122deg, var(--class-trial-intro-theme) 0 32%, var(--class-trial-intro-accent) 32% 100%);
  opacity: 0.95;
}

.class-trial-opening-intro-shards .class-trial-opening-intro-bg {
  background:
    repeating-linear-gradient(135deg, rgba(255,255,255,.16) 0 10px, transparent 10px 22px),
    linear-gradient(126deg, var(--class-trial-intro-theme) 0 38%, var(--class-trial-intro-accent) 38% 100%);
}

.class-trial-opening-intro-rings .class-trial-opening-intro-bg {
  background:
    radial-gradient(circle at 75% 48%, transparent 0 26%, rgba(0,0,0,.2) 27% 31%, transparent 32%),
    var(--class-trial-intro-theme);
}

.class-trial-opening-intro-checker .class-trial-opening-intro-bg {
  background:
    linear-gradient(45deg, rgba(255,255,255,.14) 25%, transparent 25% 75%, rgba(255,255,255,.14) 75%),
    linear-gradient(45deg, rgba(255,255,255,.14) 25%, transparent 25% 75%, rgba(255,255,255,.14) 75%),
    var(--class-trial-intro-theme);
  background-position: 0 0, 18px 18px, 0 0;
  background-size: 36px 36px;
}

.class-trial-opening-intro-scanlines .class-trial-opening-intro-bg {
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,.12) 0 2px, transparent 2px 7px),
    linear-gradient(120deg, var(--class-trial-intro-theme), var(--class-trial-intro-accent));
}

.class-trial-opening-intro-spotlight .class-trial-opening-intro-bg {
  background:
    radial-gradient(circle at 32% 46%, rgba(255,255,255,.28), transparent 30%),
    linear-gradient(120deg, var(--class-trial-intro-accent), var(--class-trial-intro-theme));
}

.class-trial-opening-intro-slice {
  background: linear-gradient(100deg, transparent 0 28%, rgba(255,255,255,.96) 29% 38%, transparent 39%);
  transform: translateX(-10%) skewX(-10deg);
  animation: class-trial-intro-slice 900ms ease both;
}

.class-trial-opening-intro-character {
  position: absolute;
  left: clamp(14px, 7vw, 96px);
  bottom: -2%;
  z-index: 2;
  width: min(42vw, 430px);
  height: min(74vh, 620px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.class-trial-opening-intro-portrait {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 30px 34px rgba(0,0,0,.52));
  animation: class-trial-intro-character-in 620ms cubic-bezier(.2,.9,.2,1.1) both;
}

.class-trial-opening-intro-title-band {
  position: absolute;
  left: min(30vw, 360px);
  right: -4vw;
  top: 38%;
  z-index: 3;
  transform: rotate(4deg);
  background: rgba(255,255,255,.96);
  color: #09090b;
  padding: clamp(14px, 2.4vw, 28px) clamp(24px, 5vw, 72px);
  box-shadow: 0 18px 26px rgba(0,0,0,.24);
}

.class-trial-opening-intro-title-band span {
  display: block;
  font-size: clamp(18px, 2.6vw, 40px);
  font-weight: 700;
}

.class-trial-opening-intro-title-band strong {
  display: block;
  margin-top: 8px;
  font-size: clamp(34px, 6vw, 88px);
  font-weight: 900;
  line-height: .95;
}

.class-trial-opening-intro-subtitle {
  position: absolute;
  left: 50%;
  bottom: clamp(24px, 6vh, 64px);
  z-index: 4;
  transform: translateX(-50%);
  width: min(92vw, 980px);
  margin: 0;
  border-top: 2px solid rgba(255,255,255,.45);
  border-bottom: 2px solid rgba(255,255,255,.45);
  background: rgba(0,0,0,.52);
  padding: 12px 20px;
  text-align: center;
  font-size: clamp(18px, 2.5vw, 34px);
  font-weight: 700;
  text-shadow: 0 2px 0 rgba(0,0,0,.65);
}

.class-trial-opening-intro-skip {
  position: absolute;
  right: 18px;
  top: 18px;
  z-index: 5;
  border: 1px solid rgba(255,255,255,.35);
  background: rgba(0,0,0,.5);
  color: #fff;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 700;
}

.class-trial-opening-intro-progress {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 14px;
  z-index: 5;
  display: flex;
  gap: 6px;
}

.class-trial-opening-intro-progress span {
  height: 4px;
  flex: 1;
  background: rgba(255,255,255,.22);
}

.class-trial-opening-intro-progress-active {
  background: rgba(255,255,255,.88) !important;
}

.class-trial-opening-wait {
  position: relative;
  min-height: min(720px, calc(100vh - 40px));
  display: grid;
  place-items: center;
  overflow: hidden;
}

.class-trial-opening-wait-panel {
  position: relative;
  z-index: 2;
  width: min(92vw, 560px);
  border: 1px solid rgba(216,195,109,.35);
  background: rgba(10,8,12,.86);
  padding: 28px;
  text-align: center;
  color: #fff2be;
}

.class-trial-opening-wait-panel span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: rgba(216,195,109,.78);
}

.class-trial-opening-wait-panel h2 {
  margin: 10px 0;
  font-size: clamp(26px, 4vw, 44px);
}

.class-trial-opening-wait-panel p {
  color: #d8ccd5;
}

.class-trial-opening-wait-panel button {
  margin-top: 18px;
  border: 1px solid rgba(255,255,255,.28);
  background: #c64f3c;
  color: #fff;
  padding: 10px 16px;
  font-weight: 800;
}

@keyframes class-trial-intro-slice {
  from { transform: translateX(-80%) skewX(-10deg); }
  to { transform: translateX(0) skewX(-10deg); }
}

@keyframes class-trial-intro-character-in {
  from { opacity: 0; transform: translateX(-26px) scale(.96); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}

@media (max-width: 720px) {
  .class-trial-opening-intro {
    min-height: calc(100vh - 24px);
  }

  .class-trial-opening-intro-character {
    left: 50%;
    width: min(78vw, 360px);
    transform: translateX(-50%);
    opacity: .92;
  }

  .class-trial-opening-intro-title-band {
    left: 0;
    right: -8vw;
    top: 46%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .class-trial-opening-intro-slice,
  .class-trial-opening-intro-portrait {
    animation: none;
  }
}
```

- [ ] **Step 2: Run CSS lint/build checks**

Run:

```powershell
npm run lint
npx tsc --noEmit
```

Expected: PASS. CSS syntax issues surface through lint/build tooling if class usage breaks JSX or TypeScript.

- [ ] **Step 3: Commit CSS**

```powershell
git add src/app/globals.css
git commit -m "style: add class trial opening intro visuals"
```

Expected: commit contains only `globals.css`.

---

### Task 10: Local Asset Preparation

**Files:**
- Create local ignored files only:
  - `local-assets/class-trial-pack/intro/intro.json`
  - `local-assets/class-trial-pack/intro/portraits/*.png`
  - `local-assets/class-trial-pack/intro/audio/*.wav`

- [ ] **Step 1: Confirm local asset paths are ignored**

Run:

```powershell
git check-ignore -v local-assets/class-trial-pack/intro/intro.json
git check-ignore -v local-assets/class-trial-pack/intro/portraits/naegi.png
git check-ignore -v local-assets/class-trial-pack/intro/audio/naegi.wav
```

Expected: all three paths are ignored. If any path is not ignored, stop and add an ignore rule before creating assets.

- [ ] **Step 2: Create intro directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path `
  'local-assets/class-trial-pack/intro/portraits', `
  'local-assets/class-trial-pack/intro/audio' | Out-Null
```

Expected: directories exist and remain untracked.

- [ ] **Step 3: Generate transparent character portraits**

Use the `imagegen` skill with one built-in image generation call per character. Prompt shape for each character:

```text
Use case: stylized-concept
Asset type: game opening intro transparent character portrait
Primary request: Create a recognizable fan-art style full-body anime portrait of <character>, suitable for a high-contrast class-trial opening montage.
Style/medium: expressive Japanese visual novel/anime illustration, sharp ink lines, high contrast, dramatic pose, energetic game-intro styling.
Composition/framing: full-body or knees-up character, centered, generous padding, no text, no logo.
Background: perfectly flat solid #00ff00 chroma-key background for background removal.
Constraints: no official screenshot composition, no watermark, no embedded text, no seat number, no UI frame, no background shadows, do not use #00ff00 in the subject.
```

Use these character names:

```text
千早愛音
高松燈
十神白夜
セレスティア・ルーデンベルク
江ノ島盾子
モノクマ
腐川冬子
霧切響子
苗木誠
```

After each image is generated, copy the selected output into `tmp/imagegen/class-trial-intro/<id>-source.png`, then run chroma-key removal:

```powershell
python "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input "tmp/imagegen/class-trial-intro/<id>-source.png" `
  --out "local-assets/class-trial-pack/intro/portraits/<id>.png" `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

Expected: each final PNG has transparent corners and no green fringe visible at normal game size.

- [ ] **Step 4: Prepare external Bilibili clips**

Use only `0:00-0:03` from each user-provided URL and save locally:

```powershell
yt-dlp -f bestaudio --download-sections "*00:00-00:03" -o "tmp/class-trial-intro-tomori.%(ext)s" "https://www.bilibili.com/video/BV1ewwxesEu4/"
yt-dlp -f bestaudio --download-sections "*00:00-00:03" -o "tmp/class-trial-intro-anon.%(ext)s" "https://www.bilibili.com/video/BV1WGS3YMEZz/"
ffmpeg -y -i "tmp/class-trial-intro-tomori.m4a" -ar 32000 -ac 1 "local-assets/class-trial-pack/intro/audio/tomori.wav"
ffmpeg -y -i "tmp/class-trial-intro-anon.m4a" -ar 32000 -ac 1 "local-assets/class-trial-pack/intro/audio/anon.wav"
```

If `yt-dlp` chooses a different extension, replace `.m4a` in the `ffmpeg` command with the downloaded extension printed by `yt-dlp`.

Expected: `tomori.wav` and `anon.wav` exist under ignored local assets.

- [ ] **Step 5: Write local intro.json**

Create `local-assets/class-trial-pack/intro/intro.json`:

```json
{
  "id": "class-trial-opening-intro",
  "version": "local-2026-06-01",
  "characters": [
    {
      "id": "anon",
      "displayNameJa": "千早 愛音",
      "titleJa": "超高校級のギタリスト",
      "subtitleJa": "あはは...",
      "portraitUrl": "/class-trial-pack/intro/portraits/anon.png",
      "audioUrl": "/class-trial-pack/intro/audio/anon.wav",
      "themeColor": "#ef4c6a",
      "accentColor": "#111318",
      "pattern": "shards",
      "durationMs": 5200,
      "audioMode": "external",
      "externalSourceUrl": "https://www.bilibili.com/video/BV1WGS3YMEZz/",
      "externalSourceRange": "0:00-0:03"
    },
    {
      "id": "tomori",
      "displayNameJa": "高松 燈",
      "titleJa": "超高校級の詩人",
      "subtitleJa": "ペンギン、ぐーぐーがーがー。",
      "portraitUrl": "/class-trial-pack/intro/portraits/tomori.png",
      "audioUrl": "/class-trial-pack/intro/audio/tomori.wav",
      "themeColor": "#6aa7ff",
      "accentColor": "#10131d",
      "pattern": "spotlight",
      "durationMs": 5400,
      "audioMode": "external",
      "externalSourceUrl": "https://www.bilibili.com/video/BV1ewwxesEu4/",
      "externalSourceRange": "0:00-0:03"
    },
    {
      "id": "togami",
      "displayNameJa": "十神 白夜",
      "titleJa": "超高校級の御曹司",
      "subtitleJa": "俺が導いてやる。",
      "portraitUrl": "/class-trial-pack/intro/portraits/togami.png",
      "audioUrl": "/class-trial-pack/intro/audio/togami.wav",
      "themeColor": "#e9e1c6",
      "accentColor": "#15130f",
      "pattern": "scanlines",
      "durationMs": 5000,
      "audioMode": "generated"
    },
    {
      "id": "celestia",
      "displayNameJa": "セレスティア",
      "titleJa": "超高校級のギャンブラー",
      "subtitleJa": "わたくしはセレスティア・ルーデンベルクですわ。",
      "portraitUrl": "/class-trial-pack/intro/portraits/celestia.png",
      "audioUrl": "/class-trial-pack/intro/audio/celestia.wav",
      "themeColor": "#d62846",
      "accentColor": "#111111",
      "pattern": "checker",
      "durationMs": 5600,
      "audioMode": "generated"
    },
    {
      "id": "enoshima",
      "displayNameJa": "江ノ島 盾子",
      "titleJa": "超高校級の分析師",
      "subtitleJa": "絶望的に飽きちゃった。",
      "portraitUrl": "/class-trial-pack/intro/portraits/enoshima.png",
      "audioUrl": "/class-trial-pack/intro/audio/enoshima.wav",
      "themeColor": "#ff2f7d",
      "accentColor": "#1b0c17",
      "pattern": "shards",
      "durationMs": 5200,
      "audioMode": "generated"
    },
    {
      "id": "monokuma",
      "displayNameJa": "モノクマ",
      "titleJa": "超高校級の学園長",
      "subtitleJa": "うぷぷぷぷ。",
      "portraitUrl": "/class-trial-pack/intro/portraits/monokuma.png",
      "audioUrl": "/class-trial-pack/intro/audio/monokuma.wav",
      "themeColor": "#ffffff",
      "accentColor": "#0a0a0a",
      "pattern": "checker",
      "durationMs": 4600,
      "audioMode": "generated"
    },
    {
      "id": "fukawa",
      "displayNameJa": "腐川 冬子",
      "titleJa": "超高校級の文学少女",
      "subtitleJa": "どうせ私なんて...",
      "portraitUrl": "/class-trial-pack/intro/portraits/fukawa.png",
      "audioUrl": "/class-trial-pack/intro/audio/fukawa.wav",
      "themeColor": "#6f56a6",
      "accentColor": "#16101f",
      "pattern": "scanlines",
      "durationMs": 5000,
      "audioMode": "generated"
    },
    {
      "id": "kirigiri",
      "displayNameJa": "霧切 響子",
      "titleJa": "超高校級の探偵",
      "subtitleJa": "ここまで言えば分かるわね?",
      "portraitUrl": "/class-trial-pack/intro/portraits/kirigiri.png",
      "audioUrl": "/class-trial-pack/intro/audio/kirigiri.wav",
      "themeColor": "#b7a6ff",
      "accentColor": "#101521",
      "pattern": "rings",
      "durationMs": 5200,
      "audioMode": "generated"
    },
    {
      "id": "naegi",
      "displayNameJa": "苗木 誠",
      "titleJa": "超高校級の幸運",
      "subtitleJa": "それは違うよ!",
      "portraitUrl": "/class-trial-pack/intro/portraits/naegi.png",
      "audioUrl": "/class-trial-pack/intro/audio/naegi.wav",
      "themeColor": "#f6c94a",
      "accentColor": "#111318",
      "pattern": "rings",
      "durationMs": 5200,
      "audioMode": "generated"
    }
  ]
}
```

Expected: local intro config parses through `sanitizeClassTrialIntroConfig`.

- [ ] **Step 6: Generate missing GPT-SoVITS intro audio**

With the app server running and GPT-SoVITS available:

```powershell
$ids = @('togami','celestia','enoshima','monokuma','fukawa','kirigiri','naegi')
foreach ($id in $ids) {
  Invoke-WebRequest -UseBasicParsing -Method POST `
    -Uri 'http://127.0.0.1:51625/api/class-trial-intro/audio' `
    -ContentType 'application/json' `
    -Body (@{ characterId = $id } | ConvertTo-Json)
}
```

Expected: `local-assets/class-trial-pack/intro/audio/<id>.wav` exists for all 7 generated-audio characters.

- [ ] **Step 7: Verify assets are untracked**

Run:

```powershell
git status --short local-assets tmp
```

Expected: no tracked/staged files under `local-assets`; ignored files may be absent from output.

Do not commit local assets.

---

### Task 11: Focused Verification

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-06-class-trial-opening-character-intro.md`

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test -- src/components/game/classTrialIntro.test.ts src/components/game/classTrialIntroAudio.test.ts src/components/game/ClassTrialOpeningIntro.test.tsx src/app/class-trial-pack/[...assetPath]/route.test.ts src/app/api/class-trial-intro/audio/route.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint and typecheck**

Run:

```powershell
npm run lint
npx tsc --noEmit
```

Expected: PASS. Existing warnings in unrelated GPT-SoVITS tests may remain if lint reports them as warnings only.

- [ ] **Step 3: Browser smoke**

Start or reuse a local server:

```powershell
npm run build
npm run start -- -p 51625
```

Open the in-app browser to:

```text
http://127.0.0.1:51625
```

Manual flow:

1. Select `学级裁判主题局`.
2. Confirm intro readiness text appears.
3. Start a local theme game.
4. Confirm waiting screen appears if audio is not ready.
5. Confirm intro plays in reverse order when ready.
6. Confirm skip enters `ClassTrialGameTable`.
7. Start another theme game and confirm intro appears again.
8. Open `http://127.0.0.1:51625/rooms` and confirm no intro entry appears.

Expected: the visible flow matches the spec.

- [ ] **Step 4: Update feature and handoff docs**

Add a feature entry to `feature_list.json`:

```json
{
  "id": "class-trial-opening-character-intro",
  "name": "Class Trial Opening Character Intro",
  "description": "Add a local-only reverse-order class-trial opening intro with Japanese title cards, prepared audio, generated transparent portraits, and skip-to-court behavior.",
  "dependencies": [
    "class-trial-thinking-persona-polish"
  ],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-06-01-class-trial-opening-character-intro-design.md; docs/superpowers/plans/2026-06-01-class-trial-opening-character-intro.md; docs/tasks/2026-06-class-trial-opening-character-intro.md; src/components/game/classTrialIntro.ts; src/components/game/ClassTrialOpeningIntro.tsx; src/app/api/class-trial-intro/audio/route.ts; focused tests; npm run lint; npx tsc --noEmit; browser local class-trial opening intro smoke"
}
```

Update `progress.md`, `session-handoff.md`, and the task card with exact command outcomes and browser evidence.

- [ ] **Step 5: Confirm no ignored assets are staged**

Run:

```powershell
git status --short
git diff --cached --name-only
```

Expected: staged files do not include `local-assets/`, `tmp/`, or generated audio/image caches.

- [ ] **Step 6: Commit verification docs**

```powershell
git add feature_list.json progress.md session-handoff.md docs/tasks/2026-06-class-trial-opening-character-intro.md
git commit -m "docs: record class trial opening intro verification"
```

Expected: final commit contains only docs/state files.

---

## Self-Review Checklist

- Spec coverage:
  - Opening placement before court table: Tasks 6 and 8.
  - Reverse order: Tasks 2 and 6.
  - Japanese title/name/subtitle: Tasks 2, 6, and 10.
  - Per-character audio and cache readiness: Tasks 4, 5, 8, and 10.
  - Skip stops audio and enters table: Task 6 and Task 8.
  - Local-only `/rooms` boundary: Task 8 and Task 11 browser smoke.
  - Transparent portraits via imagegen and local assets: Task 10.
  - No tracked local assets: Task 10 and Task 11.
- Placeholder scan: no unresolved markers or deferred-work wording are present.
- Type consistency:
  - `ClassTrialIntroConfig`, `ClassTrialIntroCharacter`, and `ClassTrialIntroAudioPreparation` are introduced before imports use them.
  - The route uses the same character ids as `CLASS_TRIAL_OPENING_INTRO_ORDER`.
  - `audioMode` values are exactly `"external"` and `"generated"` across parser, helper, route, and `intro.json`.
