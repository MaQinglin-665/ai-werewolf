# Task

Short name: class-trial-freeform-speech-quality

Goal: Improve class-trial Day 1 speech so characters look like themselves participating in a Werewolf incident, not skilled Werewolf players wearing character skins. Role authenticity comes first, then participation in the public table event, then de-templating, basic logic, and inference strength.

Why it matters: A full real-LLM class-trial sample exposed that speeches became too short and rule-contract-shaped too early. The true seer only reported a black check and stopped, the checked Fukawa line initially risked drifting to Togami without touching the check, and later speeches tended to reuse the same abstract pressure chain. After review, Fukawa's imperfect but characterful dodge was a useful target: the game should reward character-shaped play, not force every role into optimal Werewolf rebuttal templates.

## Task Gate

Task type: AI speech / LLM contract / AI behavior planning

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Real text sample when feasible
- [ ] Production/release check

Browser/manual verification:

- Required? no
- If skipped, reason: This slice changes text planning and validation, not visible layout or audio playback.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This is a local AI speech planning and prompt-quality slice.
- Residual risk: Live LLM output can still vary and needs transcript review after each prompt iteration.

## Context To Read First

- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/tasks/2026-05-class-trial-role-pressure-addressing.md`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `src/ai/tableRead.ts`
- `src/ai/speechProviders.ts`

## Allowed Scope

Files or directories the agent may edit:

- `local-assets/class-trial-pack/personas.json`
- `src/game/aiFriends.ts`
- `src/game/aiFriends.test.ts`
- `src/game/types.ts`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/classTrialTableModel.ts`
- `src/components/game/classTrialTableModel.test.ts`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/classTrialPersonaDirector.ts`
- `src/ai/classTrialPersonaDirector.test.ts`
- `src/ai/classTrialSpeechDirector.ts`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/classTrialRoleVoiceProfile.ts`
- `src/ai/classTrialRoleVoiceProfile.test.ts`
- `src/ai/classTrialLiveState.ts`
- `src/ai/classTrialLiveState.test.ts`
- `src/ai/classTrialSpeechQuality.ts`
- `src/ai/classTrialSpeechQuality.test.ts`
- `src/game/claims.ts`
- `src/game/claims.test.ts`
- `tmp/class-trial-d1-all-speeches-score.mjs`
- `feature_list.json`
- `docs/superpowers/specs/2026-06-04-class-trial-anti-template-speech-design.md`
- `docs/superpowers/plans/2026-06-04-class-trial-anti-template-speech.md`
- `docs/tasks/2026-06-class-trial-freeform-speech-quality.md`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- `public/audio/ai-speech/**`
- unrelated UI, rules, database, or deployment files

## Definition Of Done

This task is complete when:

- A true seer black-check plan asks for identity, result, and how the table should treat the checked seat without forcing D1 first-check motive.
- A checked seat gets a direct response plan instead of drifting to unrelated relationship flavor.
- Class-trial speech limits are dynamic enough for hard-information speeches to explain themselves.
- The prompt no longer tells class-trial speakers that every turn must be 3 sentences / 260 chars.
- Non-peaceful death days do not encourage or allow the stale `平安夜药线` phrase.
- Fukawa's Togami relationship cue is context-gated for hard-information responses.
- Class-trial prompt guidance explicitly says characters are playing Werewolf, not acting like Werewolf-player templates with character skins.
- Repeated pressure pivots through role-specific actions such as hope checks, testimony cuts, trial taunts, despair/guise reads, wagers, qualification lines, voice breaks, or relationship chains.
- Real D1 sample scoring uses the revised role-first lens instead of over-rewarding generic Werewolf logic.
- Characterful seer black-check phrasing such as `查了3号腐川冬子——她是狼人` is parsed as a public check instead of becoming `预言家声明缺少验人`.
- D1 no-guard peaceful-night `女巫用药` is treated as public death-shape reasoning/background, not a main attack point.
- D1 first-check motive / `首验理由` is not a major attack point, and true seers are not prompted to actively explain why they picked the first target.
- Class-trial fallback gap wording avoids stitched abstractions such as `身份那句话少了前提`.
- Focused tests and targeted verification are recorded.

