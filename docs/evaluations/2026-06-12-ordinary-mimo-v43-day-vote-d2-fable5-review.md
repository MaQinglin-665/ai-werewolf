# Ordinary Mimo v43 DAY_VOTE + D2 Fable5 Review Pack

Updated: 2026-06-12 15:45 Asia/Shanghai

## Purpose

Ask Fable5 to review the next bounded live Mimo sample after the v41 narrow fixes. This is not a whole-repo review.

The v43 sample reached the intended envelope: same seed 91, ordinary `9p-seer-witch-hunter`, real Mimo for `DAY_SPEECH,DAY_VOTE`, D1 vote, and one D2 round ending in D2 `DAY_VOTE`. The route used a temporary Token Plan key through process env/helper only; no key is persisted in this repo.

## Minimal Files For Fable5

Primary evidence:

- `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-report.json`
- `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-cases.json`
- `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-eval.json`
- `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-after-hard-fixes-eval.json`

Source files to inspect only if needed:

- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `src/ai/evalOrdinaryAiUtils.test.ts`

Avoid reading `.env`, secrets, `.next`, `node_modules`, generated caches, unrelated UI/deployment/audio files, and old `tmp/*` runs except the evidence above.

## v43 Live Summary

- total calls: 28
- speech calls: 16
- action calls: 12
- fallback count: 0
- error count: 0
- validation failure count: 0
- total provider quality issues: 3, all `death_cause_overclaim`
- local eval after hard-fix code changes: 28 cases, average score 99.3, issue count 1, high-risk cases `[]`
- local eval issue: `no_concrete_progression` 1
- report-only sample metrics:
  - `repeated_surface_phrase`: `信息确实少先听一`, `5/16`
  - `repeated_clause_rate`: Witch silver-water clause repeated at `2/16`

Phase coverage:

- D1 `DAY_SPEECH`: 9 rows
- D1 `DAY_VOTE`: 9 rows
- D2 `DAY_SPEECH`: 7 rows
- D2 `DAY_VOTE`: 3 rows

Public cue counting is no longer silent in this v43 export: rows have positive `availablePublicCueCount`, and most non-opening rows have positive `referencedPublicCueCount`.

## Known Hard Defects Found In v43 And Fixed Locally

These are not subjective style questions anymore; they are covered by local tests after the live sample.

1. False Witch counterclaim from quoted/recognized speech

In v43, 3号 GPT said it recognized 2号 Claude's Witch claim:

```text
2号Claude跳女巫救了4号豆包，这个身份我暂时先认，因为没有对跳，而且他给了具体银水目标，这个比单纯说“我是女巫”要硬一点。
```

The old parser treated this as 3号 self-claiming Witch, polluting later public cues as `女巫对跳：Claude、GPT`. Local fix: `extractRoleClaimFromSpeech` now suppresses "recognizing another Witch claim" before direct quoted Witch wording can create a self claim, while preserving real concise Witch claims.

Focused verification:

- `npm run test -- src/game/claims.test.ts -t "quoted witch-claim wording|recognizing another player's witch claim|concise ordinary witch save|seat-only comma|silver-water recipient"` passed, 5 tests.

2. D2 stale Witch save timing

In v43 D2, 2号 Witch repeated the D1 save as:

```text
我是女巫，昨晚救的是4号豆包，4号是我的银水。
```

On D2 with no current-night save, this should be `首夜救的是4号` or equivalent. Local fix: true Witch private briefing says `首夜救过...` on D2+, planned Witch fallback uses `首夜` when the save is old, and `validateRenderedSpeech` rejects D2+ self-Witch old-save claims phrased as `昨晚/昨夜/夜里救的是...` unless `antidoteUsedTonight` is true.

Focused verification:

- `npm run test -- src/ai/speechProviders.test.ts -t "stale last-night wording|true witch to name"` passed, 2 tests.

## Review Excerpt

Use the evidence files for full rows. Key rows worth reviewing:

### D1 Same-Axis And False-Counterclaim Pollution

1号 opens low-info:

```text
平安夜，女巫用了救药。 我首置位，信息确实少，先听一圈再说。
```

2号 Witch claims and gives silver water:

```text
我是女巫，昨晚救的是4号豆包，4号是我的银水。今天如果有人想出4号，必须先过我这一关。1号DeepSeek说的平安夜女巫用药，这个判断本身没问题，但我想问一句，你说完这句之后呢？就直接停在那里等后置位。
```

