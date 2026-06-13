# 12p Mimo Speech Mechanics Fable5 Review Pack

Date: 2026-06-12

Purpose: review the first 12-player Mimo sample after applying the
mechanism-level ordinary speech changes suggested by Fable5.

## Minimal Read List

- Mechanism implementation:
  - `src/ai/speechProviders.ts`
  - `src/ai/speechProviders.test.ts`
- Task card:
  - `docs/tasks/2026-06-12p-mimo-speech-mechanics.md`
- Live sample outputs:
  - `tmp/12p-mimo-speech-mechanics-report.json`
  - `tmp/12p-mimo-speech-mechanics-cases.json`
  - `tmp/12p-mimo-speech-mechanics-eval.json`

## What Changed Before This Sample

- Player identity card now exposes explicit ordinary-speech lanes:
  - speech length lane
  - question tendency
  - filler/mouth habit
  - emotion amplitude
  - default risk posture
- Self-history now includes bounded incoming pressure:
  - who questioned the current seat this round
  - prior public speech, prior target/stance, and prior vote remain available
- Shared pressure budget prompt is stronger after repeated same-axis pressure:
  - later seats are told not to keep chasing the same target and same point
  - allowed moves are steered toward hold, water-pass, vote boundary, or target shift
- Previous-speaker pickup is no longer treated as required ritual:
  - direct rebuttal, no named pickup, short water-pass, defense, and target shift are all allowed

This was intentionally a prompt/director mechanism change, not a new broad
phrase-ban or hard fallback pass.

## Live 12p Command

```powershell
npm.cmd run llm:evaluate -- --models=mimo-v2.5-pro --base-url=<temporary-base-url> --lineup-count=12 --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=260 --max-llm-calls=90 --real-phases=SHERIFF_NOMINATION,SHERIFF_SPEECH,SHERIFF_VOTE,SHERIFF_PK_SPEECH,SHERIFF_PK_VOTE,DAY_SPEECH,DAY_VOTE --json --out=tmp/12p-mimo-speech-mechanics-report.json --eval-cases-out=tmp/12p-mimo-speech-mechanics-cases.json
npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-mimo-speech-mechanics-cases.json --json --out=tmp/12p-mimo-speech-mechanics-eval.json
```

The key and base URL were supplied only through a temporary process env in a
visible PowerShell window. No key was written to `.env`, docs, source, or tmp
reports.

## Numeric Summary

From `tmp/12p-mimo-speech-mechanics-report.json`:

- Board: `12p-sheriff-seer-witch-hunter-guard`
- Seed: 91
- Stop reason: `max_llm_calls`
- Total calls: 90
- Speech calls: 33
- Action calls: 57
- Fallback count: 10
- Error count: 10
- Validation failure count: 5
- Retry issue calls: 23
- Total quality issues: 2
- Quality issue type: `speech_vote_discontinuity`
- Game did not complete; it stopped on the 90-call limit after reaching D4 `DAY_SPEECH`.

From `tmp/12p-mimo-speech-mechanics-eval.json`:

- Evaluated cases: 80
- Average score: 99.4
- Issue count: 2
- High-risk case ids:
  - `91:ad25b26d-260c-4fbc-9f7c-d88d53f17aeb:3:DAY_SPEECH:9:76`
- Issue codes:
  - `speech_vote_discontinuity`: 1
  - `bad_followup_target`: 1
- Sample-level warnings:
  - `repeated_surface_phrase`: 6/41
  - `repeated_clause_rate`: 6/41
  - `action_distribution_skew`: 0.71

## Signs The New Mechanisms Partly Worked

Several rows now explicitly notice the pressure budget or refuse to continue
the same target line:

```text
10号 D1: 2号Claude报完查杀之后，后面连续好几个人都在压他，这条压力线已经铺得很开了。我不打算再顺着同一根线追...
```

```text
11号 D2: 刚才一轮听下来，压2号的人很多，但给的理由其实差不多...基本都在讲同一件事。
```

Some rows also carry self-history or previous commitment:

```text
1号 D2: 上一轮我点过9号DeepSeek2，但最后票改到了4号豆包，因为豆包处在对跳核心，公开证据更硬。
```

These are the intended direction: seats are not only re-deriving from public
facts; they sometimes react to their own history and the table's repeated
pressure.

## Remaining Problems In This 12p Sample

### 1. Provider/fallback noise is too high

There are 10 fallbacks/errors in 90 calls, including 9 speech provider errors.
Several fallback rows contain the same repeated public-claim bridge, so the
sample is not a clean no-fallback style read.

Representative provider-error fallback:

```text
5号 D1: 我先说听感。4号豆包报2号Claude查杀，这条线我先看今天怎么站边，不急着只听一个结论...
```

### 2. Repeated long claim-handling clause remains

Sample metrics flagged this repeated normalized clause:

```text
{seat}号{name}报{seat}号{name}查杀这条线我先看今天怎么站边不急着只听一个结论
```

It appears across D1/D2 rows, especially in fallback/provider-error outputs.
This is not a single banned-word problem; it looks like a reusable bridge or
fallback public-role handler being copied whole.

### 3. 12p sheriff/role-public action path is over-dominant

The local sample metric reports 29/41 ordinary speech-like rows in
`rolePublicAction`. The 12-player sheriff board naturally creates many public
claims and counterclaims, but the response mode collapses too often into:

```text
X号报Y号查杀，这条线我先看今天怎么站边...
```

This may be a 12p-specific gap: after public role claims, seats need more
distinct moves than "handle the claim line cautiously."

### 4. Sheriff speech surface is generic and repeated

Several `SHERIFF_SPEECH` rows repeat:

```text
我竞选警长会按公开发言、身份声明和票型来归票，先把警徽给能组织桌面的人。
```

In the current report these rows are task `action`, not ordinary `speech`,
so the new ordinary speech director may not be fully controlling sheriff
campaign speech texture.

### 5. Ritual pickup is reduced but not gone

The sample still has many rows starting from:

```text
我先...
接一下...
这句我听到了...
这个点我先...
```

The prompt now permits non-ritual openings, and some rows do shift away, but
the visible surface is still too uniformly "analyst politely carrying the
previous line."

### 6. High-risk bad follow-up target

The local eval flagged a D3 row where 9号 keeps today's focus on 2号Claude even
though 2号 is no longer a valid current target:

```text
9号 D3: ...但今天我的焦点还是2号Claude。
```

This is partly continuity memory going stale: self-history and old claim lines
are being remembered, but target eligibility is not strong enough when the game
has moved on.

## Questions For Fable5

Please review at the mechanism/sample level, not at the single-word polish
level.

1. Did the four mechanisms land in the right direction?
   - player identity card
   - incoming pressure/self-history
   - shared pressure budget
   - non-ritual opening guidance

2. In this 12p sample, is the main remaining issue still "not enough player
   identity/private motive", or has it shifted to "role-public claim handler
   overuse"?

3. Should the next narrow fix target:
   - fallback/provider-error speech surfaces,
   - sheriff campaign speech path,
   - rolePublicAction move diversification,
   - stale target eligibility in self-history,
   - or something else?

4. Are the repeated claim-line bridges mostly caused by fallback text, prompt
   text, candidate action distribution, or the 12p board naturally overloading
   the public-claim axis?

5. Please do not recommend broad banned-word expansion unless a phrase is
   truly unsafe. Prefer mechanism-level changes that make seats choose
   different player moves.

## Fable5 Review Result

Fable5's mechanism-level verdict was "continue": the four mechanism directions
were considered correct, and the sample contained direct positive evidence such
as 10号/11号 refusing to keep chasing the same axis and 1号 D2 explaining why
their vote moved from the previous target.

The main read was that the remaining repetition is not proof that player
identity or private motivation failed. The sample was polluted by fallback:
9 of 33 speech calls were provider-error fallback rows, around 27% of speech
lines. The repeated long bridge
`报X查杀这条线我先看今天怎么站边，不急着只听一个结论` was identified as fallback
and public-claim handling reuse.

Fable5 ranked the next issues as:

- `rolePublicAction` handler collapse: public checks/claims were being handled
  with one cautious bridge instead of several player moves.
- Fallback rate was too high to read the true mechanism cleanly.
- Sheriff campaign speech went through the action path and repeated a fixed
  campaign line, bypassing ordinary-speech texture.
- Stale self-history targets should be downgraded when the seat is no longer a
  valid current target.

Fable5 explicitly advised not to add broad banned words, not to force action
distribution quotas, and not to chase a full D4 game before the narrow fixes.

## Follow-up Implementation After Review

Implemented the two requested narrow fixes plus the small stale-target repair:

- Public role/claim pressure now exposes six ordinary speech moves:
  `roleHandle`, `voteBoundary`, `hold`, `waterPass`, `changeRead`, and
  `discomfort`, with prompt text naming direct side-taking, questioning the
  claimant's motive, protecting the checked target, demanding counterclaim,
  vote boundary, and short water-pass as valid branches.
