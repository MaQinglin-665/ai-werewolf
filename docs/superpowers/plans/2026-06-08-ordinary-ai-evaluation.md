# Ordinary AI Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local ordinary Werewolf AI evaluation command that scores speech text, action/vote choices, and speech-to-vote continuity, with optional promptfoo LLM judging.

**Architecture:** Keep the first version as a thin evaluation layer over existing AI logs and game scripts. Add reusable scoring helpers in `src/ai/llmEvaluation.ts`, a Node evaluation runner in `scripts/eval-ordinary-ai.mjs`, and optional promptfoo files that consume exported eval cases without changing live game behavior.

**Tech Stack:** TypeScript, Vitest, Node/Vite SSR script loading, existing `scripts/evaluate-llm-game.mjs` patterns, optional promptfoo CLI through `npx promptfoo`.

---

## File Structure

- Modify `src/ai/llmEvaluation.ts`: add ordinary eval case types, local issue detection, summary thresholds, and report recommendation helpers.
- Modify `src/ai/llmEvaluation.test.ts`: focused tests for ordinary speech/action scoring.
- Create `scripts/eval-ordinary-ai.mjs`: local command-line runner for `source=mock`, `source=existing`, and bounded `source=real` handoff.
- Create `scripts/eval-ordinary-ai-utils.mjs`: Markdown/JSON report formatting and eval-case extraction helpers.
- Modify `scripts/evaluate-llm-game.mjs`: add optional eval-case JSON export so real LLM samples can feed the same evaluator.
- Modify `package.json`: add `eval:ordinary-ai` script.
- Create `prompts/evals/ordinary-ai-judge.md`: LLM-as-judge prompt for subjective ordinary table voice scoring.
- Create `scripts/promptfoo-ordinary-judge-provider.mjs`: OpenAI-compatible promptfoo provider controlled by process env.
- Create `promptfoo.config.yaml`: optional promptfoo config for generated eval cases.
- Create `docs/tasks/2026-06-ordinary-ai-evaluation.md`: task card and acceptance evidence.
- Modify `progress.md` and `session-handoff.md`: record plan and implementation state when execution starts.

Do not modify `.env`, provider keys, generated audio caches, `.next`, `node_modules`, production deploy scripts, or unrelated AI speech/action logic during the first implementation pass.

---

### Task 1: Ordinary Eval Scoring Helpers

**Files:**
- Modify: `src/ai/llmEvaluation.ts`
- Modify: `src/ai/llmEvaluation.test.ts`

- [ ] **Step 1: Add failing tests for ordinary eval issue detection**

In `src/ai/llmEvaluation.test.ts`, update the import block to include:

```ts
  analyzeOrdinaryAiEvalCase,
  summarizeOrdinaryAiEvalCases,
  type OrdinaryAiEvalCase,
```

Add these tests near the end of the existing `describe("llm evaluation helpers", () => {` block, before the final closing `});`:

```ts
  function ordinarySpeechCase(overrides: Partial<OrdinaryAiEvalCase> = {}): OrdinaryAiEvalCase {
    return {
      id: "ordinary:seed91:day1:seat2:speech",
      boardId: "9p-seer-witch-hunter",
      seed: 91,
      day: 1,
      phase: "DAY_SPEECH",
      seatId: 2,
      seatName: "Claude",
      task: "speech",
      publicContext: {
        aliveSeats: [
          { seatId: 1, name: "DeepSeek" },
          { seatId: 2, name: "Claude" },
          { seatId: 3, name: "GPT" },
        ],
        deaths: [],
        priorSpeeches: [{ seatId: 1, name: "DeepSeek", text: "我现在信息少，先听2号怎么聊。" }],
        priorVotes: [],
        publicClaims: [],
      },
      output: {
        text: "我先做全桌发言链审计，1号的收益来源和压力源没有闭合，这个缺口先记一笔。",
        provider: "mimo-speech:mimo-v2.5-pro",
        isFallback: false,
      },
      ...overrides,
    };
  }

  it("flags ordinary template tone, jargon stack, and no-action speech", () => {
    const issues = analyzeOrdinaryAiEvalCase(ordinarySpeechCase());

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["template_tone", "jargon_stack", "no_game_action"]),
    );
    expect(issues.some((issue) => issue.severity === "blocking")).toBe(false);
  });

  it("flags ordinary rule lectures that do not lead to a game action", () => {
    const issues = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        output: {
          text: "平安夜说明女巫手里有解药，狼首夜必刀，药瓶状态可以推出毒口和刀口重合。",
          provider: "mimo-speech:mimo-v2.5-pro",
        },
      }),
    );

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["rule_lecture", "no_game_action", "logic_boundary_error"]),
    );
  });

  it("flags speech-vote discontinuity when the action target does not match the speech target", () => {
    const issues = analyzeOrdinaryAiEvalCase(
      ordinarySpeechCase({
        id: "ordinary:seed91:day1:seat2:vote",
        phase: "DAY_VOTE",
        task: "vote",
        output: {
          text: "vote 5号，公开证据更清晰。",
          commandType: "vote",
          targetSeatId: 5,
          provider: "mimo-action:mimo-v2.5-pro",
        },
        continuity: {
          previousSpeechTargetSeatId: 3,
          voteTargetSeatId: 5,
          expectedFocusSeatIds: [3],
        },
      }),
    );

    expect(issues.map((issue) => issue.code)).toContain("speech_vote_discontinuity");
  });

  it("summarizes ordinary eval cases into pass/fail metrics", () => {
    const clean = ordinarySpeechCase({
      id: "clean",
      output: {
        text: "我先不打死1号，但他刚才只说信息少，没有说想听谁，2号我想听你先接这个点。",
        provider: "mimo-speech:mimo-v2.5-pro",
      },
    });
    const noisy = ordinarySpeechCase();
    const summary = summarizeOrdinaryAiEvalCases([
      { case: clean, issues: analyzeOrdinaryAiEvalCase(clean) },
      { case: noisy, issues: analyzeOrdinaryAiEvalCase(noisy) },
    ]);

    expect(summary.totalCases).toBe(2);
    expect(summary.speechCases).toBe(2);
    expect(summary.warningIssues).toBeGreaterThan(0);
    expect(summary.byIssue.template_tone).toBe(1);
    expect(summary.passed).toBe(true);
  });
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm run test -- src/ai/llmEvaluation.test.ts
```

