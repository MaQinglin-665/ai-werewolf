# Class Trial Verdict Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only class-trial court background, persistent death-seat markers, and an automatic theme-styled verdict review after game over.

**Architecture:** Keep the feature inside the existing class-trial theme boundary. Parse optional background metadata in `classTrialTheme.ts`, render the local background and death state in `ClassTrialGameTable`, and add a standalone `ClassTrialVerdictReview` component that reads existing `HumanGameView.review` data without changing rules or APIs.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest render-to-static-markup component tests, CSS in `src/app/globals.css`, local ignored image asset under `local-assets/class-trial-pack`.

---

### Task 1: Task Card And State Shell

**Files:**
- Create: `docs/tasks/2026-05-class-trial-verdict-review.md`
- Modify later: `feature_list.json`
- Modify later: `progress.md`
- Modify later: `session-handoff.md`

- [ ] **Step 1: Create task card**

Create `docs/tasks/2026-05-class-trial-verdict-review.md` with scope, required checks, and handoff format. It must list this as `Frontend/UI + local-only visual asset`, risk `medium`, browser verification required, and production checks skipped because this remains local-only.

- [ ] **Step 2: Validate task card after implementation**

Run after the code/docs are updated:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-verdict-review.md
```

Expected: exit 0.

### Task 2: Local Court Background Asset

**Files:**
- Create ignored local file: `local-assets/class-trial-pack/backgrounds/court-main.png`
- Modify ignored local file: `local-assets/class-trial-pack/manifest.json`

- [ ] **Step 1: Generate image asset**

Use the built-in image generation tool with this prompt:

```text
Use case: game asset
Asset type: local private background for a web game board
Primary request: a red and black circular class-trial courtroom stage background for a social deduction game
Scene/backdrop: dramatic circular courtroom / trial arena, dark red walls, black floor, gold accent rails, radial perspective, central empty safe area for UI overlays
Style/medium: polished anime-inspired game UI background, painterly but clean, no characters
Composition/framing: wide 16:9 landscape, center kept readable and uncluttered, darker edges, subtle elevated tribunal/ring geometry
Lighting/mood: ominous, theatrical, high contrast but not neon, suitable behind small character avatar cards
Color palette: black, deep crimson, dark burgundy, muted gold
Constraints: no readable text, no logos, no watermark, no characters, no UI buttons, no copyrighted mascots, leave center space open for HTML-rendered seats
Avoid: busy details behind the center, bright white floor, blue sci-fi holograms, cyberpunk clutter, literal screenshots from existing games
```

- [ ] **Step 2: Save generated asset**

Copy the selected generated image to:

```text
local-assets/class-trial-pack/backgrounds/court-main.png
```

Do not stage this file because `/local-assets/` is ignored private data.

- [ ] **Step 3: Update local manifest**

Add this field to ignored `local-assets/class-trial-pack/manifest.json`:

```json
"backgrounds": {
  "courtMain": "/class-trial-pack/backgrounds/court-main.png"
}
```

Do not stage this file.

### Task 3: Manifest Background Parsing

**Files:**
- Modify: `src/components/game/classTrialTheme.test.ts`
- Modify: `src/components/game/classTrialTheme.ts`

- [ ] **Step 1: Write failing tests**

Add tests that describe the desired API:

```ts
it("reads an optional class-trial court background from the manifest", () => {
  const manifest = sanitizeClassTrialPackManifest({
    id: "class-trial-pack",
    version: "local",
    backgrounds: { courtMain: "/class-trial-pack/backgrounds/court-main.png" },
    characters: [],
  });

  expect(manifest?.backgrounds?.courtMain).toBe("/class-trial-pack/backgrounds/court-main.png");
  expect(getClassTrialCourtBackgroundUrl(manifest)).toBe("/class-trial-pack/backgrounds/court-main.png");
});

