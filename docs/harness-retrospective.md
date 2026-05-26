# Harness Retrospective

Use this file when a task reveals a repeated failure, confusing workflow,
missing verification rule, or useful shortcut that future agents should know.

Harness idea: every real task can improve the harness. Do not write every
minor observation here; write back lessons that would change future behavior.

## When To Write Back

Add or propose a harness update when one of these happens:

- A command times out, fails noisily, or gives misleading output.
- An agent picked the wrong files, docs, thread, or verification command.
- A task needed a repeated explanation that should live in the repository.
- A manual check revealed something automated checks missed.
- A workflow was too heavy and a narrower check would have been enough.
- A production, room, AI, or UI check had a reusable gotcha.

Do not add a retrospective entry for one-off trivia, personal preference, or
facts that will quickly become stale unless the stale nature is clearly marked.

## Retrospective Entry Template

```md
## YYYY-MM-DD - Short lesson title

Task type:

What happened:

Evidence:
- Command, file, log, or manual observation:

Why it matters:

Harness update:
- [ ] `AGENTS.md`
- [ ] `docs/harness-state.md`
- [ ] `docs/verification-matrix.md`
- [ ] `docs/feature-registry.md`
- [ ] `docs/tasks/HARNESS_TASK_TEMPLATE.md`
- [ ] Other:

Follow-up:
```

## Write-Back Rules

- Prefer updating the most specific harness file:
  - startup/order/rules -> `AGENTS.md`
  - current state/recent lesson -> `docs/harness-state.md`
  - task type/check choice -> `docs/verification-matrix.md`
  - source/test/doc location -> `docs/feature-registry.md`
  - task scoping shape -> `docs/tasks/HARNESS_TASK_TEMPLATE.md`
- If the lesson is only a candidate, record it as a follow-up instead of making
  it a hard rule.
- Include evidence. A retrospective without evidence becomes folklore.
- Keep entries short enough that future agents will actually read them.

## Current Lessons Captured Elsewhere

- Full speech-provider checks can timeout; small diagnostics should start with
  one persona and no retries. See `docs/verification-matrix.md`.
- `WebSocket server error: Port 24678 is already in use` can be environment
  noise when the command exits 0. See `docs/verification-matrix.md` and
  `docs/harness-state.md`.
- In PowerShell, direct ripgrep globs such as `rg src\game\*.test.ts` can fail
  with path syntax errors. Prefer `rg --files` and then filter the file list.
