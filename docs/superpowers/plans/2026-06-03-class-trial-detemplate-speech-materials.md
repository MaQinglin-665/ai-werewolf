# Class Trial Detemplate Speech Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove class-trial-only internal audit terminology from speech materials, fallback, and repair paths so characters speak like themselves playing Werewolf rather than reading system rules.

**Architecture:** Keep the existing `tableRead -> speechContract -> LLM repair -> fallback -> validation` flow. Change the class-trial materials before generation, then add a narrow class-trial-only validator for known leaked internal terms. Do not alter ordinary Werewolf speech behavior.

**Tech Stack:** TypeScript, Vitest, Next.js project scripts, existing AI speech/table-read helpers.

---

## Files And Responsibilities

- `src/ai/tableRead.test.ts`: Red tests for class-trial table-task/talking-point wording that no longer contains audit terms.
- `src/ai/tableRead.ts`: Class-trial seer black-check and checked-seat plan material rewritten from audit terms into speakable actions.
- `src/ai/speechProviders.test.ts`: Red tests for speech contract, repair instructions, fallback text, and final validation of internal term leaks.
- `src/ai/speechProviders.ts`: Class-trial speech contract, repair instructions, hard-info fallback, and validation changes.
- `src/ai/classTrialCharacterLens.test.ts`: Red tests for lens fallback moves avoiding `缺口/闭合` style stitched abstractions where the latest sample exposed them.
- `src/ai/classTrialCharacterLens.ts`: Lens fallback wording softened away from internal audit phrases while keeping role texture.
- `docs/tasks/2026-06-class-trial-freeform-speech-quality.md`: Append this follow-up evidence.
- `progress.md`: Record implementation and latest sample result.
- `session-handoff.md`: Record restart path and residual risks.

This thread should not create commits because the current worktree already contains broad uncommitted class-trial changes.

---

### Task 1: Red Tests For Table-Read Materials

**Files:**
- Modify: `src/ai/tableRead.test.ts`

- [ ] **Step 1: Replace hard-info seer plan expectations**

Change `gives class-trial hard-info seer black checks enough substance to avoid result-only speeches` so it rejects internal terms and expects speakable wording:

```ts
expect(plan.speechMove).toBe("claim_black_check");
expect(planText).not.toContain("必须交代验人理由");
expect(planText).not.toContain("票口边界");
expect(planText).not.toContain("外置硬身份反证");
expect(planText).not.toContain("身份动作");
expect(planText).toContain("查杀位");
expect(planText).toContain("别把查杀位轻放过去");
expect(planText).toContain("更硬的身份信息");
expect(planText).toContain("不要只报结论");
```

- [ ] **Step 2: Replace checked-seat response expectations**

Change `gives a class-trial black-check target a direct response plan before relationship flavor` so it rejects `起跳收益/票口边界` and expects a character-playable counter:

```ts
expect(plan.target?.seatId).toBe(claimant.seatId);
expect(planText).toContain("不认");
expect(planText).toContain("查杀");
expect(planText).not.toContain("验人理由");
expect(planText).not.toContain("起跳收益");
expect(planText).not.toContain("票口边界");
expect(planText).toContain("一句话把我按死");
expect(planText).toContain("谁最轻松");
expect(planText).not.toContain("十神");
```

- [ ] **Step 3: Run red tests**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts -t "class-trial hard-info seer black checks|black-check target"
```

Expected before implementation: fail because current materials still contain `票口边界`, `外置位只看硬身份反证`, and `起跳收益`.

---

### Task 2: Implement Table-Read Material Rewrite

**Files:**
- Modify: `src/ai/tableRead.ts`

- [ ] **Step 1: Rewrite true seer black-check motive**

Replace the class-trial D1 true-seer `playMotive.line` with speakable wording:

```ts
line: "拍身份是为了把查杀放到桌上；今天先别把查杀位轻放过去，不主动展开第一晚为什么选验。",
```

- [ ] **Step 2: Rewrite seer black-check table task**

Replace the planned seer black-check `tableTask` with wording that avoids internal terms:

```ts
line:
  "预言家查杀是硬信息；不要只报结论，必须公开身份和查杀结果；今天先别把查杀位轻放过去，除非有人拿出更硬的身份信息；第一晚选择不作为桌面主攻点。",
directives: ["公开预言家身份", "报出查杀结果", "别轻放查杀位", "只接受更硬身份信息"],
```

- [ ] **Step 3: Rewrite checked-seat table task**

Replace the black-check-against-self `tableTask` with:

```ts
line:
  `你是被${blackCheckAgainstSelf.claimant.seatId}号公开查杀的位置；本轮先回应查杀本身：不认或认推都可以，但要打他一句话把你按死后谁最轻松，别绕到无关关系梗。`,
directives: ["回应查杀", "反打按死你的动作", "指出谁最轻松", "不绕关系梗"],
```

- [ ] **Step 4: Run green tests**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts -t "class-trial hard-info seer black checks|black-check target"
```

