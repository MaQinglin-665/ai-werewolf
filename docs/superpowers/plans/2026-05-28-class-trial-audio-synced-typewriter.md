# Class Trial Audio-Synced Typewriter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the local-only class-trial dialogue typewriter from real AI speech audio playback progress, while keeping existing fixed-speed and reduced-motion fallbacks.

**Architecture:** Keep audio ownership in `GameClient`, where the `HTMLAudioElement` already exists. Add small pure helpers for progress-to-frame mapping and audio progress calculation, then pass an optional class-trial-only sync object into `ClassTrialGameTable`.

**Tech Stack:** React client components, TypeScript, Vitest, existing `HTMLAudioElement` playback flow, existing class-trial table/dialogue helpers.

---

## File Structure

- `src/components/game/classTrialDialogue.ts`: add progress-to-frame helper.
- `src/components/game/classTrialDialogue.test.ts`: protect progress mapping and invalid-progress fallback.
- `src/components/game/aiSpeechAudio.ts`: add audio playback progress helper.
- `src/components/game/aiSpeechAudio.test.ts`: protect valid duration, invalid duration, and ended progress behavior.
- `src/components/game/clientTypes.ts`: extend `AiSpeechAudioStatus` with optional sync fields and add a table-facing sync type.
- `src/components/game/ClassTrialGameTable.tsx`: consume optional audio typewriter sync state and prefer it over the local timer only when it matches the current speaking focus.
- `src/components/game/classTrialGameTable.test.ts`: protect loading, progress, full-text, and mismatch fallback behavior.
- `src/components/GameClient.tsx`: update audio playback loop to publish real progress and pass sync state only into the class-trial table.
- `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`, `feature_list.json`, `progress.md`, `session-handoff.md`: completion evidence after implementation.

## Task 1: Add Dialogue Progress Frame Mapping

**Files:**
- Modify: `src/components/game/classTrialDialogue.ts`
- Modify: `src/components/game/classTrialDialogue.test.ts`

- [ ] **Step 1: Write failing progress mapping tests**

Add `getClassTrialDialogueFrameByProgress` to the import in `src/components/game/classTrialDialogue.test.ts`:

```ts
import {
  buildClassTrialDialogueTimeline,
  getClassTrialDialogueFrame,
  getClassTrialDialogueFrameByProgress,
} from "./classTrialDialogue";
```

Add these tests inside `describe("class trial dialogue helper", () => { ... })`:

```ts
  it("maps audio progress to dialogue frames", () => {
    const timeline = buildClassTrialDialogueTimeline("同步", { shortTextMaxLength: 10 });

    expect(getClassTrialDialogueFrameByProgress(timeline, 0)).toBe("同");
    expect(getClassTrialDialogueFrameByProgress(timeline, 0.49)).toBe("同");
    expect(getClassTrialDialogueFrameByProgress(timeline, 0.5)).toBe("同步");
    expect(getClassTrialDialogueFrameByProgress(timeline, 1)).toBe("同步");
  });

  it("returns undefined for invalid audio progress so callers can use the timer fallback", () => {
    const timeline = buildClassTrialDialogueTimeline("同步");

    expect(getClassTrialDialogueFrameByProgress(timeline, Number.NaN)).toBeUndefined();
    expect(getClassTrialDialogueFrameByProgress(timeline, Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(getClassTrialDialogueFrameByProgress(timeline, -0.1)).toBeUndefined();
    expect(getClassTrialDialogueFrameByProgress(timeline, 1.1)).toBeUndefined();
  });

  it("keeps reduced-motion timelines fully visible even when audio progress is partial", () => {
    const timeline = buildClassTrialDialogueTimeline("短句也直接显示。", { reducedMotion: true });

    expect(getClassTrialDialogueFrameByProgress(timeline, 0)).toBe("短句也直接显示。");
    expect(getClassTrialDialogueFrameByProgress(timeline, 0.3)).toBe("短句也直接显示。");
  });
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/components/game/classTrialDialogue.test.ts
```

Expected: FAIL because `getClassTrialDialogueFrameByProgress` is not exported.

- [ ] **Step 3: Implement the progress helper**

In `src/components/game/classTrialDialogue.ts`, add this export after `getClassTrialDialogueFrame`:

```ts
export function getClassTrialDialogueFrameByProgress(
  timeline: ClassTrialDialogueTimeline,
  progress: number,
): string | undefined {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return undefined;
  if (timeline.mode === "full") return timeline.frames.at(-1) ?? timeline.thinkingText;
  const frameCount = timeline.frames.length;
  if (frameCount <= 0) return undefined;
  const frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
  return getClassTrialDialogueFrame(timeline, frameIndex);
}
```

