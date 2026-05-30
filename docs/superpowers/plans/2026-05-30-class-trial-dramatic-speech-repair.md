# Class Trial Dramatic Speech Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make class-trial themed AI speech feel like dramatic character-led debate while preserving hard hidden-information and rules boundaries.

**Architecture:** Add a class-trial dramatic mode boundary that is reused by speech validation, claim extraction, fallback generation, and theme-scoped speech planning. Keep ordinary werewolf games on the current stricter validation path, and make class-trial validation expression-lenient while preserving hard legality checks.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, existing `src/ai/**`, `src/game/**`, and `src/app/api/ai-speech-audio/**` modules.

---

## File Structure

- Create: `src/ai/classTrialDramaticMode.ts`  
  Centralizes class-trial dramatic mode checks and validation policy constants.
- Create: `src/ai/classTrialDramaticMode.test.ts`  
  Proves ordinary games do not enter dramatic mode.
- Create: `src/game/classTrialClaims.ts`  
  Normalizes dramatic class-trial identity claims into role/strength signals.
- Modify: `src/game/claims.ts`  
  Accepts optional `roleCard` context and uses class-trial claim normalization only for class-trial role cards.
- Modify: `src/game/engine.ts`  
  Passes `actor.roleCard` into claim extraction when recording public speech memory.
- Modify: `src/game/claims.test.ts`  
  Adds class-trial dramatic claim extraction tests.
- Modify: `src/ai/speechProviders.ts`  
  Uses dramatic mode for expression-lenient class-trial validation, passes role-card context to claim extraction, and avoids false witch-attribution fallback.
- Modify: `src/ai/speechProviders.test.ts`  
  Updates existing template tests and adds regression tests for dramatic expression and witch attribution.
- Modify: `src/ai/classTrialCharacterLens.ts`  
  Adds multiple fallback moves per character and replaces the stitched fallback pattern with deterministic role action selection.
- Modify: `src/ai/classTrialCharacterLens.test.ts`  
  Verifies fallback variation and no ordinary template fallback.
- Modify: `src/ai/tableRead.ts`  
  Applies theme-scoped strategy language for seer, witch, hunter, wolf, and villager speech plans.
- Modify: `src/ai/tableRead.test.ts`  
  Verifies class-trial speech plans avoid vague “偏好信息” wording and ordinary games keep existing plan language.
- Modify: `src/app/api/ai-speech-audio/route.test.ts`  
  Adds one assertion that dramatic class-trial text is passed unchanged to the Japanese rewrite boundary.

---

### Task 1: Add Dramatic Mode Boundary

**Files:**
- Create: `src/ai/classTrialDramaticMode.ts`
- Create: `src/ai/classTrialDramaticMode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ai/classTrialDramaticMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AgentView, AiCharacterRoleCard } from "@/game/types";
import {
  DRAMATIC_CLASS_TRIAL_HARD_BOUNDARIES,
  isDramaticClassTrialRoleCard,
  isDramaticClassTrialView,
  shouldUseClassTrialExpressionLeniency,
} from "./classTrialDramaticMode";

describe("classTrialDramaticMode", () => {
  it("enables dramatic speech mode only for class-trial role cards", () => {
    expect(isDramaticClassTrialRoleCard(roleCard("class-trial"))).toBe(true);
    expect(isDramaticClassTrialRoleCard(roleCard("default"))).toBe(false);
    expect(isDramaticClassTrialRoleCard(undefined)).toBe(false);
  });

  it("exposes a view-level expression leniency switch", () => {
    const classTrialView = { roleCard: roleCard("class-trial") } as Pick<AgentView, "roleCard">;
    const ordinaryView = { roleCard: roleCard("default") } as Pick<AgentView, "roleCard">;

    expect(isDramaticClassTrialView(classTrialView)).toBe(true);
    expect(shouldUseClassTrialExpressionLeniency(classTrialView)).toBe(true);
    expect(isDramaticClassTrialView(ordinaryView)).toBe(false);
    expect(shouldUseClassTrialExpressionLeniency(ordinaryView)).toBe(false);
  });

  it("documents hard boundaries that dramatic mode must still keep", () => {
    expect(DRAMATIC_CLASS_TRIAL_HARD_BOUNDARIES).toEqual(
      expect.arrayContaining(["hidden-role-leak", "future-speech", "private-night-info", "illegal-skill-fact"]),
    );
  });
});

function roleCard(theme: string): AiCharacterRoleCard {
  return {
    id: "naegi",
    displayName: "苗木诚",
    theme,
    styleTags: [],
    speechStyleZh: "真诚但戏剧化。",
    reasoningBias: "把混乱拉回共同验证点。",
    voteBias: "投公开矛盾更明确的位置。",
    nightActionBias: "夜晚行动稳健。",
    asVillager: "作为好人时组织桌面。",
    asWerewolf: "作为狼人时用公开理由伪装。",
    pressureResponse: "被怀疑时先承认可疑点。",
    relationshipHints: [],
    catchphrasePolicy: "允许短句，不复刻原台词。",
    forbidden: [],
  };
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm run test -- src/ai/classTrialDramaticMode.test.ts
```

