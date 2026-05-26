# Frontend CSS Boundary Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the current frontend CSS and component ownership boundaries so the next frontend refactor can be narrow, agent-friendly, and verifiable.

**Architecture:** This is a docs-only execution of the Phase 1 frontend structure task. It reads `src/app/globals.css`, records a stable section map, updates routing docs, and leaves rendered CSS behavior unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, global CSS in `src/app/globals.css`, harness task cards, structure audit scripts.

---

### Task 1: Record CSS And Frontend Boundary Map

**Files:**
- Modify: `docs/tasks/2026-05-frontend-css-boundary-map.md`
- Modify: `docs/architecture.md`
- Modify: `docs/feature-registry.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Inspect current CSS outline**

Run:

```powershell
rg -n "^/\*|^@media|^@keyframes|^@layer|^[.#][A-Za-z0-9_-]+|^body|^:root|^html" src\app\globals.css
```

Expected: output includes base selectors at the top, a phone media block around line 2080, a compact-height phone media block around line 4465, reduced-motion around line 4506, and another narrow media block around line 4596.

- [ ] **Step 2: Write the CSS map into the task card**

Add an execution record to `docs/tasks/2026-05-frontend-css-boundary-map.md` with the observed line ranges and next safe refactor candidate.

- [ ] **Step 3: Add architecture routing**

Update `docs/architecture.md` so future agents know `globals.css` is still a legacy shared style surface and that Phase 1 maps sections before physical splitting.

- [ ] **Step 4: Add feature-registry routing**

Update `docs/feature-registry.md` in the table UI area so future frontend structure work starts from the boundary design and task card.

- [ ] **Step 5: Update state files**

Mark `frontend-structure-boundaries` done in `feature_list.json`, update `progress.md`, and refresh `session-handoff.md`.

- [ ] **Step 6: Verify**

Run:

```powershell
npm run audit:structure
npm run harness:task-card -- docs/tasks/2026-05-frontend-css-boundary-map.md
npm run harness:check
node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list ok')"
```

Expected: all commands pass. Browser/manual verification is skipped because no rendered behavior changes.