## Verification

Required checks:

- `npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts -t "class-trial hard-info|black-check target|non-peaceful death|Fukawa"`
- `npm run test -- src/game/claims.test.ts`
- `npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts`
- `npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/classTrialCharacterLens.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md`
- `npm run harness:check`
- `git diff --check`
- Real LLM check: `node tmp/class-trial-d1-all-speeches-score.mjs`

Optional deeper checks:

- Real LLM class-trial Day 1 text sample using the same seed/roster pattern as the reviewed run.

## Handoff

Latest update: 2026-06-06 20:22 Asia/Shanghai

Completed:

- Full-game Mimo viability check should pause here for cost control. Latest evidence: `tmp/class-trial-mimo-full-game-1780746535599.md` / `.json`; completed `GAME_OVER` on D2, good side won by `所有狼人出局`, 40 AI logs, 18 speeches, 22 actions, `actionFallback: 0`, `speechFallback: 1`, all providers are Mimo.
- Current judgment: the class-trial Mimo path is completable/playable for a full game, but not a clean 0-fallback speech run. The remaining fallback is D1 黑白熊 counterclaim speech; fallback text is legal and role-shaped, but should not be treated as real non-fallback LLM quality.
- Recommendation: stop broad full-game Mimo reruns for now. Continue later with targeted D1 黑白熊 counterclaim replay/unit tests, or manually review the latest transcript for subjective role quality before spending another real full-game run.
- Targeted local follow-up fixed the D1 黑白熊 counterclaim normalization issue exposed by the latest full-game report. The raw line had the required hard info near the end (`我是预言家，昨晚查验结果是1号苗木诚查杀。今天我的票先压1号苗木诚...`), but provider normalization could keep only the first 6 sentences and drop that contract information. Class-trial hard-info sentence limiting now preserves planned identity/check/vote-boundary sentences before compacting.
- Full-game Mimo fallback follow-up fixed two validator-side causes found in `tmp/class-trial-mimo-full-game-1780741768129.md`: quoted third-party seer claims no longer make an observer satisfy their own black-check finality contract, and post-speech challenge timeline validation no longer stitches a 5号 pressure sentence to a separate 3号 reference across sentences.
- Explicit long-run LLM retries now work above the old 3-retry ceiling. `AI_LLM_MAX_RETRIES=6` produces 7 total attempts, default remains 2 total attempts, and `AI_LLM_MAX_RETRIES_CAP` can bound high values.
- Latest focused verification passed after the normalization fix: `npm run test -- src/ai/speechProviders.test.ts -t "Monokuma"` (3 focused tests), `npm run test -- src/ai/modelLlms.test.ts src/ai/speechProviders.test.ts src/game/seerGoldHide.test.ts src/ai/tableRead.test.ts` (4 files / 253 tests), and `npx tsc --noEmit`.
- Fresh real full-game Mimo rerun is intentionally skipped for cost control. Do not copy chat-provided keys into files or replies; rerun only if the user explicitly re-approves another real full-game spend, and use temporary process env only.
- Mimo D2 follow-up reached `d2SpeechFallback: 0` in the latest real D2 harness sample: `tmp/class-trial-mimo-d2-speeches-1780737098833.md` / `.json`; 8 D2 speeches, all D2 providers `mimo-speech:mimo-v2.5-pro`.
- Fixed D2 fallback causes found in real Mimo samples: Mimo speech timeout is longer by default, quoted `为什么/怎么` fragments are no longer false unfinished-question failures, inline class-trial stage directions are stripped, and repairable internal audit terms are rewritten before validation.
- Locked class-trial fixed roles to the user-approved mapping: 苗木诚=SEER, 雾切响子=WITCH, 腐川冬子=VILLAGER, 黑白熊/江之岛盾子/塞蕾丝缇雅=WEREWOLF, 十神白夜=HUNTER, 高松灯/千早爱音=VILLAGER.
- Wired fixed seat-role overrides through browser game creation, `/api/games`, `gameService`, and `createGame()`, with engine validation that the fixed roles match the board role counts.
- Preserved `classTrialVoiceProfile` in `/api/games` role-card input so browser-created class-trial games retain structured character voice guidance.
- Updated the D1 all-speech scoring script to use the fixed class-trial lineup and the accepted check target: 苗木诚 checks 6号塞蕾丝缇雅 as wolf.
- Added hard validation for planned SEER checks regardless of true role and even under `AI_SPEECH_STRICTNESS=loose`; wolf counterclaims must still say the speaker is claiming seer and must cover target/result.
- Added public black-check fallback response states: target unspoken, target already spoke before a later counter-check, and target responded after the check.
- Added role-specific hard-info fallback exits for Naegi/Monokuma/Enoshima/Celestia black-check claims, Celestia checked-seat response, Togami hunter identity claim, Fukawa/Kirigiri early black-check relation, and Tomori/Anon late relation pivots.
- Added same-follower repetition control: after multiple speakers already attack the same black-check follower on the same `standard / two-sided / fake-focus` problem, later speakers are steered and validated to change target or attack the person who is repeating.
- Added checked-seat peaceful-night protection: a seat currently under a public black check must not reuse `平安夜/女巫用药/药线` background while answering the check; it should answer who checked them, why they reject it, and how they fight or survive today.
- Added late black-check inventory protection: after several D1 black-check speeches, later speakers should not recap the whole `平安夜 -> 苗木 -> 雾切 -> 腐川 -> 黑白熊` flow before acting. They must open with one target and a concrete role-shaped move.
- Updated `analyzeClassTrialSpeechQuality()` so valid follower pivots are not misread as `black_check_axis_repeat` merely because they cite the check before turning to a named follower, including cross-sentence pronoun pressure after a direct address.
- Expanded Togami and Celestia role texture recognition, and tightened Enoshima/Togami profile guidance so Enoshima does not return to checked-seat self-proof after pivoting and Togami uses qualification/standard review instead of empty arrogance.
- Added a follow-up pivot for public black checks: once the checked seat has answered and the table starts repeating the same `首跳查杀/被查杀位自证` axis, later speakers are steered toward follower pressure, rescue behavior, focus-locking, or character-specific reaction instead of re-asking the checked seat the same question.
- Tightened the Kirigiri relation frame as a hard validation rule: on D1 class-trial, before the checked seat answers an unopposed first black check, Kirigiri should not pressure the claimant with `票压/锁票/站不站得住/我不跟`-style language. The correct detective move is to hold the claim provisional, force the checked seat to answer, and observe counterclaim/rescue/focus changes.
- Added hard validators and repair instructions for late class-trial speakers who replay the same black-check axis or keep asking the same checked-seat self-proof question after multiple followers already did it.
- Adjusted the report-only quality analyzer so a speaker who explicitly calls out the table for repeating the same black-check axis is not itself marked as `black_check_axis_repeat`.
- Corrected the black-check hard-information relation frame after user review: when an unopposed first seer black-check is on the table, Kirigiri / good observers should not pressure the claimant or criticize `首验理由` / `票压太满`; they should hold the claimant provisional, force the checked seat to answer, and watch counterclaims / rescue / rewrite moves.
- Updated wolf-teammate black-check handling so a wolf does not repeat the same claimant-pressure axis. The live move now turns to the checked teammate's response, counterclaim risk, and who rescues too quickly.
- Added repeated black-check-axis avoidance to `ClassTrialLiveState`, steering later speakers away from replaying `首跳查杀/票压太死/顺序太干净` and toward checked-seat response, counterclaims, rescue moves, or later standing.
- Extended the report-only speech quality analyzer with `unearned_claimant_pressure` and `black_check_axis_repeat`, so Kirigiri-style premature pressure on an unopposed claimant and later repeated black-check framing are flagged as viewer-quality failures.
- Fixed black-check target-response validation so natural claimant references such as `苗木同学，你查杀我？我不认` count as answering the public black check.
- Updated the local Kirigiri and Enoshima profile reactions so Kirigiri does not look like she is protecting the checked seat, and Enoshima does not keep borrowing the same black-check line for performance.
- Added structured `classTrialVoiceProfile` support for the first migration batch: `kirigiri`, `fukawa`, and `enoshima`; Tomori remains unmigrated for this pass.
- Fixed the generic AI friend role-card sanitizer so `classTrialVoiceProfile` survives `resolveAiFriendsForGame()`, `createGame()`, and `buildAgentView()`. Before this fix, local persona JSON contained the profiles but live speech prompts still fell back to legacy lens text.
- Wired structured profiles through class-trial persona loading, role-card types, profile formatting, persona director guidance, and class-trial freeform LLM guidance.
- Added `ClassTrialLiveState` so each class-trial speaker carries current intent, pressure, target, public move, character impulse, risk, and repetition avoidance into the LLM-visible prompt.
- Migrated the first-batch role lens away from fixed action tags and old abstract audit terms, especially `冷静切证词`, `先防御/刺一句`, and `结构/收益` as the default identity.
- Added report-only `analyzeClassTrialSpeechQuality()` with hard-valid versus viewer-quality separation, evidence, repeated axes, and revision direction.
- Updated `tmp/class-trial-d1-all-speeches-score.mjs` to include anti-template quality fields and aggregate only non-fallback rows for viewer quality.

