# Class Trial UI Polish And Tomori Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace seat 8 with Takamatsu Tomori and polish the local class-trial speaking surface with a left portrait, large dialogue box, and hybrid typewriter timing.

**Architecture:** Keep the existing local-only class-trial route and table shell. Update the fixed roster and ignored local asset pack, add one small dialogue helper for deterministic typewriter behavior, and keep visual rendering inside `ClassTrialGameTable.tsx` plus existing `.class-trial-*` CSS.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, local ignored `local-assets/class-trial-pack`, existing class-trial asset route.

---

## File Structure

- `src/components/game/classTrialTheme.ts`: replace `hagakure` with `tomori` in the fixed roster and accepted local persona ids.
- `src/components/game/classTrialTheme.test.ts`: update expected roster and add Tomori status/AI friend assertions.
- `local-assets/class-trial-pack/manifest.json`: ignored local manifest; replace the Hagakure entry with Tomori asset paths.
- `local-assets/class-trial-pack/personas.json`: ignored local role card; replace the Hagakure role card with Tomori.
- `local-assets/class-trial-pack/avatars/高松灯.png`: ignored local avatar asset generated from the approved transparent PNG.
- `local-assets/class-trial-pack/portraits/高松灯.png`: ignored local halfbody/speaking portrait asset generated from the approved transparent PNG.
- `src/components/game/classTrialDialogue.ts`: new pure helper for splitting text and resolving typewriter mode.
- `src/components/game/classTrialDialogue.test.ts`: new focused tests for short-text character mode, long-text segment mode, thinking state text, and reduced-motion fallback.
- `src/components/game/ClassTrialGameTable.tsx`: consume the dialogue helper, add thinking/typewriter display state, and refine semantic markup.
- `src/components/game/classTrialGameTable.test.ts`: assert Tomori rendering, no identity leak, thinking/fallback text, and dialogue markup.
- `src/app/globals.css`: adjust existing `.class-trial-*` classes for the approved left-portrait/right-dialogue layout, weaker background ring, mobile stacking, and reduced-motion behavior.
- `src/components/game/gamePanelsMobile.test.ts`: update any fixed roster text expectation that still names Hagakure.
- `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`: task card for harness execution.
- `feature_list.json`, `progress.md`, `session-handoff.md`: mark implementation state and evidence when complete.

## Task 1: Create The Harness Task Card

Status: completed during plan setup. Do not repeat this task during implementation unless the task card is missing.

**Files:**
- Create: `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`

- [x] **Step 1: Write the task card**

Create `docs/tasks/2026-05-class-trial-ui-polish-tomori.md` with this content:

```markdown
# 学级裁判主题局 UI 打磨与高松灯替换

## Task

Short name: class-trial-ui-polish-tomori

Goal: Replace seat 8 Hagakure with Takamatsu Tomori and polish the local class-trial speaking UI.

Why it matters: The theme should be video-ready while GPT-SoVITS voices are still being trained.

## Task Gate

Task type: Frontend/UI + local assets + AI persona metadata

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local homepage -> 学级裁判主题局 -> start game -> confirm seat 8 is 高松灯 -> continue to at least one AI speech -> confirm left portrait/right dialogue, thinking pause, typewriter display, and no /rooms theme entry.
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
- Residual risk: local browser verification cannot prove future GPT-SoVITS voice timing.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/frontend.md`
- `docs/superpowers/specs/2026-05-28-class-trial-ui-polish-tomori-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-ui-polish-tomori.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/classTrialDialogue.ts`
- `src/components/game/classTrialDialogue.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/app/globals.css`
- `local-assets/class-trial-pack/manifest.json` as ignored local-only data
- `local-assets/class-trial-pack/personas.json` as ignored local-only data
- `local-assets/class-trial-pack/avatars/高松灯.png` as ignored local-only data
- `local-assets/class-trial-pack/portraits/高松灯.png` as ignored local-only data
- `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- committed image/audio assets
- generated caches
- `src/game/engine.ts`
- `src/app/rooms/**`
- `src/server/roomService.ts`
- Public Alpha deployment docs unless a later release task asks for it

## Definition Of Done

This task is complete when:

- Fixed class-trial roster uses `tomori` and `高松灯` at seat 8.
- Ignored local manifest and personas file use Tomori instead of Hagakure.
- Ignored local avatar and portrait files for 高松灯 exist and remain untracked.
- Theme game seat order is 苗木诚、雾切响子、腐川冬子、黑白熊、江之岛盾子、塞蕾丝缇雅、十神白夜、高松灯、千早爱音.
- Speaking focus uses left portrait plus right large dialogue box.
- Background ring is visually weaker while active speaker remains identifiable.
- Dialogue shows thinking pause and hybrid typewriter behavior.
- Reduced-motion or animation fallback shows plain text.
- Identity labels remain hidden from the dialogue UI.
- `/rooms` remains unchanged.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md`
- `npm run harness:check`
- Browser/manual local flow.

Optional deeper checks:

- `npm run test`

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- ...

Changed files:
- ...

Verification:
- ...

Remaining risks:
- ...
```
```

- [x] **Step 2: Run the task-card check and verify it passes**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md
```

Expected: `ok  task card gate passed`.

- [x] **Step 3: Commit the task card with this plan**

Run:

```powershell
git add docs/superpowers/plans/2026-05-28-class-trial-ui-polish-tomori.md docs/tasks/2026-05-class-trial-ui-polish-tomori.md feature_list.json progress.md
git commit -m "docs: plan class trial ui polish tomori"
```

## Task 2: Replace Hagakure With Tomori In The Fixed Roster

**Files:**
- Modify: `src/components/game/classTrialTheme.ts`
- Modify: `src/components/game/classTrialTheme.test.ts`

- [ ] **Step 1: Write the failing roster test**

In `src/components/game/classTrialTheme.test.ts`, update the fixed roster expectations so the current code fails until the roster changes:

```ts
expect(CLASS_TRIAL_CHARACTER_ROSTER.map((character) => character.displayName)).toEqual([
  "苗木诚",
  "雾切响子",
  "腐川冬子",
  "黑白熊",
  "江之岛盾子",
  "塞蕾丝缇雅",
  "十神白夜",
  "高松灯",
  "千早爱音",
]);
expect(CLASS_TRIAL_CHARACTER_IDS).toContain("tomori");
expect(CLASS_TRIAL_CHARACTER_IDS).not.toContain("hagakure");
expect(getClassTrialCharacterForSeat(7, undefined)).toMatchObject({ id: "tomori", displayName: "高松灯" });
expect(getClassTrialCharacterForSeat(8, undefined)).toMatchObject({ id: "anon", displayName: "千早爱音" });
```

Also update the AI friend order expectation:

```ts
expect(friends.map((friend) => friend.nickname)).toEqual([
  "苗木诚",
  "雾切响子",
  "腐川冬子",
  "黑白熊",
  "江之岛盾子",
  "塞蕾丝缇雅",
  "十神白夜",
  "高松灯",
  "千早爱音",
]);
expect(friends[7]?.id).toBe("class-trial:tomori");
expect(friends[7]?.roleCard?.displayName).toBe("高松灯");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: FAIL because the roster still contains `叶隐康比吕` and `hagakure`.

- [ ] **Step 3: Update the roster constants**

In `src/components/game/classTrialTheme.ts`, replace the old id/display name:

```ts
export const CLASS_TRIAL_CHARACTER_IDS = [
  "naegi",
  "kirigiri",
  "fukawa",
  "monokuma",
  "enoshima",
  "celestia",
  "togami",
  "tomori",
  "anon",
] as const;

export const CLASS_TRIAL_CHARACTER_ROSTER: Array<{ id: ClassTrialCharacterId; displayName: string }> = [
  { id: "naegi", displayName: "苗木诚" },
  { id: "kirigiri", displayName: "雾切响子" },
  { id: "fukawa", displayName: "腐川冬子" },
  { id: "monokuma", displayName: "黑白熊" },
  { id: "enoshima", displayName: "江之岛盾子" },
  { id: "celestia", displayName: "塞蕾丝缇雅" },
  { id: "togami", displayName: "十神白夜" },
  { id: "tomori", displayName: "高松灯" },
  { id: "anon", displayName: "千早爱音" },
];
```

- [ ] **Step 4: Run the focused roster test**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the roster replacement**

Run:

```powershell
git add src/components/game/classTrialTheme.ts src/components/game/classTrialTheme.test.ts
git commit -m "feat: replace class trial seat eight with tomori"
```

## Task 3: Update Ignored Local Tomori Assets And Role Card

**Files:**
- Modify: `local-assets/class-trial-pack/manifest.json` ignored local file
- Modify: `local-assets/class-trial-pack/personas.json` ignored local file
- Create: `local-assets/class-trial-pack/avatars/高松灯.png` ignored local file
- Create: `local-assets/class-trial-pack/portraits/高松灯.png` ignored local file

- [ ] **Step 1: Download or copy the approved transparent PNG into local assets**

Use the approved Wikia transparent image. If the previously downloaded preview exists, copy it; otherwise download it:

```powershell
$source = "D:\ai-werewolf\.superpowers\brainstorm\tomori-preview-assets\tomori-transparent.png"
$portrait = "D:\ai-werewolf\local-assets\class-trial-pack\portraits\高松灯.png"
$avatar = "D:\ai-werewolf\local-assets\class-trial-pack\avatars\高松灯.png"
if (Test-Path -LiteralPath $source) {
  Copy-Item -LiteralPath $source -Destination $portrait -Force
  Copy-Item -LiteralPath $source -Destination $avatar -Force
} else {
  $url = "https://static.wikia.nocookie.net/bandori/images/2/29/Let%27s_Start_a_Lifetime_%28Takamatsu_Tomori%29_transparent.png/revision/latest?cb=20230915161938"
  Invoke-WebRequest -Uri $url -OutFile $portrait -Headers @{ "User-Agent" = "Mozilla/5.0" } -TimeoutSec 30
  Copy-Item -LiteralPath $portrait -Destination $avatar -Force
}
```

- [ ] **Step 2: Verify the ignored asset files exist**

Run:

```powershell
Get-Item -LiteralPath "local-assets\class-trial-pack\portraits\高松灯.png", "local-assets\class-trial-pack\avatars\高松灯.png" |
  Select-Object Name, Length
git status --short --ignored local-assets/class-trial-pack/portraits/高松灯.png local-assets/class-trial-pack/avatars/高松灯.png
```

Expected: both files have non-zero length; Git reports them under ignored `!! local-assets/`.

- [ ] **Step 3: Update the ignored local manifest**

In `local-assets/class-trial-pack/manifest.json`, replace the Hagakure object with:

```json
{
  "id": "tomori",
  "displayName": "高松灯",
  "portraitUrl": "/class-trial-pack/portraits/高松灯.png",
  "avatarUrl": "/class-trial-pack/avatars/高松灯.png",
  "hasPortrait": true,
  "hasAvatar": true
}
```

Keep the object at seat-order position 8, between Togami and Anon.

- [ ] **Step 4: Update the ignored local role card**

In `local-assets/class-trial-pack/personas.json`, replace the Hagakure object with:

```json
{
  "id": "tomori",
  "displayName": "高松灯",
  "seatId": 8,
  "basePersonaId": "gemini-quiet-observer",
  "styleTags": ["sensitive", "earnest", "quiet-observer"],
  "speechStyleZh": "内向、敏感、认真，短句偏多，像把每一句话都当作证据一样小心确认。",
  "reasoningBias": "更关注发言里的停顿、前后不一致、被孤立的人和突然转移焦点的人。",
  "voteBias": "不喜欢草率定票，倾向投无法解释自己前后变化或持续回避问题的位置。",
  "nightActionBias": "夜晚行动偏谨慎，优先选择能保护阵营信息或减少明天混乱的合法目标。",
  "asVillager": "作为好人时用细小的发言变化和情绪断点找狼，但必须给出公开依据。",
  "asWerewolf": "作为狼人时尽量显得紧张而真诚，用公开发言里的细节转移焦点。",
  "pressureResponse": "被怀疑时先短暂停顿和紧张，再回到公开信息解释自己的判断。",
  "relationshipHints": ["对千早爱音的社交节奏会更敏感，但不能因为关系直接认好或认坏。"],
  "catchphrasePolicy": "允许极短犹豫式语气，不复刻长段原台词。",
  "forbidden": ["不能泄露隐藏身份。", "不能用作品设定或乐队关系替代狼人杀证据。"],
  "voiceProfileId": "tomori-ja-local",
  "voiceLocale": "ja-JP",
  "voiceRewritePolicy": "轻微意译，不改变狼人杀信息。"
}
```

- [ ] **Step 5: Verify local JSON and ignored status**

Run:

```powershell
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('local-assets/class-trial-pack/manifest.json','utf8')); const p=JSON.parse(fs.readFileSync('local-assets/class-trial-pack/personas.json','utf8')); console.log(m.characters.map(c=>c.displayName).join(',')); console.log(p.characters.map(c=>c.displayName).join(','));"
git status --short --ignored local-assets/class-trial-pack/manifest.json local-assets/class-trial-pack/personas.json local-assets/class-trial-pack/avatars/高松灯.png local-assets/class-trial-pack/portraits/高松灯.png
```

Expected output includes `十神白夜,高松灯,千早爱音`; Git reports ignored local assets, not tracked changes.

Do not commit ignored local files.

## Task 4: Add The Hybrid Dialogue Helper

**Files:**
- Create: `src/components/game/classTrialDialogue.ts`
- Create: `src/components/game/classTrialDialogue.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/components/game/classTrialDialogue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildClassTrialDialogueTimeline, getClassTrialDialogueFrame } from "./classTrialDialogue";

describe("class trial dialogue helper", () => {
  it("uses character steps for short lines", () => {
    const timeline = buildClassTrialDialogueTimeline("我还想再听一下。");
    expect(timeline.mode).toBe("characters");
    expect(timeline.frames.slice(0, 4)).toEqual(["我", "我还", "我还想", "我还想再"]);
    expect(timeline.frames.at(-1)).toBe("我还想再听一下。");
  });

  it("uses sentence steps for long speeches", () => {
    const text = "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。这个缺口需要高松灯继续追问。";
    const timeline = buildClassTrialDialogueTimeline(text);
    expect(timeline.mode).toBe("segments");
    expect(timeline.frames).toEqual([
      "我先回到上一轮的票型。",
      "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。",
      "我先回到上一轮的票型。十神白夜刚才给出的标准没有解释第五位。这个缺口需要高松灯继续追问。",
    ]);
  });

  it("falls back to full text for reduced motion", () => {
    const timeline = buildClassTrialDialogueTimeline("短句也直接显示。", { reducedMotion: true });
    expect(timeline.mode).toBe("full");
    expect(timeline.frames).toEqual(["短句也直接显示。"]);
  });

  it("returns thinking text before the first display frame", () => {
    const timeline = buildClassTrialDialogueTimeline("我会再想一下。");
    expect(getClassTrialDialogueFrame(timeline, -1)).toBe("正在思考/准备发言。");
    expect(getClassTrialDialogueFrame(timeline, 999)).toBe("我会再想一下。");
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npm run test -- src/components/game/classTrialDialogue.test.ts
```

Expected: FAIL because `classTrialDialogue.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/components/game/classTrialDialogue.ts`:

```ts
export type ClassTrialDialogueTimeline = {
  mode: "characters" | "segments" | "full";
  frames: string[];
  thinkingText: string;
};

export type ClassTrialDialogueOptions = {
  shortTextMaxLength?: number;
  reducedMotion?: boolean;
  thinkingText?: string;
};

const DEFAULT_SHORT_TEXT_MAX_LENGTH = 36;
const DEFAULT_THINKING_TEXT = "正在思考/准备发言。";
const SENTENCE_BOUNDARY = /(?<=[。！？；!?;])\s*/u;