Expected: FAIL because `src/ai/classTrialDramaticMode.ts` does not exist.

- [ ] **Step 3: Add the dramatic mode helper**

Create `src/ai/classTrialDramaticMode.ts`:

```ts
import type { AgentView, AiCharacterRoleCard } from "@/game/types";

export const DRAMATIC_CLASS_TRIAL_HARD_BOUNDARIES = [
  "hidden-role-leak",
  "future-speech",
  "private-night-info",
  "illegal-skill-fact",
] as const;

export function isDramaticClassTrialRoleCard(
  roleCard: Pick<AiCharacterRoleCard, "theme"> | undefined,
): boolean {
  return roleCard?.theme === "class-trial";
}

export function isDramaticClassTrialView(view: Pick<AgentView, "roleCard"> | undefined): boolean {
  return isDramaticClassTrialRoleCard(view?.roleCard);
}

export function shouldUseClassTrialExpressionLeniency(view: Pick<AgentView, "roleCard"> | undefined): boolean {
  return isDramaticClassTrialView(view);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
npm run test -- src/ai/classTrialDramaticMode.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/ai/classTrialDramaticMode.ts src/ai/classTrialDramaticMode.test.ts
git commit -m "feat: add class trial dramatic mode boundary"
```

---

### Task 2: Normalize Dramatic Class-Trial Claims

**Files:**
- Create: `src/game/classTrialClaims.ts`
- Modify: `src/game/claims.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/claims.test.ts`
- Modify: `src/ai/speechProviders.ts`

- [ ] **Step 1: Write failing claim-normalization tests**

Append these tests to `src/game/claims.test.ts` inside the existing `describe("role claim extraction", () => { })` block:

```ts
  it("treats dramatic class-trial witch reveals as hard witch claims", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message: "6号塞蕾丝缇雅。女巫在这里。药还握在我手上，谁要下注请现在开口。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim?.claimedRole).toBe("WITCH");
    expect(claim?.strength).toBe("hard");
  });

  it("does not turn dramatic class-trial witch wording on for ordinary games", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 6,
      message: "女巫在这里这个说法我不认可，我只是按平安夜做死亡形态推理。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "default" },
    });

    expect(claim).toBeUndefined();
  });

  it("keeps peaceful-night public reasoning distinct from a class-trial witch claim", () => {
    const claim = extractRoleClaimFromSpeech({
      day: 1,
      claimantSeatId: 1,
      message: "平安夜在我这里更像女巫用药结果，但这不是我明牌女巫。",
      validSeatIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      roleCard: { theme: "class-trial" },
    });

    expect(claim).toBeUndefined();
  });
```

- [ ] **Step 2: Run the claim tests to verify they fail**

Run:

```powershell
npm run test -- src/game/claims.test.ts
```

Expected: FAIL with TypeScript errors or assertion failures because `roleCard` is not accepted and class-trial claim normalization does not exist.

- [ ] **Step 3: Add class-trial claim normalization**

Create `src/game/classTrialClaims.ts`:

```ts
import type { ClaimStrength, Role } from "./types";

export type ClassTrialRoleClaimSignal = {
  claimedRole: Role;
  strength: ClaimStrength;
  reason: string;
};

const WITCH_HARD_CLAIM_PATTERNS = [
  /(?:^|[。！？；，,\s])女巫在这里(?:[。！？；，,\s]|$)/,
  /(?:我|这边|这里)[^。！？；\n]{0,18}(?:明牌|拍|摊开|亮出)[^。！？；\n]{0,12}(?:女巫|女巫牌|这张牌)/,
  /(?:女巫|女巫牌|这张牌)[^。！？；\n]{0,18}(?:明牌|拍|摊开|亮出来|在这里)/,
  /(?:药|解药|毒药)[^。！？；\n]{0,14}(?:握在我手|在我手|还在我手|我手上|我这里还在)/,
  /(?:不是暗示|不是绕话|不是试探)[^。！？；\n]{0,16}(?:女巫|明牌)/,
];

const WITCH_REASONING_NEGATIONS = [
  /(?:不是|不等于|并非)[^。！？；\n]{0,16}(?:我明牌女巫|我拍女巫|女巫声明|自称女巫)/,
  /(?:更像|像是|按|当成|视作)[^。！？；\n]{0,18}(?:女巫用药|药线|死亡形态)/,
];

const SEER_HARD_CLAIM_PATTERNS = [
  /(?:我|这边|这里)[^。！？；\n]{0,18}(?:把|将)[^。！？；\n]{0,12}(?:预言家牌|查验牌)[^。！？；\n]{0,12}(?:摊开|亮出|拍出来)/,
  /(?:这不是暗示|我不藏了)[^。！？；\n]{0,18}(?:预言家|查验)/,
];

const HUNTER_HARD_CLAIM_PATTERNS = [
  /(?:猎人|枪)[^。！？；\n]{0,18}(?:在这里|明牌|摊开|拍出来)/,
  /(?:别|不要)[^。！？；\n]{0,12}逼我[^。！？；\n]{0,12}(?:开枪|带人)/,
];

export function extractClassTrialRoleClaimSignal(message: string): ClassTrialRoleClaimSignal | undefined {
  const normalized = normalizeDigits(message);
  if (WITCH_REASONING_NEGATIONS.some((pattern) => pattern.test(normalized))) return undefined;
  if (WITCH_HARD_CLAIM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { claimedRole: "WITCH", strength: "hard", reason: "class-trial-dramatic-witch" };
  }
  if (SEER_HARD_CLAIM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { claimedRole: "SEER", strength: "hard", reason: "class-trial-dramatic-seer" };
  }
  if (HUNTER_HARD_CLAIM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { claimedRole: "HUNTER", strength: "hard", reason: "class-trial-dramatic-hunter" };
  }
  return undefined;
}

function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}
```