Expected: pass.

---

### Task 3: Red Tests For Speech Contract, Repair, Fallback, And Validation

**Files:**
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Update contract test expectations**

In `passes a final black-check contract into guided LLM input`, require that class-trial must-say and repair constraints avoid internal terms:

```ts
expect(input.speechContract.move).toBe("claim_black_check");
expect(input.speechContract.mustSay.join("\n")).toContain("查杀");
expect(input.speechContract.mustSay.join("\n")).toContain("别把查杀位轻放过去");
expect(input.speechContract.mustSay.join("\n")).not.toContain("票口边界");
expect(input.speechContract.voteBoundary ?? "").not.toContain("外置硬身份反证");
expect(constraints).toContain("speechContract.move=claim_black_check");
expect(constraints).not.toContain("票口边界");
```

- [ ] **Step 2: Add validation test for internal audit terms**

Add a focused test near the class-trial template validation tests:

```ts
it("rejects leaked class-trial internal audit terminology", () => {
  const state = createClassTrialD1BlackCheckState();
  const view = buildAgentView(state, 2);
  const plan = createSpeechPlan(view);

  for (const speech of [
    "雾切响子。1号苗木诚的问题在身份动作和公开边界的连接没有闭合。",
    "腐川冬子。我不认这条查杀；他先把起跳收益和票口边界讲完整。",
    "苗木诚。我跳预言家，外置硬身份反证才能改变结构。",
  ]) {
    expect(validateRenderedSpeech(view, plan, speech, "guided")).toContain("学级裁判发言包含内部术语");
  }
});
```

If `createClassTrialD1BlackCheckState` does not exist, use the existing nearby class-trial state setup pattern in the file rather than adding a broad helper.

- [ ] **Step 3: Update hard-info fallback test**

In `does not route class-trial seer black-check fallback through low-info opening speech`, assert the fallback no longer exposes internal terms:

```ts
expect(result.speech).toContain("查杀");
expect(result.speech).toContain("不能把查杀藏起来");
expect(result.speech).not.toContain("票口边界");
expect(result.speech).not.toContain("外置硬身份反证");
expect(result.speech).not.toContain("今天边界");
```

- [ ] **Step 4: Update retry-repair test**

In `passes contract repair instructions on a validation retry`, have the retry output use speakable terms:

```ts
return JSON.stringify({
  speech: `我跳预言家，${wolf.seatId}号是查杀。今天先别把查杀位轻放过去，除非有人拿出更硬的身份信息。`,
});
```

Then assert:

```ts
expect(repairText).toContain("删除内部审计词");
expect(repairText).not.toContain("票口边界：");
expect(result.speech).not.toContain("外置硬身份反证");
```

- [ ] **Step 5: Run red speech tests**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "final black-check contract|internal audit terminology|seer black-check fallback|contract repair"
```

Expected before implementation: fail on old `票口边界` contract/fallback and missing internal-terminology validation.

---

### Task 4: Implement Speech Contract, Repair, Fallback, And Validation

**Files:**
- Modify: `src/ai/speechProviders.ts`

- [ ] **Step 1: Rewrite class-trial claim-black-check contract**

Change the class-trial `claim_black_check` contract from `票口边界/硬身份反证边界` wording to:

```ts
mustSay.push(
  `必须公开预言家身份并报出${targetLabel}查杀。`,
  "补一句今天先别把查杀位轻放过去，不要只报结论。",
  `说清${targetLabel}作为查杀位今天不能被轻放。`,
);
mayAsk.push("除非外置位拿出更硬的身份信息。");
if (isClassTrialSpeech && view?.day === 1) {
  mustNotAsk.unshift("D1不要主动展开第一晚为什么选验；身份、查杀结果和今天如何处理查杀位足够。");
}
voteBoundary = `今天先压住${targetLabel}这条查杀；只有外置更硬的身份信息能改变结构。`;
```

- [ ] **Step 2: Rewrite repair instructions**

Inside `buildSpeechRepairInstructions`, change class-trial repair wording to include internal-term deletion:

```ts
if (input.characterLens) {
  lines.push(
    `学级裁判角色修复：保留${input.characterLens.displayName}的临场判断和角色语气，让 LLM 自由发挥；只修掉 previousIssue 指出的越界点，不要改成模板兜底句。`,
    "删除内部审计词，例如身份动作、公开边界、起跳收益、票口边界、外置硬身份反证、闭合；换成角色能说出口的一句具体压力、保留或验证条件。",
  );
}
```

Change `票口边界：${contract.voteBoundary}` to:

```ts
lines.push(`今天处理查杀或投票的说法：${contract.voteBoundary}`);
```

- [ ] **Step 3: Rewrite class-trial hard-info fallback**

Replace seer fallback with:

```ts
const fallback = `${roleCard.displayName}。我跳预言家，${targetText}是查杀；我知道这句话会把${targetText}推到台上，但我不能把查杀藏起来。今天先从这里开始，除非有人拿出更硬的身份信息。`;
```

Replace checked-seat fallback with:

```ts
const fallback = `${roleCard.displayName}。我不认${claimantText}这条查杀；他一句话就想把我按死，别让他这么轻松。今天先看他跳出来以后，谁最省力。`;
```

- [ ] **Step 4: Add internal-term validator**

Add a class-trial-only validator called from `validateRenderedSpeech`:

```ts
function validateClassTrialInternalAuditTerminology(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  if (
    /身份动作和公开边界|公开边界的连接|外置硬身份反证|票口边界|起跳收益|没有闭合|没闭合/.test(speech)
  ) {
    return ["学级裁判发言包含内部术语"];
  }
  return [];
}
```

Call it with the other class-trial validation checks.

- [ ] **Step 5: Run green speech tests**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts -t "final black-check contract|internal audit terminology|seer black-check fallback|contract repair"
```