- [ ] **Step 4: Run the test and commit**

Run:

```powershell
npm run test -- src/components/game/classTrialDialogue.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/components/game/classTrialDialogue.ts src/components/game/classTrialDialogue.test.ts
git commit -m "feat: map class trial dialogue to audio progress"
```

## Task 2: Add Audio Playback Progress Helper

**Files:**
- Modify: `src/components/game/aiSpeechAudio.ts`
- Modify: `src/components/game/aiSpeechAudio.test.ts`
- Modify: `src/components/game/clientTypes.ts`

- [ ] **Step 1: Write failing audio progress tests**

Add `buildAiSpeechAudioPlaybackSync` to the import in `src/components/game/aiSpeechAudio.test.ts`:

```ts
import {
  AiSpeechAudioUnavailableError,
  buildAiSpeechAudioCue,
  buildAiSpeechAudioPlaybackSync,
  isAiSpeechAudioUnavailableError,
  prepareAiSpeechAudio,
  takeStableTtsChunk,
} from "./aiSpeechAudio";
```

Add these tests inside `describe("aiSpeechAudio helpers", () => { ... })`:

```ts
  it("builds synced typewriter progress from valid audio timing", () => {
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 2, duration: 8, ended: false })).toEqual({
      playbackDurationSec: 8,
      playbackProgress: 0.25,
      syncedTypewriter: true,
    });
  });

  it("clamps audio progress and treats ended audio as complete", () => {
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 12, duration: 8, ended: false })?.playbackProgress).toBe(1);
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 0.5, duration: 8, ended: true })?.playbackProgress).toBe(1);
  });

  it("returns undefined when audio duration cannot drive sync", () => {
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: Number.NaN, ended: false })).toBeUndefined();
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: Number.POSITIVE_INFINITY, ended: false })).toBeUndefined();
    expect(buildAiSpeechAudioPlaybackSync({ currentTime: 1, duration: 0, ended: false })).toBeUndefined();
  });
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/components/game/aiSpeechAudio.test.ts
```

Expected: FAIL because `buildAiSpeechAudioPlaybackSync` is not exported.

- [ ] **Step 3: Extend speech audio status types**

In `src/components/game/clientTypes.ts`, extend `AiSpeechAudioStatus`:

```ts
export type AiSpeechAudioStatus = {
  speechKey: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  state: "loading" | "playing" | "paused";
  text: string;
  playbackProgress?: number;
  playbackDurationSec?: number;
  syncedTypewriter?: boolean;
};
```

Add this new type after `AiSpeechAudioStatus`:

```ts
export type ClassTrialAudioTypewriterState = Pick<
  AiSpeechAudioStatus,
  "speechKey" | "speaker" | "state" | "text" | "playbackProgress" | "syncedTypewriter"
>;
```

- [ ] **Step 4: Implement the audio progress helper**

In `src/components/game/aiSpeechAudio.ts`, add this type and helper near the constants:

```ts
type AudioPlaybackTiming = {
  currentTime: number;
  duration: number;
  ended: boolean;
};

export function buildAiSpeechAudioPlaybackSync(audio: AudioPlaybackTiming):
  | {
      playbackDurationSec: number;
      playbackProgress: number;
      syncedTypewriter: true;
    }
  | undefined {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return undefined;
  const rawProgress = audio.ended ? 1 : audio.currentTime / audio.duration;
  return {
    playbackDurationSec: audio.duration,
    playbackProgress: Math.min(1, Math.max(0, rawProgress)),
    syncedTypewriter: true,
  };
}
```

- [ ] **Step 5: Run the test and commit**

Run:

```powershell
npm run test -- src/components/game/aiSpeechAudio.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/components/game/aiSpeechAudio.ts src/components/game/aiSpeechAudio.test.ts src/components/game/clientTypes.ts
git commit -m "feat: derive ai speech audio progress"
```

## Task 3: Make ClassTrialGameTable Consume Audio Typewriter State

**Files:**
- Modify: `src/components/game/ClassTrialGameTable.tsx`
- Modify: `src/components/game/classTrialGameTable.test.ts`

- [ ] **Step 1: Write failing table rendering tests**

In `src/components/game/classTrialGameTable.test.ts`, add these tests inside `describe("ClassTrialGameTable", () => { ... })`:

```ts
  it("keeps class-trial dialogue in thinking state while matching audio is loading", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "loading",
          text: "先不要急着归票。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("正在思考/准备发言。");
    expect(html).not.toContain("先不要急着归票。");
  });

  it("uses matching audio progress to reveal partial class-trial dialogue", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame({
          tableSummary: {
            ...makeGame().tableSummary,
            recentSpeeches: [{ seq: 10, day: 2, speaker: { seatId: 3, name: "角色3" }, message: "同步" }],
          },
        }),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "playing",
          text: "同步",
          playbackProgress: 0,
          syncedTypewriter: true,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("同");
    expect(html).not.toContain("同步");
  });

  it("shows full dialogue when matching audio progress is complete", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:3",
          speaker: { seatId: 3, name: "角色3" },
          state: "playing",
          text: "先不要急着归票。",
          playbackProgress: 1,
          syncedTypewriter: true,
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("先不要急着归票。");
  });

  it("ignores audio typewriter state for a different speaker", () => {
    const html = renderToStaticMarkup(
      createElement(ClassTrialGameTable, {
        game: makeGame(),
        loading: false,
        audioTypewriter: {
          speechKey: "game-1:10:4",
          speaker: { seatId: 4, name: "角色4" },
          state: "loading",
          text: "先不要急着归票。",
        },
        onReturnHome: () => undefined,
        onSubmit: async () => undefined,
      }),
    );

    expect(html).toContain("先不要急着归票。");
    expect(html).not.toContain("正在思考/准备发言。");
  });
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts
```

Expected: FAIL because `ClassTrialGameTable` does not accept `audioTypewriter`.

- [ ] **Step 3: Add the table prop and matching logic**

In `src/components/game/ClassTrialGameTable.tsx`, update imports:

```ts
import {
  buildClassTrialDialogueTimeline,
  getClassTrialDialogueFrame,
  getClassTrialDialogueFrameByProgress,
} from "./classTrialDialogue";
import type { ClassTrialAudioTypewriterState, CommandPayload } from "./clientTypes";
```

Update the component signature:

```ts
export function ClassTrialGameTable({
  game,
  loading,
  manifest,
  audioTypewriter,
  onReturnHome,
  onSubmit,
}: {
  game: HumanGameView;
  loading: boolean;
  manifest?: ClassTrialPackManifest;
  audioTypewriter?: ClassTrialAudioTypewriterState;
  onReturnHome: () => void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
```

Add this helper near `getLatestSpeakerMessage`:

```ts
function isMatchingAudioTypewriter(
  audioTypewriter: ClassTrialAudioTypewriterState | undefined,
  speakerSeatId: number | undefined,
  message: string,
): audioTypewriter is ClassTrialAudioTypewriterState {
  return Boolean(
    audioTypewriter &&
      speakerSeatId &&
      audioTypewriter.speaker.seatId === speakerSeatId &&
      audioTypewriter.text === message,
  );
}
```

After `const timeline = ...`, add:

```ts
  const matchingAudioTypewriter = isMatchingAudioTypewriter(audioTypewriter, game.currentSpeakerSeatId, focusMessage)
    ? audioTypewriter
    : undefined;
  const syncedDialogueFrame =
    matchingAudioTypewriter?.state === "playing" && matchingAudioTypewriter.syncedTypewriter
      ? getClassTrialDialogueFrameByProgress(timeline, matchingAudioTypewriter.playbackProgress ?? Number.NaN)
      : undefined;
```

Replace `displayedMessage` calculation with:

```ts
  const displayedMessage =
    matchingAudioTypewriter?.state === "loading"
      ? timeline.thinkingText
      : syncedDialogueFrame ?? getClassTrialDialogueFrame(timeline, dialogueFrameIndex);
```

Update the timer effect guard so audio-synced playback does not also advance the local timer:

```ts
    if (matchingAudioTypewriter?.state === "loading") return;
    if (matchingAudioTypewriter?.state === "playing" && matchingAudioTypewriter.syncedTypewriter) return;
```

Add `matchingAudioTypewriter?.state` and `matchingAudioTypewriter?.syncedTypewriter` to the dependency array.

- [ ] **Step 4: Run the table tests and commit**

Run:

```powershell
npm run test -- src/components/game/classTrialGameTable.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/components/game/ClassTrialGameTable.tsx src/components/game/classTrialGameTable.test.ts
git commit -m "feat: sync class trial dialogue from audio state"
```

## Task 4: Publish Real Audio Progress From GameClient