export function buildClassTrialDialogueTimeline(
  text: string,
  options: ClassTrialDialogueOptions = {},
): ClassTrialDialogueTimeline {
  const normalized = normalizeDialogueText(text);
  const thinkingText = options.thinkingText ?? DEFAULT_THINKING_TEXT;
  if (!normalized) return { mode: "full", frames: [thinkingText], thinkingText };
  if (options.reducedMotion) return { mode: "full", frames: [normalized], thinkingText };

  const shortTextMaxLength = options.shortTextMaxLength ?? DEFAULT_SHORT_TEXT_MAX_LENGTH;
  if (countDisplayCharacters(normalized) <= shortTextMaxLength) {
    return {
      mode: "characters",
      frames: Array.from(normalized).map((_, index, chars) => chars.slice(0, index + 1).join("")),
      thinkingText,
    };
  }

  const segments = splitDialogueSegments(normalized);
  return {
    mode: "segments",
    frames: segments.map((_, index) => segments.slice(0, index + 1).join("")),
    thinkingText,
  };
}

export function getClassTrialDialogueFrame(timeline: ClassTrialDialogueTimeline, frameIndex: number): string {
  if (frameIndex < 0) return timeline.thinkingText;
  return timeline.frames[Math.min(frameIndex, timeline.frames.length - 1)] ?? timeline.thinkingText;
}

