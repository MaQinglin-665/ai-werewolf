# Harness Task Template

Use this template when a task is large enough that an agent needs explicit
scope, verification, and handoff instructions.

Harness idea: a task card is a small contract. It tells the agent what counts
as progress and what would be out of bounds.

## Task

Short name:

Goal:

Why it matters:

## Task Gate

Task type:

Risk level: low | medium | high

Required verification tier:

- [ ] Docs/readback only
- [ ] Focused automated test
- [ ] Lint/type/build confidence
- [ ] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes | no
- If yes, flow or URL:
- If skipped, reason:

State updates required:

- [ ] `feature_list.json`
- [ ] `progress.md`
- [ ] `session-handoff.md`
- [ ] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped:
- Reason:
- Residual risk:

## Context To Read First

- `docs/working-agreements.md`
- `docs/threads/<thread-name>.md`
- Other relevant docs:

## Allowed Scope

Files or directories the agent may edit:

- 

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated modules

## Definition Of Done

This task is complete when:

- 

## Verification

Required checks:

- 

Optional deeper checks:

- 

If a check cannot be run, record the reason in the handoff.

## Handoff

```text
Completed:
- ...

Changed files:
- ...

Verification:
- ...

Remaining risks:
- ...
```
