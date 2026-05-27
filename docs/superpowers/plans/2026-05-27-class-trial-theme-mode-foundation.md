# Class Trial Theme Mode Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first local-only "学级裁判主题局" foundation: ignored local asset pack path, homepage mode entry, theme-pack status model, and a non-rule-changing ring-table visual shell for local single-player/spectator games.

**Architecture:** Keep the theme as a frontend-only local presentation mode in this slice. Store the selected mode in localStorage, read local-pack availability from a lightweight browser-side manifest probe, pass a `themeMode` flag from `GameClient` to landing/table components, and render a separate themed shell only when a local game is active and the mode is enabled. Do not touch room/multiplayer routes, rules engine, server game creation, or Public Alpha pages.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, React static markup tests, Tailwind/global CSS, localStorage.

---

## Scope Split

The product spec covers independent subsystems: local asset pack, homepage entry, themed table UI, GPT-SoVITS routing, and LLM role-card behavior. This plan intentionally implements only the first testable slice:

- in scope: local theme mode selection, ignored asset-pack convention, missing-pack warning, local-only guardrails, and visual shell placeholder;
- out of scope: real copyrighted assets, GPT-SoVITS calls, 20s TTS timeout, role-card prompt injection, multi-port voice routing, and cross-game memory.

Those out-of-scope items should each get a later plan after this foundation is browser-verified.

## File Structure

- Modify `.gitignore`: ignore `/local-assets/` so private character material never enters Git.
- Create `src/components/game/classTrialTheme.ts`: constants, localStorage key, mode type, pack manifest types, default 9 character ids, validation helpers.
- Create `src/components/game/classTrialTheme.test.ts`: focused tests for mode parsing, pack validation, and local-only availability copy.
- Modify `src/components/GameClient.tsx`: own selected theme mode, persist it, pass it to `LandingPanel`, and render `ClassTrialGameTable` when a game exists and the theme is enabled.
- Modify `src/components/game/LandingPanel.tsx`: add homepage "学级裁判主题局" mode selector and missing-pack/local-only helper copy.
- Modify `src/components/game/gamePanelsMobile.test.ts`: add static coverage that the landing page exposes the theme entry without changing room link behavior.
- Create `src/components/game/ClassTrialGameTable.tsx`: first visual shell wrapping the existing desktop controls with a B-style central info table and placeholder ring seats.
- Create `src/components/game/classTrialGameTable.test.ts`: static markup tests for center phase/speaker info, hidden identity in speech copy, and return/default controls.
- Modify `src/components/game/GamePanels.tsx`: export `ClassTrialGameTable`.
- Modify `src/app/globals.css`: add minimal stable classes for the class-trial shell; keep CSS scoped under `.class-trial-table`.
- Create `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`: task card and execution record.
- Modify `feature_list.json`, `progress.md`, and `session-handoff.md` only after implementation succeeds.

## Task 1: Local Theme Model And Ignored Asset Path

**Files:**
- Modify: `.gitignore`
- Create: `src/components/game/classTrialTheme.ts`
- Test: `src/components/game/classTrialTheme.test.ts`

- [ ] **Step 1: Write the failing theme model tests**

Create `src/components/game/classTrialTheme.test.ts`:

```ts
import {
  CLASS_TRIAL_CHARACTER_IDS,
  CLASS_TRIAL_LOCAL_ASSET_ROOT,
  CLASS_TRIAL_THEME_MODE_STORAGE_KEY,
  CLASS_TRIAL_THEME_MODES,
  getClassTrialPackStatus,
  parseClassTrialThemeMode,
  type ClassTrialPackManifest,
} from "./classTrialTheme";

describe("class trial theme model", () => {
  it("keeps the local asset path and storage key stable", () => {
    expect(CLASS_TRIAL_LOCAL_ASSET_ROOT).toBe("local-assets/class-trial-pack");
    expect(CLASS_TRIAL_THEME_MODE_STORAGE_KEY).toBe("ai-werewolf-class-trial-theme-mode");
  });

  it("parses only supported theme modes", () => {
    expect(CLASS_TRIAL_THEME_MODES).toEqual(["default", "class-trial"]);
    expect(parseClassTrialThemeMode("class-trial")).toBe("class-trial");
    expect(parseClassTrialThemeMode("default")).toBe("default");
    expect(parseClassTrialThemeMode("公网")).toBe("default");
    expect(parseClassTrialThemeMode(null)).toBe("default");
  });

  it("requires the 9 expected local theme characters", () => {
    const manifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: CLASS_TRIAL_CHARACTER_IDS.map((id) => ({ id, displayName: id, hasPortrait: true, hasAvatar: true })),
    };

    expect(getClassTrialPackStatus(manifest)).toEqual({
      available: true,
      message: "本地主题素材包已就绪。",
      missingCharacterIds: [],
    });
  });

  it("explains missing local pack data without enabling public use", () => {
    expect(getClassTrialPackStatus(undefined)).toEqual({
      available: false,
      message: "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
    });

    const manifest: ClassTrialPackManifest = {
      id: "class-trial-pack",
      version: "0.1.0-local",
      characters: [{ id: "kirigiri", displayName: "雾切响子", hasPortrait: true, hasAvatar: true }],
    };

    expect(getClassTrialPackStatus(manifest)).toMatchObject({
      available: false,
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS.filter((id) => id !== "kirigiri"),
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: FAIL because `src/components/game/classTrialTheme.ts` does not exist.

- [ ] **Step 3: Add the model implementation**

Create `src/components/game/classTrialTheme.ts`:

```ts
export const CLASS_TRIAL_THEME_MODE_STORAGE_KEY = "ai-werewolf-class-trial-theme-mode";
export const CLASS_TRIAL_LOCAL_ASSET_ROOT = "local-assets/class-trial-pack";

export const CLASS_TRIAL_THEME_MODES = ["default", "class-trial"] as const;
export type ClassTrialThemeMode = (typeof CLASS_TRIAL_THEME_MODES)[number];

export const CLASS_TRIAL_CHARACTER_IDS = [
  "naegi",
  "kirigiri",
  "fukawa",
  "monokuma",
  "enoshima",
  "celestia",
  "togami",
  "hagakure",
  "anon",
] as const;

export type ClassTrialCharacterId = (typeof CLASS_TRIAL_CHARACTER_IDS)[number];

export type ClassTrialPackCharacter = {
  id: string;
  displayName: string;
  hasPortrait?: boolean;
  hasAvatar?: boolean;
};

export type ClassTrialPackManifest = {
  id: string;
  version: string;
  characters: ClassTrialPackCharacter[];
};

export type ClassTrialPackStatus = {
  available: boolean;
  message: string;
  missingCharacterIds: readonly string[];
};

export function parseClassTrialThemeMode(value: unknown): ClassTrialThemeMode {
  return value === "class-trial" ? "class-trial" : "default";
}