export function splitDialogueSegments(text: string): string[] {
  const normalized = normalizeDialogueText(text);
  if (!normalized) return [];
  const segments = normalized
    .split(SENTENCE_BOUNDARY)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : [normalized];
}

function normalizeDialogueText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function countDisplayCharacters(text: string): number {
  return Array.from(text).length;
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
npm run test -- src/components/game/classTrialDialogue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper**

Run:

```powershell
git add src/components/game/classTrialDialogue.ts src/components/game/classTrialDialogue.test.ts
git commit -m "feat: add class trial dialogue timeline"
```

## Task 5: Wire The Speaking UI To The Helper

**Files:**
- Modify: `src/components/game/ClassTrialGameTable.tsx`
- Modify: `src/components/game/classTrialGameTable.test.ts`

- [ ] **Step 1: Add focused table tests**

In `src/components/game/classTrialGameTable.test.ts`, add tests:

```ts
it("renders Tomori at seat eight without identity labels", () => {
  const html = renderToStaticMarkup(
    createElement(ClassTrialGameTable, {
      game: makeGame({
        currentSpeakerSeatId: 8,
        tableSummary: {
          ...makeGame().tableSummary,
          recentSpeeches: [{ seq: 11, day: 2, speaker: { seatId: 8, name: "高松灯" }, message: "我、我想再确认一下。" }],
        },
      }),
      loading: false,
      manifest: {
        id: "class-trial-pack",
        version: "local",
        characters: [{ id: "tomori", displayName: "高松灯", avatarUrl: "/class-trial-pack/avatars/高松灯.png", portraitUrl: "/class-trial-pack/portraits/高松灯.png" }],
      },
      onReturnHome: () => undefined,
      onSubmit: async () => undefined,
    }),
  );

  expect(html).toContain("高松灯 发言中");
  expect(html).toContain('src="/class-trial-pack/portraits/高松灯.png"');
  expect(html).toContain("我、我想再确认一下。");
  expect(html).not.toContain("预言家");
  expect(html).not.toContain("狼人");
});

it("marks the dialogue box as typewriter-ready", () => {
  const html = renderToStaticMarkup(
    createElement(ClassTrialGameTable, {
      game: makeGame(),
      loading: false,
      onReturnHome: () => undefined,
      onSubmit: async () => undefined,
    }),
  );

  expect(html).toContain("class-trial-dialogue-text");
  expect(html).toContain("aria-live=\"polite\"");
});
```

- [ ] **Step 2: Run table tests and verify they fail**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts
```

Expected: FAIL until roster, manifest, and dialogue markup are updated.

- [ ] **Step 3: Update the component imports and dialogue state**

In `src/components/game/ClassTrialGameTable.tsx`, change the import and add React hooks:

```ts
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildClassTrialDialogueTimeline, getClassTrialDialogueFrame } from "./classTrialDialogue";
```

Inside `ClassTrialGameTable`, after `const message = getLatestSpeakerMessage(game);`, add:

```ts
const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const timeline = useMemo(
  () => buildClassTrialDialogueTimeline(message, { reducedMotion: prefersReducedMotion }),
  [message, prefersReducedMotion],
);
const [dialogueFrameIndex, setDialogueFrameIndex] = useState(-1);
const displayedMessage = getClassTrialDialogueFrame(timeline, dialogueFrameIndex);

