# Session Handoff

## Current Objective

- Goal: Keep class-trial AI speech on public/player-known evidence while allowing valid public death-shape inference about witch potion state, knife targets, and poison targets.
- Current status: Done locally. Conclusion-level bans on `女巫没救/没用药` and public knife/poison-mouth reasoning were removed; prompts now require public rules/death-announcement reasoning instead of templated prohibition wording, and the work is verified and ready to push to GitHub.
- Local note: This work should push to GitHub only; no Tencent Cloud or Render deployment is in scope.

## Completed This Session

- [x] Reworked class-trial death-shape speech guidance so AI can infer potion state, knife targets, and poison targets from public death announcements plus board rules without pretending to have private night knowledge.
- [x] Removed the public-death `有夜死时不能确认女巫用药` validation branch and relaxed knife/poison-mouth validation for targets already present in the public death list.
- [x] Kept private boundaries for invented witch identity, invented rescue target, and fake self-witch status leaks.
- [x] Updated table memory, table-read tasks, inference layers, role playbooks, advanced reasoning, and debate agenda prompts from “do not say this conclusion” to “say the public evidence source.”
- [x] Added regressions proving day-one single-death public reasoning about `女巫没救/没用药`, knife target, and poison-mouth overlap passes validation.
- [x] Verification passed: affected Vitest files, `npx tsc --noEmit`, `npm run lint`, full `npm run test` (89 files / 851 tests), and `npm run build` with the existing Turbopack NFT trace warning.
- [x] Added `docs/superpowers/specs/2026-06-02-room-vote-and-class-trial-rules-design.md`, `docs/superpowers/plans/2026-06-02-room-vote-and-class-trial-rules.md`, and `docs/tasks/2026-06-room-vote-class-trial-rules.md`.
- [x] Added `src/server/roomAdvance.ts` with bounded host advancement and trace output; `src/server/roomService.ts` now uses it outside `DAY_VOTE`.
- [x] Added room API coverage proving host continue can reach speech and resolve a vote, and improved `scripts/room-action-smoke.mjs` diagnostics for base URL, timeout, and recent steps.
- [x] Added class-trial theme flow labels/details and wired the table/flow model so hidden night labels are minimized and trial steps become the main status.
- [x] Added class-trial persona director guidance that allows low-information character texture while preserving private-knowledge and system-prompt leak guards.
- [x] Focused verification passed: room advance/API tests 2 files / 23 tests; class-trial UI/model tests 4 files / 48 tests; class-trial AI director tests 3 files / 140 tests.
- [x] `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed; build kept the existing Turbopack NFT trace warning for `next.config.ts -> src/server/roomService.ts -> src/app/api/rooms/debug-cleanup/route.ts`.
- [x] Local room vote smoke passed on `http://127.0.0.1:3000`: `coveredActionTypes` included `seerCheck`, `witchAction`, `speak`, and `vote`; `voteResolved` was `true`.
- [x] Local room SSE smoke passed on `http://127.0.0.1:3000` with lobby, join, and start events.
- [x] In-app browser verification confirmed the class-trial main status uses `闭庭整理` during hidden night and `证言审理` during day speech; screenshot saved to `tmp/class-trial-room-vote-rules-visual.png`.
- [x] Added `docs/superpowers/specs/2026-06-02-class-trial-system-architecture-design.md`, `docs/superpowers/plans/2026-06-02-class-trial-system-architecture.md`, and `docs/tasks/2026-06-class-trial-system-architecture.md`.
- [x] Added `src/game/phaseSemantics.ts` and reused it from `src/game/projection.ts` and `src/server/roomService.ts`.
- [x] Added `src/game/voteSnapshot.ts` and moved public recent vote, day-vote sealed progress, day-vote reveal, and sheriff vote snapshot helpers out of projection.
- [x] Added `src/components/game/classTrialVotePresentation.ts`; `ClassTrialVoteStage` and `ClassTrialGameTable` now share the same sealed/reveal vote presentation model.
- [x] Added `src/components/game/classTrialFlowModel.ts`; `GameClient` now gates class-trial intro, opening-night curtain, auto-advance, host audio, AI audio, and voice prewarm through one model.
- [x] Added `src/components/game/classTrialTableModel.ts`; class-trial table focus, night state, host label, active audio speaker, and vote ring state are computed outside JSX.
- [x] Added `src/ai/classTrialSpeechDirector.ts`; class-trial self-introduction, dialogue rewrite, low-info opening, final-speaker, and repeated-focus director guidance moved out of `speechProviders.ts`.
- [x] Verification passed: targeted aggregate Vitest 12 files / 324 tests; room API test 1 file / 19 tests; `npx tsc --noEmit`; `npm run lint`; `npm run build`.
- [x] Local HTTP/API smoke passed on `http://127.0.0.1:3000`; room SSE smoke passed with `ROOM_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:room-sse`.
- [x] `npm run smoke:room-action:vote` was investigated but did not complete. Root cause for first failure was default port 3003 versus running server on 3000; after correcting and trying a mock 3003 production server, manual tracing showed timeout after `NIGHT_WOLVES -> NIGHT_SEER` in the existing room AI night-advance path.
- [x] Added `docs/tasks/2026-05-class-trial-vote-burst-animation.md` for the vote burst animation slice.
- [x] Added reveal verdict metadata so class-trial reveal distinguishes `exile` from `no-exile`.
- [x] Added `ClassTrialVoteBurstOverlay` for sealed `TRIAL VOTE` / `封票开始`, public target `开票揭示`, and tied `未达成处刑` burst states.
- [x] Added table-level no-exile coverage so tied reveals do not focus any seat.
- [x] Added CSS-only red/black slash burst, scanline/pulse pressure, locked-seat stamp, and reduced-motion fallback.
- [x] Added `docs/tasks/2026-05-class-trial-vote-visualization.md` and `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md` for the vote visualization slice.
- [x] Added sealed vote progress fields (`eligibleSeatIds`, `lockedSeatIds`, `pendingSeatIds`) to the public vote snapshot and kept `votes`, `tally`, `leaders`, targets, and reasons hidden until reveal.
- [x] Added `ClassTrialVoteStage` for the sealed-progress HUD and one-shot reveal surface.
- [x] Wired `ClassTrialGameTable` to show per-seat `已锁票` / `等待中` chips during voting and a focused leading seat during reveal.
- [x] Updated class-trial vote/reveal copy to say targets stay sealed until the票箱 opens.
- [x] Browser verified `http://127.0.0.1:51631`: sealed vote showed `3 / 9`, `已锁票/等待中`, no arrows/targets; reveal showed `开票揭示`, tally rows, ledger rows, and focus seat.
- [x] Updated `feature_list.json`, `progress.md`, this handoff, and the task card with current evidence for `class-trial-vote-visualization`.
- [x] Added `docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md` as the executable task card for the public-speech evidence boundary.
- [x] Root-caused the user-reported `我暂时更信5号` symptom to `buildMemorySpeechPoint()` converting private `memory.trustedSeatId` directly into public talking points.
- [x] Added a red-green table-read regression where seat 5 is privately trusted but has not spoken and has no public evidence; the test first failed on `我暂时更信5号` and now passes.
- [x] Added `buildPublicTrustSpeechPoint()` to translate private trust into public evidence wording only when the trusted seat has visible public speech/check/claim/stance/mention/vote context.
- [x] Added a positive regression proving a publicly spoken trusted seat can still be referenced as public evidence, without turning the line into raw private trust.
- [x] Verified with focused table-read/speech-provider tests, memory-tagged engine tests, TypeScript, targeted ESLint, build, task-card gate, harness check, and whitespace check.
- [x] Fixed full lint by adding `tmp/**` to `eslint.config.mjs` global ignores; `npm run lint` now passes instead of scanning unrelated existing `tmp/chrome-class-trial-smoke` Chrome extension cache files.
- [x] Updated `feature_list.json`, `progress.md`, this handoff, and the task card with current evidence.
- [x] Added `docs/tasks/2026-05-speech-de-template-persona-layer.md` as the executable follow-up task card for reducing template feel in ordinary and class-trial AI speech.
- [x] Added `buildUniversalDeTemplateGuide()` so every speaker sees a shared prompt layer that names repeated empty phrases and suggests alternate public moves: identity benefit, vote motive, reaction gap, death shape, follow-pressure benefit, and verifiable condition.
- [x] Added ordinary Werewolf template-chain validation for obvious canned phrase combinations without hard-banning bluffing, pressure, `没站边/没票口`, or legitimate later-seat verification conditions.
- [x] Red-green tests first failed because ordinary speech input lacked `通用去模板` guidance and ordinary empty-template chains returned no validation error; they now pass.
- [x] Added `docs/tasks/2026-05-class-trial-role-pressure-addressing.md` as the executable follow-up task card for role-specific repeated pressure and public name/addressing.
- [x] Added `buildNameAwareAddressingGuide()` so ordinary and class-trial speech prompts prefer `2号雾切` / `5号江之岛` / `9号爱音` style references instead of only seat numbers.
- [x] Expanded repeated abstract-pressure detection around `缺口 / 没往下推 / 没给倾向 / 没给结论` and route the next prompt through the current class-trial role's pressure method.
- [x] Strengthened 江之岛盾子's lens as 超高校级的分析师: whole-table structure, reaction pattern, and benefit analysis before theatrical chaos.
- [x] Strengthened 腐川冬子's lens around 十神白夜: she reacts to who touches, ignores, protects, or pressures 十神 while still using public reasons.
- [x] Real Day 1 text sample `tmp/class-trial-day1-real-role-pressure-addressing-1780156628228.md` generated 9/9 DeepSeek speeches with fallback 0/9, templateHits 0, repeated pressure terms 3, and nameRefs 10.
- [x] Follow-up user review of `tmp/class-trial-day1-verification-1780157549436.md` found first-three speeches still felt empty/template-like rather than characterful.
- [x] Added `openingMove` to the class-trial character lens, with role-specific low-info openings for 苗木、雾切、腐川、黑白熊、江之岛、塞蕾丝、十神、高松、爱音.
- [x] Added low-info class-trial opening director guidance so early speakers make character actions instead of reporting `发言顺序 / 站边 / 票型`.
- [x] Added validators for greeting-only平安夜 openers, generic audit-frame openers, all-later-seat waiting, final-speaker future waiting, 腐川 missing 十神, and 江之岛 missing analyst structure.
- [x] Follow-up tests passed: `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` passed 2 files / 114 tests.
- [x] Fresh real DeepSeek text sample after the opening-persona follow-up now runs: `tmp/class-trial-day1-verification-1780195573037.md` generated 9/9 speeches, fallback 3/9 via role-specific fallback, templateHits 0, repeatedPressureTerms 4, nameRefs 11, Enoshima analyst signals 1, and Fukawa Togami refs 1.
- [x] Root-caused a sample-level low-info drift: `投票时形成闭环` was incorrectly treated as hard information because day-one hard-info detection matched bare `投`, which turned off the 腐川/江之岛 low-info guards too early.
- [x] Narrowed day-one hard-info detection in `src/ai/tableRead.ts` and `src/ai/speechProviders.ts` so future voting-review wording stays low-info, while concrete identity/check/票口/归票/出人/投X号 still counts as hard progress.
- [x] Added role-specific class-trial low-info fallback lines so validation fallback no longer pressures unspoken seats and still preserves 苗木共同验证点、雾切冷静切片、腐川十神情绪坐标、江之岛结构/收益/伪装 signal.
- [x] Browser/game QA on `http://127.0.0.1:3005` completed a full Day 1 class-trial run and saved `tmp/class-trial-browser-qa-1780197058323.md` plus screenshot `tmp/class-trial-browser-qa-3005-current.png`.
- [x] Browser QA found the role layer is noticeably better but the live table still repeated `1号没给倾向/缺口` too often; GPT-SoVITS was unavailable at `127.0.0.1:9880`, so this pass could not judge audible voice quality.
- [x] Follow-up hardened repeated empty-stance/empty-gap guidance so a repeated `没给倾向/缺口` line cannot stay the main axis; it must turn into收益、身份成本、票型成本或反应差.
- [x] Follow-up made 苗木 low-info fallback more characterful by adding a `希望/共同验证` beat instead of only leaving a bare verification hook.
- [x] Follow-up dialogue-persona pass added class-trial台词化转译 guidance: Werewolf terms like `站边/票口/闭环/缺口` are internal scaffolding and should be spoken as character lines.
- [x] Added class-trial validation for terminology overload, room-greeting low-info openings, and speech-order-as-system-puzzle openings.
- [x] Added broad 腐川 role-texture validation plus fallback moves that keep 十神 present even after validation fallback; fallback gap normalization now turns identity-audit wording into `身份这句话还没说清`.
- [x] Fresh real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780198915715.md`: 9 speeches, fallback 2, templateHits 0, repeatedPressureTerms 0, nameRefs 8, Enoshima analyst signals 2, Fukawa Togami refs 1.
- [x] Follow-up verification pass tightened residual sample regressions: non-Celestia `筹码` spread, process-checklist lines around `后置位整体/发言顺序校验`, first-seat homework and full-round waiting, negative no-ticket wording closing low-info too early, and `等后置位谁先动再回头看`.
- [x] Added repeated-motif director guidance for `框架滑移/话滑空转` and `平安夜催票复读`; 苗木 low-info fallback now uses `谁把不确定说成确定` instead of the copied `借平安夜催票` phrase.
- [x] Tightened 江之岛 low-info validation so bare `裂口/谁最受益` no longer counts as analyst structure; she now needs analysis, structure, reaction pattern, benefit path, or disguise signal.
- [x] Fresh real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780200902521.md`: 9 speeches, fallback 1, templateHits 0, repeatedPressureTerms 1, nameRefs 7, Enoshima analyst signals 2, Fukawa Togami refs 1. The final observed `等第一轮走完后` variant is covered by a post-sample regression.
- [x] Latest follow-up added regressions for first-seat workflow hosting (`下一位先听你的`, `等所有人发完言后`, `后置位的各位等你们发言时`), future-identity deferral (`等后面有人拍身份再调整`), class-trial jargon bundles, unpublicized `验人线`, and role-claim attribution hallucinations like `4号和5号也先后自称猎人`.
- [x] Latest focused AI tests passed: `npm run test -- src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/tableRead.test.ts` passed 3 files / 171 tests.
- [x] Latest real DeepSeek Day 1 sample `tmp/class-trial-day1-verification-1780213850241.md`: 9 speeches, fallback 0, templateHits 0, repeatedPressureTerms 4, nameRefs 9, Enoshima analyst signals 1, Fukawa Togami refs 1. The final observed `后置位的各位，等你们发言时` variant is covered by a post-sample regression.
- [x] Added `thinkingPortraitUrl` / `hasThinkingPortrait` to the local class-trial pack manifest model and complete-pack validation.
- [x] Generated 9 local ignored transparent thinking-pose PNGs under `local-assets/class-trial-pack/thinking-portraits` and updated ignored `manifest.json` to reference them.
- [x] Updated `ClassTrialGameTable` to show the speaker's thinking portrait while class-trial voice/text preparation is loading/waiting, then use the normal portrait for spoken playback.
- [x] Added visible `1号` through `9号` badges to all class-trial podiums.
- [x] Added class-trial-themed host/system cue keys while reusing existing Werewolf broadcast clips.
- [x] Preserved Monokuma's distinctive short laugh in Japanese TTS rewrite (`噗/噗噗` -> `うぷぷ`), instead of treating it as removable filler.
- [x] Added Day 2+ class-trial guidance and validation to block repeat self-introductions, and removed `我是...` from the class-trial lens fallback prefix.
- [x] Follow-up tightened self-introduction policy from “Day 2+ no intro” to “only first-day morning can naturally introduce”; later class-trial speech explicitly says the first-day introduction window has ended.
- [x] Follow-up removed the generic “可以按座位名报自己是谁” speech prompt and added anti-template guidance for `身份-信息-站边-票口` flow, `我是闭眼好人`, and `信息不多先听后置`.
- [x] Follow-up class-trial validation rejects generic Werewolf speech openings as `学级裁判发言过于模板化`.
- [x] Follow-up speech contract now carries Day 2+ no-self-introduction plus anti-`身份-信息-站边-票口` / `我是闭眼好人` bans in `speechContract.mustNotAsk`, the highest-priority LLM constraint.
- [x] Follow-up lens audit proves all 9 fixed class-trial characters receive distinct behavior-lens cadence and推进动作 guidance rather than one shared Werewolf template.
- [x] Follow-up fallback speech no longer opens Day 2+ class-trial fallback lines with a display-name beat like `雾切响子。`, while keeping role-specific emotion/logic.
- [x] Follow-up class-trial last words no longer start from `我是角色名`, while keeping 江之岛 anger/绝望 and 雾切无奈/理性.
- [x] Follow-up local 黑白熊 persona wording no longer says “仍像狼人杀玩家发言”; it now anchors him to public evidence and vote pressure.
- [x] Added class-trial last-words candidates with role emotion: 江之岛盾子 angry/dramatic, 雾切响子 resigned but rational, and no old generic `我出局前留核心视角` fallback.
- [x] Chrome headless smoke on `http://localhost:51625` confirmed ready local assets/personas, 9 visible seat numbers, 9 local avatars, and a real Day 1 speech-preparation DOM state using a thinking portrait URL with `data-portrait-state="thinking"`.
- [x] Added `getClassTrialDialogueFrameByProgress` for mapping audio progress to class-trial dialogue frames.
- [x] Added AI speech playback helpers for loading state, real `currentTime / duration` progress, and active-run guarded status patching.
- [x] Extended `AiSpeechAudioStatus` with optional playback progress fields and added table-facing `ClassTrialAudioTypewriterState`.
- [x] Updated `ClassTrialGameTable` to consume live AI speech and active audio typewriter state.
- [x] Kept the dialogue on full `正在思考/准备发言。` while GPT-SoVITS audio is generating.
- [x] Let active audio speaker state temporarily own the class-trial speaking focus after the game advances to the next speaker.
- [x] Updated `GameClient` to publish streaming TTS loading state and real audio playback progress into the class-trial table.
- [x] Added audio preparation stages for class-trial loading: `正在调取证言。`, `正在生成语音。`, and `准备播放。`.
- [x] Added a tiny prepared-audio promise cache keyed by speech key, with rejection cleanup.
- [x] Updated `GameClient` to start class-trial speech audio preparation before the delayed playback handoff and reuse the same promise when playback starts.
- [x] Added class-trial audio lookahead guards for single-`continue` start conditions, completed-key selection, and active-run consumption.
- [x] Added `submitContinueCommand` for non-streaming background continue requests.
- [x] Updated `GameClient` to start background class-trial lookahead after current speech audio playback begins; if the first background continue only reaches the next waiting speaker, it continues once more to generate that speaker's speech before prewarming audio.
- [x] Added active GPT-SoVITS weight tracking keyed by normalized base URL.
- [x] Skips repeated `/set_gpt_weights` and `/set_sovits_weights` calls when the same GPT/SoVITS paths are already active.
- [x] Returns per-control-endpoint `durationMs` and `skipped` flags from `switchGptSoVitsWeights`.
- [x] Logs sanitized `[class-trial-gpt-sovits]` timing JSON from `/api/ai-speech-audio` for rewrite, switch, TTS, write, cache-hit, skipped flags, and total request time.
- [x] Added class-trial rewrite metadata modes: `fast`, `cache`, and `llm`.
- [x] Added safe local rewrite templates for short explanation, vote, suspicion, and contradiction lines.
- [x] Added a process-local rewrite cache keyed by role id plus normalized Chinese source text.
- [x] Added `rewriteMode` to class-trial GPT-SoVITS timing logs.
- [x] Added effective AI runtime resolution that forces `class-trial` theme mode onto `llm` even when stored global runtime is `mock`.
- [x] Selecting `学级裁判主题局` now stores `llm` as the local AI runtime mode.
- [x] The home theme card and class-trial table chrome now display `真实 LLM · DeepSeek-v4`.
- [x] Class-trial visible continue and background audio-lookahead continue calls now send the effective runtime mode.
- [x] Class-trial fixed characters now keep character role cards and display names while using DeepSeek as the single base game brain.
- [x] Class-trial action repair attempts stay on DeepSeek instead of rotating to GPT/Claude/GLM persona fallbacks.
- [x] Class-trial speech repair attempts stay on DeepSeek instead of rotating to GPT/Claude/GLM persona fallbacks.
- [x] Root-caused empty DeepSeek outputs to `max_tokens` exhaustion: the provider returned `finish_reason: "length"`, all completion tokens as `reasoning_tokens`, and empty `message.content`.
- [x] A/B probe showed DeepSeek `thinking: disabled` is better for class-trial action/speech than continuing to raise token floors.
- [x] Set DeepSeek action/speech defaults to `thinking: disabled` with a normal 900 token floor.
- [x] Added regression tests proving DeepSeek action/speech send `thinking: disabled` while preserving the normal budget.
- [x] Ran a real routed DeepSeek probe that returned non-empty action and speech JSON text without printing secrets.
- [x] Added an exclusive GPT-SoVITS synthesis queue around weight switching and TTS generation.
- [x] Added a class-trial current-speaker voice prewarm cue using a short safe fast-rewrite line.
- [x] Updated `GameClient` to fire invisible prewarm requests while class-trial is waiting for the current AI speaker's `continue`.
- [x] Added deferred class-trial streaming chunk loading so local TTS chunks are not all generated at once.
- [x] Direct route smoke with Tomori and Kirigiri class-trial role cards returned `provider: gpt-sovits` wav URLs and serialized timing logs.
- [x] Root-caused 苗木诚 mid-speech gaps to per-chunk LLM Japanese voice rewrite latency rather than repeated GPT-SoVITS weight switching.
- [x] Added a whole-speech TTS chunk mode and enabled it for class-trial visible continues, so the dialogue can stream as text while audio is generated once from the final speech.
- [x] Kept ordinary/non-theme streaming TTS on the existing stable chunk behavior.
- [x] Strengthened class-trial role-card speech guidance so characters avoid generic Werewolf templates and use their role-card performance style within the same public-information boundary.
- [x] Added class-trial timed visible text fallback when an unplayed TTS request fails, so speakers like 江之岛盾子 are not marked complete and skipped silently.
- [x] Prevented class-trial transient TTS 503/unavailable errors from flipping the global AI speech unavailable switch.
- [x] Split long class-trial dialogue into compact cumulative frames, including punctuation-light lines, to avoid sudden large text dumps.
- [x] Tuned class-trial speech contracts to 3 sentences / 260 chars and added named performance cues for key characters.
- [x] Preserved richer role-card fields through `/api/ai-speech-audio` into Japanese rewrite.
- [x] Added 千早爱音 Japanese rewrite guidance and validation so filler words are rare and placed outside seat/check/vote target fragments.
- [x] Added deterministic `rewriteMode:"local"` for complex class-trial public-logic speeches before slower LLM rewrite.
- [x] Root-caused a 76s 苗木诚 first-line wait to LLM Japanese rewrite and reduced the same text to about 6.3s through local rewrite.
- [x] Added role-specific class-trial fallback speech so rejected character speeches no longer degrade into generic Werewolf table templates.
- [x] Added a reusable class-trial character lens module for the fixed 9-character roster.
- [x] White-day class-trial speech input now carries character attention bias, pressure move, vote-rationale style, cadence, and forbidden-template signals.
- [x] Class-trial character lens is now soft LLM director guidance rather than keyword-based speech validation.
- [x] Obvious class-trial generic templates remain blocked by the baseline style guard, while DeepSeek can freeplay without lens keyword matching.
- [x] Class-trial fallback speech still uses the same role lens when bottom-line validation fails.
- [x] Day-vote action input now carries vote-rationale lens guidance while private night action input remains unaffected.
- [x] Follow-up persona pass expands the class-trial lens into a per-role `狼人杀打法卡` for all 9 fixed characters: read priority, pressure method, vote/action logic, villager/wolf/power-role play, night bias, and last-words mode.
- [x] Class-trial action input now carries that strategy lens in all class-trial phases, including private night actions, instead of only Day Vote.
- [x] Same-DeepSeek speech repair now rejects generic no-stance/no-ticket/evidence-gap or low-info report lines when they lack the current character's lens signal, plus abnormal repeated question-mark placeholders.
- [x] Class-trial speech repair now preserves LLM freeplay and only fixes the validation issue, instead of converting characterful output into template fallback wording.
- [x] Class-trial speech guidance now includes a soft anti-repeat cue so later speakers avoid repeating the same abstract criticism with a different seat number.
- [x] Class-trial character lens now includes role-specific transformation examples that show how the same table material should become different角色推进动作 without fixed scripts.
- [x] Class-trial speech input now adds dynamic director guidance when recent seats repeatedly circle `没给结论/验证方向`, `镜像攻击`, or `平安夜复读`.
- [x] Dynamic director guidance now also catches repeated `没给站边/票口` and `干净模板/后置责任` motifs found in production-preview text samples.
- [x] Production-preview text sample `64183909-65b9-44f2-9c35-4a3b89692904` generated 9 Day 1 speeches in about 75s and exposed the `没给站边/票口` repetition gap.
- [x] Production-preview text sample `309698cb-5ffc-40d6-af6d-c349b849fbd2` generated 9 Day 1 speeches in about 64s, with better role pressure shifts and one 高松灯 fallback.
- [x] Browser audio/typewriter QA on production preview reproduced the visible skip/jump risk around audio/text playback and verified the follow-up fix on `http://127.0.0.1:51627`.
- [x] Class-trial auto-advance now pauses while audio/text typewriter state is active, so fallback text has time to display before the table moves to the next speaker.
- [x] Audio-disabled class-trial continues now start timed text playback for the generated speech instead of silently jumping to the next current speaker.
- [x] Long class-trial dialogue reveal frames were tightened to smaller/faster cumulative chunks, and implausibly short audio no longer drives a long line's synced text reveal.
- [x] Added class-trial speech-order guidance and validation so unspoken seats cannot be prematurely labeled as more trusted, suspicious, wolfy, focused, or vote targets unless there is public hard info.
- [x] Added a class-trial low-info opener guard so first speakers cannot stop at “no information/no reference point” without leaving a concrete verifiable hook.
- [x] Added already-spoken seat validation for direct process demands across sentence boundaries, covering live wording like “1号……；你这一轮给过程”.
- [x] Ran a new production-preview text sample on `http://127.0.0.1:51629`: game `89c345c8-b272-457f-b4f1-244a53c8c597` generated the first four Day 1 speeches in about 39s; 苗木诚 left a共同验证断点, 雾切响子 only reviewed 1号原话, and 腐川冬子 did not prematurely信任9号.
- [x] Tightened class-trial long-speech frames to 4 display chars and capped audio-synced reveal by readable wall-clock progress.
- [x] Kept class-trial typewriter state alive after audio `ended` until readable tail time catches up, then held the completed line briefly before handoff.
- [x] Browser QA on `http://127.0.0.1:51629` confirmed game `bb78bcca-e25b-4ea5-a1a5-363bb2f3846b` displayed the complete normalized 69-char 苗木诚 first speech before switching to 雾切响子.
- [x] Root-caused no-sound in the production preview to generated `/audio/ai-speech/*.wav` files returning 404 under `next start`.
- [x] Added a dynamic AI speech audio cache route at `/audio/ai-speech/[fileName]` for runtime-generated mp3/wav files.
- [x] Restarted `next start -p 51629`; latest generated wav URLs now return 200 with `Content-Type: audio/wav`.
- [x] Added class-trial speech validation for prompt/meta leakage such as `通用观察`, `发言对比点`, `对话链`, `缺口先记下`, and template-material demands to unspoken later seats.
- [x] Added class-trial last-words validation so LLM custom遗言 cannot reintroduce the speaker with `我是角色名`; this covers the observed `噗噗，我是黑白熊` regression while preserving `噗噗`.
- [x] Rebuilt and restarted local `next start -p 51625`; app `/` returned 200 after restart.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Vote projection red-green | `npm run test -- src/game/engine.test.ts -t "keeps votes private until resolution reveals tally and public vote reasons"` | failed first, then passed | Red failure showed no locked/pending progress existed; green pass keeps targets/reasons/tally hidden and exposes only sealed progress. |
| Vote presenter/table/phase tests | `npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts` | passed | Covers sealed HUD, one-shot reveal, table seat chips/focus, and updated phase copy. |
| Vote focused regression pack | `npm run test -- src/game/engine.test.ts src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialPhaseScenes.test.ts src/components/game/PhaseCurtain.test.ts src/components/game/gamePanelsMobile.test.ts` | passed | 6 files / 170 tests. |
| Vote lint/type/build | `npm run lint`; `npx tsc --noEmit`; `npm run build` | passed | Build passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Vote harness and whitespace | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-vote-visualization.md`; `npm run harness:check`; `git diff --check` | passed | `git diff --check` reported CRLF warnings only. |
| Vote browser QA | `http://127.0.0.1:51631` | passed | Sealed `DAY_VOTE` fixture showed `封票中`, `3 / 9`, per-seat locked/waiting labels, and no target ledger; reveal path showed `开票揭示`, tally rows, voter ledger, and focus seat. Port 3000 was occupied by another local app. |
| Vote burst focused tests | `npm run test -- src/components/game/classTrialVoteStage.test.ts src/components/game/classTrialGameTable.test.ts` | passed | Covers no-exile verdict, burst overlay hooks, sealed privacy assertions, and table-level no-focus guard. |
| Vote burst browser QA | `http://127.0.0.1:51631` | passed | Confirmed sealed `TRIAL VOTE` / `封票开始`, readable sealed status with no target leak, public exile spotlight with focus seat 6, and no-exile `未达成处刑` with focus count 0. |
| Speech de-template red-green | `npm run test -- src/ai/speechProviders.test.ts -t "universal de-template\|ordinary empty-template"` | failed first, then passed | Red failure showed ordinary speech input lacked `通用去模板` and ordinary empty-template chains returned `[]`; green pass followed shared guidance and validation. |
| Speech de-template focused tests | `npm run test -- src/ai/speechProviders.test.ts src/ai/tableRead.test.ts` | passed | 2 files / 113 tests; one false positive around legitimate `等后置位发言看有没有人接线` wording was found and fixed by narrowing ordinary validation. |
| Speech de-template lint/type/build | `npm run lint`; `npx tsc --noEmit`; `npm run build` | passed | Build passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Speech de-template harness | `npm run harness:task-card -- docs/tasks/2026-05-speech-de-template-persona-layer.md`; `npm run harness:check`; `git diff --check` | passed | `git diff --check` reported CRLF warnings only. |
| Role pressure/addressing red-green | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts -t "Ultimate Analyst\|Fukawa strongly\|role-specific repeated abstract pressure\|name-aware\|public references"` | failed first, then passed | Red failures covered missing Enoshima analyst framing, missing Fukawa/Togami bias, missing role-specific abstract-pressure guide, and missing name-aware public references. |
| Role pressure/addressing focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` | passed | 2 files / 106 tests after preserving existing Enoshima `反应差` / `矛盾` / `放大` expectations. |
| Role pressure/addressing text sample | `tmp/class-trial-day1-real-role-pressure-addressing-1780156628228.md` | passed with subjective caveat | Real DeepSeek sample generated 9/9 speeches, fallback 0/9, templateHits 0, repeated pressure terms 3, nameRefs 10. Final Enoshima analyst-first nudge was added after this sample and covered by tests, not a second real sample. |
| Opening persona follow-up red-green | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts -t "low-info opening\|generic audit frames\|final class-trial speakers"` and `npm run test -- src/ai/speechProviders.test.ts -t "greet and restate peace night\|Fukawa low-info\|Enoshima low-info\|all later seats"` | failed first, then passed | Red failures reproduced missing low-info opening moves, missing opening director, generic audit frames, final-speaker future wait, greeting-only平安夜, missing Fukawa/Togami emotion, missing Enoshima analyst structure, and waiting for all later seats. |
| Opening persona focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` | passed | 2 files / 114 tests before the fresh-sample fallback/hard-info follow-up. |
| Opening persona fallback/hard-info red-green | `npm run test -- src/ai/speechProviders.test.ts -t "class-trial low-info.*fallback"`; `npm run test -- src/ai/speechProviders.test.ts -t "future voting review"`; `npm run test -- src/ai/tableRead.test.ts -t "future voting-review"` | failed first, then passed | Red failures covered class-trial low-info fallback pressuring unspoken 2号雾切, 腐川 fallback missing 十神, and `投票时形成闭环` closing the low-info layer too early. |
| Opening persona fresh focused tests | `npm run test -- src/ai/tableRead.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts` | passed | 3 files / 141 tests. |
| Opening persona real DeepSeek sample | `node tmp/verify-class-trial-role-pressure.mjs` | passed with fallback caveat | `tmp/class-trial-day1-verification-1780195573037.md`: 9/9 DeepSeek speeches, fallback 3/9 via role-specific fallback, templateHits 0, repeatedPressureTerms 4, nameRefs 11, Enoshima analyst signals 1, Fukawa Togami refs 1. |
| Class-trial prompt-leak red-green | `npm run test -- src/ai/speechProviders.test.ts -t "prompt terms leaking\|audit-template chains"` and `npm run test -- src/ai/actionProviders.test.ts -t "reintroduce the speaker"` | passed | Speech guard tests first failed on prompt/meta leakage and later passed; last-words self-intro test first failed with empty errors, then passed after validation. |
| Class-trial prompt-leak focused tests | `npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts` | passed | 3 files / 125 tests; covers the new speech leak guards plus the Monokuma last-words self-intro guard. |
| Class-trial prompt-leak TypeScript/lint | `npx tsc --noEmit`; `npx eslint src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts` | passed | No output from either command. |
| Class-trial prompt-leak build/restart health | `npm run build`; restart `next start -p 51625`; `Invoke-WebRequest -UseBasicParsing http://localhost:51625/` | passed | Build passed with the existing Turbopack NFT trace warning; restarted listener PID 43152 returned StatusCode 200. |
| Follow-up speech contract tests | `npm run test -- src/ai/speechProviders.test.ts -t "speech contract"` and `npm run test -- src/ai/speechProviders.test.ts -t "class-trial role"` | passed | Red-green covered class-trial no-self-introduction/template bans inside `speechContract.mustNotAsk` and distinct behavior lenses for all 9 fixed roles. |
| Follow-up Day 2 fallback test | `npm run test -- src/ai/speechProviders.test.ts -t "fallback speeches reopen"` | passed | Failed first on `雾切响子。...`; passed after Day 2+ class-trial fallback stopped opening with display names. |
| Follow-up self-intro/template tests | `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/ai/classTrialCharacterLens.test.ts` | passed | 3 files / 120 tests; covers first-day-only self-intro guidance, speech-contract template bans, generic Werewolf opening rejection, role lens protection, Day 2+ no-name fallback, and last words without `我是角色名` fixed openings. |
| Follow-up audio/table tests | `npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialGameTable.test.ts` | passed | 2 files / 48 tests; covers 1000ms final text hold and class-trial table rendering. |
| Follow-up personas JSON smoke | `node -e "JSON.parse(require('fs').readFileSync('local-assets/class-trial-pack/personas.json','utf8')); console.log('personas ok')"` | passed | Confirms ignored local personas JSON remains parseable after the Monokuma wording update. |
| Follow-up TypeScript | `npx tsc --noEmit` | passed | No output. |
| Follow-up targeted lint | `npx eslint src/ai/speechProviders.ts src/ai/speechProviders.test.ts src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/classTrialCharacterLens.ts src/ai/classTrialCharacterLens.test.ts` | passed | No output. |
| Thinking/persona focused tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/hostAudioCues.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialSpeechRewrite.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 7 files / 172 tests; covers thinking portrait model/rendering, seat numbers, class-trial host cue keys, Monokuma rewrite, Day 2+ no self-intro, and class-trial last words. |
| Thinking portrait asset smoke | `node -e "...manifest asset check..."` and alpha/contact-sheet validation | passed | Manifest resolved all 9 avatar/portrait/thinking files; alpha validation passed 9 transparent thinking portraits. |
| Thinking/persona TypeScript | `npx tsc --noEmit` | passed | Fixed test setup to use `lastWordsSeatId` instead of view-only `currentActorSeatId`. |
| Thinking/persona lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Thinking/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Thinking/persona task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-thinking-persona-polish.md` | passed | Task gate passed. |
| Thinking/persona harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Thinking/persona whitespace | `git diff --check` | passed | CRLF warnings only. |
| Thinking/persona browser smoke | Chrome headless CDP on `http://localhost:51625` | passed | Selected `学级裁判主题局`, entered 9p AI-only spectator, confirmed 9 podium numbers and 9 local avatars; after advancing to Day 1 speech, DOM showed `/class-trial-pack/thinking-portraits/%E8%8B%97%E6%9C%A8%E8%AF%9A.png` with `data-portrait-state="thinking"`. |
| Focused audio-sync tests | `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | 3 files, 37 tests. |
| Focused audio-lookahead tests | `npm run test -- src/components/game/classTrialAudioLookahead.test.ts src/components/game/gameClientRequests.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | 5 files, 51 tests. |
| Lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| TypeScript | `npx tsc --noEmit` | passed | No output. |
| Build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-latency.md` | passed | New latency task card passes the harness gate. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| GPT-SoVITS health | `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` | passed | StatusCode 200. |
| Browser flow | `http://127.0.0.1:51625` | partial pass | Class-trial 9p AI-only, AI speech enabled; dialogue immediately showed `正在生成语音。`, later showed `正在调取证言。` / `正在生成语音。`, and fresh `naegi` / `kirigiri` wav files appeared. Partial audio-progress reveal was not captured reliably by automation. Screenshot capture timed out. |
| Browser audio-lookahead flow | `http://127.0.0.1:51625` | passed with timing caveat | Controls stayed disabled during audio/buffered playback. A very short first speech still left visible generation on the second speaker; the longer second speech gave the third speaker enough lookahead time to enter directly with full dialogue. Screenshot saved at `tmp/class-trial-audio-lookahead-smoke.png`. |
| GPT-SoVITS latency tests | `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | 2 files, 7 tests. Red-green failures were observed before implementation for the missing cache/timing API and missing timing log. |
| GPT-SoVITS latency task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-latency.md` | passed | New backend latency task card passes the harness gate. |
| Direct latency route smoke | `POST http://127.0.0.1:51625/api/ai-speech-audio` | passed | Two same-role 高松灯/Tomori requests returned `provider: gpt-sovits`: `latency-smoke:20260528225927:1` -> `/audio/ai-speech/tomori-1fbc2cd4c7e2aaf14abcaf51.wav` in 10046ms; `latency-smoke:20260528225927:2` -> `/audio/ai-speech/tomori-6cf79401120b7e52341978a0.wav` in 4981ms. |
| Timing log diagnosis | `tmp/dev-51625-restart.log` | passed | Five real GPT-SoVITS route samples averaged 7032ms total: rewrite 5101ms / 72.5%, switch 263ms / 3.7%, TTS 1664ms / 23.7%, write 2ms. Same-weight samples skipped both switch endpoints; the one new-role Kirigiri sample spent 1313ms on weight switching. |
| Rewrite fast-path tests | `npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | 2 files, 8 tests. Red-green failures were observed before implementation for the missing metadata API/cache helper and missing `rewriteMode` log field. |
| Rewrite fast-path lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Rewrite fast-path TypeScript | `npx tsc --noEmit` | passed | No output. |
| Rewrite fast-path build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Direct rewrite fast route smoke | `POST http://127.0.0.1:51625/api/ai-speech-audio` | passed | `rewrite-fast-smoke:20260528235235:tomori` returned `provider: gpt-sovits` in 3014ms; log showed `rewriteMode:"fast"`, `rewriteMs:0`, `switchMs:1484`, `ttsMs:1319`, `totalMs:2806`. Second same-text request returned in 1053ms; log showed `rewriteMode:"cache"`, `rewriteMs:1`, `switchMs:0`, `ttsMs:965`, `totalMs:968`. |
| LLM runtime focused tests | `npm run test -- src/components/game/aiFriendStorage.test.ts src/components/game/gamePanelsMobile.test.ts src/components/game/classTrialGameTable.test.ts` | passed | 3 files, 37 tests. Red failures were observed first for the missing helper and missing status copy. |
| LLM runtime lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| LLM runtime TypeScript | `npx tsc --noEmit` | passed | No output. |
| LLM runtime build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| LLM runtime browser smoke | `http://127.0.0.1:51625` | passed | Home card showed `真实 LLM · DeepSeek-v4 主脑`; themed table showed `真实 LLM · DeepSeek-v4`. |
| LLM runtime model smoke | Prisma `AiCallLog` for `8943cd42-566f-411f-8c78-6795cc4cefdd` | passed | Logged real model attempt `deepseek-action:deepseek-v4-flash`, so class-trial start is no longer mock-only. |
| LLM runtime task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-llm-runtime.md` | passed | Task gate passed. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| DeepSeek brain focused tests | `npm run test -- src/components/game/classTrialTheme.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` | passed | 3 files, 104 tests. Red failures were observed first for mixed base personas and GPT fallback repair attempts. |
| DeepSeek brain lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| DeepSeek brain TypeScript | `npx tsc --noEmit` | passed | No output. |
| DeepSeek brain build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| DeepSeek brain task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-brain.md` | passed | Task gate passed. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| DeepSeek browser/live model smoke | `http://127.0.0.1:51625` plus Prisma `AiCallLog` for `6010e73b-e191-4d53-a3ca-9efc2f939c95` | passed with quality caveat | UI showed `真实 LLM · DeepSeek-v4 主脑`; observed action repair attempts used `deepseek-action:deepseek-v4-flash` only and an observed speech repair attempt used `deepseek-speech:deepseek-v4-flash` only. Several DeepSeek attempts had empty extracted content, so local fallback still occurred after same-model retries. |
| DeepSeek thinking-budget red-green tests | `npm run test -- src/ai/modelLlms.test.ts` | passed | Failed first because DeepSeek action/speech did not both send `thinking: disabled`; passed after implementation. |
| Focused DeepSeek token-budget tests | `npm run test -- src/ai/modelLlms.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts` | passed | 3 files, 102 tests. |
| Real routed DeepSeek token-budget probe | Vite `ssrLoadModule('/src/ai/modelLlms.ts')` | passed | Action with `maxTokens: 220` returned non-empty `deepseek-action:deepseek-v4-flash` text; speech with `maxTokens: 900` returned non-empty `deepseek-speech:deepseek-v4-flash` text. |
| Narrow class-trial real loop | engine-level Vite script with fixed class-trial AI friends | passed with latency caveat | 8 LLM calls, DeepSeek-only providers, fallback count 0, empty first-attempt count 3, recovered on second DeepSeek attempt; reached Day 1 `DAY_SPEECH` in about 248s. |
| DeepSeek thinking A/B | direct provider and routed speech probes | passed | Action `thinking: disabled` returned non-empty JSON in about 3s. Real class-trial speech with `thinking: disabled` plus 900 tokens returned non-empty speech in about 4.5s. |
| Follow-up narrow class-trial real loop | engine-level Vite script with fixed class-trial AI friends | passed | 5 LLM calls, DeepSeek-only providers, fallback count 0, empty attempt count 0, retry count 1 for speech validation, duration about 29s. |
| DeepSeek token-budget lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| DeepSeek token-budget TypeScript | `npx tsc --noEmit` | passed | No output. |
| DeepSeek token-budget build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| DeepSeek token-budget task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-deepseek-token-budget.md` | passed | Task gate passed. |
| Harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whitespace | `git diff --check` | passed | CRLF warnings only. |
| GPT-SoVITS prewarm red-green tests | `npm run test -- src/server/gptSoVitsTts.test.ts` and `npm run test -- src/components/game/aiSpeechAudio.test.ts` | passed | Failed first for missing exclusive synthesis queue, prewarm cue, and deferred chunk loading; passed after implementation. |
| GPT-SoVITS prewarm focused tests | `npm run test -- src/server/gptSoVitsTts.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts` | passed | 3 files, 22 tests. |
| GPT-SoVITS prewarm TypeScript | `npx tsc --noEmit` | passed | No output. |
| GPT-SoVITS prewarm lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| GPT-SoVITS prewarm build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| GPT-SoVITS prewarm task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md` | passed | Task gate passed. |
| GPT-SoVITS prewarm harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from class-trial slices. |
| GPT-SoVITS prewarm whitespace | `git diff --check` | passed | CRLF warnings only. |
| GPT-SoVITS health | `Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8` | passed | StatusCode 200. |
| Direct prewarm route smoke | `POST http://127.0.0.1:51625/api/ai-speech-audio` | passed | Concurrent Tomori and Kirigiri class-trial role-card requests returned `provider: gpt-sovits`; logs completed at about 2531ms and 5101ms total in serialized order. |
| Whole-speech TTS focused test | `npm run test -- src/components/game/aiSpeechAudio.test.ts` | passed | Red failure first showed whole-speech mode still loaded two chunks during `push`; passed after adding `chunkMode: "whole-speech"`. |
| Persona speech focused test | `npm run test -- src/ai/speechProviders.test.ts` | passed | Red failure first showed class-trial role-card guide lacked anti-template/persona-performance lines; passed after strengthening the guide. |
| Whole-speech/persona TypeScript | `npx tsc --noEmit` | passed | No output. |
| Whole-speech/persona lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Whole-speech/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| Local app health | `Invoke-WebRequest http://127.0.0.1:51625/` and `/alpha-health` | passed | Both returned 200 OK. Browser automation tool was not exposed in this turn, so no new screenshot/listening smoke was captured. |
| Whole-speech/persona task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md` | passed | First run failed for a missing `## Context To Read First`; passed after adding the section. |
| Whole-speech/persona harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Whole-speech/persona whitespace | `git diff --check` | passed | CRLF warnings only. |
| No-skip/typewriter/persona red-green tests | `npm run test -- src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/speechProviders.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | First failed for missing compact frames, class-trial text fallback helpers, anti-template contract, Anon filler guard, and dropped route role-card fields; latest focused run passed, 5 files / 105 tests. |
| Follow-up local rewrite tests | `npm run test -- src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts` | passed | Added deterministic local rewrite coverage for complex class-trial public-logic lines and preserved route timing metadata. |
| Follow-up persona/fallback tests | `npm run test -- src/ai/speechProviders.test.ts` | passed | Covered the tuned 3-sentence / 260-char class-trial contract and role-specific class-trial fallback speech. |
| Live API/log regression | game `68d9b996-e4f3-4518-b0e0-e146ac7c6328` plus `POST /api/ai-speech-audio` | passed with listening caveat | 苗木诚 first sample took about 76.3s with `rewriteMode:"llm"` / `rewriteMs:63779`; same text after local rewrite took about 6.3s with `rewriteMode:"local"` / `rewriteMs:0`. 江之岛盾子 generated GPT-SoVITS audio in about 5.1s instead of being skipped in this path. |
| No-skip/typewriter/persona TypeScript | `npx tsc --noEmit` | passed | No output. |
| No-skip/typewriter/persona lint | `npm run lint` | passed | 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| No-skip/typewriter/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains. |
| Latest local app health | `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:51625/` and `/alpha-health` | passed | Both returned 200. Browser automation was not exposed and local Playwright was missing, so no new screenshot/listening smoke was captured. |
| Red-green class-trial director tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts` and `npm run test -- src/ai/speechProviders.test.ts -t "dynamic class-trial director guidance"` | passed | First failed for missing role-specific transformation examples and missing dynamic repeated-focus guidance, then passed after implementation. |
| Class-trial production-preview text sample | game `64183909-65b9-44f2-9c35-4a3b89692904` on `http://127.0.0.1:51627` | passed with quality caveat | 9 Day 1 speeches in about 75s. Better role separation than the previous full sample, but repeated `没给站边/票口` pressure did not trigger the first dynamic motif set. |
| Class-trial production-preview text sample | game `309698cb-5ffc-40d6-af6d-c349b849fbd2` on `http://127.0.0.1:51627` | passed with one fallback caveat | 9 Day 1 speeches in about 64s. Pressure shifted more naturally from 1号 to 3号/2号; one 高松灯 speech fell back after validation retry. |
| Class-trial character lens focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 3 files, 110 tests. |
| Class-trial strategy-card follow-up | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 3 files / 122 tests; covers per-role `狼人杀打法卡`, all-phase class-trial action strategy input, generic template repair guards, and abnormal question-mark rejection. |
| Class-trial strategy-card TypeScript/lint | `npx tsc --noEmit`; `npx eslint src/ai/classTrialCharacterLens.ts src/ai/speechProviders.ts src/ai/actionProviders.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | No output. |
| Class-trial strategy-card live provider sample | Vite SSR routed DeepSeek sample | partial pass | Returned `deepseek-speech:deepseek-chat`, `isFallback:false`, and prompt contained `狼人杀打法卡` plus the role-action rule. PowerShell inline-script Chinese context produced placeholder artifacts, so this is provider/prompt evidence, not final dialogue-quality evidence. |
| Class-trial character lens TypeScript | `npx tsc --noEmit` | passed | No output. |
| Class-trial character lens lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Class-trial character lens build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Class-trial LLM freeplay smoke | game `e38aeb06-a684-40f3-88ba-a41035a32d0a` via `POST /api/games` and repeated `continue` with `aiRuntimeMode: "llm"` | passed with one fallback caveat | Generated 5 Day 1 speeches; 4 of 5 speech logs were non-fallback DeepSeek outputs. The only fallback came from the existing already-spoken-player guard, not character-lens validation. |
| Class-trial full Day 1 LLM sample | game `60f17301-15c4-41a9-a134-7c2adba47c92` via `POST /api/games` and repeated `continue` with `aiRuntimeMode: "llm"` | passed with quality caveat | Generated 9 of 9 Day 1 class-trial speeches as non-fallback DeepSeek speech outputs. Later seats still repeated some abstract pressure themes, which led to the soft anti-repeat prompt. |
| Class-trial anti-repeat smoke | game `ca0d5a71-261c-4d47-87b1-877c7336a77a` via `POST /api/games` and repeated `continue` with `aiRuntimeMode: "llm"` | partial pass | Exercised the new anti-repeat prompt path for the first four Day 1 speakers. Two later sampled fallbacks came from transient DeepSeek `fetch failed` provider errors, not character-lens validation. |
| Class-trial character lens health | `Invoke-WebRequest` against app `/`, app `/alpha-health`, and GPT-SoVITS `/openapi.json` | passed | All three returned StatusCode 200. |
| Class-trial character lens task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-character-lens.md` | passed | Task gate passed. |
| Class-trial character lens harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Class-trial character lens whitespace | `git diff --check` | passed | CRLF warnings only. |
| Audio/typewriter focused tests | `npm run test -- src/components/game/classTrialGameTable.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/autoAdvance.test.ts` | passed | 4 files / 54 tests. |
| Audio/typewriter TypeScript | `npx tsc --noEmit` | passed | No output. |
| Audio/typewriter lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Audio/typewriter build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Browser audio/typewriter QA | `http://127.0.0.1:51627` | partial pass | AI speech enabled: 苗木诚 wait -> text reveal -> 雾切响子 handoff without silent skip. AI speech off: death seats still showed `已退场`, and 苗木诚 timed text fallback appeared instead of immediate skip. Long trace timed out before preserving a full black-white-bear transcript. |
| Speech-order/persona guard red-green | `npm run test -- src/ai/speechProviders.test.ts` | passed | First failed for missing unspoken-seat trust guard, missing opener hook validation, and missing already-spoken direct-demand validation; latest run passed 1 file / 76 tests. |
| Speech-order/persona focused tests | `npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts` | passed | 3 files / 112 tests. |
| Speech-order/persona TypeScript | `npx tsc --noEmit` | passed | No output. |
| Speech-order/persona lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Speech-order/persona build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Speech-order/persona local health | `Invoke-WebRequest` against `http://127.0.0.1:51629/`, `/alpha-health`, and GPT-SoVITS `/openapi.json` | passed | All returned StatusCode 200. |
| Speech-order/persona live text sample | game `89c345c8-b272-457f-b4f1-244a53c8c597` on `http://127.0.0.1:51629` | passed with subjective caveat | First four Day 1 speeches generated in about 39s; the earlier no-hook opener, already-spoken direct demand, and `更信9号` issues did not recur. |
| Audio/typewriter follow-up tests | `npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts` | passed | 4 files / 58 tests. Covered readable wall-clock caps, ended-audio tail progress, final text hold, active-theme sync without role-card metadata, and 4-char long-speech frames. |
| Audio/typewriter follow-up lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| Audio/typewriter follow-up TypeScript | `npx tsc --noEmit` | passed | No output. |
| Audio/typewriter follow-up build | `npm run build` | passed | Existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| Audio/typewriter follow-up task card | `npm run harness:task-card -- docs/tasks/2026-05-class-trial-audio-synced-typewriter.md` | passed | Task gate passed. |
| Audio/typewriter follow-up harness | `npm run harness:check` | passed | Mechanical checks passed; worktree remains dirty from this and earlier class-trial slices. |
| Audio/typewriter follow-up whitespace | `git diff --check` | passed | CRLF warnings only. |
| Audio/typewriter follow-up health | `Invoke-WebRequest` against `http://127.0.0.1:51629/alpha-health` and GPT-SoVITS `/openapi.json` | passed | Both returned StatusCode 200. |
| Audio/typewriter follow-up browser QA | `http://127.0.0.1:51629` | passed with listening caveat | AI speech enabled; staged wait text and 4-char cumulative reveal were visible, and game `bb78bcca-e25b-4ea5-a1a5-363bb2f3846b` displayed the complete normalized 69-char 苗木诚 first speech before handoff to 雾切响子. |
| No-sound route red test | `npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts` | failed first, then passed | Red failure was missing `./route`; green pass covered mp3/wav cache path resolution, traversal blocking, and content types. |
| No-sound focused tests | `npm run test -- src/app/audio/ai-speech/[fileName]/route.test.ts src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialDialogue.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/classTrialAudioLookahead.test.ts` | passed | 5 files / 61 tests. |
| No-sound TypeScript | `npx tsc --noEmit` | passed | No output. |
| No-sound lint | `npm run lint` | passed | 0 errors; 3 existing warnings in `src/server/gptSoVitsTts.test.ts`. |
| No-sound build | `npm run build` | passed | Dynamic `/audio/ai-speech/[fileName]` route is included; existing Turbopack NFT trace warning remains for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`. |
| No-sound local route smoke | `Invoke-WebRequest` against `http://127.0.0.1:51629/audio/ai-speech/<latest>.wav` after restart | passed | Returned 200, `Content-Type: audio/wav`, `Content-Length: 825644`, `Accept-Ranges: bytes`. |

