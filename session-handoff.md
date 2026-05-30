# Session Handoff

## Current Objective

- Goal: Polish local-only `学级裁判主题局` so it feels less like a generic Werewolf template: thinking portraits before voice playback, visible podium numbers, themed system broadcast cue routing, stronger role/last-words emotion, Monokuma laugh preservation, self-introduction only during first-day morning, and freer per-character speech.
- Current status: Per-character thinking portrait assets and manifest fields are wired; class-trial table uses thinking portraits during voice/text preparation and seat numbers on every podium; host cue keys are class-trial namespaced; Monokuma rewrite preserves `噗噗/うぷぷ`; first-day-only self-intro guidance, speech-contract anti-template bans, Day 2+ fallback no-name openings, and role-specific last words are implemented on branch `codex/class-trial-ui-polish-tomori` at `D:\ai-werewolf`.
- Local note: GPT-SoVITS remains local-only and generated audio cache files under `public/audio/ai-speech` must not be staged.

## Completed This Session

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

## Blockers / Risks

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
- The latest production-preview text samples improved role pressure shifts, but a full browser/audio listening pass should decide whether one-off fallbacks feel acceptable and whether an evaluator layer is needed.
- A short anti-repeat smoke hit transient DeepSeek `fetch failed` provider errors for later speakers; those fallbacks were provider/network failures, not character-lens validation failures.
- The stronger persona prompt and new guards improve the first four text samples, but the next subjective browser/audio run is still needed to judge whether 苗木诚 and the other characters feel distinct enough while voiced.
- Subjective character feel still needs a longer Day 1 listening pass; tests prove the lens reaches prompts and validation, not that every live line will feel perfect.
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

Next quality slice should use `http://127.0.0.1:51629` for a browser/listening pass, comparing first-speech wait, local-rewrite voice quality, and whether at least 6 of 9 Day 1 roles show distinct reasoning/pressure styles without repeating the same abstract attack.
