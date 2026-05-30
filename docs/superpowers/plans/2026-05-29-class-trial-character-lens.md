# Class Trial Character Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a class-trial character behavior lens so each fixed character has distinct public reasoning, pressure, and vote-rationale style in speech and day-vote action input.

**Architecture:** Create a focused `src/ai/classTrialCharacterLens.ts` module that maps a class-trial role card to compact behavior signals. Feed that lens into `speechProviders.ts` and day-vote `actionProviders.ts`, then reuse the same lens for speech validation and class-trial fallback.

**Tech Stack:** TypeScript, Vitest, existing `AgentView` / `AiCharacterRoleCard` types, current routed LLM speech/action providers.

---

## File Structure

- Create `src/ai/classTrialCharacterLens.ts`: owns class-trial lens data, formatting helpers, generic-template detection, and fallback line construction.
- Create `src/ai/classTrialCharacterLens.test.ts`: protects all fixed character lenses and helper behavior.
- Modify `src/ai/speechProviders.ts`: imports lens helpers, adds `characterLens` to `LlmSpeechInput`, replaces scattered class-trial performance prompt lines with lens output, validates generic template fallback, and makes fallback speech use the lens.
- Modify `src/ai/speechProviders.test.ts`: proves speech input contains lens behavior, generic template output is rejected, and fallback stays role-specific.
- Modify `src/ai/actionProviders.ts`: imports lens helpers, adds optional `characterLens` to `LlmActionInput`, injects lens only for public day-vote action input, and adds vote-rationale constraints.
- Modify `src/ai/actionProviders.test.ts`: proves day-vote action input gets lens guidance while night actions do not.
- Create `docs/tasks/2026-05-class-trial-character-lens.md`: task card for this implementation slice.
- Modify `feature_list.json`, `progress.md`, and `session-handoff.md`: record status and verification after implementation.

---

### Task 1: Character Lens Module

**Files:**
- Create: `src/ai/classTrialCharacterLens.ts`
- Test: `src/ai/classTrialCharacterLens.test.ts`

- [ ] **Step 1: Write the failing lens tests**

Create `src/ai/classTrialCharacterLens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import {
  buildClassTrialLensFallbackSpeech,
  containsClassTrialLensSignal,
  formatClassTrialLensForAction,
  formatClassTrialLensForSpeech,
  getClassTrialCharacterLens,
  validateClassTrialLensSpeech,
} from "./classTrialCharacterLens";

const CLASS_TRIAL_IDS = ["naegi", "kirigiri", "fukawa", "monokuma", "enoshima", "celestia", "togami", "tomori", "anon"] as const;

describe("classTrialCharacterLens", () => {
  it("builds a lens for every fixed class-trial character", () => {
    for (const id of CLASS_TRIAL_IDS) {
      const lens = getClassTrialCharacterLens(roleCard(id));

      expect(lens?.roleId).toBe(id);
      expect(lens?.displayName).toBe(roleCard(id).displayName);
      expect(lens?.attentionBias.length).toBeGreaterThan(0);
      expect(lens?.pressureMove.length).toBeGreaterThan(0);
      expect(lens?.voteRationaleStyle.length).toBeGreaterThan(0);
      expect(lens?.forbiddenTemplates.join("\n")).toContain("我换一个角度");
      expect(formatClassTrialLensForSpeech(lens!)).toContain("角色行为透镜");
      expect(formatClassTrialLensForAction(lens!)).toContain("投票理由");
    }
  });

  it("returns undefined for non-class-trial role cards", () => {
    expect(getClassTrialCharacterLens({ ...roleCard("naegi"), theme: "space-opera" })).toBeUndefined();
    expect(getClassTrialCharacterLens(undefined)).toBeUndefined();
  });

  it("detects class-trial lens signals without requiring exact fixed scripts", () => {
    const kirigiri = getClassTrialCharacterLens(roleCard("kirigiri"))!;
    const enoshima = getClassTrialCharacterLens(roleCard("enoshima"))!;

    expect(containsClassTrialLensSignal(kirigiri, "3号这里的证据链断点还没闭合。")).toBe(true);
    expect(containsClassTrialLensSignal(enoshima, "这个公开矛盾被你说得太安静了，我偏要把它放大。")).toBe(true);
  });

  it("rejects generic template speech that lacks a lens signal", () => {
    const lens = getClassTrialCharacterLens(roleCard("naegi"))!;

    expect(validateClassTrialLensSpeech(lens, "我先按公开信息盘，票口先放这里，这个疑点未解除。")).toContain(
      "学级裁判发言缺少角色行为透镜",
    );
    expect(validateClassTrialLensSpeech(lens, "我还不能把3号说死，但卡住我的是大家都能一起查验的那个断点。")).toEqual([]);
  });

  it("builds role-specific fallback lines from the same lens", () => {
    const lens = getClassTrialCharacterLens(roleCard("tomori"))!;
    const line = buildClassTrialLensFallbackSpeech(lens, { focusText: "6号塞蕾丝缇雅", gap: "理由没有接上前面的票型" });

    expect(line).toContain("高松灯");
    expect(line).toContain("6号塞蕾丝缇雅");
    expect(line).toContain("理由没有接上前面的票型");
    expect(line).not.toContain("按现在桌面看");
    expect(line).not.toContain("我换一个角度");
  });
});

function roleCard(id: string): AiCharacterRoleCard {
  const displayNames: Record<string, string> = {
    naegi: "苗木诚",
    kirigiri: "雾切响子",
    fukawa: "腐川冬子",
    monokuma: "黑白熊",
    enoshima: "江之岛盾子",
    celestia: "塞蕾丝缇雅",
    togami: "十神白夜",
    tomori: "高松灯",
    anon: "千早爱音",
  };
  return {
    id,
    displayName: displayNames[id] ?? id,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "本地学级裁判角色语气。",
    reasoningBias: "按公开信息推理。",
    voteBias: "认真服务阵营胜利。",
    nightActionBias: "夜晚行动不在本轮透镜范围内。",
    asVillager: "作为好人时按公开证据找狼。",
    asWerewolf: "作为狼人时只用公开理由伪装。",
    pressureResponse: "被怀疑时回应公开逻辑。",
    relationshipHints: [],
    catchphrasePolicy: "允许极短口癖，不复刻长台词。",
    forbidden: [],
  };
}
```