## Files Changed

- `src/game/types.ts`
- `src/game/projection.ts`
- `src/game/engine.test.ts`
- `src/components/game/ClassTrialVoteStage.tsx`
- `src/components/game/classTrialVoteStage.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialPhaseScenes.ts`
- `src/components/game/classTrialPhaseScenes.test.ts`
- `src/app/globals.css`
- `docs/superpowers/plans/2026-05-31-class-trial-vote-visualization.md`
- `docs/tasks/2026-05-class-trial-vote-visualization.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/hostAudioCues.ts`
- `src/components/game/hostAudioCues.test.ts`
- `src/components/GameClient.tsx`
- `src/app/globals.css`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `docs/tasks/2026-05-speech-de-template-persona-layer.md`
- `docs/tasks/2026-05-class-trial-role-pressure-addressing.md`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `docs/tasks/2026-05-class-trial-thinking-persona-polish.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `local-assets/class-trial-pack/personas.json` (ignored local data)
- `src/components/game/classTrialDialogue.ts`
- `src/components/game/classTrialDialogue.test.ts`
- `src/components/game/aiSpeechAudio.ts`
- `src/components/game/aiSpeechAudio.test.ts`
- `src/components/game/clientTypes.ts`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialAudioLookahead.ts`
- `src/components/game/classTrialAudioLookahead.test.ts`
- `src/components/game/gameClientRequests.ts`
- `src/components/game/gameClientRequests.test.ts`
- `src/components/GameClient.tsx`
- `src/components/game/aiFriendStorage.ts`
- `src/components/game/aiFriendStorage.test.ts`
- `src/components/game/LandingPanel.tsx`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/modelLlms.ts`
- `src/ai/modelLlms.test.ts`
- `src/server/gptSoVitsTts.ts`
- `src/server/gptSoVitsTts.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/app/api/ai-speech-audio/route.ts`
- `src/app/api/ai-speech-audio/route.test.ts`
- `src/app/audio/ai-speech/[fileName]/route.ts`
- `src/app/audio/ai-speech/[fileName]/route.test.ts`
- `docs/tasks/2026-05-class-trial-audio-latency.md`
- `docs/tasks/2026-05-class-trial-audio-lookahead.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-latency.md`
- `docs/tasks/2026-05-class-trial-rewrite-fast-path.md`
- `docs/tasks/2026-05-class-trial-llm-runtime.md`
- `docs/superpowers/plans/2026-05-29-class-trial-deepseek-brain.md`
- `docs/tasks/2026-05-class-trial-deepseek-brain.md`
- `docs/tasks/2026-05-class-trial-deepseek-token-budget.md`
- `docs/tasks/2026-05-class-trial-gpt-sovits-prewarm.md`
- `docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `docs/superpowers/specs/2026-05-29-class-trial-character-lens-design.md`
- `docs/superpowers/plans/2026-05-29-class-trial-character-lens.md`
- `docs/superpowers/plans/2026-05-28-class-trial-audio-latency.md`
- `docs/superpowers/plans/2026-05-28-class-trial-audio-lookahead.md`
- `docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-latency.md`
- `docs/superpowers/specs/2026-05-28-class-trial-rewrite-fast-path-design.md`
- `docs/superpowers/plans/2026-05-28-class-trial-rewrite-fast-path.md`
- `docs/tasks/2026-05-class-trial-audio-synced-typewriter.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Ignored/generated local-only files observed:

- `local-assets/class-trial-pack/manifest.json`
- `local-assets/class-trial-pack/thinking-portraits/*.png`
- `tmp/class-trial-thinking-keyed/*.png`
- `tmp/class-trial-thinking-contact-sheet.png`
- `public/audio/ai-speech/*.wav`
- `tmp/dev-51625-restart.log`
- `tmp/dev-51626.log`

## Decisions Made

- Keep audio sync class-trial-only.
- Keep thinking text visible until audio generation/playback state is available.
- Use active audio status as the temporary speaking focus, because the game can advance to the next speaker before the previous speaker's GPT-SoVITS audio finishes.
- Use real `HTMLAudioElement.currentTime / duration` for synced reveal when duration is valid; use existing fixed timer fallback when duration is invalid.
- Start background class-trial lookahead only after current audio playback begins, so failed autoplay does not advance the server behind a silent UI.
- Keep only one buffered class-trial continue at a time and consume it only when the source speech key, game id, and active audio run still match.
- If lookahead reaches a next speaker who has not spoken yet, run one additional background continue to generate that speaker's speech before prewarming audio.
- Use in-memory active GPT/SoVITS path tracking per normalized base URL as the conservative first backend optimization.
- Keep GPT-SoVITS timing logs safe: no local weight paths, prompt text, generated text, or secrets.
- Keep rewrite fast path conservative. If a line is not a known simple public-speech pattern, it falls back to the existing LLM rewrite and validation.
- Log only `rewriteMode`, not rewritten Japanese text or original Chinese text.
- Serialize GPT-SoVITS switch + TTS because the local api_v2 service has global active weights.
- Prewarm only the current class-trial AI speaker and do it invisibly; do not play the warmup audio or mutate game state.
- Defer class-trial streaming chunk generation to the playback drain so long speeches do not burst all GPT-SoVITS requests at once.
- For class-trial visible speech, generate GPT-SoVITS audio as one whole-speech chunk after the final LLM text arrives. This removes mid-speech gaps caused by per-chunk rewrite calls, while preserving live text streaming.
- Make class-trial role cards stronger than the shared DeepSeek base persona for speech style, but keep them bounded by public information, role rules, and camp goals.
- If class-trial TTS fails before any audio plays, keep the speaker visible with timed text fallback instead of treating the speech as completed instantly.
- Treat class-trial TTS unavailability as local/transient for that speech; do not disable the whole AI speech path from a GPT-SoVITS/Mimo fallback miss.
- Let 千早爱音 keep a little filler-word texture, but cap it tightly and forbid filler inside number/check/vote target fragments.
- Prefer deterministic local Japanese rewrite for common complex class-trial public-logic lines before asking the LLM, because the live 苗木诚 sample showed rewrite latency can dominate the whole TTS wait.
- Keep class-trial speech at 3 sentences / 260 chars instead of 2 / 220 so good characterful DeepSeek lines are not rejected into fallback purely for being slightly longer.
- Make class-trial fallback speech role-specific and pressure-oriented; fallback should still sound like the character, not like a generic Werewolf template.
- Keep the character lens as a reusable soft director input layer, not a fixed dialogue library and not a keyword-matching validator.
- Apply class-trial character lens behavior to white-day speech and public day-vote reasons only; private night actions stay on existing strategic logic.
- Repairs should preserve the LLM's class-trial freeplay and only remove the specific invalid part; do not make repair prompts collapse into local fallback templates.
- Use soft anti-repeat direction in the prompt before adding hard validators; if repetition persists, prefer few-shot/director examples or an evaluator layer over keyword rules.
- Use role-specific transformation examples and dynamic repeated-focus guidance as soft prompt material; they should teach the LLM how to change lens, not become mandatory wording.
- Treat class-trial audio-sync as a readable text staging problem as well as an audio problem: if audio is off, fails, or is too short for the amount of text, keep a timed text playback status alive and block auto-advance until it clears.
- Do not let real audio `ended` alone complete a class-trial line if the readable wall-clock reveal has not caught up; keep ticking the text tail and hold the completed line briefly before advancing.
- Runtime-generated AI speech files need a dynamic route in production preview; do not rely on `next start` serving newly-created `public/audio/ai-speech` files as static build assets.
- Keep the new unspoken-seat guard hard, not just prompt-only: role自由发挥 is allowed, but public speech order still forbids assigning trust/suspicion/vote labels before a seat has spoken unless a public check or identity claim already exists.
- Treat low-info first-position speech as a character-feel problem: first speaker may stay uncertain, but must leave a verifiable hook for later seats.
- Treat self-introduction as a first-day-morning affordance, not a recurring class-trial turn template; later speech and last words should enter from current evidence, vote shape, death shape, or role-specific pressure.
- Treat generic Werewolf openings like `我是闭眼好人 / 信息不多先听后置` as hard class-trial style failures, because they erase role identity even when the public logic is legal.
- Treat generic no-stance/no-ticket/evidence-gap reports as repairable LLM failures when they do not include the current character's lens signal; this keeps the final path on DeepSeek instead of changing local fallback prose.
- Browser QA can validate visible text, timing, and transcript persistence, but actual voiced quality depends on GPT-SoVITS being reachable.
- Repeated `没给倾向/缺口` loops should be pushed through a stronger director note first; keep this as prompt guidance rather than a broad hard validator unless another live sample still repeats the same axis.

## Blockers / Risks

- The vote visualization change is local-only class-trial work and intentionally skips `/rooms` / Public Alpha / ordinary vote UI.
- `src/app/globals.css` and `src/components/game/classTrialGameTable.test.ts` already had unrelated dirty class-trial edits before this slice; preserve them when staging.
- The browser verification server is still running on `http://127.0.0.1:51631`; port 3000 was another local app during this pass.
- Latest browser QA completed a full Day 1 transcript, but GPT-SoVITS was not reachable at `127.0.0.1:9880`, so actual voiced output was not tested.
- Browser automation confirmed complete visible first-speech text before handoff after the readable-sync follow-up, but it cannot hear GPT-SoVITS output; a human listening pass is still useful.
- The no-sound fix proves generated audio URLs are reachable again, but only the user can confirm actual audible output from the in-app browser/system audio device.
- Browser automation cannot hear GPT-SoVITS output; the latest pass verified visible state/timing only, so human listening is still needed for actual audio gaps and pacing.
- The latest long browser trace timed out before preserving the full black-white-bear segment, so manually listening through the first 4 speakers is still the best next check.
- GPT-SoVITS generation can still take many seconds per local request, so this slice reduces perceived waiting and duplicate prep, but does not deeply optimize the local synthesis backend.
- GPT-SoVITS active-weight cache resets on server restart and can be stale if another external client changes weights outside this app.
- Real timing samples show rewrite is currently the dominant latency source, so more weight-switch work will have limited benefit.
- Rewrite fast path only helps lines that match its narrow templates. Real AI speeches may still hit `rewriteMode:"llm"` often until more safe patterns are added.
- Rewrite cache is process-local and resets on server restart.
- Whole-speech class-trial TTS can increase the initial wait before audio starts, especially for long speeches, but avoids the more jarring pause inside one speaker's line.
- Timed text fallback preserves the visible speech when TTS fails, but it is still silent; a longer listening pass should confirm it feels acceptable versus retrying longer.
- The 3-sentence / 260-char class-trial speech contract reduces false rejections, but speech validation can still trigger repair attempts or fallback on unusually report-like output.
- Deterministic local Japanese rewrite is much faster than LLM rewrite but may be less semantically rich; a human listening pass should judge whether the audio wording still feels natural.
- The latest text samples improved role pressure shifts, but a full browser/audio listening pass should decide whether one-off role-specific fallbacks feel acceptable and whether an evaluator layer is needed.
- A short anti-repeat smoke hit transient DeepSeek `fetch failed` provider errors for later speakers; those fallbacks were provider/network failures, not character-lens validation failures.
- The stronger persona prompt and new guards improve the first four text samples, but the next subjective browser/audio run is still needed to judge whether 苗木诚 and the other characters feel distinct enough while voiced.
- Subjective character feel still needs a longer Day 1 listening pass; tests prove the lens reaches prompts and validation, not that every live line will feel perfect.
- The latest browser QA transcript `tmp/class-trial-browser-qa-1780197058323.md` proves full Day 1 can be captured in the browser path, but it was collected before the new stronger repeated-gap director wording and while GPT-SoVITS was down.
- The latest fresh role-pressure sample `tmp/class-trial-day1-verification-1780195573037.md` proves the opening-persona follow-up now has real DeepSeek evidence, but 3/9 visible lines used role-specific fallback after validation failures, so another subjective sample may still be useful.
- The Vite SSR live provider sample confirmed official DeepSeek routing and prompt contents, but the PowerShell inline-script context had Chinese encoding placeholders; use a browser/game sample for final dialogue-quality judgment.
- Character lens is intentionally light and may need per-role wording tuning after real DeepSeek samples.
- User pasted provider key values in chat during the LLM runtime slice. Do not copy them into tracked files or handoff notes; refresh only private local config if needed.
- Class-trial LLM mode intentionally trades mock speed for real model quality; the UI now calls this out, but live latency still depends on DeepSeek/Mimo and GPT-SoVITS.
- DeepSeek-only class-trial routing removes GPT/Claude/GLM recovery for malformed JSON. Bad DeepSeek outputs now surface as same-model retries or eventual local fallback action/speech.
- Disabling DeepSeek thinking may reduce some deep deliberation, but it fits the current game need better: fast structured JSON and fewer empty attempts.
- The latest narrow real loop still had 1 retry, caused by speech-contract validation, not empty provider output.
- Audio lookahead hides wait only if the current playback duration is long enough for the next continue step and next GPT-SoVITS generation to finish.
- Background continue mutates server state before the UI advances; duplicate prevention now relies on disabled class-trial controls plus active-run guarded consumption.
- Browser screenshot capture timed out during the latency smoke; DOM state and generated wav cache evidence were collected.
- Voice prewarm shifts cold-start work earlier; it cannot eliminate GPT-SoVITS synthesis cost.
- Deferred chunk loading protects the local backend from request bursts, but very long speeches can still pause between chunks if synthesis is slower than playback.
- Browser automation was not available in the post-prewarm thread; focused tests and direct route smoke passed, but a longer listening pass is still useful.
- The worktree still contains unrelated/pre-existing class-trial and GPT-SoVITS dirty files from earlier slices; do not blindly stage everything.

## Recommended Next Step

For this architecture slice, the next useful follow-up is a dedicated room vote smoke speed/root-cause pass: make `scripts/room-action-smoke.mjs --coverage=vote` complete quickly under mock AI, then rerun the full browser visual pass with Browser/Playwright available. The class-trial architecture extraction itself is implemented and verified by focused tests, type/lint/build, local HTTP/API smoke, room API tests, and room SSE smoke.
