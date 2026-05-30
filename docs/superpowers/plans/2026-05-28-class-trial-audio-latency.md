# Class Trial Audio Latency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local class-trial GPT-SoVITS waiting feel intentional and reuse prepared audio before playback.

**Architecture:** Keep the audio route and rules engine unchanged. Add small client-side preparation state and helper functions in `aiSpeechAudio.ts`, then pass richer status into `ClassTrialGameTable` so loading shows stage-specific class-trial text while existing playback progress continues to drive the typewriter.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, local GPT-SoVITS via existing `/api/ai-speech-audio`.

---

### Task 1: Audio Preparation Model

**Files:**
- Modify: `src/components/game/clientTypes.ts`
- Modify: `src/components/game/aiSpeechAudio.ts`
- Test: `src/components/game/aiSpeechAudio.test.ts`

- [x] **Step 1: Write failing tests for staged loading status and prepared audio reuse**

Add tests that expect `buildAiSpeechAudioLoadingStatus` to carry a preparation stage, and a new prepared-audio helper to return the same promise for repeated requests with the same speech key.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- src/components/game/aiSpeechAudio.test.ts`

Expected: FAIL because loading stages and prepared audio helpers do not exist yet.

- [x] **Step 3: Implement the minimal model**

Extend `AiSpeechAudioStatus` with `preparationStage?: "queued" | "generating" | "ready"`. Add small helpers for building status objects and managing prepared audio records without changing route behavior.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm run test -- src/components/game/aiSpeechAudio.test.ts`

Expected: PASS.

### Task 2: Class-Trial Waiting Copy

**Files:**
- Modify: `src/components/game/ClassTrialGameTable.tsx`
- Test: `src/components/game/classTrialGameTable.test.ts`

- [x] **Step 1: Write failing tests for stage-specific waiting text**

Add tests asserting class-trial loading stage `generating` renders `正在生成语音。` and `ready` renders `准备播放。` instead of the generic thinking line.

- [x] **Step 2: Run the focused table test and verify it fails**

Run: `npm run test -- src/components/game/classTrialGameTable.test.ts`

Expected: FAIL because the table still uses the old generic thinking text for all loading states.

- [x] **Step 3: Implement the minimal table rendering change**

Map audio preparation stages to short class-trial waiting lines while keeping the generic thinking fallback.

- [x] **Step 4: Run the focused table test and verify it passes**

Run: `npm run test -- src/components/game/classTrialGameTable.test.ts`

Expected: PASS.

### Task 3: GameClient Preparation Queue

**Files:**
- Modify: `src/components/GameClient.tsx`
- Test: covered by `src/components/game/aiSpeechAudio.test.ts` helper tests plus focused table tests.

- [x] **Step 1: Wire status changes before production code edits**

Use the helpers from Task 1 so `GameClient` marks queued/generating before awaiting `/api/ai-speech-audio`, marks ready after `HTMLAudioElement` creation, and reuses the prepared promise when playback asks for the same speech key.

- [x] **Step 2: Keep failures bounded**

If a prepared promise rejects, remove that entry so the existing retry/fallback path can proceed. Do not leave stale rejected promises in the map.

- [x] **Step 3: Run focused audio/table tests**

Run: `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts`

Expected: PASS.

### Task 4: State And Verification

**Files:**
- Modify: `docs/tasks/2026-05-class-trial-audio-latency.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [x] **Step 1: Run verification**

Run the required commands from the task card and perform a local browser/GPT-SoVITS smoke if services are available.

- [x] **Step 2: Record evidence**

Update task card, feature list, progress, and handoff with exact commands and residual risks.