Expected: FAIL with missing exports `analyzeOrdinaryAiEvalCase`, `summarizeOrdinaryAiEvalCases`, and `OrdinaryAiEvalCase`.

- [ ] **Step 3: Add ordinary eval types to `llmEvaluation.ts`**

In `src/ai/llmEvaluation.ts`, add these exports after `LlmOptimizationRecommendationInput`:

```ts
export type OrdinaryAiEvalTask = "speech" | "action" | "vote";

export type OrdinaryAiEvalCase = {
  id: string;
  boardId: string;
  seed: number;
  gameId?: string;
  day: number;
  phase: string;
  seatId: number;
  seatName: string;
  role?: Role;
  task: OrdinaryAiEvalTask;
  publicContext: {
    aliveSeats: Array<{ seatId: number; name: string }>;
    deaths: Array<{ seatId: number; name: string; day?: number }>;
    priorSpeeches: Array<{ seatId: number; name: string; text: string }>;
    priorVotes?: Array<{ voterSeatId: number; targetSeatId?: number }>;
    publicClaims?: string[];
  };
  output: {
    text: string;
    commandType?: string;
    targetSeatId?: number;
    provider?: string;
    isFallback?: boolean;
    validationErrors?: string[];
    retryIssueCodes?: string[];
  };
  continuity?: {
    previousSpeechTargetSeatId?: number;
    voteTargetSeatId?: number;
    expectedFocusSeatIds?: number[];
  };
};

export type OrdinaryAiEvalIssueCode =
  | "template_tone"
  | "jargon_stack"
  | "rule_lecture"
  | "no_game_action"
  | "logic_boundary_error"
  | "bad_followup_target"
  | "repeated_empty_pressure"
  | "speech_vote_discontinuity"
  | "fallback_or_error";

export type OrdinaryAiEvalIssue = {
  code: OrdinaryAiEvalIssueCode;
  severity: "blocking" | "warning";
  detail: string;
  evidence: string;
};

export type OrdinaryAiEvalCaseResult = {
  case: OrdinaryAiEvalCase;
  issues: OrdinaryAiEvalIssue[];
};

export type OrdinaryAiEvalSummary = {
  totalCases: number;
  speechCases: number;
  actionCases: number;
  voteCases: number;
  blockingIssues: number;
  warningIssues: number;
  fallbackOrErrorCases: number;
  byIssue: Partial<Record<OrdinaryAiEvalIssueCode, number>>;
  passed: boolean;
};
```

- [ ] **Step 4: Implement local scoring**

In `src/ai/llmEvaluation.ts`, add these exports before `buildLlmEvaluationFriends`:

```ts
export function analyzeOrdinaryAiEvalCase(value: OrdinaryAiEvalCase): OrdinaryAiEvalIssue[] {
  const text = normalizeSpaces(value.output.text);
  const issues: OrdinaryAiEvalIssue[] = [];
  const push = (issue: OrdinaryAiEvalIssue) => issues.push(issue);

  if (value.output.isFallback || value.output.validationErrors?.length || value.output.retryIssueCodes?.length) {
    push({
      code: "fallback_or_error",
      severity: "blocking",
      detail: "provider fallback, validation failure, or retry issue occurred.",
      evidence: clipEvalEvidence(value.output.validationErrors?.join("; ") || value.output.retryIssueCodes?.join("; ") || text),
    });
  }

  if (looksLikeTemplateTone(text)) {
    push({
      code: "template_tone",
      severity: "warning",
      detail: "speech sounds like a review report or internal audit rather than a table player.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsOrdinaryJargonStack(text)) {
    push({
      code: "jargon_stack",
      severity: "warning",
      detail: "speech stacks internal abstract terms instead of ordinary player wording.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsOrdinaryRuleLecture(text)) {
    push({
      code: "rule_lecture",
      severity: "warning",
      detail: "speech explains first-night death or witch medicine as a rules lecture.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (containsOrdinaryLogicBoundaryError(text)) {
    push({
      code: "logic_boundary_error",
      severity: "blocking",
      detail: "speech turns public inference into a certainty or leaks impossible knowledge.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (value.task === "speech" && lacksConcreteGameAction(text)) {
    push({
      code: "no_game_action",
      severity: "warning",
      detail: "speech does not leave suspicion, protection, a question, vote boundary, or action commitment.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (asksBadFollowupTarget(value, text)) {
    push({
      code: "bad_followup_target",
      severity: "warning",
      detail: "speech asks an already-spoken or unavailable seat to answer the same kind of point.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (repeatsPriorEmptyPressure(value, text)) {
    push({
      code: "repeated_empty_pressure",
      severity: "warning",
      detail: "speech repeats a prior low-information pressure question without adding a new target or reason.",
      evidence: clipEvalEvidence(text),
    });
  }

  if (hasOrdinarySpeechVoteDiscontinuity(value, text)) {
    push({
      code: "speech_vote_discontinuity",
      severity: "warning",
      detail: "vote/action target does not follow the previous speech target and lacks a public pivot explanation.",
      evidence: clipEvalEvidence(text),
    });
  }

  return issues;
}

export function summarizeOrdinaryAiEvalCases(results: OrdinaryAiEvalCaseResult[]): OrdinaryAiEvalSummary {
  const byIssue = results.reduce<Partial<Record<OrdinaryAiEvalIssueCode, number>>>((acc, result) => {
    for (const issue of result.issues) {
      acc[issue.code] = (acc[issue.code] ?? 0) + 1;
    }
    return acc;
  }, {});
  const blockingIssues = results.flatMap((result) => result.issues).filter((issue) => issue.severity === "blocking").length;
  const warningIssues = results.flatMap((result) => result.issues).filter((issue) => issue.severity === "warning").length;
  const speechCases = results.filter((result) => result.case.task === "speech").length;
  const actionCases = results.filter((result) => result.case.task === "action").length;
  const voteCases = results.filter((result) => result.case.task === "vote").length;
  const fallbackOrErrorCases = results.filter((result) => result.issues.some((issue) => issue.code === "fallback_or_error")).length;
  const templateWarnings = (byIssue.template_tone ?? 0) + (byIssue.jargon_stack ?? 0);
  const templateRatio = speechCases > 0 ? templateWarnings / speechCases : 0;
  const fallbackRatio = results.length > 0 ? fallbackOrErrorCases / results.length : 0;
  const voteDiscontinuityRatio = voteCases + actionCases > 0 ? (byIssue.speech_vote_discontinuity ?? 0) / (voteCases + actionCases) : 0;

  return {
    totalCases: results.length,
    speechCases,
    actionCases,
    voteCases,
    blockingIssues,
    warningIssues,
    fallbackOrErrorCases,
    byIssue,
    passed: blockingIssues === 0 && fallbackRatio <= 0.1 && templateRatio <= 0.2 && voteDiscontinuityRatio <= 0.15,
  };
}
```

- [ ] **Step 5: Add local detector helpers**

In `src/ai/llmEvaluation.ts`, add these helpers near the existing private text helper functions:

```ts
function looksLikeTemplateTone(text: string): boolean {
  return /全桌|审计|复盘工具|收益来源|发言链|结构化|闭合|收口|压力源/.test(text);
}

function containsOrdinaryJargonStack(text: string): boolean {
  const hits = ["收益来源", "发言链", "闭合", "收口", "压力源", "缺口", "审计", "结构收益"].filter((word) => text.includes(word));
  return hits.length >= 2;
}

function containsOrdinaryRuleLecture(text: string): boolean {
  return /狼首夜必刀|女巫手里有解药|药瓶状态|毒口重合刀口|刀口就在|女巫一定救|女巫必救/.test(text);
}

function containsOrdinaryLogicBoundaryError(text: string): boolean {
  return /狼人不能空刀|规则不允许空刀|一定救了\d+号|女巫一定救|刀口就是\d+号|毒口就是\d+号/.test(text);
}

function lacksConcreteGameAction(text: string): boolean {
  if (!text.trim()) return true;
  return !/(怀疑|暂时放|先放|压|追问|回答|解释|投|票|验|查|听|保留|站边|不认|认下|打死|看你|聊清楚|给态度|给结论)/.test(text);
}

function asksBadFollowupTarget(value: OrdinaryAiEvalCase, text: string): boolean {
  const spokenSeatIds = new Set(value.publicContext.priorSpeeches.map((speech) => speech.seatId));
  const askedSeats = [...text.matchAll(/(\d+)号[^。！？!?]{0,18}(回答|解释|补|接这个点|给态度|给过程)/g)].map((match) => Number(match[1]));
  return askedSeats.some((seatId) => spokenSeatIds.has(seatId) && !/(刚才|已经|你上一轮|你前面)/.test(text));
}

function repeatsPriorEmptyPressure(value: OrdinaryAiEvalCase, text: string): boolean {
  const prior = value.publicContext.priorSpeeches.map((speech) => speech.text).join("\n");
  if (!prior) return false;
  const repeatedPhrases = ["信息少", "先记一笔", "给态度", "补过程", "说清楚"];
  const repeatedCount = repeatedPhrases.filter((phrase) => text.includes(phrase) && prior.includes(phrase)).length;
  return repeatedCount >= 2 && !/(我和前面不同|我换个角度|新点|新增|转向|不再问)/.test(text);
}

function hasOrdinarySpeechVoteDiscontinuity(value: OrdinaryAiEvalCase, text: string): boolean {
  const previousTarget = value.continuity?.previousSpeechTargetSeatId;
  const voteTarget = value.output.targetSeatId ?? value.continuity?.voteTargetSeatId;
  if (!previousTarget || !voteTarget || previousTarget === voteTarget) return false;
  return !/(因为|但|刚才|后来|新增|票型|对跳|查杀|金水|遗言|发言更差|改投|转票|公开证据)/.test(text);
}

function clipEvalEvidence(text: string): string {
  return normalizeSpaces(text).slice(0, 180);
}
```

