# 学级裁判公开发言证据边界

## Task

Short name: class-trial-public-speech-evidence-boundary

Goal: Fix the class-trial case where private memory trust, especially `trustedSeatId`, leaks into public talking points such as `我暂时更信5号`, while preserving character strategy freedom, bluffing, momentum-driving, and role-specific pressure.

Why it matters: In the observed class-trial flow, Kirigiri said `我暂时更信5号` because the system selected seat 5 as `trustedSeatId` in private memory and `buildMemorySpeechPoint()` translated it directly into a public talking point. From the player's view, seat 5 had not spoken and had no public identity claim, check result, vote record, death context, or public evaluation chain. The line therefore felt like hidden system scoring leaked into table speech.

Player-experience target: AI characters may still make bold strategic choices, bluff, redirect focus, protect or frame someone, and apply role-specific pressure. The fix should only stop private trust/suspicion scores from being spoken as conclusion labels unless the spoken conclusion can be translated into visible table evidence.

## Task Gate

Task type: AI speech / LLM contract + AI behavior boundary

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? preferred
- If yes, flow or URL: local `学级裁判主题局` Day 1 speech sample with real class-trial LLM when available; confirm Kirigiri or another early speaker does not publicly label an unspoken seat as trusted/suspicious/vote-worthy without public table evidence.
- If skipped, reason: Real LLM/browser listening can be slow and depends on local provider state; focused tests around `buildMemorySpeechPoint()` and rendered-speech validation are required.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped: Production/release check
- Reason: `学级裁判主题局` is local-only private theme behavior, not Public Alpha or room production behavior.
- Residual risk: Subjective character feel still needs a longer Day 1 listening pass because tests can prove boundaries but not whether every line feels like Kirigiri, Enoshima, or Monokuma.

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/ai-speech.md`
- `docs/threads/ai-behavior.md`
- `docs/tasks/2026-05-class-trial-character-lens.md`
- `docs/tasks/2026-05-class-trial-thinking-persona-polish.md`
- `src/ai/tableRead.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/game/engine.test.ts`

## Allowed Scope

Files or directories the agent may edit:

- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `src/ai/speechProviders.ts`
- `src/ai/speechProviders.test.ts`
- `src/game/engine.test.ts`
- `docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- `local-assets/**`
- `public/audio/ai-speech/**`
- `D:\AI\GPT-SoVITS\**`
- production deployment docs
- `src/components/**`, unless the implementation discovers a UI-only test fixture needs a narrow update
- `src/game/engine.ts`, unless a failing test proves the speech plan construction contract cannot be fixed in the AI layer

## Boundary Model

Internal strategy layer:

- Keep private memory and strategy freedom intact. `trustedSeatId`, `suspectedSeatId`, wolf-team plans, risk tolerance, persona strategy, and vote/action scoring may still influence decisions.
- Wolves may protect someone, redirect focus, frame a target, or create tempo.
- Kirigiri may coldly construct pressure; Enoshima may stir chaos; Monokuma may taunt and provoke.
- Do not flatten these into generic safe speech.

Public expression layer:

- Any spoken conclusion about trust, suspicion, vote targets, wolf pits, clearing, protecting, or pressure must be expressible as public table evidence.
- Public table evidence includes current or earlier public speech, public identity claims, public seer checks, public vote records, death announcements, and another player already publicly building pressure or trust around that seat.
- If a seat has not spoken and has no public hard info or public evaluation chain, the speaker may assign that seat a future listening task, ask them to react to an existing public line when their turn comes, or explain why the current focus remains elsewhere.
- In that low-public-info case, replace `我暂时更信5号，所以焦点先放在1号` with wording like `我先不把后置位拉进焦点，先审1号这段逻辑` or `5号轮到时只接这个公开点，当前焦点还是1号的这段断点`.

Allowed bluffing and tempo:

- A character may bluff, exaggerate pressure, or deliberately lead tempo.
- The spoken bluff must still look like a table-player move grounded in public material: a reaction test, a vote-pressure tactic, a reading of a speech gap, or a challenge based on an already visible chain.
- Do not implement a broad ban on speculation, bluffing, or role-persona pressure.

Disallowed leak pattern:

- Do not let private `trustedSeatId` or raw trust score become a public `更信X号`, `放X号`, `X号偏好`, `X号更干净`, `X号先不进狼坑`, or similar conclusion when X lacks public evidence.
- Do not solve this only by adding more prompt text. The source talking point should be public-sayability filtered before it reaches LLM speech rendering.

## Definition Of Done

This task is complete when:

- `buildMemorySpeechPoint()` or its immediate call path checks public sayability before converting `memory.trustedSeatId` into a public talking point.
- Private memory can still influence focus, vote, action, and persona strategy; the fix only changes what becomes a public speech point.
- A trusted seat with public evidence, such as an actual public claim/check, vote record, prior speech, or public pressure chain, may still be referenced with a public reason.
- A trusted seat with no public evidence is not spoken as trusted, cleared, protected, or preferred.
- The low-info replacement wording keeps character agency and tempo: it should redirect to the current public focus or assign a future public question, not collapse into `信息不多先听后置`.
- Class-trial speech validation still rejects rendered LLM output that tries to label unspoken seats without public hard info.
- Tests include the concrete regression shape: early class-trial speech where seat 5 has not spoken and has no public evidence, but private memory has `trustedSeatId: 5`.
- Tests also include a positive case proving allowed character pressure/bluffing survives, such as asking an unspoken seat to react later to an already-spoken seat's public line or using public logic to keep focus on the current suspect.
- The implementation does not add broad bans that make all roles avoid prediction, bluffing, tempo, or role-specific pressure.
- Focused tests, TypeScript, lint, task-card validation, harness check, and skipped browser/LLM rationale are recorded.

## Suggested Implementation Notes

- Start with a failing regression around `createSpeechPlan()` or the narrow helper path that currently produces `我暂时更信${trustedSeatId}号，所以焦点先放在${focus.seatId}号`.
- The likely source is `src/ai/tableRead.ts` in `buildMemorySpeechPoint()`.
- Prefer a small helper such as `canPubliclyReferenceTrust(view, tableRead, trustedSeat)` or `buildPublicTrustEvidencePoint(...)` over embedding a large rule directly in the branch.
- Use existing public-info helpers where possible, for example current-day speech status, recent speeches, `tableMemory.claimBoard`, public checks, vote snapshot, and public stances/pressure already present in `AiTableRead`.
- If the helper cannot find public evidence, return a neutral tempo line about the focus seat or later listening task instead of mentioning private trust.
- Keep `sanitizeAiMemoryForSpeech()` in mind: private context should not encourage the LLM to reintroduce the same leak after the plan is filtered.
- Avoid touching AI action scoring unless a test proves the action layer itself is leaking spoken text. The user's core concern is public expression, not internal decision freedom.

## Verification

Required checks:

- `npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts`
- `npm run test -- src/game/engine.test.ts -t "memory"`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md`
- `npm run harness:check`
- `git diff --check`

Optional deeper checks:

- `npm run build`
- Local class-trial real-LLM Day 1 sample on `http://127.0.0.1:51625` or the currently running local preview port.
- A targeted transcript review of the first 4 speakers, looking for unspoken-seat trust/suspicion labels and whether Kirigiri/Enoshima/Monokuma still apply distinct pressure.

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- Root-caused the observed `我暂时更信5号` leak to `buildMemorySpeechPoint()` converting private `memory.trustedSeatId` directly into a public talking point.
- Added a red-green regression where a class-trial speaker privately trusts unevidenced seat 5 while public focus is seat 1; the test first failed on `我暂时更信5号` and now passes.
- Added `buildPublicTrustSpeechPoint()` so trusted-seat memory only becomes public speech when the trusted seat has visible public evidence.
- Public evidence currently covers public good checks, public claims, support/follow stances, prior public speech, current-day public mentions, and vote records.
- Added a positive regression proving publicly spoken trusted seats can still be referenced as public evidence.
- Kept private memory available for strategy and scoring; the fix only filters public talking-point generation.

Changed files:
- `src/ai/tableRead.ts`
- `src/ai/tableRead.test.ts`
- `docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Verification:
- Red-green: `npm run test -- src/ai/tableRead.test.ts -t "does not turn private trust"` first failed because speech text contained `我暂时更信5号，所以焦点先放在1号`, then passed after the fix.
- Positive focused test: `npm run test -- src/ai/tableRead.test.ts -t "private trust|visible speech evidence"` passed, 2 tests.
- `npm run test -- src/ai/tableRead.test.ts src/ai/speechProviders.test.ts` passed, 2 files / 111 tests.
- `npm run test -- src/game/engine.test.ts -t "memory"` passed, 4 tests.
- `npx tsc --noEmit` passed.
- `npx eslint src/ai/tableRead.ts src/ai/tableRead.test.ts` passed with no output.
- Follow-up lint config fix added `tmp/**` to `eslint.config.mjs` global ignores because ESLint 9 flat config was scanning existing `tmp/chrome-class-trial-smoke` Chrome extension cache files.
- `npm run lint` passed after the `tmp/**` ignore fix.
- `npm run build` passed with the existing Turbopack NFT trace warning for `next.config.ts -> src/app/class-trial-pack/[...assetPath]/route.ts`.
- `npm run harness:task-card -- docs/tasks/2026-05-class-trial-public-speech-evidence-boundary.md` passed.
- `npm run harness:check` passed.
- `git diff --check` passed with CRLF warnings only.

Remaining risks:
- No real-LLM/browser Day 1 transcript sample was run in this slice; focused tests prove the plan boundary but subjective class-trial speech quality still needs a later listening pass.
```
