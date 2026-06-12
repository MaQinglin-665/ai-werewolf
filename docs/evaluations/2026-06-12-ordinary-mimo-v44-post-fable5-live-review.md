# Ordinary Mimo v44 Post-Fable5 Live Review Pack

Updated: 2026-06-12 16:30 Asia/Shanghai

## Purpose

Ask Fable5 to review the same-seed bounded live Mimo sample after the v43 critique fixes. This is a narrow ordinary-speech quality review, not a whole-repo review.

The v44 sample used seed 91, ordinary `9p-seer-witch-hunter`, real Mimo for `DAY_SPEECH,DAY_VOTE`, and covered D1 speech/vote plus one D2 round. The temporary provider key was used only through process env/helper flow and is not persisted in repo files.

## Minimal Files For Fable5

Primary evidence:

- `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-report.json`
- `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-cases.json`
- `tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-after-self-witch-fix-eval.json`
- `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-post-fable5-review-eval.json`

Source files to inspect only if needed:

- `src/ai/seatMemory.ts`
- `src/ai/seatMemory.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/llmEvaluation.ts`
- `src/ai/llmEvaluation.test.ts`
- `scripts/eval-ordinary-ai-utils.mjs`
- `src/ai/evalOrdinaryAiUtils.test.ts`

Avoid reading `.env`, secrets, `.next`, `node_modules`, generated caches, unrelated UI/deployment/audio files, and old `tmp/*` runs except the evidence above.

## v44 Live Summary

- total calls: 28
- speech calls: 16
- action calls: 12
- fallback count: 1
- error count: 1
- validation failure count: 0
- provider rows: 15 `custom-speech:mimo-v2.5-pro`, 12 `custom-action:mimo-v2.5-pro`, 1 routed fallback speech
- exported eval cases with public cue references: 24/28
- local eval after the self-Witch guard: 28 cases, average score 98.2, issue count 2
- eval issues: `no_concrete_progression` 1, `logic_boundary_error` 1
- high-risk case: `91:d22c7c66-7446-43fc-ae6b-22c7ddc7a196:2:DAY_SPEECH:3:19`
- report-only sample metrics:
  - `repeated_surface_phrase`: `先听一圈再看`, `6/16`
  - `repeated_clause_rate`: `那句“女巫用药了”本身没错但你后面只`, `2/16`

Phase coverage:

- D1 `DAY_SPEECH`
- D1 `DAY_VOTE`
- D2 `DAY_SPEECH`
- D2 `DAY_VOTE`

This is not a clean final acceptance sample. It has one provider fallback and it exposed one new hard logic defect, now covered locally.

## Fixes Covered Before v44

These were the three Fable5 required v43 fixes:

1. Vote-continuity premise now comes from rendered speech, not plan focus.
   - `lastSpeechTargetSeatId` is only retained if the rendered speech actually supports that target.
   - Vote continuity hints and validators only trust rendered speech support.
   - Existing v43 replay now catches the old human-visible mismatch: `speech_vote_discontinuity` 10 in `tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-post-fable5-review-eval.json`.

2. Forward commitment guard now covers commitment followed only by public-info restatement.
   - Examples like `我现在不舒服的是另一件事。2号Claude跳女巫……4号是银水。` are treated as malformed unfinished speech when the promised discomfort never lands.

3. Public-role claimant vote posture has a third path: question identity truth, not only continue/pivot vote.
   - A silver-water recipient can vote the Witch claimant with a reason like doubting the claim chain, instead of a forced `证据更硬` template.

## New Hard Defect Found In v44 And Fixed Locally

v44 D2 3号 GPT is a villager, but misread another player's statement as a self-Witch identity:

```text
你说我是女巫，这个身份我认。
```

This polluted later public reasoning because the table could treat 3号 as having recognized a Witch identity. Local fix:

- speech validation rejects non-Witch speakers accepting a misattributed self-Witch identity;
- ordinary eval flags the same shape as `logic_boundary_error`;
- recognizing another player's public Witch claim remains allowed.

Focused verification:

- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity|repeated-axis|forward commitment|cut-off seat reference|soft"` passed.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity|malformed|forward commitment|vote continuity"` passed.

## Current Local Judgment

Clearly fixed locally:

- v43 vote-continuity premise mismatch is now detectable and the prompting path no longer trusts plan-only targets.
- v43 forward-commitment restatement variant is covered.
- v43 public-role claimant vote reason has a better candidate posture.
- v44 non-Witch self-Witch acceptance is now a hard validation/eval issue.
- v41 public cue reference counting is not silent in rebuilt cases; 4/8 rebuilt v41 rows have `referencedPublicCueCount > 0`.

Still worth Fable5 judgment:

- Whether self-Witch guard requires another same-seed paid bounded live rerun before final user acceptance.
- Whether v44's 1 provider fallback is enough to require a clean rerun.
- Whether the D1/D2 `先听一圈再看` / `你说完就停了` pressure axis should be fixed now through shared pressure budget/candidate actions, or left as a diversity follow-up.
- Whether the current state can move to final user subjective验收 after the self-Witch guard, or needs one more narrow repair plus live proof.

## Verification Completed

- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity"` first failed, then passed after implementation.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity"` first failed, then passed after implementation.
- `npm run eval:ordinary-ai -- --source=existing --input=tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-cases.json --json --out=tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-after-self-witch-fix-eval.json` passed and now flags the v44 self-Witch issue.
- `npm run test -- src/ai/speechProviders.test.ts -t "misattributed self witch identity|repeated-axis|forward commitment|cut-off seat reference|soft"` passed: 11 tests.
- `npm run test -- src/ai/llmEvaluation.test.ts -t "misattributed self witch identity|malformed|forward commitment|vote continuity"` passed: 4 tests.
- `npm run test -- src/game/claims.test.ts src/ai/actionProviders.test.ts src/ai/tableRead.test.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts src/ai/seatMemory.test.ts src/game/tableMemory.test.ts` passed: 449 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/game/claims.ts src/game/claims.test.ts src/ai/seatMemory.ts src/ai/seatMemory.test.ts src/ai/tableRead.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/llmEvaluation.ts src/ai/llmEvaluation.test.ts src/ai/evalOrdinaryAiUtils.test.ts scripts/eval-ordinary-ai-utils.mjs` passed.

## Token-Saving Prompt For Fable5

```text
只审 v44 same-seed bounded live 和本文机制摘要，不扫全仓库。证据文件：
tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-report.json
tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-cases.json
tmp/ordinary-mimo-v44-post-fable5-live-20260612-161030-after-self-witch-fix-eval.json
tmp/ordinary-mimo-v43-day-vote-d2-live-20260612-151541-post-fable5-review-eval.json

摘要：v44 28 calls，16 speech/12 action，覆盖 D1 speech/vote + D2 speech/vote；fallback/error 1（D2 8号 fetch failed fallback），validationFailure 0。当前 eval 98.2，issue 2：D1 1号 no_concrete_progression，D2 3号 logic_boundary_error（村民把他人关于女巫身份的说法误接成“你说我是女巫，这个身份我认”）。已本地补 validator/eval，不扩禁词、不扩硬 fallback。v43 回放现在能抓出 speech_vote_discontinuity，v44 vote continuity 前提基本对上 rendered speech。

请判断：① self-witch 小修后是否必须同 seed 再跑一次付费 bounded live；② D1 围绕 1号“先听一圈再看”的 6/16 同轴重复是否已到必须修共享压力预算/候选动作的程度；③ 1 次 provider fallback 是否要求重跑干净样本；④ 还能否进入最终用户验收，还是再小修一轮。
```
