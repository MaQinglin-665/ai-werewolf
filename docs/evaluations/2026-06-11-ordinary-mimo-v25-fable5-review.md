# Ordinary Mimo Speech Quality v25 Fable5 Review Pack

Generated: 2026-06-11 18:10 Asia/Shanghai

## Purpose

This pack is for a targeted Fable5 review of the ordinary 9-player Werewolf AI speech-quality stage after the v24 critique.

The goal is not to judge whether local regex scoring is high. The goal is to judge whether the current ordinary-player speech direction now feels closer to real table speech, and whether the next work should continue the same positive-context/candidate-action direction or shift to a different root cause.

## Minimal Read List For Fable5

Read these files only unless more evidence is needed:

- `docs/evaluations/2026-06-11-ordinary-mimo-v25-fable5-review.md`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- Optional context: `docs/evaluations/2026-06-11-ordinary-mimo-stage-close-fable5-review.md`
- Optional research context: `docs/evaluations/2026-06-09-ordinary-werewolf-speech-research.md`

Do not spend tokens on UI, deployment, room APIs, class-trial theme code, or token-cost reduction unless a specific claim here requires it.

## What Changed After v24 Feedback

Fable5's v24 critique said the direction was right but the remaining defects were positive-supply defects, not missing bans:

- mock bridge text was reused across seats;
- player mini-bio/context supply was still not enough;
- the same pressure event was fed unchanged to later seats;
- sample metrics were too easy to satisfy and missed repeated clauses/axis concentration;
- old audit-register words leaked from mock/agenda templates.

v25 changes kept the hard-validator boundary narrow and made these local fixes:

- Added sample-level metrics for repeated long clauses and dominant target-axis concentration.
- Added a shared-pressure citation budget in the ordinary soft director:
  - detects when 2+ prior speakers pressure the same seat;
  - adds a table object like "1号已被连续点到";
  - removes `quoteOneLine`, `halfAccept`, and `followPressure` from candidates, pushing `hold`, `waterPass`, `voteBoundary`, or `changeRead`.
- Replaced repeated pivot and previous-speaker bridge templates:
  - removed exact repeats like `上一位X先记下，但我这轮要转回1号哪里没说清`;
  - removed repeated `X的说法先只当背景，不靠一句话定人`;
  - varied previous-speaker carry lines without making them hard fallback rules.
- Fixed mock speech splicing artifacts:
  - `不靠一句话定人我...`;
  - `有反证我会改1号...`;
  - `不拿来替自己下结论我...`;
  - `不直接照搬1号...`.
- Reworded player-visible mock/agenda templates away from review-register text:
  - `公开动作`, `公开问题`, `公开过程`, `公开点`, `公开理由`, `发言动作`, `闭合`;
  - `桌面压力落到`;
  - repeated `个参考，我还要看票和回应`.

## Final Local Evidence

Command:

```text
npm run eval:ordinary-ai -- --source=mock --games=1 --seed-start=91 --max-cases=30 --json --out=tmp/ordinary-mimo-v25-post-fable-feedback-mock-eval.json
```

Result summary:

```json
{
  "totalCases": 30,
  "averageScore": 100,
  "issueCount": 0,
  "byIssueCode": {},
  "highRiskCaseIds": [],
  "sampleMetrics": []
}
```

Important: this is local mock evidence only. It is a regression and transcript-shape check, not proof that live Mimo speech is accepted.

## Final Sample Excerpt

Seed 91, board `9p-seer-witch-hunter`, source `mock`, first 15 speech/last-word rows:

```text
D1 1 DeepSeek: 我把能听到的点摆一下，枪牌不用抢着拍，先听谁的站边讲不圆。昨夜平安夜，我当背景。前面样本少，先说我暂时怎么听。所以这轮我先不压票，听一圈再看谁急着带节奏。
D1 2 Claude: 我先说听感，我拍女巫，我把票口收窄一点。我这票会先压1号，后面有人保就讲清。我压这里，理由在1号DeepSeek这会儿被推到台前，主要卡在回避站边；前面有回避站边的记录。
D1 3 GPT: 我说一个不舒服的点，1号DeepSeek先吃一点压力，理由只看他已经说出口的内容。上一位Claude的视角我先认可一部分，再对照1号的解释，再看现在吃压，主要因为被Claude施压、回避站边，另外他前面有回避站边的记录。2号Claude的判断我先记成样本，但不直接照搬。我主要听回应，回看他已发言的表态和票口：哪句话能撑住这条线，哪句话会把它拆掉。
D1 4 豆包: 我不想慢慢磨，1号DeepSeek这边我只取一个没说顺的地方，不把全场都绕进去。这轮得把话讲实。上一位先记着，我这票口还在1号身上。3号GPT那段我听到了，但票还是看被点的人怎么回。
D1 5 Mimo: 我先说听感，打回1号DeepSeek不是情绪牌，我只看他说过的话和怎么落票。豆包那段我先放一下，先回到1号没讲顺的地方，再看这边我先核被Claude施压、回避站边，另外他前面有回避站边的记录。4号豆包那段我先记着，票口还是按我自己的理由走。回看他已发言的表态和票口：哪句话能撑住这条线，哪句话会把它拆掉。
D1 6 Gemini: 我不急着锁死，1号DeepSeek这里我不顺手放过，先核他说过的话和投票动作。边界放清：不把直接打死。我不把1号投死，只回看他已经说出口的逻辑。我不会只凭一个点出他，但他刚才的过程在票型前还不够硬。
D1 7 GLM: 我先把桌面关系捋一下，我这里先不把话说满。我接一下上一位Gemini，他这段发言还缺把结论推出来的过程。6号Gemini这轮我只当一份材料，不拿来替自己下结论。我保留可改空间，关键看9号后面能不能把这段话讲顺。
D1 8 Kimi: 我按前后发言往回看，打回1号DeepSeek不是情绪牌，我只看他说过的话和怎么落票。这边先别只听结论，要看站边怎么落票。他被点到的是被Claude施压、回避站边，另外他前面有回避站边的记录。他发言前我先不定死，等他给完视角再决定票怎么落。
D1 9 Human: 我按公开信息说，我不铺全场，先问6号Gemini刚才那段怎么接到票上。前后两条线对一下：8号Kimi那段我听到了，但票还是看被点的人怎么回。再看这会儿被推到台前，主要卡在回避站边。他这段我先挂疑问，等投票前再看有没有人能补出反证。
D1 遗言 Gemini: 我出局前留一条线：4号豆包刚才的发言要和后面投票对照，谁顺着单点带节奏，明天优先回看。
D2 1 DeepSeek: 按现在桌面看，我拍猎人，我会盯着最后谁乱改票。我这票会先压3号，后面有人保就讲清。我压这里，理由在3号GPT这会儿被推到台前，主要卡在上一轮公开吃到1票。如果后置没有更强反证，今天可以先往收票。
D2 2 Claude: 这轮我先说票怎么放，我拍女巫，今天别把票摊散。今天先把1号放到出人方向里听反证。这不是空踩，我卡的是1号DeepSeek这边我先核被Claude施压、回避站边；这张身份牌要和今天怎么投票对上。
D2 3 GPT: 我给一个暂时判断，我不铺全场，先问1号DeepSeek刚才那段怎么接到票上。边界放清：不把直接打死。上一位Claude的视角我先认可一部分，再对照1号的解释。这票可以先压在他附近，除非后面有人给出更完整的反面解释。
D2 4 豆包: 我直接压节奏，1号DeepSeek先吃一点压力，理由只看他已经说出口的内容。这轮得把话讲实。我不顺着上一位往外铺，先听1号怎么把话说圆。3号GPT那段我先记着，票口还是按我自己的理由走。
D2 7 GLM: 我从结构上看，我这里先不把话说满。我接一下上一位豆包，他这段发言还缺把结论推出来的过程。4号豆包的判断我先记成样本，但不直接照搬。1号DeepSeek刚才的动机和票型要回看，今天先不靠想象补过程。
```

## What Fable5 Should Judge

Please review as a product-quality/code-review critique, not a style rewrite.

Questions:

1. Did v25 actually solve the v24 defects, or did it only hide them from the new metrics?
2. Does the shared-pressure citation budget belong at the current soft-director/candidate layer, or should it be moved deeper into table-memory/action planning?
3. Is the remaining D1 sample still too much around 1号, despite no `axis_concentration` warning?
4. Are `打回`, `票口`, `压`, `讲实`, `这条线`, and `不铺全场` acceptable ordinary table speech here, or still too system-shaped?
5. Is the GLM structural voice still too stiff compared with a real casual player?
6. Should the next stage be a small paid live Mimo sample, or another local positive-supply pass first?

## Do Not Recommend

- Do not recommend expanding broad banned-word regexes for ordinary player-feel issues.
- Do not recommend hard fallback for soft style concerns unless the issue is a real rule/public-info/private-info/death/role/truncation correctness problem.
- Do not treat local score 100 as a quality proof.
- Do not start phase 3 token-cost reduction until the user accepts phase 2 quality.

## Current Recommendation Before Fable

Pause implementation here and send this pack to Fable5.

My current read: v25 fixes the concrete v24 mechanical defects, and the remaining question is subjective human-feel: whether the table still sounds like several variants of one analytical speaker. That question needs Fable/user reading or a small live Mimo sample, not another local regex pass.