- [ ] **Step 6: Run focused tests until GREEN**

Run:

```powershell
npm run test -- src/ai/llmEvaluation.test.ts
```

Expected: PASS for the full `llmEvaluation.test.ts` file.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts
git commit -m "Add ordinary AI eval scoring helpers"
```

Expected: commit succeeds. If the working tree contains unrelated existing changes in these files, stage only the hunks from this task.

---

### Task 2: Local Evaluation Runner And Reports

**Files:**
- Create: `scripts/eval-ordinary-ai-utils.mjs`
- Create: `scripts/eval-ordinary-ai.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create utility module for cases and reports**

Create `scripts/eval-ordinary-ai-utils.mjs`:

```js
export function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rawValue] = arg.slice(2).split("=");
    result[rawKey] = rawValue.length > 0 ? rawValue.join("=") : true;
  }
  return result;
}

export function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function readNonNegativeInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function commandToEvalText(output) {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (output.type === "speak") return output.message ?? "";
  if (output.type === "vote") return `vote ${output.targetSeatId ?? ""}号 ${output.reason ?? ""}`.trim();
  if (output.type === "seerCheck") return `seerCheck ${output.targetSeatId ?? ""}号 ${output.reason ?? ""}`.trim();
  if (output.type === "wolfKill") return `wolfKill ${output.targetSeatId ?? ""}号 ${output.reason ?? ""}`.trim();
  if (output.type === "witchAction") return `witchAction ${output.action ?? ""} ${output.targetSeatId ?? ""}号 ${output.reason ?? ""}`.trim();
  return JSON.stringify(output);
}

export function commandToTargetSeatId(output) {
  if (!output || typeof output !== "object") return undefined;
  return typeof output.targetSeatId === "number" ? output.targetSeatId : undefined;
}

export function commandToEvalTask(output, phase) {
  if (output?.type === "speak") return "speech";
  if (output?.type === "vote" || phase === "DAY_VOTE") return "vote";
  return "action";
}

export function buildPriorSpeechesFromLogs(aiLogs, currentIndex) {
  return aiLogs
    .slice(0, currentIndex)
    .filter((log) => log.output?.type === "speak")
    .map((log) => ({
      seatId: log.seatNumber,
      name: readSeatName(log),
      text: commandToEvalText(log.output),
    }))
    .slice(-8);
}

export function buildEvalCaseFromAiLog(log, index, aiLogs, state, options) {
  const outputText = commandToEvalText(log.output);
  const task = commandToEvalTask(log.output, log.phase);
  const previousSpeechTargetSeatId = readPreviousSpeechTarget(log, aiLogs, index);
  const targetSeatId = commandToTargetSeatId(log.output);
  return {
    id: `${options.boardId}:seed${options.seed}:day${log.day}:seat${log.seatNumber}:${task}:${index}`,
    boardId: options.boardId,
    seed: options.seed,
    gameId: log.gameId,
    day: log.day,
    phase: log.phase,
    seatId: log.seatNumber,
    seatName: readSeatName(log),
    role: readSeatRole(state, log.seatNumber),
    task,
    publicContext: {
      aliveSeats: state.seats.filter((seat) => seat.status === "ALIVE").map((seat) => ({ seatId: seat.seatId, name: seat.name })),
      deaths: state.seats
        .filter((seat) => seat.status !== "ALIVE")
        .map((seat) => ({ seatId: seat.seatId, name: seat.name, day: state.day })),
      priorSpeeches: buildPriorSpeechesFromLogs(aiLogs, index),
      priorVotes: [],
      publicClaims: [],
    },
    output: {
      text: outputText,
      commandType: log.output?.type,
      targetSeatId,
      provider: log.provider,
      isFallback: log.isFallback === true,
      validationErrors: log.validationErrors ?? [],
      retryIssueCodes: log.retryIssueCodes ?? [],
    },
    continuity:
      previousSpeechTargetSeatId || targetSeatId
        ? {
            previousSpeechTargetSeatId,
            voteTargetSeatId: task === "vote" ? targetSeatId : undefined,
            expectedFocusSeatIds: previousSpeechTargetSeatId ? [previousSpeechTargetSeatId] : [],
          }
        : undefined,
  };
}

export function formatOrdinaryEvalMarkdown(report) {
  const lines = [
    "# 普通局 AI 评测报告",
    "",
    "## 结论",
    `- 结果：${report.summary.passed ? "通过第一版阈值" : "未通过第一版阈值"}`,
    `- 最大问题：${formatTopIssue(report.summary.byIssue)}`,
    `- 推荐下一步：${formatRecommendation(report.summary)}`,
    "",
    "## 汇总",
    `- 样本数：${report.summary.totalCases}`,
    `- 发言/行动/投票：${report.summary.speechCases}/${report.summary.actionCases}/${report.summary.voteCases}`,
    `- blocking/warning：${report.summary.blockingIssues}/${report.summary.warningIssues}`,
    `- fallback/error 样本：${report.summary.fallbackOrErrorCases}`,
    "",
    "## Top Issues",
    ...Object.entries(report.summary.byIssue)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
    "## 样本摘录",
    ...report.results
      .filter((result) => result.issues.length > 0)
      .slice(0, 12)
      .flatMap((result) => [
        `### ${result.case.id}`,
        `- seat: ${result.case.seatId}号 ${result.case.seatName}`,
        `- task: ${result.case.task}`,
        `- issues: ${result.issues.map((issue) => `${issue.code}/${issue.severity}`).join(", ")}`,
        `- text: ${clip(result.case.output.text, 280)}`,
        "",
      ]),
  ];
  return `${lines.join("\n")}\n`;
}