- [ ] **Step 4: Wire class-trial claim normalization into `claims.ts`**

Modify `src/game/claims.ts`:

```ts
import { extractClassTrialRoleClaimSignal } from "./classTrialClaims";
import { ROLE_LABELS } from "./labels";
import type { ClaimCheck, ClaimStrength, Role, RoleClaim } from "./types";
```

Change the parameter type in `extractRoleClaimFromSpeech`:

```ts
export function extractRoleClaimFromSpeech(params: {
  day: number;
  claimantSeatId: number;
  message: string;
  validSeatIds: Set<number>;
  sourceSpeechSeq?: number;
  roleCard?: { theme?: string };
}): SpeechClaimDraft | undefined {
```

Replace the explicit-role block in that function with:

```ts
  const explicitRole = ROLE_PATTERNS.find((item) => item.pattern.test(normalized))?.role;
  const classTrialSignal =
    params.roleCard?.theme === "class-trial" ? extractClassTrialRoleClaimSignal(normalized) : undefined;
  const checks = extractClaimChecks({
    day: params.day,
    claimantSeatId: params.claimantSeatId,
    message: normalized,
    validSeatIds: params.validSeatIds,
    sourceSpeechSeq: params.sourceSpeechSeq,
  });
  const claimedRole = explicitRole ?? classTrialSignal?.claimedRole ?? (checks.length > 0 && hasSelfCheckCue(normalized) ? "SEER" : undefined);
  if (!claimedRole) return undefined;
  const classTrialStrength = classTrialSignal?.claimedRole === claimedRole ? classTrialSignal.strength : undefined;

  return {
    day: params.day,
    claimantSeatId: params.claimantSeatId,
    claimedRole,
    strength: classTrialStrength ?? inferClaimStrength(normalized, claimedRole),
    checks,
    message,
    sourceSpeechSeq: params.sourceSpeechSeq,
  };
```

- [ ] **Step 5: Pass role-card context from game memory and speech validation**

In `src/game/engine.ts`, update the `extractRoleClaimFromSpeech` call inside `recordPublicSpeechMemory`:

```ts
  const claimDraft = extractRoleClaimFromSpeech({
    day: state.day,
    claimantSeatId: actor.seatId,
    message: cleanMessage,
    validSeatIds,
    sourceSpeechSeq: speechEventSeq,
    roleCard: actor.roleCard,
  });
```

In `src/ai/speechProviders.ts`, update the `extractRoleClaimFromSpeech` call inside `validateRenderedSpeech`:

```ts
  const publicClaim = extractRoleClaimFromSpeech({
    day: view.day,
    claimantSeatId: view.mySeatId,
    message: normalized,
    validSeatIds,
    roleCard: view.roleCard,
  });
```

- [ ] **Step 6: Run tests to verify normalization passes**

Run:

```powershell
npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS for claim tests. `speechProviders.test.ts` may fail where existing tests still expect class-trial expression-level template rejection; those failures are resolved in Task 3.

- [ ] **Step 7: Commit**

```powershell
git add src/game/classTrialClaims.ts src/game/claims.ts src/game/engine.ts src/game/claims.test.ts src/ai/speechProviders.ts
git commit -m "feat: normalize dramatic class trial claims"
```

---

### Task 3: Make Class-Trial Speech Validation Expression-Lenient

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write failing validation tests**

In `src/ai/speechProviders.test.ts`, update the test named `"keeps class-trial character speeches short and blocks repeated table templates"` so the broad audit-template assertion is no longer expected to fail. Replace this assertion:

```ts
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "桌面已经很多人把压力给到3号了，我不重复那个缺口。我换一个角度，这个疑点至今未解除。",
        "guided",
      ),
    ).toContain("发言过于冗长或报告化");
```

with:

```ts
    expect(
      validateRenderedSpeech(
        view,
        plan,
        "桌面已经很多人把压力给到3号了，但我不重复同一个票口；苗木诚先把这条压力拉回大家能共同验证的前后断点。",
        "guided",
      ),
    ).not.toContain("学级裁判发言过于模板化");