- [ ] **Step 2: Run the lens tests to verify they fail**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts
```

Expected: FAIL because `src/ai/classTrialCharacterLens.ts` does not exist.

- [ ] **Step 3: Implement the lens module**

Create `src/ai/classTrialCharacterLens.ts`:

```ts
import type { AiCharacterRoleCard } from "@/game/types";

export type ClassTrialCharacterLens = {
  roleId: string;
  displayName: string;
  attentionBias: string[];
  pressureMove: string[];
  voteRationaleStyle: string[];
  forbiddenTemplates: string[];
  sampleCadence: string;
  signalKeywords: string[];
  fallbackPattern: string;
};

type LensSeed = Omit<ClassTrialCharacterLens, "roleId" | "displayName" | "forbiddenTemplates"> & {
  forbiddenTemplates?: string[];
};

const COMMON_FORBIDDEN_TEMPLATES = [
  "按现在桌面看",
  "我先按公开信息盘",
  "我先不站死",
  "我换一个角度",
  "这个疑点未解除",
  "票口先放这里",
  "桌面已经很多人",
  "我不重复那个缺口",
  "延续上一轮压力",
];

const LENS_BY_ROLE_ID: Record<string, LensSeed> = {
  naegi: {
    attentionBias: ["优先寻找大家都能共同验证的公开断点", "先承认不确定，再把结论拉回可查验条件"],
    pressureMove: ["用温和但明确的方式要求对方补上逻辑", "把分散争吵收束成一个共同问题"],
    voteRationaleStyle: ["票口理由要写成共同验证后的暂定推进，不写成独断归票"],
    sampleCadence: "先让一步，再给一个能一起查验的点。",
    signalKeywords: ["共同", "一起", "查验", "不确定", "希望", "大家", "验证"],
    fallbackPattern: "我还不能把{focus}说死，但卡住我的是{gap}；这点至少能让大家一起查验。",
  },
  kirigiri: {
    attentionBias: ["优先审查证据链断点", "少讲情绪，多指出前后矛盾"],
    pressureMove: ["冷静压缩对方说法，要求补齐缺失环节"],
    voteRationaleStyle: ["票口理由要像证据链结论，说明哪个断点仍未闭合"],
    sampleCadence: "短句、冷静、直指证据链缺口。",
    signalKeywords: ["证据链", "断点", "闭合", "矛盾", "缺口", "前后"],
    fallbackPattern: "{focus}这段先不归死，证据链缺的是{gap}；我只把这个缺口放到裁判台上。",
  },
  fukawa: {
    attentionBias: ["优先盯含糊、闪躲和把责任推开的说法", "对轻飘飘的解释更敏感"],
    pressureMove: ["带防御感地刺向对方含过去的部分", "不替别人把话说圆"],
    voteRationaleStyle: ["票口理由要强调对方没有正面回应，不写成泛泛听感"],
    sampleCadence: "尖、敏感、带一点自我保护，但必须落到公开理由。",
    signalKeywords: ["含糊", "闪躲", "逃避", "别逼", "说圆", "正面回应"],
    fallbackPattern: "我不喜欢{focus}把问题含过去的方式，{gap}先挂着，别逼我替你们写结论。",
  },
  monokuma: {
    attentionBias: ["优先放大能制造反应的公开矛盾", "盯住别人想糊弄过去的地方"],
    pressureMove: ["用嘲讽挑拨逼对方站边", "制造压力但不以主持人身份裁定规则"],
    voteRationaleStyle: ["票口理由可以尖锐，但必须来自公开矛盾"],
    sampleCadence: "嘲讽、挑拨、短促，不替规则宣判。",
    signalKeywords: ["糊弄", "有意思", "站边", "缺口", "矛盾", "噗"],
    fallbackPattern: "噗，{focus}这段最有意思的不是结论，是{gap}；我先盯这个缺口，别想糊弄过去。",
  },
  enoshima: {
    attentionBias: ["优先找公开发言里的反差和裂口", "把安静的矛盾戏剧化放大"],
    pressureMove: ["挑衅式放大矛盾来逼反应", "制造绝望感但不空喊口号"],
    voteRationaleStyle: ["票口理由要像把裂口压成投票压力"],
    sampleCadence: "戏剧化、反转感、挑衅，但每句咬住公开矛盾。",
    signalKeywords: ["反差", "裂口", "放大", "绝望", "矛盾", "压力"],
    fallbackPattern: "绝望地说，{focus}空出来的不是情绪，是{gap}；我先把压力压在这个裂口上。",
  },
  celestia: {
    attentionBias: ["优先看解释是否优雅闭合", "喜欢把矛盾当筹码试探"],
    pressureMove: ["轻压票口，像下注一样观察反应", "用克制语气套出对方漏洞"],
    voteRationaleStyle: ["票口理由要像下注：说明筹码压在何处和为何值得试"],
    sampleCadence: "优雅、克制、下注式试探。",
    signalKeywords: ["优雅", "筹码", "下注", "试探", "说圆", "微笑"],
    fallbackPattern: "{focus}这段还不够优雅，{gap}没有被说圆；我先微笑着把这枚筹码压在这里。",
  },
  togami: {
    attentionBias: ["优先看对方标准是否前后一致", "盯不达标的推理过程"],
    pressureMove: ["用高标准压人，要求对方达标", "拒绝空泛保留态度"],
    voteRationaleStyle: ["票口理由要说明对方哪里没有达到公开推理标准"],
    sampleCadence: "高压、挑剔、讲标准，不空摆架子。",
    signalKeywords: ["标准", "达标", "不合格", "别拿", "推理", "过程"],
    fallbackPattern: "{focus}的标准没有立住，{gap}就是缺口；别拿保留态度当推理。",
  },
  tomori: {
    attentionBias: ["优先听发言里的犹豫、躲闪和不协调", "把敏感听感落到公开矛盾"],
    pressureMove: ["短句停顿式追问，确认对方是不是在躲", "不把情绪本身当铁证"],
    voteRationaleStyle: ["票口理由要说清楚哪个声音或转折没有接上公开事实"],
    sampleCadence: "短句、停顿、敏感，但每次落到一个公开点。",
    signalKeywords: ["停", "声音", "躲", "犹豫", "没接上", "不协调"],
    fallbackPattern: "{focus}这段让我停了一下，{gap}还悬着；我只想先确认这个声音是不是在躲。",
  },
  anon: {
    attentionBias: ["先接住气氛，再抓一个具体违和", "优先把绕开的点拉回可理解的问题"],
    pressureMove: ["轻快社交转场后压一个明确问题", "不乱塞语气词"],
    voteRationaleStyle: ["票口理由要像社交缓冲后的明确选择，不跟着乱跑票"],
    sampleCadence: "轻快、社交感、只允许少量转场语气词。",
    signalKeywords: ["有点绕", "接上", "先不跟", "违和", "气氛", "跑票"],
    fallbackPattern: "{focus}这段有点绕，{gap}还没接上；我先不跟着跑票，只看这个点。",
  },
};

