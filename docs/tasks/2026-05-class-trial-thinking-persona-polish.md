# 学级裁判思考立绘与角色化播报

## Task

Short name: class-trial-thinking-persona-polish

Goal: Improve the local-only class-trial theme so each character has a pre-voice thinking portrait, visible table seat numbers, stronger character-specific speech and last words, class-trial-safe host/system broadcast audio cues, complete Monokuma vocal texture, and self-introduction happens only during the first-day morning opening rather than every round.

Why it matters: The current themed flow is visually close, but the user reported that speech still feels too much like generic Werewolf, Monokuma's vocal texture is incomplete, last words lack character emotion, table seats need clearer numbers, and later days should sound like continuing debate instead of a fresh introduction round.

## Task Gate

Task type: local-only frontend/UI + AI speech/action quality + host audio cue routing

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: local `学级裁判主题局` with AI speech enabled; confirm thinking portrait appears before audio speech, table seats show numbers, and system host cues still play.
- If skipped, reason:

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: This is local-only private class-trial polish and generated local assets under ignored `local-assets/**`.
- Residual risk: Subjective character feel and audio quality still require user listening feedback.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `docs/tasks/2026-05-class-trial-speech-persona-audio-gap.md`
- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/hostAudioCues.ts`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/speechProviders.ts`
- `src/ai/actionProviders.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/components/game/ClassTrialGameTable.tsx`
- `src/components/game/classTrialGameTable.test.ts`
- `src/components/game/classTrialTheme.ts`
- `src/components/game/classTrialTheme.test.ts`
- `src/components/game/hostAudioCues.ts`
- `src/components/game/hostAudioCues.test.ts`
- `src/ai/classTrialCharacterLens.ts`
- `src/ai/classTrialCharacterLens.test.ts`
- `src/ai/classTrialSpeechRewrite.ts`
- `src/ai/classTrialSpeechRewrite.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/ai/actionProviders.ts`
- `src/ai/actionProviders.test.ts`
- `local-assets/class-trial-pack/manifest.json`
- `local-assets/class-trial-pack/thinking-portraits/**`
- `docs/tasks/2026-05-class-trial-thinking-persona-polish.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `D:\AI\GPT-SoVITS\**`
- `public/audio/ai-speech/**`
- production deployment docs
- `src/game/engine.ts`
- unrelated room or Public Alpha code

## Definition Of Done

This task is complete when:

- The local class-trial manifest supports per-character `thinkingPortraitUrl` and validates the pack as complete only when avatar, speaking portrait, and thinking portrait are present.
- Each of the 9 local class-trial characters has a generated temporary thinking portrait asset under ignored `local-assets/class-trial-pack/thinking-portraits`.
- During class-trial speech preparation/loading, the table shows the speaker's thinking portrait before spoken audio/text playback begins; spoken playback still uses the normal portrait.
- Every seat on the class-trial table visibly shows its seat number.
- Class-trial host/system audio cues keep using Werewolf flow clips but are keyed separately so theme-specific cue behavior can be extended without affecting normal games.
- Monokuma speech/TTS rewrite preserves a complete short vocal texture instead of dropping the key laugh/taunt.
- Character lens and speech constraints further reduce generic Werewolf templates, limit self-introduction to first-day morning, and prevent later class-trial speech or last words from reintroducing the speaker by name.
- Class-trial last words prefer character-specific emotional/public-safe final statements, with 江之岛 more angry/dramatic and 雾切 more resigned but rational.
- Focused tests, TypeScript, lint, build or skipped build rationale, harness checks, and browser/manual evidence are recorded.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/hostAudioCues.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialSpeechRewrite.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-thinking-persona-polish.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- Local browser class-trial AI-only run with AI speech enabled, listening through at least the first four speakers and one last-words path if reachable.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Added thinkingPortraitUrl / hasThinkingPortrait model support and complete-pack validation.
- Generated 9 local-only transparent thinking-pose PNGs and wired the ignored manifest to them.
- Class-trial table now shows thinking portrait during voice/text preparation, visible podium seat numbers, and normal portrait during spoken playback.
- Class-trial host cue keys are namespaced while reusing existing Werewolf broadcast clips.
- Monokuma rewrite preserves 噗/噗噗 as うぷぷ.
- Day 2+ class-trial guidance/validation blocks repeat self-introductions; lens fallback no longer starts with 我是.
- Follow-up self-introduction guidance limits character-name introductions to first-day morning; later class-trial speech says the introduction window has ended.
- Follow-up template guards reject generic Werewolf flow openings like `我先说身份 / 我是闭眼好人 / 信息不多先听后置`, and the prompt asks each round to change the推进动作 instead of swapping seat numbers into the same template.
- Follow-up contract pass puts Day 2+ no-self-introduction and anti-`身份-信息-站边-票口` / `我是闭眼好人` bans directly into `speechContract.mustNotAsk`, the highest-priority LLM constraint.
- Follow-up lens audit confirms all 9 fixed class-trial roles receive their own behavior lens and distinct推进动作/cadence guidance rather than one shared Werewolf template.
- Follow-up fallback pass stops Day 2+ class-trial fallback speech from opening with a display-name beat like `雾切响子。`, while preserving role emotion/logic.
- Class-trial last words no longer use `我是角色名` as a fixed opening while keeping role emotion.
- Class-trial last words now use role-specific emotional statements for 江之岛盾子, 雾切响子, and the rest of the roster.
- Follow-up DeepSeek persona pass adds per-role `狼人杀打法卡` decision guidance for all 9 fixed characters, covering read priority, pressure method, vote logic, villager/wolf/power-role play, night bias, and last-words mode.
- Follow-up action pass now sends the class-trial action strategy lens to all class-trial AI action inputs, including private night actions, rather than only Day Vote.
- Follow-up LLM guard pass makes generic `没站边/没票口/证据链缺口` or low-info report lines trigger same-DeepSeek repair when they do not match the current character lens, and rejects abnormal repeated question-mark placeholders.
- Follow-up prompt-leak guard rejects LLM lines that expose class-trial prompt/meta terms such as `通用观察`, `发言对比点`, `对话链`, or ask unspoken later seats for template material.
- Follow-up last-words guard rejects custom学级裁判遗言 that reintroduce the speaker with `我是角色名`, covering `噗噗，我是黑白熊` while preserving the `噗噗` character beat.

Changed files:
- src/components/game/classTrialTheme.ts
- src/components/game/classTrialTheme.test.ts
- src/components/game/ClassTrialGameTable.tsx
- src/components/game/classTrialGameTable.test.ts
- src/components/game/hostAudioCues.ts
- src/components/game/hostAudioCues.test.ts
- src/components/GameClient.tsx
- src/app/globals.css
- src/ai/classTrialCharacterLens.ts
- src/ai/classTrialCharacterLens.test.ts
- src/ai/classTrialSpeechRewrite.ts
- src/ai/classTrialSpeechRewrite.test.ts
- src/ai/speechProviders.ts
- src/ai/speechProviders.test.ts
- src/ai/actionProviders.ts
- src/ai/actionProviders.test.ts
- local-assets/class-trial-pack/manifest.json (ignored local data)
- local-assets/class-trial-pack/thinking-portraits/*.png (ignored local data)
- docs/tasks/2026-05-class-trial-thinking-persona-polish.md
- feature_list.json
- progress.md
- session-handoff.md

Verification:
- npm run test -- src/components/game/classTrialTheme.test.ts src/components/game/classTrialGameTable.test.ts src/components/game/hostAudioCues.test.ts src/ai/classTrialCharacterLens.test.ts src/ai/classTrialSpeechRewrite.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
- npm run test -- src/ai/speechProviders.test.ts -t "speech contract"
- npm run test -- src/ai/speechProviders.test.ts -t "class-trial role"
- npm run test -- src/ai/speechProviders.test.ts -t "fallback speeches reopen"
- npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts src/ai/classTrialCharacterLens.test.ts
- npm run test -- src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
- npx eslint src/ai/classTrialCharacterLens.ts src/ai/speechProviders.ts src/ai/actionProviders.ts src/ai/classTrialCharacterLens.test.ts src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts
- npm run test -- src/ai/speechProviders.test.ts -t "prompt terms leaking|audit-template chains"
- npm run test -- src/ai/actionProviders.test.ts -t "reintroduce the speaker"
- npm run test -- src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts src/ai/classTrialCharacterLens.test.ts
- npx eslint src/ai/actionProviders.ts src/ai/actionProviders.test.ts src/ai/speechProviders.ts src/ai/speechProviders.test.ts
- Vite SSR routed DeepSeek sample: `deepseek-speech:deepseek-chat`, `isFallback:false`, prompt contained `狼人杀打法卡` and the role-action rule. PowerShell inline-script Chinese context showed encoding placeholder artifacts, so that sample is provider/prompt evidence rather than final dialogue-quality evidence.
- npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/classTrialGameTable.test.ts
- node -e "JSON.parse(require('fs').readFileSync('local-assets/class-trial-pack/personas.json','utf8')); console.log('personas ok')"
- node manifest asset smoke: resolved all 9 character avatar/portrait/thinking files.
- Alpha/contact-sheet validation: 9 thinking portraits had transparent corners and plausible subject coverage.
- npx tsc --noEmit
- npm run lint (passed with 3 existing warnings in src/server/gptSoVitsTts.test.ts)
- npm run build (passed with existing Turbopack NFT trace warning)
- Restarted `next start -p 51625`; `Invoke-WebRequest -UseBasicParsing http://localhost:51625/` returned 200.
- npm run harness:task-card -- docs/tasks/2026-05-class-trial-thinking-persona-polish.md
- npm run harness:check
- git diff --check (CRLF warnings only)
- Chrome headless CDP smoke on http://localhost:51625: local pack/personas ready, 9 seat numbers, 9 local avatars, Day 1 speech prep used /class-trial-pack/thinking-portraits/%E8%8B%97%E6%9C%A8%E8%AF%9A.png with data-portrait-state=thinking.

Remaining risks:
- Generated thinking portraits are temporary local private assets; user should visually approve/replace any off-model pose.
- Browser automation cannot judge actual GPT-SoVITS audio quality or whether Monokuma's laugh sounds good by ear.
- The new strategy-card and repair guards reduce template drift, but final character feel remains subjective and should be judged in a real browser/listening Day 1/Day 2 run.
- Existing worktree contains many earlier class-trial dirty files; do not blindly stage local-assets or unrelated slices.
```