useEffect(() => {
  setDialogueFrameIndex(-1);
}, [speakerName, message]);

useEffect(() => {
  if (timeline.mode === "full") {
    setDialogueFrameIndex(0);
    return;
  }

  const delay = dialogueFrameIndex < 0 ? 650 : timeline.mode === "characters" ? 32 : 680;
  const timer = window.setTimeout(() => {
    setDialogueFrameIndex((current) => Math.min(current + 1, timeline.frames.length - 1));
  }, delay);

  return () => window.clearTimeout(timer);
}, [dialogueFrameIndex, timeline]);
```

- [ ] **Step 4: Update the dialogue markup**

Replace the current dialogue section body:

```tsx
<div className="class-trial-dialogue">
  <h3>{speakerName}</h3>
  <p>{message}</p>
</div>
```

with:

```tsx
<div className="class-trial-dialogue">
  <h3>{speakerName}</h3>
  <p className="class-trial-dialogue-text" aria-live="polite">
    {displayedMessage}
  </p>
</div>
```

- [ ] **Step 5: Run helper and table tests**

Run:

```powershell
npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit component wiring**

Run:

```powershell
git add src/components/game/ClassTrialGameTable.tsx src/components/game/classTrialGameTable.test.ts
git commit -m "feat: animate class trial dialogue"
```