export function getClassTrialPackStatus(manifest: ClassTrialPackManifest | undefined): ClassTrialPackStatus {
  if (!manifest) {
    return {
      available: false,
      message: "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。",
      missingCharacterIds: CLASS_TRIAL_CHARACTER_IDS,
    };
  }

  const completeIds = new Set(
    manifest.characters
      .filter((character) => character.hasPortrait && character.hasAvatar)
      .map((character) => character.id),
  );
  const missingCharacterIds = CLASS_TRIAL_CHARACTER_IDS.filter((id) => !completeIds.has(id));

  return {
    available: missingCharacterIds.length === 0,
    message:
      missingCharacterIds.length === 0
        ? "本地主题素材包已就绪。"
        : `本地主题素材包缺少 ${missingCharacterIds.length} 个角色素材。`,
    missingCharacterIds,
  };
}
```

- [ ] **Step 4: Ignore local private assets**

Add this block to `.gitignore` under the local scratch/runtime section:

```gitignore
# private local-only theme assets
/local-assets/
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add .gitignore src/components/game/classTrialTheme.ts src/components/game/classTrialTheme.test.ts
git commit -m "feat: add class trial theme model"
```

## Task 2: Homepage Mode Entry

**Files:**
- Modify: `src/components/GameClient.tsx`
- Modify: `src/components/game/LandingPanel.tsx`
- Test: `src/components/game/gamePanelsMobile.test.ts`

- [ ] **Step 1: Add failing static markup coverage**

Append this test to `src/components/game/gamePanelsMobile.test.ts`:

```ts
it("shows the local-only class trial theme entry without replacing rooms", () => {
  const boards = getDefaultBoardOptions();
  const html = renderToStaticMarkup(
    createElement(LandingPanel, {
      loading: false,
      boards,
      selectedBoardId: boards[0]?.id ?? null,
      onSelectBoard: () => undefined,
      humanSeatMode: "none",
      selectedHumanSeatId: null,
      onSelectRandomHumanSeat: () => undefined,
      onSelectFixedHumanSeat: () => undefined,
      onSelectNoHumanSeat: () => undefined,
      selectedAiFriendCount: 9,
      customAiFriendCount: 0,
      aiLineupPreview: [],
      recentGameIds: [],
      onLoadGame: async () => undefined,
      onStartGame: async () => undefined,
      classTrialThemeMode: "class-trial",
      classTrialPackAvailable: false,
      classTrialPackMessage: "未找到本地主题素材包。请将素材放在 local-assets/class-trial-pack，并保持该目录不提交到 Git。",
      onSelectClassTrialThemeMode: () => undefined,
    }),
  );

  expect(html).toContain("学级裁判主题局");
  expect(html).toContain("本地限定");
  expect(html).toContain("未找到本地主题素材包");
  expect(html).toContain("/rooms");
});
```

If the test file does not currently import `LandingPanel`, `createElement`, or `renderToStaticMarkup` in a compatible shape, extend its existing imports rather than duplicating them.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/gamePanelsMobile.test.ts
```

Expected: FAIL because `LandingPanel` does not accept the new class-trial props.

- [ ] **Step 3: Add `LandingPanel` props and UI**

In `src/components/game/LandingPanel.tsx`, import the mode type:

```ts
import type { ClassTrialThemeMode } from "./classTrialTheme";
```

Extend the props object:

```ts
  classTrialThemeMode,
  classTrialPackAvailable,
  classTrialPackMessage,
  onSelectClassTrialThemeMode,
```

Extend the prop type:

```ts
  classTrialThemeMode: ClassTrialThemeMode;
  classTrialPackAvailable: boolean;
  classTrialPackMessage: string;
  onSelectClassTrialThemeMode: (mode: ClassTrialThemeMode) => void;
```

Add this block above the board strip in the mobile dock:

```tsx
            <section className="class-trial-mode-card rounded-2xl border border-[#d8c36d]/26 bg-[#14131d]/78 p-4 shadow-lg shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8c36d]/72">Local Theme</div>
                  <h3 className="mt-1 text-base font-semibold text-[#fff2be]">学级裁判主题局</h3>
                  <p className="mt-1 text-xs leading-5 text-[#c9bec7]">
                    本地限定主题，只影响单机/观战局的角色、视觉和演出，不进入公网房间。
                  </p>
                </div>
                <span className="rounded-full border border-[#f04b67]/35 bg-[#2d1018]/70 px-2 py-1 text-xs font-semibold text-[#ffd6dd]">
                  本地限定
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={classTrialThemeMode === "default"}
                  onClick={() => onSelectClassTrialThemeMode("default")}
                  className={[
                    "rounded-xl border px-3 py-2 text-left text-xs transition",
                    classTrialThemeMode === "default"
                      ? "border-[#f1c76e]/58 bg-[#2c2015]/80 text-[#f7ead5]"
                      : "border-white/10 bg-black/18 text-[#ad9c7d] hover:border-[#f1c76e]/35",
                  ].join(" ")}
                >
                  默认狼人杀
                </button>
                <button
                  type="button"
                  aria-pressed={classTrialThemeMode === "class-trial"}
                  onClick={() => onSelectClassTrialThemeMode("class-trial")}
                  className={[
                    "rounded-xl border px-3 py-2 text-left text-xs transition",
                    classTrialThemeMode === "class-trial"
                      ? "border-[#d8c36d]/72 bg-[#2b2534]/88 text-[#fff2be]"
                      : "border-white/10 bg-black/18 text-[#ad9c7d] hover:border-[#d8c36d]/45",
                  ].join(" ")}
                >
                  学级裁判主题局
                </button>
              </div>
              <p className={["mt-3 text-xs leading-5", classTrialPackAvailable ? "text-[#a8f0b6]" : "text-[#ffd6dd]"].join(" ")}>
                {classTrialPackMessage}
              </p>
            </section>
```