Expected: pass.

---

### Task 5: Red/Green Lens Fallback Wording

**Files:**
- Modify: `src/ai/classTrialCharacterLens.test.ts`
- Modify: `src/ai/classTrialCharacterLens.ts`

- [ ] **Step 1: Add or update lens fallback test**

Update the existing fallback wording tests so role fallback lines do not expose `缺口/闭合` abstractions for Kirigiri, Enoshima, Anon, and fallback lens:

```ts
const text = buildClassTrialLensFallbackSpeech(lens, {
  focusText: "1号苗木诚",
  gap: "身份动作和公开边界的连接",
  includeDisplayName: true,
  seed: 2,
});
expect(text).not.toMatch(/身份动作|公开边界|没有闭合|没闭合|缺口/);
```

- [ ] **Step 2: Run red lens test**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts -t "fallback"
```

Expected before implementation: fail on existing `缺口/闭合` fallback moves.

- [ ] **Step 3: Rewrite fallback moves**

Change fallback move patterns away from audit abstractions:

```ts
{ label: "quiet-audit", pattern: "情绪先放下。{focus}这句话还没有把自己从票下拉出来；我只看这点。" }
{ label: "despair-rift", pattern: "绝望地说，{focus}空出来的不是情绪，是能让他脱身的那一步；我先把压力压在那里。" }
{ label: "tempo-bridge", pattern: "等一下，这里气氛跑太快了。{focus}这句话只到这里为止，我先把话题拉回这一处。" }
{ label: "single-point", pattern: "我只抓一个公开点：{focus}这句话还没把自己从票下拉出来。" }
```

Keep role-specific texture and avoid expanding to a fixed dialogue library.

- [ ] **Step 4: Run green lens test**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts -t "fallback"
```

Expected: pass.

---

### Task 6: Focused Integration Tests

**Files:**
- Existing tests only

- [ ] **Step 1: Run affected AI tests**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/classTrialCharacterLens.test.ts
```

Expected: pass.

- [ ] **Step 2: Run type and lint**

Run:

```powershell
npx tsc --noEmit
npm run lint
```

Expected: both exit 0. Existing warnings are acceptable only if already present and unrelated.

---

### Task 7: Real D1 Sample And Docs

**Files:**
- Modify: `docs/tasks/2026-06-class-trial-freeform-speech-quality.md`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run latest D1 sample**

Run:

```powershell
node tmp/class-trial-d1-all-speeches-score.mjs
```

Expected: generated Markdown/JSON sample under `tmp/`. Inspect whether final speeches avoid:

```text
身份动作和公开边界
公开边界的连接
没有闭合
起跳收益
票口边界
外置硬身份反证
```

Fallback count should not exceed 4/9. If it exceeds 4/9 because the new internal-term validator is too broad, narrow the validator before proceeding.

- [ ] **Step 2: Update task/handoff docs**

Append a concise note to the task card, `progress.md`, and `session-handoff.md`:

```md
- [x] Follow-up class-trial detemplate pass rewrote hard-info materials, repair wording, and fallback speeches so internal audit terms such as `身份动作和公开边界`, `起跳收益`, `票口边界`, and `外置硬身份反证` no longer appear in final class-trial speech.
- [x] Latest D1 sample: `tmp/<new-sample>.md`; fallback `<n>/9`; average `<score>`.
```

- [ ] **Step 3: Run harness checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md
npm run harness:check
git diff --check
```

Expected: task-card and harness pass; `git diff --check` exits 0 or only reports existing CRLF warnings.

---

## Completion Criteria

- Class-trial D1 speech materials no longer feed internal audit terms to the LLM for hard-info black-check paths.
- Class-trial hard-info fallback lines read like character-facing public speech, not rule summaries.
- Repair instructions explicitly transform internal terms into character-playable pressure instead of asking for `边界/闭合`.
- Final validation rejects the known leaked internal terms only for class-trial speech.
- Latest real D1 sample avoids the known terms and fallback count does not exceed 4/9.
- Focused tests, typecheck, lint, harness checks, and whitespace check are recorded.