const FALLBACK_LENS: LensSeed = {
  attentionBias: ["围绕一个公开矛盾或可验证点发言"],
  pressureMove: ["用角色自己的节奏提出一个具体问题"],
  voteRationaleStyle: ["票口理由必须回到公开证据和阵营胜利"],
  sampleCadence: "保留角色节奏，但不写固定台词。",
  signalKeywords: ["矛盾", "验证", "公开", "证据", "理由"],
  fallbackPattern: "{focus}这段还没有把{gap}说清楚；我先把这个公开缺口放在这里。",
};

export function getClassTrialCharacterLens(roleCard: AiCharacterRoleCard | undefined): ClassTrialCharacterLens | undefined {
  if (!roleCard || roleCard.theme !== "class-trial") return undefined;
  const seed = LENS_BY_ROLE_ID[roleCard.id] ?? FALLBACK_LENS;
  return {
    roleId: roleCard.id,
    displayName: roleCard.displayName,
    attentionBias: seed.attentionBias,
    pressureMove: seed.pressureMove,
    voteRationaleStyle: seed.voteRationaleStyle,
    forbiddenTemplates: [...COMMON_FORBIDDEN_TEMPLATES, ...(seed.forbiddenTemplates ?? []), ...roleCard.forbidden],
    sampleCadence: seed.sampleCadence,
    signalKeywords: seed.signalKeywords,
    fallbackPattern: seed.fallbackPattern,
  };
}