```

Add this new test near the class-trial validation tests:

```ts
  it("keeps dramatic class-trial expression while still rejecting ordinary werewolf openers", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const enoshima = state.seats.find((seat) => seat.isAi)!;
    enoshima.name = "江之岛盾子";
    enoshima.roleCard = roleCardFixture("enoshima", "江之岛盾子");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [enoshima.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, enoshima.seatId);
    const plan = createSpeechPlan(view);

    expect(
      validateRenderedSpeech(
        view,
        plan,
        "噗，这个票口当然有理由。1号把身份线压成谜语，6号又把女巫牌摊到裁判席上，我偏要看谁最急着让这条裂口闭嘴。",
        "guided",
      ),
    ).not.toContain("学级裁判发言过于模板化");

    expect(
      validateRenderedSpeech(view, plan, "我先说一下身份，我是闭眼好人，目前信息不多，先听后置位发言。", "guided"),
    ).toContain("学级裁判发言过于模板化");
  });
```

Add this witch-attribution regression test near the existing witch attribution tests:

```ts
  it("accepts discussion of a class-trial dramatic witch claim recorded on claim board", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const witch = state.seats.find((seat) => seat.isAi)!;
    witch.name = "塞蕾丝缇雅";
    witch.roleCard = roleCardFixture("celestia", "塞蕾丝缇雅");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [witch.seatId];
    state.speechIndex = 0;
    state.roleClaims = [
      {
        id: `${witch.seatId}:WITCH`,
        day: 1,
        claimantSeatId: witch.seatId,
        claimedRole: "WITCH",
        strength: "hard",
        checks: [],
        message: "女巫在这里。药还握在我手上。",
      },
    ];

    const view = buildAgentView(state, witch.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, `${witch.seatId}号已经明牌女巫，这条身份线我先接住。`, "guided")).toEqual([]);
  });
```

- [ ] **Step 2: Run speech tests to verify failures**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts
```

Expected: FAIL because current class-trial validation still treats broad audit cues as template risk and may not accept dramatic witch claim discussion.

- [ ] **Step 3: Import dramatic mode helper**

At the top of `src/ai/speechProviders.ts`, add:

```ts
import { shouldUseClassTrialExpressionLeniency } from "./classTrialDramaticMode";
```

- [ ] **Step 4: Relax class-trial report-style validation**

Replace the `reportStylePattern` assignment inside `validateConciseTableSpeech` with:

```ts
  const reportStylePattern = isClassTrialSpeech
    ? /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚)/u
    : /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚)/u;
```

- [ ] **Step 5: Replace the generic template validator**

Replace `validateClassTrialGenericSpeechTemplate` in `src/ai/speechProviders.ts` with:

```ts
function validateClassTrialGenericSpeechTemplate(view: AgentView, speech: string): string[] {
  if (view.roleCard?.theme !== "class-trial") return [];
  const genericIdentityTemplate =
    /(?:我先(?:说(?:一下)?|表(?:一下)?|报(?:一下)?)身份|先(?:说|表|报)(?:一下)?身份|我是闭眼好人|目前信息(?:不多|太少)|信息(?:不多|太少).{0,12}(?:先听|听).{0,8}后置|先听后置(?:位)?(?:发言)?|后置位(?:先)?发言|这轮先过一下|我先过一下)/;
  if (genericIdentityTemplate.test(speech)) return ["学级裁判发言过于模板化"];

  if (!shouldUseClassTrialExpressionLeniency(view)) return [];

  const emptyAnyRoleTemplate =
    /(?:按现在桌面看|我先按公开信息盘|我先不站死|我换一个角度|这个疑点(?:至今)?未解除|票口先放这里)/;
  const hasConcreteClassTrialAnchor =
    /(?:\d{1,2}\s*号|苗木|雾切|腐川|黑白熊|江之岛|塞蕾丝|十神|高松|千早|预言家|女巫|猎人|查杀|金水|平安夜|倒牌|死亡|票型|裁判席|明牌|裂口|证据链|共同验证|下注|二选一|停顿|气氛)/.test(
      speech,
    );
  const isOnlyEmptyTemplate = emptyAnyRoleTemplate.test(speech) && !hasConcreteClassTrialAnchor;
  return isOnlyEmptyTemplate ? ["学级裁判发言过于模板化"] : [];
}
```

- [ ] **Step 6: Keep hard validation boundaries untouched**

Do not remove these calls inside `validateRenderedSpeech`:

```ts
  errors.push(...validateDeathCauseBoundaries(view, normalized));
  errors.push(...validateWitchClaimAttribution(view, normalized));
  errors.push(...validateSpeechTimeline(view, normalized));
  errors.push(...validateAlreadySpokenFutureAsk(view, normalized));
  errors.push(...validateFutureSeatMentionOrder(view, normalized));
  errors.push(...validateUnspokenSeatPrematureRead(view, plan, publicClaim, normalized));
  errors.push(...validateSeerBlackCheckFinality(view, plan, publicClaim, normalized));
  errors.push(...validateBlackCheckReactionTimeline(view, normalized));
  errors.push(...validatePreClaimTargetInteractionTimeline(view, normalized));
  errors.push(...validatePostSpeechChallengeTimeline(view, normalized));
  errors.push(...validateClaimAttribution(view, normalized));
  errors.push(...validateCompleteQuestionFragments(normalized));
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm run test -- src/ai/classTrialDramaticMode.test.ts src/game/claims.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "fix: relax dramatic class trial speech validation"
```