it("keeps old class-trial manifests valid when backgrounds are absent", () => {
  const manifest = sanitizeClassTrialPackManifest({
    id: "class-trial-pack",
    version: "local",
    characters: [],
  });

  expect(manifest?.backgrounds).toBeUndefined();
  expect(getClassTrialCourtBackgroundUrl(manifest)).toBeUndefined();
});
```

- [ ] **Step 2: Run red test**

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: fail because `sanitizeClassTrialPackManifest` and/or `getClassTrialCourtBackgroundUrl` do not exist yet.

- [ ] **Step 3: Implement minimal parsing helper**

Add `backgrounds?: { courtMain?: string }` to `ClassTrialPackManifest`, add `sanitizeClassTrialPackManifest(value: unknown)`, and add:

```ts
export function getClassTrialCourtBackgroundUrl(manifest: ClassTrialPackManifest | undefined): string | undefined {
  return readString(manifest?.backgrounds?.courtMain, 240);
}
```

Keep existing manifest usage compatible by having `sanitizeClassTrialPackManifest` sanitize `characters` with existing `readString` and `readPortraitLayout` helpers.

- [ ] **Step 4: Run green test**

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: pass.

### Task 4: Theme Verdict Review Component

**Files:**
- Create: `src/components/game/ClassTrialVerdictReview.tsx`
- Create: `src/components/game/classTrialVerdictReview.test.ts`

- [ ] **Step 1: Write failing review tests**

Create tests covering:

```ts
it("renders the final verdict, evidence, vote fog, departures, and role reveal", () => {
  const html = renderToStaticMarkup(createElement(ClassTrialVerdictReview, { game: makeGameWithReview(), onReturnHome: () => undefined }));

  expect(html).toContain("最终裁决");
  expect(html).toContain("好人阵营胜利");
  expect(html).toContain("关键证据");
  expect(html).toContain("票型迷雾");
  expect(html).toContain("退场名单");
  expect(html).toContain("身份揭晓");
});

it("does not crash when optional review arrays are empty", () => {
  const html = renderToStaticMarkup(createElement(ClassTrialVerdictReview, { game: makeGameWithSparseReview(), onReturnHome: () => undefined }));

  expect(html).toContain("最终裁决");
  expect(html).toContain("暂无退场记录");
});
```

- [ ] **Step 2: Run red test**

```powershell
npm run test -- src/components/game/classTrialVerdictReview.test.ts
```

Expected: fail because the component does not exist.

- [ ] **Step 3: Implement component**

Implement a client component that:

- returns a graceful fallback when `game.review` is absent;
- shows `返回首页`;
- uses `review.result`, `review.turningPoints`, `review.voteImpacts`, `review.deathTimeline`, `review.roleReveal`, and `review.keyEvents`;
- limits key evidence and vote sections to the most useful handful of entries;
- does not request data or mutate state.

- [ ] **Step 4: Run green test**

```powershell
npm run test -- src/components/game/classTrialVerdictReview.test.ts
```

Expected: pass.

### Task 5: Wire Background, Death Seats, And Auto Review

**Files:**
- Modify: `src/components/game/ClassTrialGameTable.tsx`
- Modify: `src/components/game/classTrialGameTable.test.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing table tests**

Add tests that assert:

```ts
expect(html).toContain("class-trial-seat-dead");
expect(html).toContain("已退场");
expect(html).not.toContain("被毒");
expect(html).not.toContain("女巫");
expect(html).toContain("--class-trial-court-background:url(/class-trial-pack/backgrounds/court-main.png)");
expect(html).toContain("class-trial-verdict-review");
```

- [ ] **Step 2: Run red test**

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts
```

Expected: fail because death markers, background CSS variable, and auto review are not wired.

- [ ] **Step 3: Implement wiring**

Update `ClassTrialGameTable` to:

- import `ClassTrialVerdictReview`;
- import `getClassTrialCourtBackgroundUrl`;
- compute `const courtBackgroundUrl = getClassTrialCourtBackgroundUrl(manifest);`;
- set a CSS variable when present;
- render `ClassTrialVerdictReview` when `game.result` is present;
- add `class-trial-seat-dead` and `已退场` when `!seat.alive`.

Update `globals.css` so `.class-trial-table-background` uses `var(--class-trial-court-background)` as the first background image when available, and style `.class-trial-seat-dead` plus `.class-trial-verdict-review`.

- [ ] **Step 4: Run green table tests**

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/classTrialVerdictReview.test.ts
```

Expected: pass.

### Task 6: State And Registry Updates

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-class-trial-verdict-review.md`

- [ ] **Step 1: Update feature registry**

Add feature id `class-trial-verdict-review`, name `Class Trial Verdict Review`, dependency `class-trial-flow-scenes`, status `done` after verification, and evidence listing files/commands/browser checks.

- [ ] **Step 2: Update progress and handoff**

Record current state, changed files, verification evidence, remaining risks, and next step. Include that `local-assets/class-trial-pack/backgrounds/court-main.png` and manifest changes are ignored local data and must not be staged.

### Task 7: Verification

**Files:** none unless verification exposes issues.

- [ ] **Step 1: Focused tests**

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialVerdictReview.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: pass.

- [ ] **Step 2: Broader checks**

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run harness:task-card -- docs/tasks/2026-05-class-trial-verdict-review.md
npm run harness:check
git diff --check
```

Expected: pass, except any pre-existing line-ending warnings should be recorded as such.

- [ ] **Step 3: Browser verification**

Run local dev server and verify:

- homepage -> `学级裁判主题局` -> no-human spectator game;
- generated red/black court background appears;
- at least one dead seat shows `已退场` without role/death reason;
- `GAME_OVER` automatically shows the verdict review;
- `/rooms` has no class-trial entry.