export function formatClassTrialLensForSpeech(lens: ClassTrialCharacterLens): string {
  return [
    `角色行为透镜：${lens.displayName}`,
    `优先抓点：${lens.attentionBias.join("；")}`,
    `施压方式：${lens.pressureMove.join("；")}`,
    `说话节奏：${lens.sampleCadence}`,
    `本轮至少体现一个透镜信号，但不要固定台词化。`,
  ].join("。");
}

export function formatClassTrialLensForAction(lens: ClassTrialCharacterLens): string {
  return [
    `学级裁判角色投票理由透镜：${lens.displayName}`,
    `优先比较：${lens.attentionBias.join("；")}`,
    `投票理由风格：${lens.voteRationaleStyle.join("；")}`,
    "这是轻微偏好，只能在公开证据接近时影响理由表达和取舍。",
  ].join("。");
}

export function containsClassTrialLensSignal(lens: ClassTrialCharacterLens, speech: string): boolean {
  return lens.signalKeywords.some((keyword) => speech.includes(keyword));
}

export function validateClassTrialLensSpeech(lens: ClassTrialCharacterLens, speech: string): string[] {
  const genericTemplate = lens.forbiddenTemplates.some((template) => speech.includes(template));
  if (!genericTemplate) return [];
  return containsClassTrialLensSignal(lens, speech) ? [] : ["学级裁判发言缺少角色行为透镜"];
}

export function buildClassTrialLensFallbackSpeech(
  lens: ClassTrialCharacterLens,
  context: { focusText: string; gap: string },
): string {
  return `我是${lens.displayName}。${lens.fallbackPattern.replaceAll("{focus}", context.focusText).replaceAll("{gap}", context.gap)}`;
}
```

- [ ] **Step 4: Run the lens tests to verify they pass**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts
```

Expected: PASS, 1 file.

- [ ] **Step 5: Commit the lens module**

Run:

```powershell
git add src/ai/classTrialCharacterLens.ts src/ai/classTrialCharacterLens.test.ts
git commit -m "feat: add class trial character lens"
```

Expected: commit succeeds with only these two files staged.

---

### Task 2: Speech Input, Validation, And Fallback

**Files:**
- Modify: `src/ai/speechProviders.ts`
- Test: `src/ai/speechProviders.test.ts`

- [ ] **Step 1: Write failing speech tests**

Add the import in `src/ai/speechProviders.test.ts` if it is not already present:

```ts
import { getClassTrialCharacterLens } from "./classTrialCharacterLens";
```

In the `describe("routed speech provider", () => {` block, add:

```ts
  it("adds class-trial behavior lens to speech input", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const kirigiri = state.seats.find((seat) => seat.isAi)!;
    kirigiri.name = "雾切响子";
    kirigiri.roleCard = roleCardFixture("kirigiri", "雾切响子");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [kirigiri.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, kirigiri.seatId);
    const input = buildConstrainedSpeechInput(view, createSpeechPlan(view), "guided");
    const guideText = [...input.playerSpeechGuide.tablePlayerStyle, ...input.playerSpeechGuide.avoid].join("\n");

    expect(input.characterLens).toMatchObject({
      roleId: "kirigiri",
      displayName: "雾切响子",
    });
    expect(guideText).toContain("角色行为透镜：雾切响子");
    expect(guideText).toContain("证据链断点");
    expect(guideText).toContain("投票理由");
  });

  it("rejects class-trial generic template speech when it lacks the character lens", () => {
    const state = createGame({ seed: 91, humanSeatId: null });
    const tomori = state.seats.find((seat) => seat.isAi)!;
    tomori.name = "高松灯";
    tomori.roleCard = roleCardFixture("tomori", "高松灯");
    state.phase = "DAY_SPEECH";
    state.speechQueue = [tomori.seatId];
    state.speechIndex = 0;

    const view = buildAgentView(state, tomori.seatId);
    const plan = createSpeechPlan(view);

    expect(validateRenderedSpeech(view, plan, "我先按公开信息盘，票口先放这里，这个疑点未解除。", "guided")).toContain(
      "学级裁判发言缺少角色行为透镜",
    );
    expect(validateRenderedSpeech(view, plan, "6号这段让我停了一下，理由没接上前面的票型；我想先确认这个声音是不是在躲。", "guided")).not.toContain(
      "学级裁判发言缺少角色行为透镜",
    );
  });
```

If `roleCardFixture` does not exist in the test file, add it near the other test helpers:

```ts
function roleCardFixture(id: string, displayName = id) {
  return {
    id,
    displayName,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "本地学级裁判角色语气。",
    reasoningBias: "按公开信息推理。",
    voteBias: "认真服务阵营胜利。",
    nightActionBias: "夜晚行动不在本轮透镜范围内。",
    asVillager: "作为好人时按公开证据找狼。",
    asWerewolf: "作为狼人时只用公开理由伪装。",
    pressureResponse: "被怀疑时回应公开逻辑。",
    relationshipHints: [],
    catchphrasePolicy: "允许极短口癖，不复刻长台词。",
    forbidden: [],
  };
}
```

- [ ] **Step 2: Run speech tests to verify they fail**

Run:

```powershell
npm run test -- src/ai/speechProviders.test.ts
```

Expected: FAIL because `LlmSpeechInput` has no `characterLens`, speech guides do not include formatted lens output, and validation does not call `validateClassTrialLensSpeech`.

- [ ] **Step 3: Wire the lens into speech input**

Modify imports in `src/ai/speechProviders.ts`:

```ts
import {
  buildClassTrialLensFallbackSpeech,
  formatClassTrialLensForSpeech,
  getClassTrialCharacterLens,
  validateClassTrialLensSpeech,
  type ClassTrialCharacterLens,
} from "./classTrialCharacterLens";
```

Add to `LlmSpeechInput`:

```ts
  characterLens?: ClassTrialCharacterLens;
```

In `buildConstrainedSpeechInput`, compute the lens once and include it in the returned input:

```ts
  const characterLens = getClassTrialCharacterLens(view.roleCard);
```

Add this property beside `characterRole: view.roleCard`:

```ts
    characterLens,
```

- [ ] **Step 4: Replace scattered class-trial speech prompt lines with lens output**

In `buildPlayerSpeechGuide`, add:

```ts
  const classTrialLens = getClassTrialCharacterLens(roleCard);
```

Inside the `roleCard.theme === "class-trial"` array, replace the existing `buildClassTrialCharacterPerformanceLine` call with:

```ts
              classTrialLens ? formatClassTrialLensForSpeech(classTrialLens) : undefined,
              classTrialLens ? `角色投票解释方式：${classTrialLens.voteRationaleStyle.join("；")}` : undefined,
```