---

### Task 4: Rework Class-Trial Fallback Into Role Actions

**Files:**
- Modify: `src/ai/classTrialCharacterLens.ts`
- Modify: `src/ai/classTrialCharacterLens.test.ts`
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write failing fallback tests**

Append this test to `src/ai/classTrialCharacterLens.test.ts`:

```ts
  it("uses multiple role action fallback moves instead of one stitched fallback pattern", () => {
    const monokuma = getClassTrialCharacterLens(roleCard("monokuma"))!;
    const first = buildClassTrialLensFallbackSpeech(monokuma, {
      focusText: "1号苗木诚",
      gap: "身份线说得像谜语",
      seed: 1,
    });
    const second = buildClassTrialLensFallbackSpeech(monokuma, {
      focusText: "1号苗木诚",
      gap: "身份线说得像谜语",
      seed: 2,
    });

    expect(first).toContain("黑白熊");
    expect(second).toContain("黑白熊");
    expect(new Set([first, second]).size).toBe(2);
    expect(first + second).toContain("二选一");
    expect(first + second).not.toContain("这个疑点未解除");
    expect(first + second).not.toContain("按现在桌面看");
  });
```

Update the existing fallback test call to include a seed:

```ts
    const line = buildClassTrialLensFallbackSpeech(lens, { focusText: "6号塞蕾丝缇雅", gap: "理由没有接上前面的票型", seed: 3 });
```

- [ ] **Step 2: Run lens tests to verify failure**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts
```

Expected: FAIL because `seed` is not accepted and only `fallbackPattern` exists.

- [ ] **Step 3: Extend the lens type**

In `src/ai/classTrialCharacterLens.ts`, update the type definitions:

```ts
export type ClassTrialFallbackMove = {
  label: string;
  pattern: string;
};

export type ClassTrialCharacterLens = {
  roleId: string;
  displayName: string;
  attentionBias: string[];
  pressureMove: string[];
  signatureMoves: string[];
  voteRationaleStyle: string[];
  forbiddenTemplates: string[];
  sampleCadence: string;
  directorExample: string;
  signalKeywords: string[];
  fallbackPattern: string;
  fallbackMoves: ClassTrialFallbackMove[];
  werewolfStrategy: ClassTrialWerewolfStrategy;
};

type LensSeed = Omit<ClassTrialCharacterLens, "roleId" | "displayName" | "forbiddenTemplates" | "werewolfStrategy"> & {
  forbiddenTemplates?: string[];
};
```

In `getClassTrialCharacterLens`, add:

```ts
    fallbackMoves: seed.fallbackMoves,