## Task 6: Polish The Class-Trial CSS

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/game/classTrialGameTable.test.ts` if class names change

- [ ] **Step 1: Update CSS for the approved layout**

In `src/app/globals.css`, keep the existing `.class-trial-*` block but update these rules:

```css
.class-trial-ring {
  position: absolute;
  inset: 8% 7% 18%;
  filter: blur(2.4px);
  opacity: 0.28;
}

.class-trial-seat-active {
  opacity: 1;
  border-color: rgba(240, 75, 103, 0.96);
  box-shadow: 0 0 24px rgba(240, 75, 103, 0.48);
}

.class-trial-focus {
  position: absolute;
  right: 4%;
  bottom: 4%;
  left: 4%;
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(230px, 30%) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: end;
}

.class-trial-portrait-placeholder {
  position: relative;
  display: grid;
  min-height: 24rem;
  overflow: hidden;
  color: #fff2be;
  font-weight: 900;
  background: linear-gradient(140deg, #2c3345 0 22%, #171b29 22% 48%, #4f2734 48% 70%, #14131a 70%);
  border: 2px solid rgba(238, 207, 123, 0.72);
  border-radius: 1.5rem 1.5rem 0 0;
  box-shadow: 0 0 60px rgba(238, 207, 123, 0.2);
  place-items: end center;
}

.class-trial-portrait-image {
  width: 100%;
  height: 24rem;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 24px 30px rgba(0, 0, 0, 0.46));
}

.class-trial-dialogue {
  position: relative;
  min-height: 14rem;
  padding: 1.6rem 1.8rem;
  color: #111827;
  background: rgba(252, 252, 255, 0.96);
  border: 2px solid #f04b67;
  border-radius: 1.1rem;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45), 0 0 0 8px rgba(240, 75, 103, 0.12);
}

.class-trial-dialogue-text {
  min-height: 7.2rem;
  font-size: clamp(1.08rem, 2vw, 1.58rem);
  font-weight: 750;
  line-height: 1.68;
}

@media (prefers-reduced-motion: reduce) {
  .class-trial-ring,
  .class-trial-portrait-image,
  .class-trial-dialogue {
    transition: none;
  }
}
```

Keep the existing mobile media query, but update the portrait/dialogue sizing:

```css
@media (max-width: 780px) {
  .class-trial-focus {
    grid-template-columns: 1fr;
  }

  .class-trial-portrait-placeholder {
    min-height: 12rem;
    opacity: 0.72;
  }

  .class-trial-portrait-image {
    height: 12rem;
  }

  .class-trial-dialogue {
    min-height: 10rem;
    padding: 1rem;
  }
}
```

- [ ] **Step 2: Run focused UI tests**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit CSS polish**

Run:

```powershell
git add src/app/globals.css src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
git commit -m "style: polish class trial dialogue layout"
```

## Task 7: Update Remaining Tests And Harness State

**Files:**
- Modify: `src/components/game/gamePanelsMobile.test.ts`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-class-trial-ui-polish-tomori.md`

- [ ] **Step 1: Search for stale Hagakure expectations**

Run:

```powershell
rg -n "hagakure|叶隐康比吕|叶隐" src docs local-assets -g "!node_modules"
```

