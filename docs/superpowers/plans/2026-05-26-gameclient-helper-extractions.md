# GameClient Helper Extractions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract three focused helper modules from `GameClient.tsx` while preserving the current single-player table behavior.

**Architecture:** Keep `GameClient.tsx` as the React orchestration layer that owns state, refs, effects, and network callbacks. Move pure or mostly stateless helpers into `src/components/game/autoAdvance.ts`, `hostAudioCues.ts`, and `aiSpeechAudio.ts`, and import them back into the client.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing `HumanGameView` and `clientTypes` types.

---

### Task 1: Auto-Advance Helper

**Files:**
- Create: `src/components/game/autoAdvance.test.ts`
- Create: `src/components/game/autoAdvance.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing test**

Create tests for `speechStreamKey`, `getAutoAdvanceDelay`, `getLatestStreamableAiSpeech`, and `getNextPlayableAiSpeech`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/game/autoAdvance.test.ts`
Expected: FAIL because `src/components/game/autoAdvance.ts` does not exist yet.

- [ ] **Step 3: Move the helper implementation**

Move the existing auto-advance constants and functions out of `GameClient.tsx` and import them from `./game/autoAdvance`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/game/autoAdvance.test.ts`
Expected: PASS.

### Task 2: Host Audio Cue Helpers

**Files:**
- Create: `src/components/game/hostAudioCues.test.ts`
- Create: `src/components/game/hostAudioCues.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing test**

Create tests for day-speech cue construction, dawn death cue construction, host clip source resolution, and host clip pre-delay resolution.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/game/hostAudioCues.test.ts`
Expected: FAIL because `src/components/game/hostAudioCues.ts` does not exist yet.

- [ ] **Step 3: Move the helper implementation**

Move host audio clip types, clip helpers, public-event cue builders, and `buildHostAudioCue` out of `GameClient.tsx` and import them from `./game/hostAudioCues`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/game/hostAudioCues.test.ts`
Expected: PASS.

### Task 3: AI Speech Audio Helpers

**Files:**
- Create: `src/components/game/aiSpeechAudio.test.ts`
- Create: `src/components/game/aiSpeechAudio.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing test**

Create tests for AI speech cue construction, unavailable-error detection, stable TTS chunk selection, and audio element preparation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/game/aiSpeechAudio.test.ts`
Expected: FAIL because `src/components/game/aiSpeechAudio.ts` does not exist yet.

- [ ] **Step 3: Move the helper implementation**

Move AI speech audio constants, unavailable error helpers, seat TTS lookup helpers, AI speech cue builder, streaming TTS queue, chunking helpers, and audio preparation helpers out of `GameClient.tsx` and import them from `./game/aiSpeechAudio`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/game/aiSpeechAudio.test.ts`
Expected: PASS.

### Task 4: Integration And Harness Handoff

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Modify: `docs/tasks/2026-05-gameclient-helper-extractions.md`

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- src/components/game/autoAdvance.test.ts src/components/game/hostAudioCues.test.ts src/components/game/aiSpeechAudio.test.ts`
Expected: PASS.

- [ ] **Step 2: Run lint and type checks**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run harness checks**

Run: `npm run harness:task-card -- docs/tasks/2026-05-gameclient-helper-extractions.md`
Run: `npm run harness:check`
Run: `npm run audit:structure`
Expected: PASS.

- [ ] **Step 4: Run main-game smoke**

Start a local dev server and run: `npm run smoke:main-game -- --base-url=http://127.0.0.1:3000`
Expected: PASS through game creation, first human action, stream continue, and day speech.

- [ ] **Step 5: Update state files**

Record the changed files, verification evidence, skipped production check, and next restart path in the task card, `feature_list.json`, `progress.md`, and `session-handoff.md`.
