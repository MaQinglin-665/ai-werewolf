# Agent 文档入口整理

## Task

Short name: agent-doc-entrypoints

Goal: 整理 `README.md` 和 `docs/README.md`，让 AI agent 更容易找到工作所需文档，并明确应从根目录 `AGENTS.md` 开始。

Why it matters: harness 的第一层价值是让项目入口成为事实来源。新线程或新 agent 不应该依赖聊天记忆来猜该读哪些文档、按哪个线程边界工作、如何验证。

## Context To Read First

- `AGENTS.md`
- `docs/working-agreements.md`
- `docs/threads/docs.md`
- `docs/README.md`
- `README.md`

## Allowed Scope

Files or directories the agent may edit:

- `README.md`
- `docs/README.md`
- `docs/tasks/2026-05-agent-doc-entrypoints.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- business source code under `src/**`
- scripts unrelated to documentation entrypoints

## Definition Of Done

This task is complete when:

- `README.md` points AI agents to `AGENTS.md` without making the player-facing quick start harder to read.
- `docs/README.md` clearly distinguishes human/project docs from agent workflow docs.
- The existing docs structure is preserved; no parallel documentation system is introduced.
- The handoff records changed files, verification, and remaining risks.

## Verification

Required checks:

- Read back `README.md` and `docs/README.md` to verify the entrypoint language is present and clear.
- Run `git diff -- README.md docs/README.md docs/tasks/2026-05-agent-doc-entrypoints.md`.

Optional deeper checks:

- `npm run lint` is not required for this docs-only change.

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