Verification:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/game/engine.test.ts src/app/api/games/aiFriends.test.ts src/app/api/games/api.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts src/ai/classTrialCharacterLens.test.ts` passed: 8 files / 375 tests.
- `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts src/ai/classTrialCharacterLens.test.ts` passed: 3 files / 214 tests.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md`, `npm run harness:check`, and `git diff --check` passed. Build still reports the existing Turbopack NFT trace warning; diff check reports CRLF warnings only.
- Latest fallback-heavy real report: `tmp/class-trial-d1-all-speeches-score-1780651610416.md`; 9 speeches, 9 fallback, average 83, no anti-template findings. Because all rows were fallback, use this only as fallback legality/shape evidence, not as proof of ideal non-fallback LLM quality.
- `npm run test -- src/game/aiFriends.test.ts src/components/game/classTrialTheme.test.ts src/ai/classTrialRoleVoiceProfile.test.ts src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts` passed: 8 files / 253 tests.
- `node -e "JSON.parse(require('fs').readFileSync('local-assets/class-trial-pack/personas.json','utf8')); console.log('personas json ok')"` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- Latest full report after this pass: `tmp/class-trial-d1-all-speeches-score-1780643618268.md`; 9 speeches, 5 fallback, average 83, quality sample 4 non-fallback speeches, `viewerQuality pass=4`, and no non-fallback anti-template findings. Fallback rows are still intentionally ignored for this user-requested pass.
- `npm run test -- src/ai/classTrialLiveState.test.ts` passed: 9 tests.
- `npm run test -- src/ai/speechProviders.test.ts` passed: 154 tests.
- `npm run test -- src/ai/classTrialSpeechQuality.test.ts` passed: 9 tests.
- `npm run test -- src/game/aiFriends.test.ts src/components/game/classTrialTheme.test.ts src/ai/classTrialRoleVoiceProfile.test.ts src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts` passed: 8 files / 223 tests.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- Latest full report after the repeated-axis / Kirigiri-pressure validators: `tmp/class-trial-d1-all-speeches-score-1780620247379.md`; 9 speeches, 5 fallback, average 77, quality sample 4 non-fallback speeches, `viewerQuality pass=3 warn=1`, and no non-fallback `unearned_claimant_pressure`. Fallback rows are intentionally ignored for this user-requested pass.
- `npm run test -- src/ai/classTrialLiveState.test.ts` passed: 7 tests.
- `npm run test -- src/ai/classTrialSpeechQuality.test.ts` passed: 8 tests.
- `npm run test -- src/ai/speechProviders.test.ts -t "Fukawa"` passed: 6 focused tests.
- `npm run test -- src/game/aiFriends.test.ts src/components/game/classTrialTheme.test.ts src/ai/classTrialRoleVoiceProfile.test.ts src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts` passed: 8 files / 218 tests.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- Direct 1-3 raw probe after the claimant-alias fix produced non-fallback Kirigiri and Fukawa lines: Kirigiri kept Naegi's claim provisional and pushed Fukawa to answer; Fukawa directly rejected Naegi's black check.
- Latest full report after the hard-info relation fix: `tmp/class-trial-d1-all-speeches-score-1780588824661.md`; 9 speeches, 5 fallback, average 76, quality sample 4 non-fallback speeches, aggregate `black_check_axis_repeat=2`. Because Kirigiri / Enoshima fell back in that run, this report is not enough for final subjective judgment of migrated-role quality.
- `npm run test -- src/components/game/classTrialTheme.test.ts src/ai/classTrialRoleVoiceProfile.test.ts src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts` passed: 7 files / 201 tests.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- `node tmp/class-trial-d1-all-speeches-score.mjs` produced `tmp/class-trial-d1-all-speeches-score-1780580906170.md`: 9 speeches, 7 fallback, average 78, quality sample 2 non-fallback speeches, `viewerQuality pass=2`, no non-fallback anti-template findings.
- After the sanitizer fix, `node tmp/class-trial-d1-all-speeches-score.mjs` produced `tmp/class-trial-d1-all-speeches-score-1780586047863.md`: 9 speeches, 4 fallback, average 81, quality sample 5 non-fallback speeches, `viewerQuality pass=5`. Kirigiri, Fukawa, and Enoshima were all non-fallback and had `characterPresence: strong`.
- `npm run test -- src/game/aiFriends.test.ts src/components/game/classTrialTheme.test.ts src/ai/classTrialRoleVoiceProfile.test.ts src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts` passed: 8 files / 211 tests.
- `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with CRLF warnings only.
- Mimo probe with a temporary process env route, not persisted to `.env`: `tmp/class-trial-d1-all-speeches-score-1780653397137.md` / `.json`; 9 speeches, 4 fallback, average 86, and `viewerQuality pass=4 warn=1` across 5 non-fallback rows. This produced stronger character voice than the current DeepSeek route, while still exposing validator/contract issues.
- User decision after the Mimo probe: for class-trial theme only, fix the game brain to Mimo and prioritize speech/decision quality over latency.
- Current Mimo routing implementation: fixed class-trial friends use `mimo-logic-checker`; action repair uses the actual class-trial seat persona instead of hard-coded `DeepSeek`; action/speech repair stay on the same Mimo route instead of GPT/Claude/GLM fallbacks; class-trial home/table labels show `真实 LLM · Mimo-v2.5-pro`.
- Post-code Mimo D1 fixed-scenario sample: `tmp/class-trial-d1-all-speeches-score-1780654895988.md` / `.json`; 9 speeches, 4 fallback, average 83, `viewerQuality pass=4 warn=1` across 5 non-fallback rows, all non-fallback providers on `mimo-speech:mimo-v2.5-pro`.
- Added `tmp/class-trial-mimo-full-game.mjs` and ran a complete Mimo game with temporary process env secrets only: `tmp/class-trial-mimo-full-game-1780655742482.md` / `.json`; completed to `GAME_OVER` on Day 4, wolves won by `所有平民出局`, with 41 Mimo actions, 24 Mimo speeches, 0 action fallback, and 6 speech fallback.
- Added a hard validator for class-trial speeches that end mid-thought without a sentence close, after the full-game Mimo sample exposed a non-fallback 千早爱音 line ending at `塞蕾丝缇雅，你那句`.
- `npm run test -- src/ai/speechProviders.test.ts -t "ends mid-thought"` passed: 1 focused test, 167 skipped.
- `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts` passed: 6 files / 265 tests.
- `npx tsc --noEmit`, `npm run lint`, `node --check tmp/class-trial-mimo-full-game.mjs`, `npm run build`, `npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md`, `npm run harness:check`, and `git diff --check` passed. Build still reports the existing Turbopack NFT trace warning; diff check reports CRLF warnings only.
- Fixed a validator false negative for natural true-seer black-check treatment: wording such as `今天她必须正面接这个结果，全桌怎么处理她，就从她自己的回应开始` now counts as today's treatment instead of being rejected as `预言家查杀缺少今天如何处理查杀位`.
- `npm run test -- src/ai/speechProviders.test.ts -t "requires class-trial seer black checks"` passed after the red-green fix.
- Post-fix Mimo D1 sample: `tmp/class-trial-d1-all-speeches-score-1780662175071.md` / `.json`; 9 speeches, 6 fallback, average 85, quality sample 3, `viewerQuality pass=3`. 苗木诚 is non-fallback Mimo output with score 93, proving the seer-treatment false negative was fixed.
- Post-truncation-validator full-game Mimo rerun: `tmp/class-trial-mimo-full-game-1780662562076.md` / `.json`; completed to `GAME_OVER` on Day 2, wolves won by `所有神职出局`, with 24 Mimo actions, 14 Mimo speeches, 0 action fallback, 1 speech fallback, and no dangling/truncated speech endings found by scan.

Remaining risks:

- Mimo is now fixed in code and the post-truncated-validator full-game path has been rerun successfully. This proves a complete Mimo game path, not ideal subjective speech quality.
- The latest full-game sample was much cleaner than the previous one, but still had 1 speech fallback out of 14 speeches.
- The 20:22 fix is local provider-path proof for the known D1 黑白熊 failure shape; it is not a fresh full-game 0-fallback proof.
- The latest post-code D1 Mimo sample still had 4 fallback out of 9 speeches and report-only repeated-axis findings (`thought_axis_repeat`, `black_check_axis_repeat`).
- The latest post-fix fixed D1 Mimo sample had 6 fallback out of 9 speeches; remaining causes are mostly prompt/model behavior against existing hard rules: first-check motive, peaceful-night misuse, overlong report style, and already-spoken/final-seat constraints.
- The latest successful subjective metric is non-fallback-only. Fallback remains explicitly out of scope per user direction, but the latest sample still had 5 fallback rows, which limits how many real LLM lines can be judged per run.
- The current pass handles repeated black-check axes, same-follower dogpiles, peaceful-night reuse by checked seats, and late inventory recaps. The next useful quality pass should focus on increasing non-fallback rate and stronger per-role action texture for weak/fallback-prone roles, not more broad table-rule validators.
- The stricter validators increased fallback in some samples. The user explicitly asked not to optimize fallback for this pass, but the high fallback rate reduces the number of subjective non-fallback lines available per sample.
- The latest non-fallback sample removes the worst relation error for Kirigiri, but Kirigiri / Tomori / Anon can still read weaker in role texture than the migrated first-batch target. The next useful pass should improve per-role non-fallback action texture instead of adding broad generic Werewolf validators.
- The latest fixed samples prove the migrated first-batch role profiles and live-state material reach real LLM speech, but the LLM still varies. A clean multi-sample subjective read is still needed, especially after one full report had Kirigiri / Enoshima fall back.
- Fukawa as the checked wolf can still attack the seer claim from self-preservation. That is allowed for now, but if it keeps sounding like generic `首验动机` pressure instead of a panicked checked-wolf dodge, it should get a separate role-specific repair.
- Fallback quality is deliberately ignored for this pass per user direction.
- Live LLM wording can still vary; the next subjective pass should review non-fallback Kirigiri/Fukawa/Enoshima lines specifically for old role-label repetition.

```text
Completed:
- Tried the approved class-trial LLM-only experiment: removed decision/audit scripts from the initial LLM-visible speech input while keeping backend validation and retry repair.
- Root-caused renewed D1 first-check-reason attacks to the LLM's own Werewolf priors after the script strip, not to an explicit table-task instruction.
- Repaired the LLM retry path so first-check-reason failures are redirected to checked-seat response, seer counterclaim, today black-check treatment, or public collision with the result.
- Removed the copyable visible system phrase "D1不需要解释首验理由" and replaced it with identity/result/today-treatment guidance.
- Accepted natural black-check wording such as "昨晚查验了3号腐川冬子，结果是狼人。所以腐川是我的查杀" as a valid public black check.
- Latest sample: tmp/class-trial-d1-all-speeches-score-1780567243006.md; 苗木诚 is non-fallback real DeepSeek output, and non-fallback speeches no longer use 首验理由/为什么验3号 as the attack axis. Remaining weakness is role-action depth for 雾切、高松、爱音.
- Reframed the class-trial goal from "characters speak like skilled Werewolf players" to "characters visibly play Werewolf while staying themselves"; role authenticity now outranks optimal Werewolf phrasing.
- Updated class-trial director and speech guides so repeated pressure pivots into character actions such as hope checks, testimony cuts, trial taunts, despair/guise reads, wagers, qualification lines, voice breaks, or relationship chains instead of generic `收益/票型/结构` wording.
- Updated fallback gap wording so class-trial repair lines avoid stitched phrases like `身份这句话还没说清没有闭合`.
- Generated a latest real D1 all-seat sample with the revised score lens: `tmp/class-trial-d1-all-speeches-score-1780490992573.md`; it produced 9/9 real speeches with 0 fallback, average score 75.
- Root-caused the bad `首验理由/女巫用药` attack direction: the public claim extractor did not parse natural characterful wording like `查了3号腐川冬子——她是狼人`, so later seats saw `预言家声明缺少验人`; death-shape prompt guidance also let `女巫用药` become an attack target instead of a public background fact.
- Updated `src/game/claims.ts` so characterful named-target/pronoun-result seer checks are extracted into `claimBoard.checks`.
- Updated `src/ai/speechProviders.ts` so D1 no-guard peaceful-night `女巫用药` can be mentioned as public death-shape reasoning but is rejected when it becomes the main attack point.
- Added hard-information class-trial speech planning for true seer black checks: identity, explicit checked target/result, and today's vote boundary are required, while D1 first-check reason is explicitly not a main attack axis.
- Added direct black-check target planning so the checked seat responds to the claim before any unrelated character flavor.
- Replaced fixed class-trial 3-sentence / 260-char constraints with dynamic hard-information limits.
- Tightened validation for class-trial seer black checks, checked-seat replies, prompt/meta leaks, D1 first-check motive attacks, peaceful-night witch-use attacks, non-peaceful death stale phrases, and Fukawa/Togami trigger boundaries.
- Updated fallback lines so hard-information failures fall back to semantically useful speeches instead of low-information openings.
- Updated class-trial fallback gap wording from `身份那句话少了前提` to a less stitched identity-boundary phrase, and removed fallback wording that triggers already-spoken-seat follow-up errors.