3号 recognizes 2号's claim but old parser turned it into a false counterclaim:

```text
平安夜一句带过就行，女巫用药这个判断我听到了，但后面没有展开，所以我现在更想听1号DeepSeek把话说完。 2号Claude跳女巫救了4号豆包，这个身份我暂时先认，因为没有对跳，而且他给了具体银水目标，这个比单纯说“我是女巫”要硬一点。但今天票口不能直接跟着银水走，得看后面发言。 1号DeepSeek刚才说“信息确实少，先听一圈”，这句话没问题，但问题是你说完这句就停了，没有给任何立场。
```

Later rows then see polluted `女巫对跳：Claude、GPT`, producing artificial reasoning around 3号/GPT.

### D2 Old-Save Timing

2号 Witch repeats the old save on D2 with stale timing:

```text
我是女巫，昨晚救的是4号豆包，4号是我的银水。今天如果有人想出4号，必须先过我这一关。 1号DeepSeek刚才说5号倒牌、狼刀成功，这个判断我听到了，但你说完就停了。你上一轮被多人点过，今天还是这样，我需要你补清楚你现在的站边。
```

4号 receives that claim naturally but the source claim timing was wrong:

```text
我先接一下2号Claude。你说你是女巫，昨晚救的是我，我是你的银水。这个信息我听到了，但你跳出来保我，不代表我就必须无条件站你。 我上一轮票口在1号DeepSeek，投的是3号GPT，这个投票我认，但今天5号Mimo倒牌，狼刀成功，女巫没救，这个死讯出来后，我需要重新看2号Claude这张牌。
```

## Current Local Judgment

Clearly fixed locally after v43:

- quoted/recognized Witch claim no longer creates false 3号 Witch claim;
- D2+ true Witch old-save self claim cannot say `昨晚救的是...` unless the current night save actually happened;
- Fable5 v41 narrow fixes remain passing: public-role-claim repeated-axis steering, forward-commitment soft retry plus final tail cut, and referenced public cue counting from recent speeches/speech influence/vote leaders.

Still worth Fable5 judgment:

- Whether the table still over-focuses on low-info first-seat "no stance" pressure even after the false-counterclaim pollution is fixed.
- Whether D1/D2 rows lean too much on `你说完就停了 / 没给立场 / 需要补清楚` as repeated table texture.
- Whether the D2 vote reasons are good enough, especially 4号 voting 2号 despite 2号's silver-water claim, or whether that line needs stronger public reasoning context.
- Whether another paid bounded live rerun with the same seed is required after these two post-v43 hard fixes, or whether current local proof plus v43 evidence is enough to stop for user/Fable acceptance.

## Verification Completed After v43 Hard Fixes

- `npm run test -- src/game/claims.test.ts -t "quoted witch-claim wording|recognizing another player's witch claim|concise ordinary witch save|seat-only comma|silver-water recipient"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "stale last-night wording|true witch to name"` passed.
- `npm run test -- src/ai/speechProviders.test.ts -t "repeated-axis|forward commitment|cut-off seat reference|soft"` passed.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "malformed|forward commitment"` passed.
- `npm run test -- src/ai/evalOrdinaryAiUtils.test.ts` passed.
- `npm run test -- src/game/claims.test.ts src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 441 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v41-live-d1-cn-base-cases.json --json --out=tmp/ordinary-mimo-v41-live-d1-cn-base-after-v43-hard-fixes-eval.json` passed.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-cases.json --json --out=tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-after-hard-fixes-eval.json` passed.

## Token-Saving Prompt For Fable5

```text
只审 v43 live Mimo 普通局 DAY_VOTE + D2 样本和本文机制摘要，不扫全仓库。证据文件：
tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-report.json
tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-cases.json
tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-after-hard-fixes-eval.json

摘要：28 calls，16 speech，12 action，fallback/error/validationFailure 都是 0；local eval 99.3，issue 1，无 high risk；sampleMetrics 有 repeated_surface_phrase 5/16、repeated_clause_rate 2/16。

已本地修掉两个硬缺陷：3号认可2号女巫时被误建成 GPT 女巫对跳；2号女巫 D2 复述旧救人还说“昨晚救的是4号”。请不要建议扩大禁词表或硬 fallback。请判断剩余问题：是否还需要同 seed 再跑一次付费 bounded live，还是可以先停给用户主观验收；D1/D2 是否仍有过度“你说完就停了/没给立场”的同质压力；D2 vote 理由是否自然。
```
