# Class Trial Audio Lookahead Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or a focused local implementation loop. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide part of the per-character first-line GPT-SoVITS wait by starting the next class-trial continue step and next audio preparation while the current speech audio is playing.

**Architecture:** Keep rules and TTS backend unchanged. Add a tiny lookahead model for safe guards, add a non-streaming continue request helper, then let `GameClient` buffer one class-trial continue result and one prepared next-audio promise. The visible table continues to focus the currently playing speaker until that audio finishes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, local GPT-SoVITS via existing `/api/ai-speech-audio`.

---

### Task 1: Lookahead Guard Model

**Files:**
- Add: `src/components/game/classTrialAudioLookahead.ts`
- Add: `src/components/game/classTrialAudioLookahead.test.ts`

- [x] **Step 1: Write failing tests for lookahead start and consume rules**

Cover: enabled class-trial single `continue` step starts lookahead, active buffered work blocks duplicates, current speech key is included in completed keys, and buffered results only match the active audio run.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- src/components/game/classTrialAudioLookahead.test.ts`

Expected: FAIL for missing/stubbed lookahead behavior.

- [x] **Step 3: Implement the minimal guard helpers**

Add `shouldStartClassTrialAudioLookahead`, `buildClassTrialLookaheadCompletedSpeechKeys`, and `isMatchingClassTrialAudioLookahead`.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm run test -- src/components/game/classTrialAudioLookahead.test.ts`

Expected: PASS.

### Task 2: Non-Streaming Continue Request

**Files:**
- Modify: `src/components/game/gameClientRequests.ts`
- Modify: `src/components/game/gameClientRequests.test.ts`

- [x] **Step 1: Write failing request-helper test**

Expect `submitContinueCommand` to post `{ type: "continue", aiRuntimeMode, aiLlmConfigs }` to `/api/games/:id/commands`.

- [x] **Step 2: Run the request test and verify it fails**

Run: `npm run test -- src/components/game/gameClientRequests.test.ts`

Expected: FAIL because `submitContinueCommand` does not exist.

- [x] **Step 3: Implement the helper**

Add a focused helper for background lookahead without changing `submitGameCommand`'s existing non-continue boundary.

- [x] **Step 4: Run the request test and verify it passes**

Run: `npm run test -- src/components/game/gameClientRequests.test.ts`

Expected: PASS.

### Task 3: GameClient Lookahead Buffer

**Files:**
- Modify: `src/components/GameClient.tsx`

- [x] **Step 1: Start lookahead after current audio playback begins**

Pass an `onPlaybackStarted` callback into `playAiSpeechAudioElement`. Only class-trial AI speech starts background lookahead, and only when there is one available `continue` action.

- [x] **Step 2: Prepare next audio from the buffered view**

After the background continue returns, build the next AI speech cue using completed keys plus the current source key, then call the existing prepared-audio cache without publishing next-speaker UI status yet.

- [x] **Step 3: Consume only the matching buffered result**

After current audio completes, apply the buffered game view only if game id, source speech key, run id, and active run id still match. Otherwise clear and let the existing auto-advance path recover.

- [x] **Step 4: Prevent duplicate continues**

Disable class-trial controls while AI audio or buffered continue is active, and ignore manual `continue` submit attempts when a buffered continue already exists.

### Task 4: Verification And State

**Files:**
- Modify: `docs/tasks/2026-05-class-trial-audio-lookahead.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [x] **Step 1: Run required checks**

Run the task-card verification set and local browser/GPT-SoVITS smoke.

- [x] **Step 2: Record evidence**

Update task card, feature list, progress, and handoff with exact command results and residual risks.
