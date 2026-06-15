# 12p DeepSeek Final Acceptance Proof

Date: 2026-06-14

Scope: one same-seed 12-player bounded live proof using `deepseek-chat`, after
the local Seer-check attribution invariant suite and current extractor fixes.
The run was meant to answer one question: whether the live D3 table can exercise
quoted/reported Seer checks plus a new fake-Seer self-check without polluting
`publicClaimBoard`.

## Evidence

- `tmp/12p-deepseek-chat-final-acceptance-preflight-report.json`
- `tmp/12p-deepseek-chat-final-acceptance-preflight-cases.json`
- `tmp/12p-deepseek-chat-final-acceptance-report.json`
- `tmp/12p-deepseek-chat-final-acceptance-cases.json`
- `tmp/12p-deepseek-chat-final-acceptance-hardscan.json`
- `tmp/12p-deepseek-chat-final-acceptance-eval.json`
- `tmp/12p-deepseek-chat-final-acceptance-after-eval-calibration-eval.json`
- `tmp/12p-deepseek-chat-final-acceptance-stdout.log`

## Run Result

- Preflight: 1 real `deepseek-chat` action call, fallback 0, error 0,
  validationFailure 0.
- Full run: 100 calls, 32 speech, 68 action.
- Stop reason: `max_llm_calls`; reached day 3 `DAY_VOTE`.
- Completed games: 0/1, by design for this bounded D3 proof.
- Provider noise: fallback 9/100, error 9/100, validationFailure 4/100.
- Quality issues: 2 `speech_vote_discontinuity`.

## Hard Scan

- non-Seer claimBoard checks: 0
- claimed-Seer same-target contradictions: 0
- private leak hits: 0
- accepted fragment hard-shape hits: 0
- Seer claim snapshots scanned: 227
- D3 speech rows scanned: 9
- trigger text rows scanned: 64

The key live trigger occurred on D3. 8号 Kimi publicly claimed Seer:

`好，我跳个预言家。1号DeepSeek是金水，我昨天夜里验的。...因为Claude和GLM两个预言家遗言都锁着9号...`

The next `publicClaimBoard` snapshot kept:

- 8号 Kimi claimed Seer with only `8 -> 1 GOOD`;
- 2号 Claude and 7号 GLM retained their own public 9号查杀 entries;
- 5号 Mimo remained Hunter with `checks: []`.

This exercises both sides of the final hard gate: a fake-Seer self-owned check
is retained, while quoted dead/other-Seer checks do not enter the speaker's
structured `checks`.

## Evaluator Calibration

The first local eval on these cases reported:

- 80 cases, averageScore 99, issueCount 3.
- highRiskCaseIds: 2, both `logic_boundary_error`.

Both high-risk rows were false positives: non-Seer speakers legally referenced
2号 Claude's public 7号金水, which was already present in `publicClaimBoard`.

The offline evaluator calibration added regressions for:

- `2号Claude今天报7号金水，说自己验了7号`;
- `2号压力链已经成形了——豆包遗言留查杀、今天报7号金水`.

After calibration:

- 80 cases, averageScore 99.8, issueCount 1.
- highRiskCaseIds: empty.
- Remaining item: 1 `no_concrete_progression`, plus report-only sample warnings
  for repeated surface phrasing.

## Verification

- `npm.cmd run test -- src/ai/llmEvaluation.test.ts` passed: 40 tests.
- `npx.cmd tsc --noEmit --pretty false` passed.
- `npm.cmd run lint` passed.
- `git diff --check` passed with LF/CRLF warnings only.
- Secret-pattern scan over generated DeepSeek final proof outputs found 0
  real key or Bearer token matches.

## Decision

`go-hardgate` for the 12p structured Seer-check attribution gate on this
DeepSeek final proof.

Do not run another paid attribution proof by default. The known hard gates are
clean in the live D3 trigger that matters:

- quoted/reported checks from other Seers do not pollute the speaker;
- self-owned fake-Seer checks still enter the speaker;
- non-Seer checks remain empty;
- same-target contradictions remain 0;
- private leak and accepted-fragment scans remain 0;
- evaluator high-risk rows are clean after offline calibration.

Remaining risks:

- DeepSeek provider stability was noisy in this sample: fallback/error 9/100
  and validationFailure 4/100. This is not a hard attribution failure, but it
  should not be described as a no-noise live run.
- This proof validates the current mechanics path with `deepseek-chat`. It does
  not replace a separate Mimo-specific full-game subjective read-feel sample if
  the product goal returns to Mimo voice quality rather than structural gates.