- Sheriff speech candidates in `src/ai/actionProviders.ts` now generate
  persona-weighted campaign messages instead of the fixed
  `我竞选警长会按公开发言、身份声明和票型来归票...` template. The action constraints also
  tell the model that sheriff campaign speech must use ordinary-player mouth
  feel and focus on badge/sheriff-table public pressure.
- Ordinary self-history now only keeps last speech/vote targets when they are
  alive. Dead or otherwise invalid remembered targets are downgraded into
  "旧线 / 不是当前可处理目标" prompt lines.
- Public-check fallback bridge text now uses used-line avoidance for claim
  handling, so the repeated claim bridge is not reused whole-game as a fallback
  surface.

Focused regression checks passed for all four behaviors, and the next paid
validation should be the bounded 12p rerun Fable5 requested: same seed, through
`SHERIFF_NOMINATION -> SHERIFF_VOTE`, D1 full, and D2 `DAY_SPEECH`, with
acceptance focused on sheriff-speech variety, at least three different
post-check response actions, and fallback rate near 1-2/30 or lower.

## Post-Fable Bounded Reruns

Two bounded 72-call 12p Mimo reruns were run after the Fable5 follow-up fixes,
using the same board and seed. The key was supplied only through the temporary
PowerShell runner and was not written to `.env`, docs, source, or reports.

### First post-Fable rerun

Files:

- `tmp/12p-mimo-speech-mechanics-post-fable-live-report.json`
- `tmp/12p-mimo-speech-mechanics-post-fable-live-cases.json`
- `tmp/12p-mimo-speech-mechanics-post-fable-live-eval.json`

Summary:

- Total calls: 72
- Speech calls: 26
- Action calls: 46
- Fallback count: 12
- Error count: 12
- Validation failure count: 9
- Failure type split: `ok` 49, `retry_ok` 11, `provider_error` 12
- Fallback split: speech 4, action 8
- Main fallback phases: D1 `DAY_SPEECH` speech 3, D1 `DAY_VOTE` action 7,
  D2 `DAY_VOTE` action 1, D3 `DAY_SPEECH` speech 1

This was not a clean quality read. The main pollution was action validation
rejecting grounded public-check vote reasons with `凭空引用未公开查验结果`.

Root cause: player names with numeric suffixes, especially `DeepSeek2`, were
resolved by numeric extraction before exact name matching. A reason such as
`8号Kimi报了DeepSeek2查杀` could resolve `DeepSeek2` as seat 2 instead of
the actual named seat 9, so a grounded public check was treated as fabricated.

### Name-suffix attribution fix

Added regression coverage in `src/ai/actionProviders.test.ts` proving a public
check against a target named `DeepSeek2` is accepted when the claim board
contains that exact target. `resolveActionPublicCheckSeatRef` now tries exact
full player-name matching before extracting digits.

Local checks after this fix passed:

- `npm run test -- src/ai/actionProviders.test.ts -t "target name ends with a digit|fabricate another player's public check result"`
- `npm run test -- src/ai/actionProviders.test.ts`
- `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run lint`

### Second post-Fable rerun after name-suffix fix

Files:

- `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-report.json`
- `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-cases.json`
- `tmp/12p-mimo-speech-mechanics-post-fable-namefix-live-eval.json`

Summary:

- Total calls: 72
- Speech calls: 25
- Action calls: 47
- Fallback count: 6
- Error count: 6
- Validation failure count: 2
- Failure type split: `ok` 59, `retry_ok` 7, `provider_error` 6
- Fallback split: speech 4, action 2
- Phase coverage: 12 sheriff nominations, 9 sheriff speeches, 4 sheriff
  votes, 25 day speeches, 22 day votes
- Fallback phases: D1 `DAY_SPEECH` speech 2, D1 `DAY_VOTE` action 1,
  D2 `DAY_SPEECH` speech 2, D2 `DAY_VOTE` action 1

This is a material improvement over the first rerun: total fallback dropped
from 12 to 6, validation failures dropped from 9 to 2, and action fallback
dropped from 8 to 2. It still misses the acceptance target of roughly 1-2
fallback rows per 30 calls, so it should be treated as a diagnostic sample,
not final acceptance.

### Mechanism read from the second rerun

Positive signs:

- The fixed sheriff campaign line is gone. The 9 sheriff speeches use different
  warning, pressure, identity-line, and badge-standard surfaces.
- Post-check responses show at least three distinct moves: direct side/vote
  boundary, short hold waiting for counterclaim, discomfort, target shift, and
  self/counter-claim.
- The public-check name-suffix validator fix clearly reduced action fallback.

Remaining issues:

- Speech fallback remains 4/25, so subjective speech read is still polluted.
- Local eval warns repeated sheriff-standard quotation:
  `警徽要给能听完对跳还能把票口说清的人` appears in 4/34 speech-like rows.
  This is now mostly quote propagation from one sheriff speech into following
  D1 speeches, not the old fallback claim bridge.
- One sheriff speech exposed adjacent exact repetition:
  `我跳预言家，9号是查杀。我跳预言家，9号是查杀。`
  Existing `normalizeSpeech -> dedupeSpeechSentences` now has a focused
  regression test for adjacent duplicate sheriff claim sentences.

Current recommendation: do not spend another paid 12p sample immediately.
First handle remaining no-cost local issues around provider stability/fallback
rate and quote propagation, then rerun one final bounded 12p sample.

## Local Follow-up After The Second Rerun

The remaining second-rerun speech fallback rows and local eval warnings were
reviewed without spending another live sample. Three local issues were fixed:

- Speech-side public-check attribution now exact-matches full player names
  before extracting digits, matching the action-side `DeepSeek2` fix. A grounded
  claim such as `8号Kimi报DeepSeek2查杀` no longer resolves `DeepSeek2` as seat 2.
- Generic counterclaim-status wording after a public Seer check is allowed.
  Lines such as `现在没人对跳预言家` or `看有没有对跳` are status reads, not an
  attempt to turn the check result itself into a Seer claim.
- Repeated full quote propagation is now surfaced to the ordinary speech
  director. If multiple recent seats already quote the same sheriff-standard
  sentence, later seats get explicit guidance to paraphrase, react, or change
  handling action instead of copying the sentence again; `quoteOneLine` is also
  removed from allowed moves for that context.

Two suspicious fallback shapes from the rerun were covered by existing or
already-passing checks and did not need new implementation:

- Negated Witch-boundary criticism like `你没有拍自己是女巫` is not treated as a
  Witch-claim attribution.
- Witch silver-water information and a separate Seer black check are not
  cross-read as fabricated public checks.

Local targeted checks passed:

- `npm run test -- src/ai/speechProviders.test.ts -t "repeated full-quote propagation|negated witch-boundary|target name ends with a digit in speech|witch silver water|generic counterclaim status"`
- `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`
- `npm run test -- src/ai/llmEvaluation.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run lint`

These fixes narrow the known local causes from the second rerun, but they do
not by themselves prove final 12p acceptance. One final bounded paid rerun is
still needed to confirm fallback rate and table-level variety.

## Final Post-Localfix Bounded Rerun

Files:

- `tmp/12p-mimo-speech-mechanics-post-localfix-live-report.json`
- `tmp/12p-mimo-speech-mechanics-post-localfix-live-cases.json`
- `tmp/12p-mimo-speech-mechanics-post-localfix-live-eval.json`

Summary:

- Total calls: 72
- Speech calls: 25
- Action calls: 47
- Fallback count: 4
- Error count: 4
- Validation failure count: 1
- Failure type split: `ok` 56, `retry_ok` 12, `provider_error` 4
- Local eval: 72 cases, averageScore 97.5, issueCount 10
- Local eval high-risk cases: 2
- Sample warnings:
  - `repeated_surface_phrase`: 3/32, mainly `我先按这个背景听`
  - `repeated_clause_rate`: 2/32, repeated `我先接10号Claude2一句...`
  - `action_distribution_skew`: 25/32 rolePublicAction

Read:

- The local no-paid fixes helped: fallback improved from 6/72 to 4/72, and
  validation failures improved from 2 to 1.
- The old repeated sheriff-standard full quote warning is gone from the sample
  warning list. A smaller repeated-bridge issue remains around `我先接10号...`.
- The remaining hard issue shifted to the action path: public action reasons can
  leak private role/night-action information. Example: 10号女巫's sheriff vote
  reason said `作为女巫，我首夜救了2号...`.

## Local Follow-up After Final Rerun

Added a hard action-provider guard for public action reasons:

- Public action phases now tell the model that reasons must use public table
  evidence only, and must not say the speaker's hidden role or private night
  action.
- `validateActionDecision` rejects public action reasons that expose the
  actor's own private role or night action, such as `我作为女巫...` or
  `我首夜救了2号...`.
- The repair path can replace a private self-leaking reason with a public
  candidate reason hint, so a fixable reason does not automatically force
  fallback.
- Public references to another seat's already-public Witch claim remain allowed.

Focused checks passed:

- `npm run test -- src/ai/actionProviders.test.ts -t "public action reasons"`
- `npm run test -- src/ai/actionProviders.test.ts`
- `npm run test -- src/ai/speechProviders.test.ts src/ai/actionProviders.test.ts`