Keep `buildClassTrialCharacterPerformanceLine` only if another call remains. If no references remain, delete the function.

- [ ] **Step 5: Add lens validation to speech validation**

Update `validateConciseTableSpeech` in `src/ai/speechProviders.ts`:

```ts
function validateConciseTableSpeech(speech: string, view?: AgentView): string[] {
  const isClassTrialSpeech = view?.roleCard?.theme === "class-trial";
  const reportStylePattern = isClassTrialSpeech
    ? /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚|桌面已经(?:很多人|多人)|我不重复(?:那个)?缺口|我换一个角度|延续上一轮(?:发言)?压力|这个疑点(?:至今)?未解除|票口先放这里|我先按公开信息盘|我先不站死|按现在桌面看)/u
    : /(?:第一[，、]|第二[，、]|第三[，、]|第[一二三四]点|首先|其次|最后[，、：:]|最后(?:一点|一个|我想说)|三件事|两个问题|几点问题|盘问议程|推理框架|验证问题|可改票条件|逻辑链条|收益对象|需要你们?现在把.{0,24}说清楚)/u;
  const errors: string[] = [];
  const reportStyle = reportStylePattern.test(speech);
  const maxSentences = isClassTrialSpeech ? CLASS_TRIAL_SPEECH_MAX_SENTENCES : AI_SPEECH_MAX_SENTENCES;
  const maxChars = isClassTrialSpeech ? CLASS_TRIAL_SPEECH_MAX_CHARS : AI_SPEECH_MAX_CHARS;
  const tooManySentences = countSentenceLikeUnits(speech) > maxSentences;
  const tooLong = speech.length > maxChars;
  if (reportStyle || tooManySentences || tooLong) errors.push("发言过于冗长或报告化");
  const lens = getClassTrialCharacterLens(view?.roleCard);
  if (lens) errors.push(...validateClassTrialLensSpeech(lens, speech));
  return errors;
}
```

- [ ] **Step 6: Make fallback speech use the lens**

Replace the role-line map inside `createClassTrialFallbackSpeech` with:

```ts
  const lens = getClassTrialCharacterLens(roleCard);
  if (lens) {
    return compactSpeechToLimit(
      limitSpeechSentences(buildClassTrialLensFallbackSpeech(lens, { focusText, gap }), CLASS_TRIAL_SPEECH_MAX_SENTENCES),
      CLASS_TRIAL_SPEECH_MAX_CHARS,
    );
  }
```

Keep one generic fallback after that block:

```ts
  return compactSpeechToLimit(
    limitSpeechSentences(`我是${roleCard.displayName}。${focusText}这段还有公开缺口：${gap}。`, CLASS_TRIAL_SPEECH_MAX_SENTENCES),
    CLASS_TRIAL_SPEECH_MAX_CHARS,
  );
```

- [ ] **Step 7: Run speech tests to verify they pass**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts
```

Expected: PASS, both files.

- [ ] **Step 8: Commit the speech integration**

Run:

```powershell
git add src/ai/classTrialCharacterLens.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts
git commit -m "feat: apply class trial lens to speech"
```

Expected: commit succeeds with only these files staged.

---

### Task 3: Day-Vote Action Input

**Files:**
- Modify: `src/ai/actionProviders.ts`
- Test: `src/ai/actionProviders.test.ts`

- [ ] **Step 1: Write failing action tests**

Update the existing `includes local character role-card guidance in real LLM action input` test in `src/ai/actionProviders.test.ts` by adding:

```ts
    expect(input.characterLens).toMatchObject({
      roleId: "kirigiri",
      displayName: "雾切响子",
    });
    expect(input.constraints.join("\n")).toContain("学级裁判角色投票理由透镜：雾切响子");
    expect(input.constraints.join("\n")).toContain("证据链断点");
