# 学级裁判开场角色片头

## Task

Short name: 学级裁判开场角色片头

Goal:

学级裁判主题局每局开局后先播放 9 人倒序角色片头，再进入裁判席。片头全日文显示称号、名字和字幕，可跳过，只影响本地主题局。

Why it matters:

- 让本地 `class-trial` 主题局具备开局仪式感。
- 把本地私有立绘和音频素材接入主题局，但不影响 `/rooms`、Public Alpha 或普通狼人杀模式。

## Task Gate

Task type: Frontend/UI + local-only asset/audio pipeline.

Risk level: medium

Required verification tier:

- [ ] Docs/readback only
- [x] Focused automated test
- [x] Lint/type/build confidence
- [x] Smoke or browser/manual flow
- [ ] Production/release check

Browser/manual verification:

- Required? yes
- If yes, flow or URL: homepage -> 学级裁判主题局 -> audio ready/waiting -> opening intro -> skip -> court table; `/rooms` has no opening intro entry.
- If skipped, reason: record the specific blocker and residual risk in the handoff.

State updates required:

- [x] `feature_list.json`
- [x] `progress.md`
- [x] `session-handoff.md`
- [x] Relevant `docs/tasks/*.md`
- [ ] Not needed because:

Skipped checks must record:

- Check skipped:
- Reason:
- Residual risk:

## Context To Read First

- `README.md`
- `docs/harness-orientation.md`
- `feature_list.json`
- `progress.md`
- `long_running_tasks.json`
- `session-handoff.md`
- `docs/README.md`
- `docs/harness-state.md`
- `docs/feature-registry.md`
- `docs/working-agreements.md`
- Relevant `docs/threads/*.md`
- This task card: `docs/tasks/2026-06-class-trial-opening-character-intro.md`

## Allowed Scope

In scope:

- 本地 `class-trial` 单机/观战局。
- `local-assets/class-trial-pack/intro/intro.json` 解析。
- 本地 ignored 片头人物透明立绘和音频路径。
- 首页主题选择后的片头音频准备状态。
- 开局后的片头等待态、播放器、跳过和自然结束。
- GPT-SoVITS 生成 7 个弹丸角色开场音频。
- `/class-trial-pack` 路由服务本地音频。

Canonical intro content:

| order | id | displayNameJa | titleJa | subtitleJa | audioMode | audio file path | external source URL | source range |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `anon` | `千早 愛音` | `超高校級のギタリスト` | `あはは...` | `external` | `/class-trial-pack/intro/audio/anon.wav` | `https://www.bilibili.com/video/BV1WGS3YMEZz/` | `0:00-0:03` |
| 2 | `tomori` | `高松 燈` | `超高校級の詩人` | `ペンギン、ぐーぐーがーがー。` | `external` | `/class-trial-pack/intro/audio/tomori.wav` | `https://www.bilibili.com/video/BV1ewwxesEu4/` | `0:00-0:03` |
| 3 | `togami` | `十神 白夜` | `超高校級の御曹司` | `俺が導いてやる。` | `generated` | `/class-trial-pack/intro/audio/togami.wav` |  |  |
| 4 | `celestia` | `セレスティア` | `超高校級のギャンブラー` | `わたくしはセレスティア・ルーデンベルクですわ。` | `generated` | `/class-trial-pack/intro/audio/celestia.wav` |  |  |
| 5 | `enoshima` | `江ノ島 盾子` | `超高校級の分析師` | `絶望的に飽きちゃった。` | `generated` | `/class-trial-pack/intro/audio/enoshima.wav` |  |  |
| 6 | `monokuma` | `モノクマ` | `超高校級の学園長` | `うぷぷぷぷ。` | `generated` | `/class-trial-pack/intro/audio/monokuma.wav` |  |  |
| 7 | `fukawa` | `腐川 冬子` | `超高校級の文学少女` | `どうせ私なんて...` | `generated` | `/class-trial-pack/intro/audio/fukawa.wav` |  |  |
| 8 | `kirigiri` | `霧切 響子` | `超高校級の探偵` | `ここまで言えば分かるわね?` | `generated` | `/class-trial-pack/intro/audio/kirigiri.wav` |  |  |
| 9 | `naegi` | `苗木 誠` | `超高校級の幸運` | `それは違うよ!` | `generated` | `/class-trial-pack/intro/audio/naegi.wav` |  |  |

