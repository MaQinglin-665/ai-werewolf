# 12p DeepSeek D3 Proof After Pronoun Self-Check Fix

Date: 2026-06-14

Scope: one same-seed 12-player bounded D3/D4 proof using `deepseek-chat` after
the local target-before-pronoun self-check fix. The goal was to verify both
structured-check attribution directions:

- quoted/reported checks from another claimed Seer must not pollute the current
  speaker's `checks`;
- self-owned Seer or fake-Seer checks must still enter the speaker's `checks`.

## Evidence

- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-preflight-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-preflight-cases.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-cases.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-eval.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-pronounfix-hardscan.json`

## Run Result

- Preflight: 1 action call, fallback 0, error 0, validationFailure 0.
- Full run: 100 calls, 33 speech, 67 action.
- Stop reason: `max_llm_calls`; reached day 4 `DAY_SPEECH`.
- fallback/error: 1/100.
- validationFailureCount: 1 in the report summary.
- Local eval: 80 cases, averageScore 97.7, issueCount 8,
  highRiskCaseIds 3.

Hard scan:

- private leak hits: 0
- accepted fragment hard-shape hits: 0
- malformed output fragment issues: 0
- non-Seer claimBoard checks: 0
- claimed-Seer same-target contradictions: 0
- quoted-check rows: 32
- target-before-pronoun self-check rows: 0

## New Hard Failure

The exact target-before-pronoun trigger from the previous proof did not recur.
Instead, this run found a same-sentence mixed attribution variant.

At D1 `DAY_SPEECH`, 4号 豆包 said:

`2号Claude跳预言家报9号查杀，我先不听这个，因为我是预言家，昨晚验的2号Claude，查杀。今天票口先压2号。`

The first clause legally references 2号 Claude's public 9号查杀. The later
clause is 4号 豆包's own fake-Seer check against 2号 Claude. The exported
`publicClaimBoard` then recorded:

- 2号 Claude claimed Seer with 9号 DeepSeek2 `WEREWOLF`.
- 4号 豆包 claimed Seer with `checks: []`.
- 5号 Mimo claimed Hunter with `checks: []`.

This caused later legal references to "4号反手报2号查杀" to be judged against a
stale/dirty board, producing three `logic_boundary_error` high-risk rows. The
downstream eval rows are symptoms; the source failure is the missing 4->2
`WEREWOLF` check.

## Root Cause

`isReferencedOtherClaimantCheck()` scoped the quote/report attribution test to
the whole sentence. In this sentence, the first clause
`2号Claude跳预言家报9号查杀` correctly looks like another Seer's reported check,
but that whole-sentence result incorrectly suppressed the later self-owned
clause `因为我是预言家，昨晚验的2号Claude，查杀`.

The issue is not another missing quote blacklist. It is a scoping bug: quoted
check attribution must be decided near the current check candidate, not across
the whole sentence when clauses change ownership.

## Local Follow-up

- Added a red regression in `src/game/claims.test.ts`:
  `keeps a same-sentence self-owned check after quoting another seer check`.
- `src/game/claims.ts` now scopes quote/report ownership checks to the local
  attribution clause around the candidate check, while still using the sentence
  boundary to find the result text.
- Historical quote protections still pass: old reported checks and
  target-as-subject reports are not attached to the current speaker.

## Current Decision

Not `go`. This proof reached the right D3/D4 envelope and old hard gates stayed
clean, but it failed the self-owned structured check side through 4号 豆包's
same-sentence mixed attribution.

The local fix is narrow and test-backed. The next acceptance proof, if the user
supplies temporary provider input again, should verify:

- 4号-style same-sentence quote plus self-check produces 4->2 `WEREWOLF`;
- 11号-style target-before-pronoun self-check still produces its own check if
  it recurs;
- quoted/reported checks from other seats still do not enter the speaker's
  `checks`;
- old hard gates remain 0.

## Local Cost-Control Follow-up

After this report, the repeated paid rerun pattern was judged too expensive for
finding more attribution phrasings in the same bug class. The follow-up moved
the live examples into deterministic local coverage and replayed current
extraction over existing case files without provider calls.

Evidence:

- `src/game/claims.test.ts`
- `tmp/12p-claim-attribution-local-rescan.json`

Local invariant matrix:

- quoted dead-Seer old check does not pollute a speaker's new check;
- target-before-pronoun self-check is retained;
- target-as-subject quote before self-check does not suppress the self-check;
- report verbs such as `给/留/报/说/称` are not treated as self-owned check verbs;
- same-sentence quote then self-check keeps the later self-check;
- current-Seer quote after the speaker's own counterclaim does not create a
  second speaker-owned check.

Rescan result:

- case files scanned: 6
- cases scanned: 550
- speech rows scanned: 246
- extracted Seer claims: 30
- `potentialMissingSelfCheckCount`: 0
- `staleBoardMismatchCount`: 4, from old board metadata generated before the
  current extractor fixes

Verification:

- `npm.cmd run test -- src/game/claims.test.ts -t "live seer-check attribution invariant"` passed: 6 tests.
- `npm.cmd run test -- src/game/claims.test.ts` passed: 41 tests.
- `npm.cmd run test -- src/game/claims.test.ts src/ai/llmEvaluation.test.ts src/ai/speech/ordinarySurface.test.ts`
  passed: 82 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run harness:task-card -- docs/tasks/2026-06-12p-mimo-speech-mechanics.md` passed.
- `npm.cmd run harness:long-tasks` passed.
- JSON parse for `long_running_tasks.json` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over touched source/docs/state found 0 matches.

Decision:

Pause paid exploratory reruns. This does not turn the stale live proof into a
full live `go`, but it is enough evidence to stop spending model calls on local
variant discovery. Any future paid work should be a single explicit final
acceptance proof, not another open-ended diagnostic loop.
