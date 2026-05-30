# Class Trial DeepSeek Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local-only class-trial theme use DeepSeek-v4 as the exclusive game reasoning model while preserving character role cards and voice routing.

**Architecture:** Class-trial fixed AI friends will all resolve to the built-in DeepSeek persona so standard route-level DeepSeek env config is reused without writing secrets. Speech/action provider fallback selection will detect class-trial role cards and keep retries on the same DeepSeek route instead of rotating to GPT/Claude/GLM.

**Tech Stack:** Next.js app code, Vitest, TypeScript, existing `modelLlms` routed model layer.

---

### Task 1: Fixed Class-Trial Friends Use DeepSeek Persona

**Files:**
- Modify: `src/components/game/classTrialTheme.ts`
- Test: `src/components/game/classTrialTheme.test.ts`

- [ ] **Step 1: Write the failing test**

Add expectations in `builds fixed class-trial AI friends in the approved seat order`:

```ts
expect(friends.every((friend) => friend.basePersonaId === "deepseek-calm-analyst")).toBe(true);
expect(friends.every((friend) => friend.roleCard?.displayName)).toBe(true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/game/classTrialTheme.test.ts`

Expected: FAIL because some class-trial friends still use persona ids from `personas.json`.

- [ ] **Step 3: Write minimal implementation**

In `buildClassTrialAiFriends`, resolve one DeepSeek base friend:

```ts
export const CLASS_TRIAL_GAME_BRAIN_PERSONA_ID = "deepseek-calm-analyst";

const deepseekBase = defaultByPersonaId.get(CLASS_TRIAL_GAME_BRAIN_PERSONA_ID) ?? defaults[0]!;
```

Use `deepseekBase` for all returned fixed friends while keeping `nickname`, `id`, and `roleCard` from the class-trial character.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/game/classTrialTheme.test.ts`

Expected: PASS.

### Task 2: Class-Trial Actions Stay On DeepSeek Retries

**Files:**
- Modify: `src/ai/actionProviders.ts`
- Test: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that builds a `DeepSeek` view with `roleCard.theme = "class-trial"`, returns invalid JSON on the first request, valid JSON on the second request, and expects requested models to be `["deepseek-v4-flash", "deepseek-v4-flash"]` with final provider `deepseek-action:deepseek-v4-flash`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/ai/actionProviders.test.ts`

Expected: FAIL because the second action attempt currently switches to configured fallback persona models.

- [ ] **Step 3: Write minimal implementation**

In `actionProviders.ts`, add a class-trial role-card helper and use it in `readActionPrimaryPersonaName`, `readRoutedActionOutputMaxAttempts`, and fallback selection so class-trial action retries keep `DeepSeek` and return no fallback persona names.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/ai/actionProviders.test.ts`

Expected: PASS.

### Task 3: Class-Trial Speech Stays On DeepSeek Retries

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Test: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that builds a `DeepSeek` view with `roleCard.theme = "class-trial"`, makes the first DeepSeek speech request fail, the second DeepSeek request succeed, and expects no GPT request.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/ai/speechProviders.test.ts`

Expected: FAIL because speech currently uses configured fallback personas after a primary request failure.

- [ ] **Step 3: Write minimal implementation**

Change `readSpeechFallbackPersonaNames` to accept the full `LlmSpeechInput` and return `[]` when `input.characterRole.theme === "class-trial"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/ai/speechProviders.test.ts`

Expected: PASS.

### Task 4: Documentation And Verification

**Files:**
- Create: `docs/tasks/2026-05-class-trial-deepseek-brain.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Create task card**

Create a task card recording scope, checks, and live smoke target.

- [ ] **Step 2: Run focused checks**

Run:

```powershell
npm run test -- src/components/game/classTrialTheme.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
npm run lint
npx tsc --noEmit
npm run build
npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-brain.md
npm run harness:check
git diff --check
```

- [ ] **Step 3: Live smoke**

Start or reuse `http://127.0.0.1:51625`, create a class-trial game, advance through at least one model-generated action or speech, and query `AiCallLog` to confirm provider attempts stay on `deepseek-*` rather than `gpt-*`.