Local asset policy:

- Tracked implementation tasks must not stage or commit `local-assets/`, `tmp/`, generated image files, generated Bilibili clips, or generated GPT-SoVITS audio.
- A separate local asset-preparation pass for this feature may create or update ignored files under `local-assets/class-trial-pack/intro/**` and `tmp/**` for local smoke testing only.
- Before and after asset generation, run `git check-ignore -v local-assets/class-trial-pack/intro/intro.json`, `git check-ignore -v local-assets/class-trial-pack/intro/audio/naegi.wav`, and `git status --short local-assets tmp`.
- Before any docs/state commit, run `git diff --cached --name-only` and confirm no `local-assets/` or `tmp/` paths are staged.

Out of scope:

- `/rooms` 和 Public Alpha。
- 普通狼人杀模式。
- 狼人杀规则、投票、AI 决策、胜负。
- 提交 B 站截取音频、imagegen 立绘、缓存音频。
- 每个角色首次发言前弹窗。

Files or directories the agent may edit:

- `src/components/GameClient.tsx`
- `src/components/game/classTrialIntro.ts`
- `src/components/game/classTrialIntro.test.ts`
- `src/components/game/classTrialIntroAudio.ts`
- `src/components/game/classTrialIntroAudio.test.ts`
- `src/components/game/ClassTrialOpeningIntro.tsx`
- `src/components/game/ClassTrialOpeningIntro.test.tsx`
- `src/components/game/GamePanels.tsx`
- `src/components/game/LandingPanel.tsx`
- `src/components/game/gamePanelsMobile.test.ts`
- `src/app/class-trial-pack/[...assetPath]/route.ts`
- `src/app/class-trial-pack/[...assetPath]/route.test.ts`
- `src/app/api/class-trial-intro/audio/route.ts`
- `src/app/api/class-trial-intro/audio/route.test.ts`
- `src/app/globals.css`
- `docs/tasks/2026-06-class-trial-opening-character-intro.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`

Files or directories the agent should not edit:

- `.env`
- generated caches
- unrelated modules
- `local-assets/class-trial-pack/intro/**` tracked state
- `tmp/**` tracked state
- `/rooms` implementation unless explicitly needed to prove no intro entry appears

## Definition Of Done

This task is complete when:

- 选择 `学级裁判主题局` 后，首页显示开场片头音频准备状态。
- 创建学级裁判主题局后，进入裁判席前显示片头或片头准备等待态。
- 片头按 `anon -> tomori -> togami -> celestia -> enoshima -> monokuma -> fukawa -> kirigiri -> naegi` 播放。
- 片头只显示日文称号、日文角色名和日文字幕，不显示座位号。
- 片头自然结束进入 `ClassTrialGameTable`。
- 点击跳过停止当前音频并进入 `ClassTrialGameTable`。
- `/rooms` 不读取或显示片头入口。
- 本地素材和缓存音频保持 untracked/ignored。
- Canonical intro data matches the table in this task card, including `displayNameJa`, `titleJa`, `subtitleJa`, `audioMode`, and audio file paths for all 9 characters.
- Before staging, run `git status --short` and verify no `local-assets/class-trial-pack/intro/**` files are staged.
- Before any docs/state commit, run `git diff --cached --name-only` and verify no `local-assets/` or `tmp/` paths are staged.
- The local image/audio assets are private and must not enter Git.

## Verification

Required checks:

- `npm run test -- src/components/game/classTrialIntro.test.ts src/components/game/classTrialIntroAudio.test.ts src/components/game/ClassTrialOpeningIntro.test.tsx src/app/class-trial-pack/[...assetPath]/route.test.ts src/app/api/class-trial-intro/audio/route.test.ts src/components/game/gamePanelsMobile.test.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `git check-ignore -v local-assets/class-trial-pack/intro/intro.json`
- `git check-ignore -v local-assets/class-trial-pack/intro/audio/naegi.wav`
- `git status --short local-assets tmp`
- Browser smoke: homepage -> 学级裁判主题局 -> audio ready/waiting -> opening intro -> skip -> court table.
- Browser smoke: `/rooms` has no opening intro entry.

Optional deeper checks:

- Full baseline only if the touched implementation area grows beyond this task card: `npm run test`, `npm run build`.

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
