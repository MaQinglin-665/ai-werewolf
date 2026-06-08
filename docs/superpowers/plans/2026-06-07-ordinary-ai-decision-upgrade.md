# Ordinary AI Decision Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the class-trial AI quality mechanisms into ordinary Werewolf games while preserving each model persona.

**Architecture:** Add a generic ordinary-game strategy-card and live-intent layer under `src/ai/`, then feed it into speech, vote, and light night-action prompts. Persist only the actor's own current intent in private AI memory so speech-vote continuity can use it without leaking hidden information.

**Tech Stack:** TypeScript, Vitest, Next.js React components, existing `AgentView`, `AiSeatMemory`, `speechProviders`, `actionProviders`, and `/ai-pool` local storage flow.

---

### Task 1: Strategy Cards And Live Intent Model

**Files:**
- Create: `src/ai/personaStrategyCards.ts`
- Create: `src/ai/personaStrategyCards.test.ts`
- Modify: `src/game/types.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving built-in personas get distinct camp-aware strategy summaries, custom friends can be inferred from role-card/persona text, and formatted live intent contains public moves but no hidden role/team terms.

Run: `npm run test -- src/ai/personaStrategyCards.test.ts`
Expected: fail because the module does not exist.

- [ ] **Step 2: Implement strategy cards**

Create deterministic strategy-card builders for DeepSeek, Claude, GPT, Kimi, Mimo, Gemini, GLM, 豆包, plus custom inference from `AiPersona`, `AiCharacterRoleCard`, and preferences.

- [ ] **Step 3: Extend private AI memory**

Add optional `liveIntent`, `liveIntentTargetSeatId`, `liveIntentPublicReason`, `liveIntentCommitment`, and `voteContinuity` fields to `AiSeatMemory`.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- src/ai/personaStrategyCards.test.ts`
Expected: pass.

### Task 2: Speech Prompt And Fallback Integration

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/speechProviders.test.ts`
- Modify: `src/ai/seatMemory.ts`

- [ ] **Step 1: Write failing speech tests**

Add tests proving ordinary speech input exposes `personaStrategyCard` and `liveIntent`, preserves model persona style, includes anti-template motivation guidance, and mock/fallback speech uses the live intent target instead of generic low-info prose.

Run: `npm run test -- src/ai/speechProviders.test.ts -t "ordinary live intent|persona strategy"`
Expected: fail because ordinary speech input has no generic strategy card/live intent.

- [ ] **Step 2: Implement speech integration**

Build live intent from public table memory, speech plan, persona strategy, camp, and previous private memory. Include it in LLM input and table-player guidance. Update mock/fallback speech to pick the live intent public move and avoid template phrases.

- [ ] **Step 3: Persist speech intent**

Update `rememberAiDecision()` to store the speech live intent and target after `speak`/`sheriffSpeech` commands.

- [ ] **Step 4: Run focused speech tests**

Run: `npm run test -- src/ai/personaStrategyCards.test.ts src/ai/speechProviders.test.ts`
Expected: pass.

### Task 3: Vote And Light Night-Action Integration

**Files:**
- Modify: `src/ai/actionProviders.ts`
- Modify: `src/ai/actionProviders.test.ts`
- Modify: `src/ai/seatMemory.ts`

- [ ] **Step 1: Write failing action tests**

Add tests proving ordinary action input receives strategy-card/live-intent guidance, day vote reasons must explain extension or pivot from the last speech target, and night actions get light camp-aware strategy without exposing hidden info in public reasons.

Run: `npm run test -- src/ai/actionProviders.test.ts -t "ordinary live intent|strategy card"`
Expected: fail because action input has no generic strategy card/live intent.

- [ ] **Step 2: Implement action integration**

Add `personaStrategyCard` and `liveIntent` fields to `LlmActionInput`, add constraints that use them as soft strategy, update vote candidate reason hints, and keep night-action reasons public-safe.

- [ ] **Step 3: Persist vote/action intent**

Update `rememberAiDecision()` to store vote continuity after votes and focus/commitment for light night actions.

- [ ] **Step 4: Run focused action tests**

Run: `npm run test -- src/ai/personaStrategyCards.test.ts src/ai/actionProviders.test.ts`
Expected: pass.

### Task 4: AI Pool Strategy Summary

**Files:**
- Modify: `src/components/game/aiFriendStorage.ts`
- Modify: `src/components/game/clientTypes.ts`
- Modify: `src/components/AiPoolClient.tsx`
- Modify: `src/components/AiPoolClient.mobile.test.ts`

- [ ] **Step 1: Write failing UI summary tests**

Add SSR tests proving AI cards show a strategy-card summary and a manual refresh entry, and default/custom cards both get a summary.

Run: `npm run test -- src/components/AiPoolClient.mobile.test.ts`
Expected: fail because the strategy summary is not rendered.

- [ ] **Step 2: Implement summary and refresh**

Expose strategy-card summaries through `AiFriendOption`, render a compact summary chip/panel in AI cards, and add a refresh button for custom AI that re-infers the base strategy from current persona/card fields. Do not add editing UI in v1.

- [ ] **Step 3: Run UI tests**

Run: `npm run test -- src/components/AiPoolClient.mobile.test.ts`
Expected: pass.

### Task 5: Verification And Handoff

**Files:**
- Modify: `progress.md`
- Modify: `session-handoff.md`
- Optionally modify: `docs/tasks/2026-06-ordinary-ai-decision-upgrade.md`

- [ ] **Step 1: Run targeted aggregate**

Run: `npm run test -- src/ai/personaStrategyCards.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/AiPoolClient.mobile.test.ts`
Expected: pass.

- [ ] **Step 2: Run AI behavior sample**

Run: `npm run simulate:ai -- --games=10 --seed-start=91`
Expected: complete all games; record fallback count and any obvious regressions.

- [ ] **Step 3: Run static confidence checks**

Run targeted eslint for changed files, then `npx tsc --noEmit` if the current `.next` type cache permits it. If blocked by pre-existing `.next` parse errors, record the exact blocker and run focused tests instead.

- [ ] **Step 4: Update handoff**

Record changed files, verification, skipped real-LLM checks, and remaining risk. Do not stage unrelated dirty files.