Changed files:
- src/ai/tableRead.ts
- src/ai/tableRead.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/classTrialPersonaDirector.ts
- src/ai/classTrialPersonaDirector.test.ts
- src/ai/classTrialSpeechDirector.ts
- src/ai/classTrialCharacterLens.ts
- src/ai/classTrialCharacterLens.test.ts
- src/game/claims.ts
- src/game/claims.test.ts
- docs/tasks/2026-06-class-trial-freeform-speech-quality.md
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/game/claims.test.ts
- npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts
- npm run test -- src/ai/classTrialPersonaDirector.test.ts src/ai/classTrialSpeechDirector.test.ts src/ai/classTrialCharacterLens.test.ts
- npx tsc --noEmit
- npm run lint
- npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md
- npm run harness:check
- git diff --check
- Real LLM checks:
  - `tmp/class-trial-d1-all-speeches-score-1780495718356.md`: after claim parsing, checks were extracted but old `首验理由/后续验人结构` pseudo-problems still appeared.
  - `tmp/class-trial-d1-all-speeches-score-1780497191642.md`: fallback validation pollution was fixed; sample reached 9 speeches, 2 fallback, average 91, but still showed first-check reason drift.
  - `tmp/class-trial-d1-all-speeches-score-1780498805293.md`: final stricter guard removed the old `首验理由/女巫用药` main-axis issue and the stitched `身份那句话少了前提` phrase, but increased fallback to 4/9 and average fell to 78.
  - `tmp/class-trial-d1-all-speeches-score-1780505837274.md`: de-template material pass reached 9/9 real LLM speeches, 0 fallback, average 91; scan found no `票口边界` / `外置硬身份反证` / `起跳收益` / `身份动作` / `公开边界` / `首验理由` / `验人理由` in the sample.

