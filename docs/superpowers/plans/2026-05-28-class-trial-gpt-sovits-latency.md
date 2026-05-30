# Class Trial GPT-SoVITS Latency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or a focused local implementation loop. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local class-trial GPT-SoVITS latency observable and skip redundant weight switches for repeated same-character requests.

**Architecture:** Keep the audio route contract unchanged. Add active-weight memory and timing reports inside `src/server/gptSoVitsTts.ts`, then let the class-trial branch in `/api/ai-speech-audio` log sanitized per-stage timings. Do not write local weight paths, prompt text, generated text, or secrets to logs.

**Tech Stack:** Next.js App Router, Node route runtime, TypeScript, Vitest, local GPT-SoVITS FastAPI api_v2.py.

---

### Task 1: Weight Switch Cache And Timing Report

**Files:**
- Modify: `src/server/gptSoVitsTts.ts`
- Modify: `src/server/gptSoVitsTts.test.ts`

- [x] **Step 1: Write failing tests for active-weight skip and timing**

Expect the first same-role switch to call `/set_gpt_weights` and `/set_sovits_weights`, return durations, then the second identical switch to return skipped flags without calling either endpoint again.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- src/server/gptSoVitsTts.test.ts`

Expected: FAIL because the cache/timing API does not exist yet.

- [x] **Step 3: Implement minimal active-weight tracking**

Track active GPT and SoVITS weight paths by normalized base URL. Update the cache only after a successful control endpoint call.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm run test -- src/server/gptSoVitsTts.test.ts`

Expected: PASS.

### Task 2: Route Timing Logs

**Files:**
- Modify: `src/app/api/ai-speech-audio/route.ts`
- Modify: `src/app/api/ai-speech-audio/route.test.ts`

- [x] **Step 1: Write failing test for sanitized timing log**

Expect class-trial GPT-SoVITS success to call `console.info` with a `[class-trial-gpt-sovits]` JSON payload that includes skipped flags.

- [x] **Step 2: Run the route test and verify it fails**

Run: `npm run test -- src/app/api/ai-speech-audio/route.test.ts`

Expected: FAIL because no timing log is emitted.

- [x] **Step 3: Add per-stage timings**

Measure rewrite, weight switch, TTS, file write, and total. Include only safe identifiers and numeric timings.

- [x] **Step 4: Run the route test and verify it passes**

Run: `npm run test -- src/app/api/ai-speech-audio/route.test.ts`

Expected: PASS.

### Task 3: Verification And State

**Files:**
- Modify: `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [x] **Step 1: Run required checks**

Run the task-card verification set and direct local route smoke if the services are available.

- [x] **Step 2: Record evidence**

Update task card, feature list, progress, and handoff with exact command results and residual risks.