```

- [ ] **Step 4: Add fallback moves to each lens**

Add `fallbackMoves` beside each role’s `fallbackPattern`. Use these exact arrays:

```ts
fallbackMoves: [
  { label: "shared-proof", pattern: "我还不能把{focus}说死，但{gap}已经摆在我们面前；先把这一点拿出来共同验证。" },
  { label: "hope-hook", pattern: "{focus}如果要让大家相信，就得把{gap}补成能被全场查验的东西；我先守住这个希望点。" },
],
```

For `kirigiri`:

```ts
fallbackMoves: [
  { label: "evidence-break", pattern: "{focus}这段先不归死，证据链缺的是{gap}；我只把这个断点放到裁判台上。" },
  { label: "quiet-audit", pattern: "情绪先放下。{focus}的问题在{gap}没有闭合，这一点比喊票口更重要。" },
],
```

For `fukawa`:

```ts
fallbackMoves: [
  { label: "sharp-flinch", pattern: "我不喜欢{focus}把问题含过去的方式，{gap}先挂着，别逼我替你们写结论。" },
  { label: "defensive-stab", pattern: "{focus}别把话滑过去。{gap}还露在外面，我只是第一个把它说出来。" },
],
```

For `monokuma`:

```ts
fallbackMoves: [
  { label: "binary-pressure", pattern: "噗，{focus}这段最有意思的不是结论，是{gap}；这是安全保留还是想糊弄过去，二选一。" },
  { label: "taunt-gap", pattern: "有意思。{focus}把{gap}留在裁判席中央，还想装作没人看见吗？我先敲这个缺口。" },
],
```

For `enoshima`:

```ts
fallbackMoves: [
  { label: "despair-rift", pattern: "绝望地说，{focus}空出来的不是情绪，是{gap}；我先把压力压在这个裂口上。" },
  { label: "reversal", pattern: "太棒了，{focus}越想把话说平，{gap}就越刺眼；我偏要把这个反差放大。" },
],
```

For `celestia`:

```ts
fallbackMoves: [
  { label: "elegant-bet", pattern: "{focus}这段还不够优雅，{gap}没有被说圆；我先微笑着把这枚筹码压在这里。" },
  { label: "cost-check", pattern: "若要下注，我会押在{focus}的{gap}上；解释成本这么高，值得全场看一眼。" },
],
```

For `togami`:

```ts
fallbackMoves: [
  { label: "standard-cut", pattern: "{focus}的标准没有立住，{gap}就是缺口；别拿保留态度当推理。" },
  { label: "qualification", pattern: "{focus}还没有达到能带队的标准。先把{gap}补齐，再谈让别人跟票。" },
],
```

For `tomori`:

```ts
fallbackMoves: [
  { label: "small-pause", pattern: "{focus}这段让我停了一下，{gap}还悬着；我只想先确认这个声音是不是在躲。" },
  { label: "quiet-confirm", pattern: "……我听到的是{focus}那里有一点没接上，{gap}。先别急着推走，我想确认这一点。" },
],
```

For `anon`:

```ts
fallbackMoves: [
  { label: "social-catch", pattern: "{focus}这段有点绕，{gap}还没接上；我先不跟着跑票，只看这个点。" },
  { label: "tempo-bridge", pattern: "等一下，这里气氛跑太快了。{focus}的{gap}没说清，我先把话题拉回这一处。" },
],
```

For `FALLBACK_LENS`:

```ts
fallbackMoves: [
  { label: "public-gap", pattern: "{focus}这段还没有把{gap}说清楚；我先把这个公开缺口放在这里。" },
  { label: "single-point", pattern: "我只抓一个公开点：{focus}的{gap}还没闭合。" },
],
```

- [ ] **Step 5: Replace fallback builder**

Replace `buildClassTrialLensFallbackSpeech` with:

```ts
export function buildClassTrialLensFallbackSpeech(
  lens: ClassTrialCharacterLens,
  context: { focusText: string; gap: string; includeDisplayName?: boolean; seed?: number },
): string {
  const moves = lens.fallbackMoves.length > 0 ? lens.fallbackMoves : [{ label: "legacy", pattern: lens.fallbackPattern }];
  const index = Math.abs(context.seed ?? stableFallbackSeed(lens.roleId, context.focusText, context.gap)) % moves.length;
  const line = moves[index]!.pattern.replaceAll("{focus}", context.focusText).replaceAll("{gap}", normalizeFallbackGap(context.gap));
  return context.includeDisplayName === false ? line : `${lens.displayName}。${line}`;
}

