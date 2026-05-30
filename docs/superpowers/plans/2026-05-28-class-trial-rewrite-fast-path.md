# Class Trial Rewrite Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe fast path and cache for class-trial Japanese TTS rewrite so common short lines avoid slow LLM rewrite.

**Architecture:** Extend the existing `src/ai/classTrialSpeechRewrite.ts` helper instead of adding a new service layer. Keep the old string-returning API for compatibility, add a metadata-returning API for the audio route, and surface `rewriteMode` in the existing safe timing log.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, local GPT-SoVITS timing logs.

---

### Task 1: Rewrite Helper Fast Path And Cache

**Files:**
- Modify: `src/ai/classTrialSpeechRewrite.ts`
- Modify: `src/ai/classTrialSpeechRewrite.test.ts`

- [x] **Step 1: Write failing tests**

Add tests for `rewriteClassTrialSpeechForJapaneseTtsWithMeta`, `clearClassTrialSpeechRewriteCache`, fast explanation/vote/suspicion/contradiction lines, cache reuse, and LLM fallback.

- [x] **Step 2: Verify red**

Run: `npm run test -- src/ai/classTrialSpeechRewrite.test.ts`

Expected: fail because the metadata API and cache clear helper do not exist.

- [x] **Step 3: Implement minimal helper**

Add `ClassTrialSpeechRewriteMode`, `ClassTrialSpeechRewriteResult`, a process-local cache, fast templates, and metadata-returning rewrite.

- [x] **Step 4: Verify green**

Run: `npm run test -- src/ai/classTrialSpeechRewrite.test.ts`

Expected: pass.

### Task 2: API Timing Log Mode

**Files:**
- Modify: `src/app/api/ai-speech-audio/route.ts`
- Modify: `src/app/api/ai-speech-audio/route.test.ts`

- [x] **Step 1: Write failing route test**

Expect the class-trial GPT-SoVITS timing log to include `"rewriteMode":"fast"` when the rewrite helper returns that mode.

- [x] **Step 2: Verify red**

Run: `npm run test -- src/app/api/ai-speech-audio/route.test.ts`

Expected: fail because the timing log does not include `rewriteMode`.

- [x] **Step 3: Use metadata rewrite in route**

Call `rewriteClassTrialSpeechForJapaneseTtsWithMeta`, pass `result.textJa` to GPT-SoVITS, and log `result.mode`.

- [x] **Step 4: Verify green**

Run: `npm run test -- src/app/api/ai-speech-audio/route.test.ts`

Expected: pass.

### Task 3: Evidence And Handoff

**Files:**
- Create: `docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [x] **Step 1: Run focused checks**

Run rewrite/helper tests, route tests, lint, typecheck, build, task-card, harness, diff check, GPT-SoVITS health, and direct route smoke.

- [x] **Step 2: Record evidence**

Record exact commands, live timing result, changed files, and remaining risks in the task card and handoff files.