**Files:**
- Modify: `src/components/GameClient.tsx`
- Modify: `src/components/game/aiSpeechAudio.ts`
- Modify: `src/components/game/aiSpeechAudio.test.ts`

- [ ] **Step 1: Write failing helper tests for status patching**

In `src/components/game/aiSpeechAudio.test.ts`, add `buildAiSpeechAudioPlaybackStatusPatch` to the import:

```ts
import {
  AiSpeechAudioUnavailableError,
  buildAiSpeechAudioCue,
  buildAiSpeechAudioPlaybackStatusPatch,
  buildAiSpeechAudioPlaybackSync,
  isAiSpeechAudioUnavailableError,
  prepareAiSpeechAudio,
  takeStableTtsChunk,
} from "./aiSpeechAudio";
```

Add this test:

```ts
  it("builds a status patch only for the active speech run", () => {
    const cue = {
      gameId: "game-1",
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      text: "同步",
    };

    expect(
      buildAiSpeechAudioPlaybackStatusPatch({
        audio: { currentTime: 1, duration: 2, ended: false },
        cue,
        runId: 7,
        activeRunId: 7,
      }),
    ).toEqual({
      speechKey: "game-1:10:3",
      speaker: { seatId: 3, name: "角色3" },
      state: "playing",
      text: "同步",
      playbackDurationSec: 2,
      playbackProgress: 0.5,
      syncedTypewriter: true,
    });

    expect(
      buildAiSpeechAudioPlaybackStatusPatch({
        audio: { currentTime: 1, duration: 2, ended: false },
        cue,
        runId: 6,
        activeRunId: 7,
      }),
    ).toBeUndefined();
  });
```

- [ ] **Step 2: Run helper tests and verify RED**

Run:

```powershell
npm run test -- src/components/game/aiSpeechAudio.test.ts
```

Expected: FAIL because `buildAiSpeechAudioPlaybackStatusPatch` is not exported.

- [ ] **Step 3: Implement the status patch helper**

In `src/components/game/aiSpeechAudio.ts`, import the type:

```ts
import type { AiSpeechAudioStatus, AiSpeechAudioTextCue, SpeechItem } from "./clientTypes";
```

Then add:

```ts
export function buildAiSpeechAudioPlaybackStatusPatch(options: {
  audio: AudioPlaybackTiming;
  cue: AiSpeechAudioTextCue;
  runId: number;
  activeRunId: number;
}): AiSpeechAudioStatus | undefined {
  if (options.runId !== options.activeRunId) return undefined;
  return {
    speechKey: options.cue.speechKey,
    speaker: options.cue.speaker,
    state: "playing",
    text: options.cue.text,
    ...buildAiSpeechAudioPlaybackSync(options.audio),
  };
}
```

- [ ] **Step 4: Wire GameClient audio events**

In `src/components/GameClient.tsx`, update the import from `aiSpeechAudio`:

```ts
  buildAiSpeechAudioPlaybackStatusPatch,
```

Inside `playAiSpeechAudioElement`, replace the current post-`audio.play()` status set:

```ts
    setAiSpeechAudioStatus({
      speechKey: cue.speechKey,
      speaker: cue.speaker,
      state: "playing",
      text: cue.text,
    });
```

with:

```ts
    const updatePlaybackStatus = () => {
      const next = buildAiSpeechAudioPlaybackStatusPatch({
        audio,
        cue,
        runId,
        activeRunId: aiSpeechAudioRunRef.current,
      });
      if (next) setAiSpeechAudioStatus(next);
    };

    updatePlaybackStatus();
    let animationFrame = 0;
    const tick = () => {
      updatePlaybackStatus();
      if (aiSpeechAudioRunRef.current === runId && !audio.paused && !audio.ended) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };
    animationFrame = window.requestAnimationFrame(tick);
    audio.addEventListener("loadedmetadata", updatePlaybackStatus);
    audio.addEventListener("durationchange", updatePlaybackStatus);
    audio.addEventListener("timeupdate", updatePlaybackStatus);
    audio.addEventListener("ended", updatePlaybackStatus);
```

Then replace the existing `await new Promise...` block with a `try/finally` cleanup:

```ts
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`AI 发言音频加载失败：${audio.currentSrc || audio.src}`));
      });
    } finally {
      window.cancelAnimationFrame(animationFrame);
      audio.removeEventListener("loadedmetadata", updatePlaybackStatus);
      audio.removeEventListener("durationchange", updatePlaybackStatus);
      audio.removeEventListener("timeupdate", updatePlaybackStatus);
      audio.removeEventListener("ended", updatePlaybackStatus);
    }
```