function formatTopIssue(byIssue) {
  const top = Object.entries(byIssue).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} (${top[1]})` : "暂无明显问题";
}

function formatRecommendation(summary) {
  if (summary.blockingIssues > 0) return "先修 blocking 问题，尤其是 fallback、信息边界和行动连续性。";
  if ((summary.byIssue.template_tone ?? 0) + (summary.byIssue.jargon_stack ?? 0) > 0) return "优先降低模板腔和内部黑话。";
  if ((summary.byIssue.speech_vote_discontinuity ?? 0) > 0) return "优先补发言到投票的一致性。";
  return "扩大样本，加入少量真实 LLM 和人工复核。";
}

function readSeatName(log) {
  return log.seatName ?? log.prompt?.mySeat?.name ?? log.prompt?.persona?.name ?? `${log.seatNumber}号`;
}

function readSeatRole(state, seatId) {
  return state.seats.find((seat) => seat.seatId === seatId)?.role;
}

function readPreviousSpeechTarget(log, aiLogs, currentIndex) {
  const ownPriorSpeech = aiLogs
    .slice(0, currentIndex)
    .reverse()
    .find((item) => item.seatNumber === log.seatNumber && item.output?.type === "speak");
  return ownPriorSpeech?.speechPlan?.target?.seatId ?? ownPriorSpeech?.votePlan?.primaryTarget?.seatId;
}

function clip(text, maxLength) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
```

- [ ] **Step 2: Create the local evaluation runner**

Create `scripts/eval-ordinary-ai.mjs`:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  buildEvalCaseFromAiLog,
  formatOrdinaryEvalMarkdown,
  parseArgs,
  readNonNegativeInt,
  readPositiveInt,
} from "./eval-ordinary-ai-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const source = String(args.source ?? "mock");
const games = readPositiveInt(args.games, 2);
const seedStart = readNonNegativeInt(args["seed-start"], 91);
const boardId = String(args.board ?? "9p-seer-witch-hunter");
const maxSteps = readPositiveInt(args["max-steps"], 160);
const humanSeatId = readPositiveInt(args["human-seat"], 9);
const json = Boolean(args.json);
const outPath = args.out ? path.resolve(root, String(args.out)) : undefined;

if (!["mock", "existing"].includes(source)) {
  throw new Error(`source=${source} is not implemented in eval-ordinary-ai.mjs first pass. Use source=mock or source=existing.`);
}

const server = await createServer({
  root,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { "@": path.join(root, "src") } },
});

try {
  const [{ advanceWithMockAi }, { createGame }, { analyzeOrdinaryAiEvalCase, summarizeOrdinaryAiEvalCases }] = await Promise.all([
    server.ssrLoadModule("/src/ai/mockAgent.ts"),
    server.ssrLoadModule("/src/game/engine.ts"),
    server.ssrLoadModule("/src/ai/llmEvaluation.ts"),
  ]);

  const cases =
    source === "existing"
      ? await readExistingCases(path.resolve(root, String(args.input ?? "tmp/ordinary-ai-eval-cases.json")))
      : await collectMockCases({ advanceWithMockAi, createGame });

  const results = cases.map((item) => ({ case: item, issues: analyzeOrdinaryAiEvalCase(item) }));
  const report = {
    generatedAt: new Date().toISOString(),
    options: { source, boardId, games, seedStart, maxSteps, humanSeatId },
    summary: summarizeOrdinaryAiEvalCases(results),
    results,
  };

  const output = json ? `${JSON.stringify(report, null, 2)}\n` : formatOrdinaryEvalMarkdown(report);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, output, "utf8");
  }
  process.stdout.write(output);
  process.exitCode = report.summary.passed ? 0 : 1;
} finally {
  await server.close();
}

async function collectMockCases(modules) {
  const cases = [];
  for (let index = 0; index < games; index += 1) {
    const seed = seedStart + index;
    const initial = modules.createGame({ boardId, seed, humanSeatId });
    const { state, aiLogs } = await modules.advanceWithMockAi(initial, { ignoreHuman: true, maxSteps });
    aiLogs.forEach((log, logIndex) => {
      if (log.phase === "DAY_SPEECH" || log.phase === "DAY_VOTE") {
        cases.push(buildEvalCaseFromAiLog(log, logIndex, aiLogs, state, { boardId, seed }));
      }
    });
  }
  return cases;
}

