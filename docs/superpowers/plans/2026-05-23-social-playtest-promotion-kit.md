# Social Playtest Promotion Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a repo-local Chinese promotion kit that the project owner can copy into WeChat Moments and adapt to small public social platforms.

**Architecture:** This is a documentation-only deliverable. Create one focused Markdown artifact under `docs/promotion/` and add a short index link in `docs/README.md` so future sessions can find it.

**Tech Stack:** Markdown documentation in the existing `docs/` tree; verification with `rg` and `git diff --check`.

---

### Task 1: Create The Promotion Kit Document

**Files:**
- Create: `docs/promotion/social-playtest-kit.md`

- [ ] **Step 1: Create the document directory and file**

Use `apply_patch` to add `docs/promotion/social-playtest-kit.md`.

- [ ] **Step 2: Include the required sections**

The document must include:

```markdown
# AI 狼人杀朋友圈试玩素材包

## 使用场景
## 朋友圈长文案
## 朋友圈短文案
## 配图脚本
## 私聊邀请
## 试玩反馈 5 问
## 公开平台改写
## 发布前检查
```

- [ ] **Step 3: Keep the Alpha framing honest**

The copy must include the Tencent Cloud link `https://175.178.199.245`, mention that this is an Alpha playtest, and avoid promising a polished public beta.

### Task 2: Link The Kit From Docs Index

**Files:**
- Modify: `docs/README.md`

- [ ] **Step 1: Add a docs index bullet**

Add a bullet for `promotion/social-playtest-kit.md` near the other Alpha/playtest docs.

- [ ] **Step 2: Keep wording short**

The index description should say this is a copy-paste social sharing and friend playtest invite kit.

### Task 3: Verify And Commit

**Files:**
- Verify: `docs/promotion/social-playtest-kit.md`
- Verify: `docs/README.md`

- [ ] **Step 1: Check the required content is present**

Run:

```powershell
rg -n "https://175\.178\.199\.245|Alpha|朋友圈长文案|试玩反馈 5 问|小红书|微博|B站" docs/promotion/social-playtest-kit.md docs/README.md
```

Expected: all required phrases appear.

- [ ] **Step 2: Check markdown whitespace**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Commit**

Run:

```powershell
git add docs/promotion/social-playtest-kit.md docs/README.md docs/superpowers/plans/2026-05-23-social-playtest-promotion-kit.md
git commit -m "docs: add social playtest promotion kit"
```

Expected: commit succeeds.