Remaining risks:
- Live LLM wording can still vary; the latest D1 sample removed the known pseudo-problems and fallback pressure, but later seats can still share similar `结构收益/票口/身份线` vocabulary under real generation.
- Latest D1 sample still shows weaker character texture for some later seats, especially 塞蕾丝 and 十神; next work should improve role actions and character-specific pressure, not add more Werewolf checklist rules.
- No browser/audio pass was run because this task only changes AI text planning, prompt contracts, and validation.
```

```text
Completed:
- Continued the Mimo route follow-up after the high-fallback D1 samples.
- Fixed validator false positives around true-seer black-check target response, natural self-intro seer claims such as `我是1号苗木诚，预言家`, Celestia's chip/后置 wording, D1 first-check motive negation, supportive Kirigiri pressure, and natural black-check treatment boundaries.
- Switched class-trial default/runtime labels to `mimo-v2.5`, matching the first 0-fallback fixed-scenario Mimo sample instead of the earlier `mimo-v2.5-pro` route.
- Latest fixed D1 sample: `tmp/class-trial-d1-all-speeches-score-1780667013149.md` / `.json`; 9 speeches, 0 fallback, average 85, all providers `mimo-speech:mimo-v2.5`, `viewerQuality pass=8 warn=1`.

Changed files:
- src/ai/modelLlms.ts
- src/game/personas.ts
- src/components/game/classTrialTheme.ts
- src/components/game/classTrialTableModel.test.ts
- src/components/game/classTrialGameTable.test.ts
- src/components/game/gamePanelsMobile.test.ts
- src/ai/actionProviders.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/game/claims.ts
- src/game/claims.test.ts
- docs/tasks/2026-06-class-trial-freeform-speech-quality.md
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/game/claims.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/components/game/classTrialTheme.test.ts src/components/game/classTrialTableModel.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/gamePanelsMobile.test.ts
- npx tsc --noEmit