async function readExistingCases(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.cases)) return parsed.cases;
  if (Array.isArray(parsed.results)) return parsed.results.map((result) => result.case ?? result);
  throw new Error(`Existing eval file does not contain cases: ${filePath}`);
}
```

- [ ] **Step 3: Add package script**

In `package.json`, add this script after `llm:evaluate`:

```json
"eval:ordinary-ai": "node scripts/eval-ordinary-ai.mjs",
```

Keep JSON valid and keep the existing script ordering readable.

- [ ] **Step 4: Run syntax and smoke checks**

Run:

```powershell
node --check scripts/eval-ordinary-ai-utils.mjs
node --check scripts/eval-ordinary-ai.mjs
npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json
```

Expected: `node --check` passes. The eval command may exit 1 if quality thresholds fail, but it must write `tmp/ordinary-ai-eval-smoke.json` with `summary`, `results`, and issue details.

- [ ] **Step 5: Add a generated report smoke assertion**

Run:

```powershell
node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync('tmp/ordinary-ai-eval-smoke.json','utf8')); if(!r.summary || !Array.isArray(r.results)) throw new Error('bad ordinary eval report'); console.log(r.summary.totalCases)"
```

Expected: prints a positive number.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add scripts/eval-ordinary-ai-utils.mjs scripts/eval-ordinary-ai.mjs package.json package-lock.json
git commit -m "Add ordinary AI eval runner"
```

Expected: commit succeeds. Include `package-lock.json` only if npm changed it; adding a script usually does not alter the lock file.

---

### Task 3: Real Sample Export And Existing-Case Flow

**Files:**
- Modify: `scripts/evaluate-llm-game.mjs`
- Modify: `scripts/eval-ordinary-ai-utils.mjs`
- Modify: `scripts/eval-ordinary-ai.mjs`

- [ ] **Step 1: Add eval-case export support to real LLM evaluation**

In `scripts/evaluate-llm-game.mjs`, add after the existing line `const outPath = args.out ? path.resolve(root, String(args.out)) : undefined;`:

```js
const evalCasesOutPath = args["eval-cases-out"] ? path.resolve(root, String(args["eval-cases-out"])) : undefined;
```

Update the utility import section near the top:

```js
import { buildEvalCaseFromAiLog } from "./eval-ordinary-ai-utils.mjs";
```

When building `report`, add:

```js
    evalCases: buildOrdinaryEvalCasesFromGames(games, boardId ?? "default"),
```

Add this helper near `summarizeGames`:

```js
function buildOrdinaryEvalCasesFromGames(games, boardId) {
  return games.flatMap((game) =>
    (game.aiLogs ?? []).flatMap((log, index, logs) => {
      if (log.phase !== "DAY_SPEECH" && log.phase !== "DAY_VOTE") return [];
      return [buildEvalCaseFromAiLog(log, index, logs, game.finalState, { boardId, seed: game.seed })];
    }),
  );
}
```

If `evaluateGame` does not currently return `aiLogs` and `finalState`, update its return object:

```js
    aiLogs: calls.map((call) => call.aiLog).filter(Boolean),
    finalState: state,
```

After writing the main output, add:

```js
  if (evalCasesOutPath) {
    await fs.mkdir(path.dirname(evalCasesOutPath), { recursive: true });
    await fs.writeFile(evalCasesOutPath, `${JSON.stringify(report.evalCases, null, 2)}\n`, "utf8");
  }
```

- [ ] **Step 2: Run syntax check**

Run:

```powershell
node --check scripts/evaluate-llm-game.mjs
```

Expected: PASS.

- [ ] **Step 3: Verify `source=existing` with the generated mock report cases**

Create a cases file from the previous smoke:

```powershell
node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync('tmp/ordinary-ai-eval-smoke.json','utf8')); fs.writeFileSync('tmp/ordinary-ai-eval-cases.json', JSON.stringify(r.results.map(x=>x.case), null, 2));"
npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json --json --out=tmp/ordinary-ai-eval-existing.json
```

Expected: command reads existing cases and writes `tmp/ordinary-ai-eval-existing.json`. It may exit 1 when thresholds fail; the file must still be valid JSON.

- [ ] **Step 4: Document bounded real run command in script help**

In `scripts/eval-ordinary-ai.mjs`, add a `--help` branch before the Vite server is created:

```js
if (args.help) {
  process.stdout.write([
    "Usage: npm run eval:ordinary-ai -- --source=mock --games=2 --seed-start=91",
    "Usage: npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json",
    "Real LLM path: use scripts/evaluate-llm-game.mjs --eval-cases-out=tmp/ordinary-real-cases.json, then source=existing.",
    "No API keys are read or written by eval-ordinary-ai.mjs.",
    "",
  ].join("\\n"));
  process.exit(0);
}
```

- [ ] **Step 5: Run help check**

Run:

```powershell
npm run eval:ordinary-ai -- --help
```

Expected: exits 0 and prints the two-step real LLM flow.

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add scripts/evaluate-llm-game.mjs scripts/eval-ordinary-ai.mjs scripts/eval-ordinary-ai-utils.mjs
git commit -m "Export ordinary eval cases from LLM samples"
```

Expected: commit succeeds.

---

### Task 4: Optional Promptfoo Judge

**Files:**
- Create: `prompts/evals/ordinary-ai-judge.md`
- Create: `scripts/promptfoo-ordinary-judge-provider.mjs`
- Create: `promptfoo.config.yaml`
- Modify: `scripts/eval-ordinary-ai-utils.mjs`
- Modify: `scripts/eval-ordinary-ai.mjs`

- [ ] **Step 1: Add the judge prompt**

Create `prompts/evals/ordinary-ai-judge.md`:

```md
你是普通狼人杀 AI 评测员。只评估这条公开发言或行动理由是否像普通玩家、是否承接公开上下文、是否推动对局。

请只输出 JSON，不要输出 Markdown。