Do not call the final rerun a full acceptance gate yet. The latest paid sample
is the best 12p read so far, but it exposed a new hard action-boundary defect
that has only been fixed locally after the sample.

## Post-Private-Guard Bounded Rerun

After the action private-leak guard, a smaller 50-call bounded 12p live sample
was run on the same board and seed:

- `tmp/12p-mimo-speech-mechanics-post-private-guard-live-report.json`
- `tmp/12p-mimo-speech-mechanics-post-private-guard-live-cases.json`
- `tmp/12p-mimo-speech-mechanics-post-private-guard-live-eval.json`

Summary:

- Total calls: 50
- Speech calls: 13
- Action calls: 37
- Fallback count: 7
- Error count: 7
- Validation failure count: 2
- Local eval: 50 cases, averageScore 98, issueCount 6, highRiskCaseIds empty

Private-leak read:

- The original hard leak shape, such as `作为女巫，我首夜救了2号...`, did not
  recur.
- No `公开行动理由泄露私有身份或夜晚信息` validation hits occurred in the sample.
- A scan of exported cases found only legal public speech role claims, such as
  a Seer publicly saying `我是预言家`.

The sample was still not clean enough for acceptance because all 7 fallbacks
clustered in `DAY_SPEECH`. The main cause was repeated retry failure on
`D1首验理由不是主要攻击点`: the model kept attacking or asking for first-check
motive, and ordinary-mode retry instructions did not yet tell it how to repair
that specific error.

Local follow-up after this sample:

- Added ordinary retry guidance for `D1首验理由不是主要攻击点`, steering repairs toward
  checked-seat response, counterclaim status, rescue/follow pressure, or vote
  treatment instead of first-check motive.
- Extended public action private-leak validation from power-role/night-action
  leaks to public reasons that reveal the actor as `平民/民牌/村民/闭眼平民`.

Focused checks passed:

- `npm run test -- src/ai/speechProviders.test.ts -t "ordinary D1 first-check motive"`
- `npm run test -- src/ai/actionProviders.test.ts -t "public action reasons"`

## Final Post-Retryfix Bounded Rerun

A final 50-call bounded 12p live sample was then run after the ordinary retry
fix:

- `tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json`
- `tmp/12p-mimo-speech-mechanics-post-retryfix-live-cases.json`
- `tmp/12p-mimo-speech-mechanics-post-retryfix-live-eval.json`

The runner status file ended as `failed` only because the final status write
raced with local polling; the report, cases, eval JSON, and both stderr logs
were complete. Treat the JSON outputs as the source of truth.

Summary:

- Total calls: 50
- Speech calls: 13
- Action calls: 37
- Fallback count: 1
- Error count: 1
- Validation failure count: 0
- Failure type split: `ok` 45, `retry_ok` 4, `provider_error` 1
- Local eval: 50 cases, averageScore 98.2, issueCount 5, highRiskCaseIds empty
- Phase fallback split: 1 fallback in D1 `DAY_SPEECH`, none in sheriff/action
  phases or `DAY_VOTE`

Private-leak read:

- No own Witch/Seer/Hunter/Guard/Wolf night-action leak appeared in exported
  outputs.
- No action validation hit `公开行动理由泄露私有身份或夜晚信息`.
- The only strict private-leak scanner hit was a legal public Seer speech:
  `我是预言家。昨夜验了9号DeepSeek2，查杀。`
- One sheriff nomination reason said `我作为闭眼位先不上警`; this is a lower-risk
  private-self-label, not a night-action leak, but it should still be blocked in
  public action reasons. A local guard for `闭眼位/闭眼好人` was added after the
  sample and covered by `public action reasons`.

Remaining report-only surface warnings:

- `repeated_surface_phrase`: 4/21, mostly `我听到了，但你...`
- `repeated_clause_rate`: 2/21, repeated
  `{seat}号已经给过公开身份信息，当前先听{seat}号哪里没说清`
- One fallback was caused by repeated failure on
  `报查验结果等同预言家声明，不能追问是否跳预言家`

Mechanism verdict:

- The original Fable5 blockers are resolved at the mechanism gate: sheriff
  speech is no longer the fixed template, public-check handling has multiple
  moves, private-leak action reasons are guarded, fallback rate is within the
  requested bounded threshold, and local eval has no high-risk cases.
- Remaining issues are report-only surface variety and one locally guarded
  `闭眼位` action-reason boundary. Do not spend another paid sample by default;
  rerun only if the user specifically wants live proof for the final
  `闭眼位/闭眼好人` guard.