In the class-trial table render path, pass the status:

```tsx
<ClassTrialGameTable
  game={game}
  loading={loading}
  manifest={classTrialPackManifest}
  audioTypewriter={aiSpeechAudioStatus ?? undefined}
  onReturnHome={returnHome}
  onSubmit={submitCommand}
/>
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialGameTable.test.ts
npx tsc --noEmit
```

Expected: PASS.

Commit:

```powershell
git add src/components/GameClient.tsx src/components/game/aiSpeechAudio.ts src/components/game/aiSpeechAudio.test.ts
git commit -m "feat: publish ai speech playback progress"
```

## Task 5: Verification, Browser Smoke, And State Updates

**Files:**
- Modify: `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run required verification**

Run:

```powershell
npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts
npm run lint
npx tsc --noEmit
npm run build
npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md
npm run harness:check
git diff --check
```

Expected: all commands pass. `npm run build` may still show the existing Turbopack NFT trace warning; record it if present.

- [ ] **Step 2: Run browser/manual smoke**

Use the existing dev server if available, or start a new one. Then:

1. Open `http://127.0.0.1:<port>`.
2. Select `学级裁判主题局`.
3. Enable AI speech.
4. Select `9 人预女猎`.
5. Select `无真人 · 只看 AI 对局`.
6. Click `进入牌桌`.
7. Wait for an AI speaker.
8. Click `听 X号发言`.
9. Confirm dialogue remains `正在思考/准备发言。` before audio starts.
10. Confirm dialogue begins revealing after audio starts and reaches full text by audio end.

- [ ] **Step 3: Update state files**

In `feature_list.json`, append:

```json
{
  "id": "class-trial-audio-synced-typewriter",
  "name": "Class Trial Audio-Synced Typewriter",
  "description": "Drive local-only class-trial dialogue reveal from real AI speech audio playback progress, with fixed-speed fallback when audio duration is unavailable.",
  "dependencies": ["class-trial-gpt-sovits-voice"],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-05-28-class-trial-audio-synced-typewriter-design.md; docs/superpowers/plans/2026-05-28-class-trial-audio-synced-typewriter.md; docs/tasks/2026-05-class-trial-audio-synced-typewriter.md; src/components/game/classTrialDialogue.ts; src/components/game/aiSpeechAudio.ts; src/components/game/ClassTrialGameTable.tsx; src/components/GameClient.tsx; npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts; npm run lint; npx tsc --noEmit; npm run build; browser local class-trial GPT-SoVITS smoke confirmed thinking text before audio and audio-progress-driven reveal during playback"
}
```

In `progress.md`, set:

```md
**Session ID:** class-trial audio-synced typewriter
**Active Feature:** class-trial-audio-synced-typewriter - Class Trial Audio-Synced Typewriter
```

Add bullets for the progress helper, audio playback helper, table consumption, GameClient progress publishing, and browser smoke.

In `session-handoff.md`, record the final status, verification output, remaining risks, and next step.

In `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`, replace the initial Handoff block with completion evidence.

- [ ] **Step 4: Commit implementation state**

Commit only this slice's files. Avoid staging generated audio, local assets, or unrelated class-trial UI files.

```powershell
git add src/components/game/classTrialDialogue.ts src/components/game/classTrialDialogue.test.ts `
  src/components/game/aiSpeechAudio.ts src/components/game/aiSpeechAudio.test.ts `
  src/components/game/clientTypes.ts src/components/game/ClassTrialGameTable.tsx `
  src/components/game/classTrialGameTable.test.ts src/components/GameClient.tsx `
  docs/tasks/2026-05-class-trial-audio-synced-typewriter.md `
  feature_list.json progress.md session-handoff.md
git commit -m "feat: sync class trial typewriter to audio"
```

## Self-Review Notes

- Spec coverage: The plan covers class-trial-only scope, loading thinking text, real audio progress, invalid-duration fallback, reduced-motion fallback, no backend timestamp work, and browser/manual verification.
- Scope check: This is one frontend playback/rendering slice and does not change game rules, TTS backend routing, local assets, rooms, or production deployment.
- Type consistency: The plan uses `AiSpeechAudioStatus` for playback state, `ClassTrialAudioTypewriterState` for table consumption, and `buildAiSpeechAudioPlaybackSync` for progress derivation.
- TDD check: Tasks start with failing tests before implementation and keep browser smoke in the final verification task.