评分字段：
- human_table_voice: 1 到 5，越像普通玩家越高。
- concrete_progress: 1 到 5，越能推进怀疑、追问、暂保、投票或行动越高。
- context_fit: 1 到 5，越准确承接公开发言、死讯、身份声明和票型越高。
- vote_continuity: 1 到 5，越能解释发言目标到行动/投票目标越高。非投票/行动样本也要给分。
- over_template_risk: 1 到 5，越模板、越报告腔、越像系统内部字段，分数越高。
- verdict: pass、warn 或 fail。
- reason: 一句话中文解释。

公开上下文：
{{publicContext}}

当前样本：
座位：{{seatId}}号 {{seatName}}
阶段：{{phase}}
任务：{{task}}
输出：{{outputText}}
连续性：{{continuity}}

输出 JSON 形状：
{"human_table_voice":4,"concrete_progress":4,"context_fit":4,"vote_continuity":4,"over_template_risk":1,"verdict":"pass","reason":"这句像玩家发言，并且有明确追问。"}
```

- [ ] **Step 2: Add promptfoo custom provider**

Create `scripts/promptfoo-ordinary-judge-provider.mjs`:

```js
export default class OrdinaryAiJudgeProvider {
  id() {
    return "ordinary-ai-judge-openai-compatible";
  }

  async callApi(prompt) {
    const baseUrl = readEnv("PROMPTFOO_JUDGE_BASE_URL", "https://api.openai.com/v1").replace(/\/+$/, "");
    const apiKey = process.env.PROMPTFOO_JUDGE_API_KEY;
    const model = readEnv("PROMPTFOO_JUDGE_MODEL", "gpt-4.1-mini");
    if (!apiKey) {
      return { error: "Missing PROMPTFOO_JUDGE_API_KEY" };
    }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: "system", content: "Return strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      return { error: sanitize(raw, apiKey) };
    }
    const data = JSON.parse(raw);
    return { output: data.choices?.[0]?.message?.content ?? raw };
  }
}

function readEnv(key, fallback) {
  return process.env[key]?.trim() || fallback;
}

function sanitize(text, apiKey) {
  return apiKey ? String(text).split(apiKey).join("***") : String(text);
}
```

- [ ] **Step 3: Add promptfoo config**

Create `promptfoo.config.yaml`:

```yaml
description: Ordinary Werewolf AI speech/action judge
prompts:
  - file://prompts/evals/ordinary-ai-judge.md
providers:
  - file://scripts/promptfoo-ordinary-judge-provider.mjs
tests: file://tmp/ordinary-ai-promptfoo-cases.json
defaultTest:
  assert:
    - type: is-json
```

- [ ] **Step 4: Export promptfoo test cases from reports**

In `scripts/eval-ordinary-ai-utils.mjs`, add:

```js
export function writePromptfooCases(results) {
  return results.slice(0, 40).map((result) => ({
    vars: {
      publicContext: JSON.stringify(result.case.publicContext, null, 2),
      seatId: result.case.seatId,
      seatName: result.case.seatName,
      phase: result.case.phase,
      task: result.case.task,
      outputText: result.case.output.text,
      continuity: JSON.stringify(result.case.continuity ?? {}, null, 2),
    },
  }));
}
```

In `scripts/eval-ordinary-ai.mjs`, import `writePromptfooCases`:

```js
  writePromptfooCases,
```

After `report` is built, add:

```js
  if (args.judge === "promptfoo") {
    const promptfooCasesPath = path.resolve(root, "tmp", "ordinary-ai-promptfoo-cases.json");
    await fs.mkdir(path.dirname(promptfooCasesPath), { recursive: true });
    await fs.writeFile(promptfooCasesPath, `${JSON.stringify(writePromptfooCases(results), null, 2)}\n`, "utf8");
  }
```

- [ ] **Step 5: Run promptfoo case export without calling judge model**

Run:

```powershell
npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --judge=promptfoo --json --out=tmp/ordinary-ai-eval-promptfoo-prep.json
node -e "const fs=require('fs'); const t=JSON.parse(fs.readFileSync('tmp/ordinary-ai-promptfoo-cases.json','utf8')); if(!Array.isArray(t) || !t[0].vars.outputText) throw new Error('bad promptfoo cases'); console.log(t.length)"
```

Expected: promptfoo case file is created. The eval command may exit 1 on quality thresholds, but the promptfoo cases file must be valid.

- [ ] **Step 6: Run optional promptfoo dry path only when a judge key is available**

If `PROMPTFOO_JUDGE_API_KEY` is set, run:

```powershell
npx promptfoo eval -c promptfoo.config.yaml --output tmp/ordinary-ai-promptfoo-report.json
```

Expected: promptfoo exits 0 and writes `tmp/ordinary-ai-promptfoo-report.json`.

If no judge key is available, record:

```text
Skipped promptfoo live judge because PROMPTFOO_JUDGE_API_KEY is not configured.
```

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add prompts/evals/ordinary-ai-judge.md scripts/promptfoo-ordinary-judge-provider.mjs promptfoo.config.yaml scripts/eval-ordinary-ai-utils.mjs scripts/eval-ordinary-ai.mjs
git commit -m "Add optional promptfoo ordinary AI judge"
```

Expected: commit succeeds.

---

### Task 5: Task Card, Verification, And Handoff

**Files:**
- Create: `docs/tasks/2026-06-ordinary-ai-evaluation.md`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Create task card**

Create `docs/tasks/2026-06-ordinary-ai-evaluation.md`:

```md
# Ordinary AI Evaluation

Short name: ordinary-ai-evaluation
Task type: AI speech / AI behavior / verification
Status: in-progress

## Goal

Create a local ordinary Werewolf AI evaluation command that scores speech text, action/vote choices, and speech-to-vote continuity, with optional promptfoo LLM judging.

## Scope

- Ordinary Werewolf only.
- Local command-line reports in Markdown/JSON.
- Local rule scoring is required.
- promptfoo judge is optional and cost-gated by `PROMPTFOO_JUDGE_API_KEY`.
- Real LLM generation is not run by default.

## Out Of Scope

- Cloud TTS.
- LiteLLM.
- Langfuse.
- Web evaluation dashboard.
- Production deployment.
- Editing `.env`, keys, generated audio, database files, `.next`, or node_modules.

## Verification

- `npm run test -- src/ai/llmEvaluation.test.ts`
- `node --check scripts/eval-ordinary-ai-utils.mjs`
- `node --check scripts/eval-ordinary-ai.mjs`
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json`
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json --json --out=tmp/ordinary-ai-eval-existing.json`
- `npm run lint`
- `npx tsc --noEmit`

## Acceptance Notes

- Initial state: implementation pending.
```

- [ ] **Step 2: Update progress at implementation start**

At the top of `progress.md`, set:

```md
**Last Updated:** 2026-06-08 Asia/Shanghai
**Session ID:** ordinary-ai-evaluation
**Active Feature:** ordinary-ai-evaluation - ordinary Werewolf AI speech/action evaluation with local scoring and optional promptfoo judging.
```

Add a current status bullet:

```md
- [ ] Ordinary AI evaluation implementation is in progress: scoring helpers, CLI report, existing/real sample bridge, and optional promptfoo judge.
```

- [ ] **Step 3: Update `session-handoff.md` current objective**

At the top of `session-handoff.md`, set current objective bullets to:

```md
- Goal: Build the first local ordinary Werewolf AI evaluation command for speech text, action/vote choices, and speech-to-vote continuity.
- Current status: In progress.
- Local note: Do not run real LLM or promptfoo judge unless the user explicitly accepts the cost and provides temporary process env keys.
```

Keep older completion history below the current objective.

- [ ] **Step 4: Run final focused verification**

Run:

```powershell
npm run test -- src/ai/llmEvaluation.test.ts
node --check scripts/eval-ordinary-ai-utils.mjs
node --check scripts/eval-ordinary-ai.mjs
npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json
node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync('tmp/ordinary-ai-eval-smoke.json','utf8')); if(!r.summary || !Array.isArray(r.results)) throw new Error('bad ordinary eval report'); console.log('ordinary eval ok')"
npm run lint
npx tsc --noEmit
```

Expected: tests, syntax checks, JSON report check, lint, and TypeScript pass. The eval command may exit 1 if thresholds fail; if it does, rerun the JSON validation command and record that the command generated a valid report but failed quality thresholds by design.

- [ ] **Step 5: Update task card and handoff with exact evidence**

In `docs/tasks/2026-06-ordinary-ai-evaluation.md`, set:

```md
Status: done
```

Append:

```md
## Implementation Record

Completed:
- Added ordinary eval case scoring helpers.
- Added local ordinary AI eval command and report output.
- Added existing-case bridge for generated eval cases.
- Added optional promptfoo judge prompt/config/provider.

Verification:
- `npm run test -- src/ai/llmEvaluation.test.ts`
- `node --check scripts/eval-ordinary-ai-utils.mjs`
- `node --check scripts/eval-ordinary-ai.mjs`
- `npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --json --out=tmp/ordinary-ai-eval-smoke.json`
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-ai-eval-cases.json --json --out=tmp/ordinary-ai-eval-existing.json`
- `npm run lint`
- `npx tsc --noEmit`

Skipped checks:
- Real LLM generation was skipped unless explicitly run.
- promptfoo live judge was skipped unless `PROMPTFOO_JUDGE_API_KEY` was configured.

Remaining risks:
- First scoring thresholds are provisional and should be calibrated after reviewing several reports.
- LLM judge results are subjective and should not be the only pass/fail source.
```

Update `progress.md` and `session-handoff.md` with changed files, verification, skipped checks, and remaining risks.

- [ ] **Step 6: Commit Task 5**

Run:

```powershell
git add docs/tasks/2026-06-ordinary-ai-evaluation.md progress.md session-handoff.md
git commit -m "Record ordinary AI evaluation rollout"
```

Expected: commit succeeds. Do not stage unrelated dirty files.

---

## Self-Review

- Spec coverage: Task 1 implements local scoring for template tone, jargon, rule lecture, no action, logic boundary, bad followup, repeated pressure, speech-vote continuity, and fallback/error. Task 2 implements local CLI and Markdown/JSON reports. Task 3 covers existing and real-sample bridge without default model cost. Task 4 covers optional promptfoo judge. Task 5 covers task card and verification evidence.
- Placeholder scan: This plan contains concrete paths, function names, commands, and code snippets. It does not rely on deferred implementation markers.
- Type consistency: `OrdinaryAiEvalCase`, `OrdinaryAiEvalIssue`, `OrdinaryAiEvalCaseResult`, and `OrdinaryAiEvalSummary` are introduced before they are used. Script helpers consume the same case shape that `src/ai/llmEvaluation.ts` scores.
- Scope check: The plan does not change live gameplay, provider routing, TTS, deployment, or UI. Real LLM and promptfoo judge runs are explicitly opt-in because they can cost money.