function stableFallbackSeed(roleId: string, focusText: string, gap: string): number {
  const text = `${roleId}|${focusText}|${gap}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return hash;
}
```

- [ ] **Step 6: Pass a deterministic seed from speech fallback**

In `src/ai/speechProviders.ts`, update the call inside `createClassTrialFallbackSpeech`:

```ts
        buildClassTrialLensFallbackSpeech(lens, {
          focusText,
          gap,
          includeDisplayName: view.day <= 1,
          seed: view.day * 100 + view.mySeatId + currentDaySpeechItems(view).length,
        }),
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/ai/classTrialCharacterLens.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "feat: make class trial fallback role-action based"
```

---

### Task 5: Add Theme-Scoped Dramatic Speech Strategy

**Files:**
- Modify: `src/ai/tableRead.ts`
- Modify: `src/ai/tableRead.test.ts`
- Modify: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write failing strategy tests**

Add these tests to `src/ai/tableRead.test.ts`:

```ts
describe("class-trial dramatic speech planning", () => {
  it("replaces vague hidden seer-check wording in class-trial mode", () => {
    const view = {
      ...createView(createTableMemory()),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      roleCard: {
        id: "naegi",
        displayName: "苗木诚",
        theme: "class-trial",
        styleTags: [],
        speechStyleZh: "真诚但戏剧化。",
        reasoningBias: "共同验证。",
        voteBias: "先看公开矛盾。",
        nightActionBias: "稳健。",
        asVillager: "组织桌面。",
        asWerewolf: "伪装组织桌面。",
        pressureResponse: "承认疑点再解释。",
        relationshipHints: [],
        catchphrasePolicy: "短句。",
        forbidden: [],
      },
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: 2, result: "GOOD" }],
      },
    } as AgentView;

    const tableRead: AiTableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      personaLabel: "苗木诚",
      seats: [
        createSeat({ seatId: 1, isSelf: true, suspicion: 0, trust: 100 }),
        createSeat({ seatId: 2, name: "雾切响子", suspicion: 38, trust: 62 }),
        createSeat({ seatId: 3, name: "腐川冬子", suspicion: 49, trust: 42, pressure: ["解释还没接上"] }),
      ],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [2],
      wolfTeammateSeatIds: [],
      focus: createSeat({ seatId: 3, name: "腐川冬子", suspicion: 49, trust: 42, pressure: ["解释还没接上"] }),
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory: createTableMemory(),
      tableMood: "首日学级裁判低信息",
    };

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.talkingPoints.join("\n")).not.toContain("偏好信息");
    expect(plan.talkingPoints.join("\n")).toContain("验人线");
    expect(plan.talkingPoints.join("\n")).toContain("裁判席");
  });

  it("keeps ordinary hidden seer-check wording outside class-trial mode", () => {
    const view = {
      ...createView(createTableMemory()),
      phase: "DAY_SPEECH",
      myRole: "SEER",
      privateKnowledge: {
        aiMemory: { seatId: 1, day: 1, beliefs: [] },
        seerChecks: [{ day: 1, seerSeatId: 1, targetSeatId: 2, result: "GOOD" }],
      },
    } as AgentView;
    const tableRead = {
      mySeatId: 1,
      myRole: "SEER",
      day: 1,
      seats: [createSeat({ seatId: 1, isSelf: true }), createSeat({ seatId: 2, name: "P2", suspicion: 35, trust: 65 })],
      knownWolfSeatIds: [],
      knownGoodSeatIds: [2],
      wolfTeammateSeatIds: [],
      voteSnapshot: emptyVoteSnapshot,
      recentSpeeches: [],
      recentDeaths: [],
      tableMemory: createTableMemory(),
      tableMood: "ordinary",
    } as AiTableRead;

    const plan = createSpeechPlan(view, tableRead);

    expect(plan.talkingPoints.join("\n")).toContain("偏好信息");
  });
});
```

- [ ] **Step 2: Run the table-read test to verify failure**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts
```

Expected: FAIL because class-trial mode still uses “偏好信息”.

- [ ] **Step 3: Import dramatic mode helper**

At the top of `src/ai/tableRead.ts`, add:

```ts
import { isDramaticClassTrialView } from "./classTrialDramaticMode";
```

- [ ] **Step 4: Add class-trial strategy wording helpers**

Add these helpers near `buildHardIdentityPoint`:

```ts
function buildHiddenSeerCheckPoint(view: AgentView, target: ActionTarget | undefined): string {
  if (isDramaticClassTrialView(view)) {
    const targetText = target ? `${target.seatId}号这条验人线` : "我手里的验人线";
    return `${targetText}我暂时不白白交给夜刀；这不是“偏好信息”，是我压在裁判席上的可追问边界`;
  }
  return "我手里有一张偏好信息，今天先不把身份线打满";
}

function buildDramaticWitchLeadPoint(view: AgentView, savedTarget: ActionTarget | undefined): string {
  if (!isDramaticClassTrialView(view)) {
    return savedTarget ? `我女巫，平安夜救了${savedTarget.seatId}号，${savedTarget.seatId}号是银水` : "我拍女巫，今天票型不能再散";
  }
  return savedTarget
    ? `女巫在这里，昨晚我把${savedTarget.seatId}号从刀口边上拽回来了；这枚银水筹码现在摊在裁判席上`
    : "女巫在这里，药线我不再藏；今天谁想借混乱散票，就把理由摊到裁判席上";
}

function buildDramaticHunterLeadPoint(view: AgentView): string {
  return isDramaticClassTrialView(view) ? "猎人的枪就在这里；谁要把票乱推到我身上，就先把公开理由说完整" : "我拍猎人，今天不要再分票";
}
```

- [ ] **Step 5: Replace seer, witch, and hunter plan lines**

In the seer hidden-check branch, replace:

```ts
          "我手里有一张偏好信息，今天先不把身份线打满",
```

with:

```ts
          buildHiddenSeerCheckPoint(view, target),
```

In the witch hard-claim branch, replace:

```ts
          savedTarget ? `我女巫，平安夜救了${savedTarget.seatId}号，${savedTarget.seatId}号是银水` : "我拍女巫，今天票型不能再散",
```

with:

```ts
          buildDramaticWitchLeadPoint(view, savedTarget),
```

In the hunter hard-claim branch, replace:

```ts
          "我拍猎人，今天不要再分票",
```

with:

```ts
          buildDramaticHunterLeadPoint(view),
```

- [ ] **Step 6: Add one speech input regression**

In `src/ai/speechProviders.test.ts`, in the class-trial guide tests, add:

```ts
    expect(guideText).toContain("角色语气先行");
    expect(guideText).toContain("结论必须能投票");
```

This assertion should pass after previous prompt work; if it fails, add the exact sentence below to the class-trial `tablePlayerStyle` block in `buildPlayerSpeechGuide`:

```ts
"学级裁判戏剧化模式：角色语气先行，允许绕一点，但最后必须让玩家知道你压谁、为什么压、有没有身份声明。",
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/ai/tableRead.ts src/ai/tableRead.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "feat: add class trial dramatic speech strategy"
```

---

### Task 6: Verify TTS Boundary and Acceptance Flow

**Files:**
- Modify: `src/app/api/ai-speech-audio/route.test.ts`
- No source change expected unless the test exposes a regression.

- [ ] **Step 1: Add a TTS rewrite-boundary assertion**

In `src/app/api/ai-speech-audio/route.test.ts`, inside `"uses GPT-SoVITS for class-trial ja-JP role cards"`, change the request text in `requestBody()` from:

```ts
      text: "我想听3号解释。",
```

to:

```ts
      text: "女巫在这里，药线我不再藏；今天谁想借混乱散票，就把理由摊到裁判席上。",
```

Then update the existing `toHaveBeenCalledWith` expectation so it includes the exact dramatic source text:

```ts
    expect(mocks.rewriteClassTrialSpeechForJapaneseTtsWithMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceZh: "女巫在这里，药线我不再藏；今天谁想借混乱散票，就把理由摊到裁判席上。",
        roleCard: expect.objectContaining({ id: "tomori", theme: "class-trial" }),
      }),
    );