- [ ] **Step 4: Wire mode state in `GameClient`**

In `src/components/GameClient.tsx`, import:

```ts
import {
  CLASS_TRIAL_THEME_MODE_STORAGE_KEY,
  getClassTrialPackStatus,
  parseClassTrialThemeMode,
  type ClassTrialPackManifest,
  type ClassTrialThemeMode,
} from "./game/classTrialTheme";
```

Add state near other local UI state:

```ts
  const [classTrialThemeMode, setClassTrialThemeMode] = useState<ClassTrialThemeMode>("default");
  const [classTrialPackManifest, setClassTrialPackManifest] = useState<ClassTrialPackManifest | undefined>();
```

Add derived status:

```ts
  const classTrialPackStatus = useMemo(() => getClassTrialPackStatus(classTrialPackManifest), [classTrialPackManifest]);
```

Inside the first localStorage-loading `useEffect`, add:

```ts
      setClassTrialThemeMode(parseClassTrialThemeMode(window.localStorage.getItem(CLASS_TRIAL_THEME_MODE_STORAGE_KEY)));
```

Add a second effect to probe an optional public manifest path. This first slice should tolerate 404:

```ts
  useEffect(() => {
    let cancelled = false;
    void fetch("/class-trial-pack/manifest.json")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((manifest: ClassTrialPackManifest | undefined) => {
        if (!cancelled) setClassTrialPackManifest(manifest);
      })
      .catch(() => {
        if (!cancelled) setClassTrialPackManifest(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

Add a selector callback:

```ts
  const selectClassTrialThemeMode = useCallback((mode: ClassTrialThemeMode) => {
    setClassTrialThemeMode(mode);
    window.localStorage.setItem(CLASS_TRIAL_THEME_MODE_STORAGE_KEY, mode);
  }, []);
```

Pass props to `LandingPanel`:

```tsx
            classTrialThemeMode={classTrialThemeMode}
            classTrialPackAvailable={classTrialPackStatus.available}
            classTrialPackMessage={classTrialPackStatus.message}
            onSelectClassTrialThemeMode={selectClassTrialThemeMode}
```

- [ ] **Step 5: Run the focused landing test**

Run:

```powershell
npm run test -- src/components/game/gamePanelsMobile.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/components/GameClient.tsx src/components/game/LandingPanel.tsx src/components/game/gamePanelsMobile.test.ts
git commit -m "feat: add class trial theme entry"
```

## Task 3: Themed Table Visual Shell

**Files:**
- Create: `src/components/game/ClassTrialGameTable.tsx`
- Create: `src/components/game/classTrialGameTable.test.ts`
- Modify: `src/components/game/GamePanels.tsx`
- Modify: `src/components/GameClient.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing static markup tests**