Remaining risks:
- 0 fallback does not equal ideal character quality.
- The sample still has near-duplicate 5号江之岛 / 7号十神 wording, weak Togami/Hunter identity texture, and a comparatively weak 2号雾切 line.
- Next pass should target repeated role axes and per-character action texture, not further fallback polishing.
```

```text
Completed:
- Continued the Mimo D1 fallback repair after the first 0-fallback sample still had duplicate question-shape and weak hard-info issues.
- Added copied-question-shape validation and live-state avoidance for late class-trial speakers.
- Preserved hard SEER / hard identity contracts in class-trial LLM input, while still stripping ordinary decision/audit scripts.
- Retained only D1 public-black-check safety bans for non-hard freeform speech so Mimo sees the first-check / peaceful-night restrictions without seeing the full table script.
- Accepted `我才是预言家` as a valid hard seer counterclaim.
- Made hard class-trial hunter claims expose `我拍猎人，枪在这里。`.
- Latest fixed D1 sample: `tmp/class-trial-d1-all-speeches-score-1780673627203.md` / `.json`; 9 speeches, 0 fallback, average 79, all providers `mimo-speech:mimo-v2.5`, `viewerQuality pass=8 warn=1`.

Changed files:
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/classTrialLiveState.ts
- src/ai/classTrialLiveState.test.ts
- src/ai/modelLlms.ts
- src/game/personas.ts
- src/components/game/classTrialTheme.ts
- related Mimo label/runtime tests
- docs/tasks/2026-06-class-trial-freeform-speech-quality.md
- progress.md
- session-handoff.md

Verification:
- node tmp/class-trial-d1-all-speeches-score.mjs
- npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/gameClientRequests.test.ts src/game/engine.test.ts src/app/api/games/aiFriends.test.ts src/app/api/games/api.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechQuality.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialLiveState.test.ts src/game/claims.test.ts
- npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialLiveState.test.ts src/game/claims.test.ts
- npx tsc --noEmit
- npm run lint
- npm run build
- npm run harness:task-card -- docs/tasks/2026-06-class-trial-freeform-speech-quality.md

Remaining risks:
- 0 fallback is achieved for the fixed D1 text sample, not for a fresh full-game Mimo run after these exact repairs.
- Subjective character quality is still uneven: 2号雾切 is too short, 4号黑白熊 is contract-shaped, and 9号千早爱音 lacks enough relationship texture.
- Browser/audio listening remains a separate verification path.
```