```

Add a new night-action guard test:

```ts
  it("does not apply class-trial vote lens to private night action input", () => {
    const state = createGame({ seed: 47, humanSeatId: null });
    state.phase = "NIGHT_WOLVES";
    const wolf = state.seats.find((seat) => seat.isAi && seat.role === "WEREWOLF")!;
    wolf.name = "江之岛盾子";
    wolf.roleCard = {
      id: "enoshima",
      displayName: "江之岛盾子",
      theme: "class-trial",
      styleTags: [],
      speechStyleZh: "戏剧化、挑衅。",
      reasoningBias: "放大公开反差。",
      voteBias: "喜欢把压力推向能制造反应的位置。",
      nightActionBias: "夜晚行动激进。",
      asVillager: "作为好人时用公开证据施压。",
      asWerewolf: "作为狼人时把混乱包装成公开推理。",
      pressureResponse: "被怀疑时反向挑衅。",
      relationshipHints: [],
      catchphrasePolicy: "允许极短绝望感，不复刻长台词。",
      forbidden: [],
    };
    const view = buildAgentView(state, wolf.seatId);
    const tableRead = buildAiTableRead(view);
    const input = buildConstrainedActionInput(view, {
      tableRead,
      fallbackCommand: createMockCommand(view, tableRead),
    });

    expect(input.characterRole?.displayName).toBe("江之岛盾子");
    expect(input.characterLens).toBeUndefined();
    expect(input.constraints.join("\n")).not.toContain("学级裁判角色投票理由透镜");
  });
```

- [ ] **Step 2: Run action tests to verify they fail**

Run:

```powershell
npm run test -- src/ai/actionProviders.test.ts
```

Expected: FAIL because `LlmActionInput` has no `characterLens` and day-vote constraints do not include lens text.

- [ ] **Step 3: Wire the lens into day-vote action input**

Modify imports in `src/ai/actionProviders.ts`:

```ts
import { formatClassTrialLensForAction, getClassTrialCharacterLens, type ClassTrialCharacterLens } from "./classTrialCharacterLens";
```

Add to `LlmActionInput`:

```ts
  characterLens?: ClassTrialCharacterLens;
```

Add this helper near `isClassTrialActionInput`:

```ts
function shouldUseClassTrialActionLens(view: AgentView): boolean {
  return view.roleCard?.theme === "class-trial" && view.phase === "DAY_VOTE";
}
```

In `buildConstrainedActionInput`, include:

```ts
    characterLens: shouldUseClassTrialActionLens(view) ? getClassTrialCharacterLens(view.roleCard) : undefined,
```

- [ ] **Step 4: Add day-vote lens constraints**

In `buildActionConstraints`, inside the existing `if (view.roleCard)` branch, add:

```ts
    const classTrialLens = shouldUseClassTrialActionLens(view) ? getClassTrialCharacterLens(view.roleCard) : undefined;
    if (classTrialLens) {
      constraints.push(
        formatClassTrialLensForAction(classTrialLens),
        "Use the class-trial vote lens only to choose between close public vote lines; do not mention private knowledge or change illegal actions.",
      );
    }
```

Make sure this code is inside `buildActionConstraints`, after `constraints.push(...view.roleCard.forbidden)`.

- [ ] **Step 5: Run action tests to verify they pass**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/actionProviders.test.ts
```

Expected: PASS, both files.

- [ ] **Step 6: Commit the action integration**

Run:

```powershell
git add src/ai/classTrialCharacterLens.ts src/ai/classTrialCharacterLens.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts
git commit -m "feat: apply class trial lens to day votes"
```

Expected: commit succeeds with only these files staged.

---

### Task 4: Task Card, State, And Verification

**Files:**
- Create: `docs/tasks/2026-05-class-trial-character-lens.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Create the task card**

Create `docs/tasks/2026-05-class-trial-character-lens.md`:

```md
# 学级裁判角色行为透镜

## Task

Short name: class-trial-character-lens

Goal: Give local class-trial characters distinct public reasoning, pressure, and vote-rationale behavior through a reusable character lens layer.

Why it matters: The user wants character feel to come from how each role reads and pressures the table, not only from surface speech style.

## Task Gate

Task type: AI speech + AI action input quality

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? preferred
- If yes, flow or URL: `http://127.0.0.1:51625` local class-trial Day 1 speech/listening pass.
- If skipped, reason: Record whether browser automation or manual listening was available in the final handoff.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: Local-only private class-trial prompt/input behavior.
- Residual risk: Subjective character feel still needs user listening feedback.

## Context To Read First

