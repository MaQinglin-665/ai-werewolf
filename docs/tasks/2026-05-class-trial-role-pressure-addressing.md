# Task

Short name: class-trial-role-pressure-addressing

Goal: Improve post-template class-trial speech by turning repeated abstract pressure into character-specific pressure moves, and make AI speakers refer to other players with names or short role names instead of only seat numbers.

Why it matters: The latest Day 1 text sample showed the obvious templates were gone, but later speakers still circled `缺口 / 没往下推 / 没给倾向` in similar ways. The next layer should make repeated pressure sound like each character's way of thinking. It should also make the class-trial table feel more character-driven by saying `2号雾切` or `雾切` instead of only `2号`.

## Task Gate

Task type: AI speech / LLM contract

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If skipped, reason: This is a prompt/input and validation quality slice. A pure text sample is the intended manual check.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Browser/audio listening pass
- Reason: The requested next check is pure text transcript quality.
- Residual risk: Names and role pressure are prompt-directed; live LLM output can still vary and may need another sample pass.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/tasks/2026-05-speech-de-template-persona-layer.md`
- `tmp/class-trial-day1-text-sample-1780155122816.md`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-05-class-trial-role-pressure-addressing.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- `local-assets/**`
- `public/audio/ai-speech/**`
- unrelated UI or rules modules

## Definition Of Done

This task is complete when:

- Dynamic repeated-pressure guidance detects abstract loops around `缺口 / 没往下推 / 没给倾向 / 没给结论`.
- The repeated-pressure guidance asks the current class-trial role to apply a character-specific pressure method, not just swap to another generic logic label.
- 江之岛盾子 is framed as 超高校级的分析师: strong structural analysis first, theatrical pressure second.
- 腐川冬子 has a strong Togami bias in speech guidance: when 十神 appears in the public table, she clearly cares about him and reacts around him.
- Speech input encourages ordinary and class-trial speakers to use seat plus name/short name for public references, while keeping seat numbers for vote/check/target clarity.
- A new pure text sample is generated and summarized.

## Verification

Required checks:

- `npm run test -- src/ai/speechProviders.test.ts -t "role-specific repeated abstract pressure|name-aware"`
- `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-role-pressure-addressing.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- `npm run build`
- Pure text class-trial Day 1 sample after implementation.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added a name-aware public addressing guide so ordinary and class-trial speakers prefer seat plus name/short name while preserving seat numbers for checks, votes, and target clarity.
- Added repeated abstract-pressure detection for 缺口 / 没往下推 / 没给倾向 / 没给结论 loops and a role-specific director note that asks the current class-trial character to change pressure method.
- Strengthened 江之岛盾子 as 超高校级的分析师: structure and reaction-pattern analysis first, theatrical pressure second.
- Strengthened 腐川冬子 around 十神白夜: she clearly cares about who touches, protects, ignores, or pressures 十神 while still speaking from public table reasons.
- Generated a real Day 1 text sample after the main implementation: 9/9 speeches, fallback 0/9, templateHits 0, repeated pressure terms 3, nameRefs 10, provider deepseek-speech:deepseek-chat.
- Follow-up after user review: added per-role low-information opening moves for all 9 class-trial characters so openings do not collapse into generic Werewolf audit language.
- Added class-trial opening director guidance: 苗木 leaves a共同验证点, 雾切 cold-slices可验证/空白部分, 腐川 can openly orbit 十神大人 even before he speaks, 黑白熊 pushes互相审判, 江之岛 leads with structure/benefit analysis, 塞蕾丝下注解释成本, 十神 sets a合格线, 高松 catches small discontinuity, and 爱音 pulls relationship/greeting-chain pressure.
- Added validation for the latest bad sample patterns: greeting-only平安夜 restatement, `发言顺序/站边/票型一起校验`, `等后置位所有人过完`, final speakers waiting for后置位, 腐川 missing 十神, and 江之岛 missing analyst structure.
- Fresh real sample unblocked the Vite SSR path and exposed a hard-info classifier bug: generic future wording like `投票时形成闭环` was treated as hard information because the detector matched bare `投`.
- Narrowed day-one hard-info detection in both table-read and speech validation so only concrete claims, hard identity, `票口/归票/出人`, or explicit `投X号` close the low-info layer.
- Added role-specific class-trial low-info fallback lines so validation fallback no longer pressures unspoken seats and still keeps 苗木共同验证点、雾切冷静切片、腐川十神情绪坐标、江之岛结构/收益/伪装信号.
- Fresh real Day 1 text sample after this fix: `tmp/class-trial-day1-verification-1780195573037.md` generated 9/9 DeepSeek speeches, fallback 3/9 via role-specific fallback, templateHits 0, repeatedPressureTerms 4, nameRefs 11, Enoshima analyst signals 1, Fukawa Togami refs 1.
- Browser/game QA on `http://127.0.0.1:3005` completed a full Day 1 class-trial run and saved transcript `tmp/class-trial-browser-qa-1780197058323.md`; it confirmed stronger role feel but still found too much repeated `没给倾向/缺口` pressure.
- Follow-up after browser QA: 苗木 low-info fallback now carries a stronger `希望/共同验证` character beat, and repeated empty-stance/empty-gap director guidance now explicitly forbids keeping the same `没给倾向/缺口` line as the main axis.
- Latest follow-up tightened live-sample residuals around first-seat workflow hosting (`下一位先听你的`, `等所有人发完言后`, `后置位的各位等你们发言时`), future-identity deferral (`等后面有人拍身份再调整`), bundled狼人杀术语 (`站边和票口`, `检验线`, `证词还没闭合`), unpublicized查验线 references, and false role-claim attribution such as saying seats that never claimed `自称猎人`.
- Latest real DeepSeek Day 1 sample: `tmp/class-trial-day1-verification-1780213850241.md` generated 9/9 speeches, fallback 0/9, templateHits 0, repeatedPressureTerms 4, nameRefs 9, Enoshima analyst signals 1, and Fukawa Togami refs 1 before the final narrow `后置位的各位` regression was added.

Changed files:
- src/ai/classTrialCharacterLens.ts
- src/ai/classTrialCharacterLens.test.ts
- src/ai/tableRead.ts
- src/ai/tableRead.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- docs/tasks/2026-05-class-trial-role-pressure-addressing.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts
- Real text sample: tmp/class-trial-day1-real-role-pressure-addressing-1780156628228.md
- Follow-up red-green: npm run test -- src/ai/speechProviders.test.ts -t "greet and restate peace night|Fukawa low-info|Enoshima low-info|all later seats"
- Follow-up focused: npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts
- Fresh-sample red-green: npm run test -- src/ai/speechProviders.test.ts -t "class-trial low-info.*fallback"; npm run test -- src/ai/speechProviders.test.ts -t "future voting review"; npm run test -- src/ai/tableRead.test.ts -t "future voting-review"
- Fresh-sample focused: npm run test -- src/ai/tableRead.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts
- Fresh real text sample: tmp/class-trial-day1-verification-1780195573037.md
- Browser QA transcript: tmp/class-trial-browser-qa-1780197058323.md
- Browser QA screenshot: tmp/class-trial-browser-qa-3005-current.png
- Post-browser red-green: npm run test -- src/ai/speechProviders.test.ts -t "hardens the class-trial director note|class-trial low-info first-speaker fallback"
- Post-browser focused: npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts
- Dialogue-persona red-green: npm run test -- src/ai/speechProviders.test.ts -t "room-greeting boilerplate|dialogue rewrite guidance"; npm run test -- src/ai/speechProviders.test.ts -t "speech order as a system puzzle|room-greeting boilerplate"; npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts -t "Fukawa fallback|validation fallback tied"
- Dialogue-persona focused: npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts
- Fresh real text sample: tmp/class-trial-day1-verification-1780198915715.md
- Verification follow-up red-green: npm run test -- src/ai/speechProviders.test.ts -t "process checklist|chip metaphor|dialogue rewrite guidance"; npm run test -- src/ai/speechProviders.test.ts -t "framework-slide|next speaker homework|process checklist|chip metaphor"; npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts -t "negative no-ticket|Enoshima analyst guard|future voting-review"; npm run test -- src/ai/speechProviders.test.ts -t "peaceful-night vote-bait|first-speaker fallback"; npm run test -- src/ai/speechProviders.test.ts -t "all later seats to finish|full round finishes|room-greeting boilerplate"; npm run test -- src/ai/speechProviders.test.ts -t "Enoshima low-info openings|Enoshima analyst guard"
- Verification follow-up focused: npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts
- Fresh real text samples: tmp/class-trial-day1-verification-1780199539544.md, tmp/class-trial-day1-verification-1780199696231.md, tmp/class-trial-day1-verification-1780199873932.md, tmp/class-trial-day1-verification-1780200025669.md, tmp/class-trial-day1-verification-1780200232131.md, tmp/class-trial-day1-verification-1780200361245.md, tmp/class-trial-day1-verification-1780200494836.md, tmp/class-trial-day1-verification-1780200623119.md, tmp/class-trial-day1-verification-1780200902521.md
- Latest red-green/focused: npm run test -- src/ai/speechProviders.test.ts; npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts
- Latest real text samples: tmp/class-trial-day1-verification-1780213358480.md, tmp/class-trial-day1-verification-1780213674742.md, tmp/class-trial-day1-verification-1780213850241.md

Remaining risks:
- The browser QA transcript is available, but GPT-SoVITS was unavailable at `127.0.0.1:9880`, so audible quality and voiced pacing still need a manual pass after the local voice service is started.
- Live DeepSeek output can still vary; the latest sample had 0 validation errors/fallbacks and strong name usage, but it still needed a post-sample targeted regression for `后置位的各位，等你们发言时`, so another subjective browser/audio pass should judge whether the stricter text layer feels natural enough.
```