```

- [ ] **Step 2: Run the TTS route test**

Run:

```powershell
npm run test -- src/app/api/ai-speech-audio/route.test.ts
```

Expected: PASS. If it fails because the route mutates source text before rewrite, inspect `tryGenerateClassTrialGptSoVitsAudio` and keep the Chinese source passed into `rewriteClassTrialSpeechForJapaneseTtsWithMeta` unchanged.

- [ ] **Step 3: Run full focused test set**

Run:

```powershell
npm run test -- src/ai/classTrialDramaticMode.test.ts src/game/claims.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/app/api/ai-speech-audio/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: Run text acceptance sample**

Run two class-trial Day 1 text samples using the existing local DeepSeek provider path. Use the same temporary inline approach used during diagnosis, but record these numbers in the final handoff:

```text
sample count: 2 games
fallback count per game
validation failure count per game
role distinctiveness notes for all 9 seats
whether ordinary templates appeared
```

Expected:

```text
fallback count is lower than 4/9 in both samples
validation failures are not dominated by template or witch-attribution errors
at least 7 of 9 seats have distinct role actions
```

- [ ] **Step 6: Run local TTS smoke**

With the local app and GPT-SoVITS server running, POST one dramatic class-trial line to `/api/ai-speech-audio`:

```powershell
$personas = Get-Content -Raw -Encoding UTF8 local-assets/class-trial-pack/personas.json | ConvertFrom-Json
$p = $personas.characters | Where-Object { $_.id -eq 'monokuma' } | Select-Object -First 1
$role = [ordered]@{
  id = [string]$p.id
  displayName = [string]$p.displayName
  theme = 'class-trial'
  styleTags = @($p.styleTags)
  speechStyleZh = [string]$p.speechStyleZh
  reasoningBias = [string]$p.reasoningBias
  voteBias = [string]$p.voteBias
  nightActionBias = [string]$p.nightActionBias
  asVillager = [string]$p.asVillager
  asWerewolf = [string]$p.asWerewolf
  pressureResponse = [string]$p.pressureResponse
  relationshipHints = @($p.relationshipHints)
  catchphrasePolicy = [string]$p.catchphrasePolicy
  forbidden = @($p.forbidden)
  voiceLocale = [string]$p.voiceLocale
  voiceRewritePolicy = [string]$p.voiceRewritePolicy
}
$body = [ordered]@{
  gameId = 'class-trial-dramatic-smoke'
  speechKey = 'class-trial-dramatic-smoke:monokuma'
  speakerSeatId = 4
  speakerName = '黑白熊'
  roleCard = $role
  text = '噗，1号把身份线压成谜语，6号又把女巫牌摊到裁判席上。谁想糊弄过去，现在就二选一站边。'
} | ConvertTo-Json -Depth 8
Invoke-WebRequest -Uri 'http://127.0.0.1:51629/api/ai-speech-audio' -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -UseBasicParsing -TimeoutSec 180 | Select-Object -ExpandProperty Content
```

Expected: JSON contains `"provider":"gpt-sovits"` and a `/audio/ai-speech/*.wav` URL. Delete the smoke audio cache after checking it, using a resolved path under `D:\ai-werewolf\public\audio\ai-speech`.

- [ ] **Step 7: Commit tests or source changes from this task**

```powershell
git add src/app/api/ai-speech-audio/route.test.ts
git commit -m "test: cover dramatic class trial tts rewrite boundary"
```

---

### Final Verification

- [ ] Run focused tests:

```powershell
npm run test -- src/ai/classTrialDramaticMode.test.ts src/game/claims.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/tableRead.test.ts src/app/api/ai-speech-audio/route.test.ts
```

Expected: PASS.

- [ ] Run typecheck:

```powershell
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] Run lint if time allows:

```powershell
npm run lint
```

Expected: exit code 0 or only pre-existing unrelated warnings called out explicitly.

- [ ] Run two live text samples and one TTS smoke, then summarize:

```text
Completed:
- dramatic mode boundary
- class-trial claim normalization
- expression-lenient class-trial validation
- role-action fallback
- theme-scoped speech strategy
- TTS rewrite boundary check

Verification:
- focused tests
- tsc
- live text sample 1
- live text sample 2
- TTS smoke

Remaining risks:
- subjective role feel still needs player listening pass after implementation
- broad validation leniency can let some weaker raw model text through, by design
```