Expected: old docs/plans may mention the previous roster; current source/tests/local assets should not use Hagakure for the active class-trial roster.

- [ ] **Step 2: Update active tests if they reference old seat 8**

If `src/components/game/gamePanelsMobile.test.ts` or another active test expects `叶隐康比吕`, replace it with `高松灯`. Do not rewrite old historical plan docs from 2026-05-27.

- [ ] **Step 3: Update feature state after implementation**

In `feature_list.json`, change `class-trial-ui-polish-tomori.status` to `done` and set evidence to include:

```text
docs/superpowers/specs/2026-05-28-class-trial-ui-polish-tomori-design.md; docs/superpowers/plans/2026-05-28-class-trial-ui-polish-tomori.md; docs/tasks/2026-05-class-trial-ui-polish-tomori.md; local ignored Tomori avatar/portrait/personas/manifest update; npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts; npm run lint; npx tsc --noEmit; npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md; npm run harness:check; browser local theme smoke confirmed Tomori seat 8 and dialogue typewriter
```

- [ ] **Step 4: Update progress and handoff**

In `progress.md`, set:

```markdown
Set `Last Updated` to the current Asia/Shanghai time when implementation finishes.
**Session ID:** class-trial UI polish Tomori implementation
**Active Feature:** class-trial-ui-polish-tomori - Class Trial UI Polish And Tomori Replacement
```

Add completion bullets for Tomori seat 8, local ignored assets, dialogue helper, left-portrait/right-dialogue layout, and browser verification.

In `session-handoff.md`, add a compact handoff with Completed, Verification Evidence, Files Changed, Decisions Made, Blockers/Risks, and Recommended Next Step.

- [ ] **Step 5: Run state checks**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"
npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md
npm run harness:check
git diff --check
```

Expected: all pass. `git diff --check` may print LF-to-CRLF warnings but must not report whitespace errors.

- [ ] **Step 6: Commit state updates**

Run:

```powershell
git add src/components/game/gamePanelsMobile.test.ts feature_list.json progress.md session-handoff.md docs/tasks/2026-05-class-trial-ui-polish-tomori.md
git commit -m "docs: record class trial ui polish completion"
```

## Task 8: Browser Verification

**Files:**
- No committed source files unless verification reveals a bug.
- Ignored: `tmp/class-trial-ui-polish-tomori-smoke.png` if a screenshot is saved.

- [ ] **Step 1: Start a local dev server**

Run on an available port:

```powershell
$env:DATABASE_URL = "file:D:/ai-werewolf/prisma/dev.db"
npm run dev -- --hostname 127.0.0.1 --port 51624
```

Expected: local app starts and serves `http://127.0.0.1:51624`.

- [ ] **Step 2: Verify theme flow in browser**

Use the in-app Browser or Playwright to check:

1. Open `http://127.0.0.1:51624`.
2. Click `学级裁判主题局`.
3. Confirm readiness text mentions local assets and role cards.
4. Start the table.
5. Confirm seat order includes `十神白夜`, `高松灯`, `千早爱音`.
6. Continue to at least one AI speech.
7. Confirm speaking focus uses left portrait plus right large dialogue.
8. Confirm dialogue does not show `狼人`, `预言家`, or other hidden identity labels.
9. Open `/rooms` and confirm `学级裁判主题局` is absent.

- [ ] **Step 3: Save optional screenshot**

If a screenshot is useful, save it to:

```text
tmp/class-trial-ui-polish-tomori-smoke.png
```

Confirm it remains ignored:

```powershell
git status --short --ignored tmp/class-trial-ui-polish-tomori-smoke.png
```

Expected: `!! tmp/`.

- [ ] **Step 4: Stop the dev server**

Stop the dev server process before ending the session unless the user explicitly asks to keep it open.

## Final Verification Bundle

Run these after all implementation tasks:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
npm run lint
npx tsc --noEmit
npm run harness:task-card -- docs/tasks/2026-05-class-trial-ui-polish-tomori.md
npm run harness:check
```

If the touched files affect broader behavior unexpectedly, run:

```powershell
npm run test
```

End with the harness handoff format:

```text
Completed:
- ...

Changed files:
- ...

Verification:
- ...

Remaining risks:
- ...
```