Create `src/components/game/classTrialGameTable.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { HumanGameView } from "@/game/types";
import { ClassTrialGameTable } from "./ClassTrialGameTable";

function makeGame(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "game-1",
    day: 2,
    phase: "DAY_SPEECH",
    phaseLabel: "白天发言",
    board: {
      id: "9p-seer-witch-hunter",
      name: "9人预女猎",
      description: "test",
      seatCount: 9,
      roleSummary: "3狼 3民 预言家 女巫 猎人",
      hasGuard: false,
      hasSheriff: false,
      winCondition: "side-slaughter",
    },
    humanSeatId: null,
    seats: Array.from({ length: 9 }, (_, index) => ({
      seatId: index + 1,
      name: `角色${index + 1}`,
      isAi: true,
      isHuman: false,
      alive: true,
      personaName: `角色${index + 1}`,
    })),
    publicEvents: [],
    privateEvents: [],
    availableActions: [{ type: "continue", label: "继续", description: "继续推进" }],
    currentSpeakerSeatId: 3,
    wolfTeammates: [],
    seerChecks: [],
    votes: {},
    tableSummary: {
      recentSpeeches: [{ seq: 10, day: 2, speaker: { seatId: 3, name: "角色3" }, message: "先不要急着归票。" }],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      claimBoard: [],
      aiReasonHighlights: [],
      phaseSteps: [],
      tableMemory: {
        day: 2,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    ...overrides,
  };
}

describe("ClassTrialGameTable", () => {
  it("renders the central phase and speaker without identity labels", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("class-trial-table");
    expect(html).toContain("白天发言");
    expect(html).toContain("角色3 发言中");
    expect(html).toContain("先不要急着归票。");
    expect(html).not.toContain("预言家");
    expect(html).not.toContain("狼人");
  });

  it("keeps a visible way back to the default table flow", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: true,
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("返回首页");
    expect(html).toContain("继续");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts
```

Expected: FAIL because `ClassTrialGameTable.tsx` does not exist.

- [ ] **Step 3: Implement the visual shell**

Create `src/components/game/ClassTrialGameTable.tsx`:

```tsx
"use client";

import type { HumanGameView } from "@/game/types";
import type { CommandPayload } from "./clientTypes";

function getSpeakerName(game: HumanGameView): string {
  const seatId = game.currentSpeakerSeatId ?? game.currentActorSeatId;
  return game.seats.find((seat) => seat.seatId === seatId)?.name ?? "等待发言";
}

function getLatestSpeakerMessage(game: HumanGameView): string {
  const seatId = game.currentSpeakerSeatId ?? game.currentActorSeatId;
  const speech = [...game.tableSummary.recentSpeeches].reverse().find((item) => !seatId || item.speaker?.seatId === seatId);
  return speech?.message ?? "正在思考/准备发言。";
}

export function ClassTrialGameTable({
  game,
  loading,
  onReturnHome,
  onSubmit,
}: {
  game: HumanGameView;
  loading: boolean;
  onReturnHome: () => void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  const speakerName = getSpeakerName(game);
  const message = getLatestSpeakerMessage(game);
  const continueAction = game.availableActions.find((action) => action.type === "continue");

  return (
    <section className="class-trial-table">
      <div className="class-trial-table-background" aria-hidden="true" />
      <header className="class-trial-table-topbar">
        <div>
          <span className="class-trial-table-kicker">Local Theme</span>
          <h2>学级裁判主题局</h2>
        </div>
        <button type="button" onClick={onReturnHome} className="class-trial-table-secondary">
          返回首页
        </button>
      </header>

      <div className="class-trial-ring" aria-label="9人环形裁判席">
        {game.seats.map((seat, index) => (
          <div
            key={seat.seatId}
            className={["class-trial-seat", seat.seatId === game.currentSpeakerSeatId ? "class-trial-seat-active" : ""].join(" ")}
            style={{ "--seat-index": index, "--seat-total": game.seats.length } as React.CSSProperties}
          >
            <span>{seat.name}</span>
          </div>
        ))}
      </div>

      <section className="class-trial-info-table" aria-label="当前阶段">
        <span>{game.phaseLabel}</span>
        <strong>{speakerName} 发言中</strong>
      </section>

      <section className="class-trial-focus" aria-label="当前发言者">
        <div className="class-trial-portrait-placeholder">
          <span>{speakerName}</span>
        </div>
        <div className="class-trial-dialogue">
          <h3>{speakerName}</h3>
          <p>{message}</p>
        </div>
      </section>

      {continueAction && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void onSubmit({ type: "continue" })}
          className="class-trial-table-primary"
        >
          {loading ? "推进中" : continueAction.label}
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Export and render it only for local theme mode**

In `src/components/game/GamePanels.tsx`, add:

```ts
export { ClassTrialGameTable } from "./ClassTrialGameTable";
```

In `src/components/GameClient.tsx`, import `ClassTrialGameTable` from `./game/GamePanels`.

Before the main return, add:

```ts
  const classTrialThemeActive = classTrialThemeMode === "class-trial" && Boolean(game);