- `docs/superpowers/specs/2026-05-29-class-trial-character-lens-design.md`
- `docs/superpowers/plans/2026-05-29-class-trial-character-lens.md`
- `src/ai/speechProviders.ts`
- `src/ai/actionProviders.ts`
- `docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `D:\AI\GPT-SoVITS\**`
- production deployment docs

## Definition Of Done

This task is complete when:

- A reusable class-trial character lens module exists for the fixed 9-character roster.
- White-day speech input includes character attention and pressure behavior, not only style text.
- Day-vote action input includes character vote-rationale behavior while night actions remain unaffected.
- Generic class-trial Werewolf-template speech can trigger validation or repair.
- Class-trial fallback speech uses the lens.
- Focused tests, TypeScript, lint, build, task-card, harness, and whitespace checks are recorded.

## Verification

Required checks:

- `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- Local Day 1 class-trial live run with 9 AI speakers, checking whether at least 6 roles show distinct reasoning/pressure styles.

## Handoff

```text
Completed:
- Added the class-trial character lens module and wired it into speech and day-vote action input.
- Added lens validation/fallback behavior for class-trial speech.

Changed files:
- src/ai/classTrialCharacterLens.ts
- src/ai/classTrialCharacterLens.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/actionProviders.ts
- src/ai/actionProviders.test.ts

Verification:
- npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
- npx tsc --noEmit
- npm run lint
- npm run build
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md
- npm run harness:check
- git diff --check

Remaining risks:
- Subjective character feel still needs a longer Day 1 listening pass.
```
```

- [ ] **Step 2: Add feature registry entry**

In `feature_list.json`, add a new feature after `class-trial-speech-persona-audio-gap`:

```json
{
  "id": "class-trial-character-lens",
  "name": "Class Trial Character Lens",
  "description": "Give local class-trial characters distinct public reasoning, pressure, and vote-rationale behavior through a reusable character lens layer.",
  "dependencies": [
    "class-trial-speech-persona-audio-gap"
  ],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-05-29-class-trial-character-lens-design.md; docs/superpowers/plans/2026-05-29-class-trial-character-lens.md; docs/tasks/2026-05-class-trial-character-lens.md; src/ai/classTrialCharacterLens.ts; src/ai/classTrialCharacterLens.test.ts; src/ai/speechProviders.ts; src/ai/speechProviders.test.ts; src/ai/actionProviders.ts; src/ai/actionProviders.test.ts; npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts passed; npx tsc --noEmit passed; npm run lint passed; npm run build passed; npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md passed; npm run harness:check passed; git diff --check passed"
}
```

- [ ] **Step 3: Update progress and handoff**

In `progress.md`, set the active feature to `class-trial-character-lens` and add completed lines:

```md
- [x] Added a reusable class-trial character lens layer for the fixed 9-character roster.
- [x] White-day class-trial speech input now carries attention, pressure, cadence, and forbidden-template signals.
- [x] Day-vote action input now carries vote-rationale lens guidance while private night actions remain unaffected.
- [x] Class-trial generic template speech can trigger lens validation, and fallback speech uses the same role lens.
```

In `session-handoff.md`, add the same completion summary and a remaining risk:

```md
- [ ] Subjective character feel still needs a longer Day 1 listening pass; tests prove the lens reaches prompts and validation, not that every live line will feel perfect.
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run type, lint, and build**

Run:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all exit 0. Existing warnings, if any, must be copied into the final handoff.

- [ ] **Step 6: Run harness checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md
npm run harness:check
git diff --check
```

Expected: task card and harness pass; `git diff --check` has no whitespace errors. CRLF warnings are acceptable if they match the existing repository behavior.

- [ ] **Step 7: Commit docs and state**

Run:

```powershell
git add docs/tasks/2026-05-class-trial-character-lens.md feature_list.json progress.md session-handoff.md
git commit -m "docs: record class trial character lens"
```

Expected: commit succeeds with only the task/state files staged.

---

## Self-Review Checklist

- Spec coverage: Tasks 1-3 cover lens generation, speech input, day-vote input, validation, and fallback. Task 4 covers task card, state, and verification.
- Scope control: Night action selection is explicitly guarded by `shouldUseClassTrialActionLens(view)`, which only returns true in `DAY_VOTE`.
- Type consistency: `ClassTrialCharacterLens` is imported as a type in both speech and action providers; `characterLens` is optional in both LLM input types.
- Template control: Generic-template validation is centralized in `classTrialCharacterLens.ts` and called from `validateConciseTableSpeech`.
- Verification: Focused tests cover new module, speech provider, and action provider before type/lint/build/harness.