```

In the `{game ? ... }` branch, render `ClassTrialGameTable` before `MobileGameTable`:

```tsx
            {classTrialThemeActive ? (
              <ClassTrialGameTable game={game} loading={loading} onReturnHome={returnHome} onSubmit={submitCommand} />
            ) : (
              <MobileGameTable
                game={game}
                loading={loading}
                pendingCommandType={pendingCommandType}
                liveAiSpeech={liveAiSpeech}
                hostAudioEnabled={hostAudioEnabled}
                aiSpeechAudioEnabled={aiSpeechAudioEnabled}
                hostAudioStatus={hostAudioStatus}
                aiSpeechAudioStatus={aiSpeechAudioStatus}
                aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
                events={latestEvents}
                onNewGame={() => startGame()}
                onReturnHome={returnHome}
                onSubmit={submitCommand}
                onOpenIdentityBook={() => setIdentityBookOpen(true)}
                onOpenGlossary={() => setGlossaryOpen(true)}
                onToggleAiSpeechAudio={toggleAiSpeechAudio}
                onToggleHostAudio={toggleHostAudio}
              />
            )}
```

Keep the existing desktop `.hidden gap-4 sm:grid` area unchanged in this first slice unless manual browser verification shows duplicate table controls are confusing. If duplication is too noisy, gate that block with `!classTrialThemeActive`.

- [ ] **Step 5: Add scoped CSS**

Append to `src/app/globals.css` near mobile/table component sections:

```css
.class-trial-table {
  position: relative;
  min-height: calc(100svh - 6rem);
  overflow: hidden;
  border: 1px solid rgba(216, 195, 109, 0.28);
  border-radius: 24px;
  background: radial-gradient(circle at 50% 42%, rgba(190, 42, 66, 0.34), transparent 24%),
    radial-gradient(circle at 50% 52%, #211925 0 24%, #0f1018 58%, #050508 100%);
  color: #f8fafc;
}

.class-trial-table-topbar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.class-trial-table-kicker {
  color: rgba(216, 195, 109, 0.78);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.class-trial-table-topbar h2 {
  margin-top: 0.25rem;
  font-size: 1.4rem;
  font-weight: 800;
}

.class-trial-table-secondary,
.class-trial-table-primary {
  border-radius: 999px;
  border: 1px solid rgba(216, 195, 109, 0.48);
  background: rgba(12, 13, 19, 0.78);
  color: #fff2be;
  font-size: 0.875rem;
  font-weight: 800;
  min-height: 2.5rem;
  padding: 0.65rem 1rem;
}

.class-trial-ring {
  position: absolute;
  inset: 8% 7% 18%;
  opacity: 0.38;
  filter: blur(1.8px);
}

.class-trial-ring::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 48%;
  width: min(56vw, 580px);
  height: min(28vw, 260px);
  transform: translate(-50%, -50%);
  border: 2px solid rgba(216, 195, 109, 0.78);
  border-radius: 50%;
  box-shadow: 0 0 0 44px rgba(216, 195, 109, 0.08), 0 24px 80px rgba(0, 0, 0, 0.65);
}

.class-trial-seat {
  --angle: calc((360deg / var(--seat-total)) * var(--seat-index) - 90deg);
  position: absolute;
  left: calc(50% + cos(var(--angle)) * min(28vw, 300px));
  top: calc(48% + sin(var(--angle)) * min(16vw, 170px));
  width: 5rem;
  min-height: 6rem;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(216, 195, 109, 0.62);
  border-radius: 0.75rem;
  background: linear-gradient(180deg, #3b3341, #17161c);
  display: grid;
  place-items: center;
  padding: 0.5rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
}

.class-trial-seat-active {
  border-color: rgba(240, 75, 103, 0.96);
  box-shadow: 0 0 24px rgba(240, 75, 103, 0.38);
}

.class-trial-info-table {
  position: absolute;
  left: 50%;
  top: 36%;
  transform: translate(-50%, -50%);
  z-index: 4;
  width: min(78vw, 330px);
  border: 1px solid rgba(216, 195, 109, 0.9);
  border-radius: 0.875rem;
  background: rgba(11, 12, 18, 0.84);
  box-shadow: 0 0 32px rgba(216, 195, 109, 0.2);
  color: #fff2be;
  padding: 1rem;
  text-align: center;
}

.class-trial-info-table span {
  display: block;
  color: rgba(216, 195, 109, 0.78);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.class-trial-info-table strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.35rem;
}

.class-trial-focus {
  position: absolute;
  left: 4%;
  right: 4%;
  bottom: 4%;
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(220px, 32%) minmax(0, 1fr);
  align-items: end;
  gap: 1rem;
}

.class-trial-portrait-placeholder {
  min-height: 22rem;
  border: 2px solid rgba(238, 207, 123, 0.72);
  border-radius: 1.5rem 1.5rem 0 0;
  background: linear-gradient(140deg, #2c3345 0 22%, #171b29 22% 48%, #4f2734 48% 70%, #14131a 70%);
  display: grid;
  place-items: start center;
  padding-top: 1.25rem;
  color: #fff2be;
  font-weight: 900;
  box-shadow: 0 0 60px rgba(238, 207, 123, 0.2);
}

.class-trial-dialogue {
  position: relative;
  min-height: 12rem;
  border: 2px solid #f04b67;
  border-radius: 1rem;
  background: rgba(252, 252, 255, 0.94);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45), 0 0 0 8px rgba(240, 75, 103, 0.12);
  color: #111827;
  padding: 1.5rem;
}

.class-trial-dialogue h3 {
  margin-bottom: 0.75rem;
  color: #be263f;
  font-size: 1.35rem;
  font-weight: 900;
}

.class-trial-dialogue p {
  font-size: clamp(1.1rem, 2.1vw, 1.7rem);
  font-weight: 750;
  line-height: 1.62;
}

.class-trial-table-primary {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  z-index: 6;
}

@media (max-width: 780px) {
  .class-trial-focus {
    grid-template-columns: 1fr;
  }

  .class-trial-portrait-placeholder {
    min-height: 12rem;
    opacity: 0.62;
  }
}
```

If the CSS parser rejects `sin()`/`cos()` in target browsers or tests, replace the computed seat positions with index classes in the component before committing.

- [ ] **Step 6: Run focused tests and lint**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
npm run lint
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/components/game/ClassTrialGameTable.tsx src/components/game/classTrialGameTable.test.ts src/components/game/GamePanels.tsx src/components/GameClient.tsx src/app/globals.css
git commit -m "feat: add class trial table shell"
```

## Task 4: Task Card, State Records, And Browser Verification

**Files:**
- Create: `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Create the task card**

Create `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`:

```md
# 学级裁判主题局第一期

## Task

Short name: class-trial-theme-mode-foundation

Goal: Add a local-only class trial theme entry and visual shell without changing rules, rooms, or Public Alpha behavior.

Why it matters: The theme mode needs a safe local foundation before adding private assets, GPT-SoVITS routing, or LLM character behavior.

## Task Gate

Task type: Frontend/UI

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> select 学级裁判主题局 -> start a 9p spectator game -> confirm themed shell; also confirm /rooms does not show the theme.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: production/release check
- Reason: first slice is local-only and must not change Public Alpha or deployment.
- Residual risk: local browser verification does not prove later GPT-SoVITS or real LLM behavior.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-27-class-trial-theme-mode-design.md`
- `docs/superpowers/plans/2026-05-27-class-trial-theme-mode-foundation.md`

## Allowed Scope

Files or directories the agent may edit:

- `.gitignore`
- `src/components/GameClient.tsx`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/GamePanels.tsx`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/*.test.ts`
- `src/app/globals.css`
- `docs/tasks/2026-05-class-trial-theme-mode-foundation.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- `src/game/**`
- `src/server/**`
- `src/app/api/**`
- `src/app/rooms/**`
- `local-assets/**` real private assets

## Definition Of Done

This task is complete when:

- The local asset directory is ignored.
- The homepage can select default or 学级裁判主题局.
- Missing local pack state is explained clearly.
- Starting a local game in theme mode shows the class-trial visual shell.
- Rooms/Public Alpha surfaces are unchanged.
- Focused tests, lint, and browser flow pass or skipped checks are explained.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- Browser/manual local flow.

Optional deeper checks:

- `npx tsc --noEmit`
- `npm run smoke:main-game -- --base-url=http://127.0.0.1:<port>`

If a check cannot be run, record the reason in the handoff.
```

- [ ] **Step 2: Update `feature_list.json`**

Add a feature entry:

```json
{
  "id": "class-trial-theme-mode-foundation",
  "name": "Class Trial Theme Mode Foundation",
  "description": "Local-only class trial theme entry, ignored private asset-pack convention, missing-pack status, and first ring-table visual shell without changing rules or rooms.",
  "dependencies": ["ai-pool-character-roster"],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-05-27-class-trial-theme-mode-design.md; docs/superpowers/plans/2026-05-27-class-trial-theme-mode-foundation.md; docs/tasks/2026-05-class-trial-theme-mode-foundation.md; npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts; npm run lint; browser local homepage/theme flow"
}
```

- [ ] **Step 3: Update `progress.md` and `session-handoff.md`**

Record:

- class-trial first slice done;
- changed files;
- commands run;
- browser URL and flow;
- production checks skipped because local-only;
- next recommended step: local theme pack manifest and placeholder asset preview, then GPT-SoVITS planning after all 9 voices are prepared.

- [ ] **Step 4: Run state checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-theme-mode-foundation.md
npm run harness:check
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"
git diff --check
```

Expected: PASS. `git diff --check` may report only known CRLF replacement warnings; no trailing whitespace errors.

- [ ] **Step 5: Browser/manual verification**

Start or reuse a local dev server:

```powershell
npm run dev
```

Open the printed local URL. Verify:

1. homepage shows "学级裁判主题局";
2. selecting it stores the mode;
3. missing local pack warning is visible if no pack exists;
4. start a 9p spectator game;
5. themed table shell renders with center phase/speaker and dialogue;
6. `/rooms` still does not expose the theme entry.

- [ ] **Step 6: Commit**

Run:

```powershell
git add docs/tasks/2026-05-class-trial-theme-mode-foundation.md feature_list.json progress.md session-handoff.md
git commit -m "docs: record class trial theme foundation"
```

## Self-Review Checklist

- Spec coverage: this plan covers local-only mode entry, ignored private assets, missing-pack status, B-style center info table, and first speaking focus placeholder. GPT-SoVITS, LLM role behavior, and real assets are intentionally deferred to separate plans.
- Placeholder scan: no step uses TBD/TODO/fill-in language; each code step includes exact target content.
- Type consistency: `ClassTrialThemeMode`, `ClassTrialPackManifest`, and `ClassTrialPackStatus` are defined in Task 1 and reused by later tasks.
- Public Alpha safety: no task touches `src/app/rooms/**`, `src/app/api/rooms/**`, `src/server/**`, or production docs.
