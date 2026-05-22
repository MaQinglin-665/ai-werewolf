"use client";

import { useMemo, useState } from "react";
import { getBoardPreset } from "@/game/boards";
import type { AvailableHumanAction, HumanGameView, Role } from "@/game/types";
import { ROLE_CARD_BOOK_IMAGES, ROLE_CARD_IMAGES } from "./viewHelpers";
import {
  IDENTITY_BOOK_FILTERS,
  IDENTITY_BOOK_ROLE_ORDER,
  ROLE_INTROS,
  ROLE_LINK_TIPS,
  type IdentityBookFilter,
  type RoleCamp,
  type RoleLinkTip,
  type RolePhaseHint,
} from "./RoleKnowledgeContent";
import { RoleCardArtwork } from "./RoleCardArtwork";
import { RoleIntroItem } from "./RoleIntroOverlay";

export function IdentityBookOverlay({
  game,
  activeBoardId,
  onClose,
}: {
  game?: HumanGameView | null;
  activeBoardId?: string;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<IdentityBookFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const activeBoard = activeBoardId ? getBoardPreset(activeBoardId) : undefined;
  const activeBoardRoleSet = useMemo(() => new Set(activeBoard?.roles ?? []), [activeBoard]);
  const activeBoardRoleCounts = useMemo(() => getRoleCounts(activeBoard?.roles), [activeBoard]);
  const currentRole = game && game.humanSeatId !== null ? game.myRole : undefined;
  const hasActiveBoard = Boolean(activeBoard);
  const enabledRoleCount = IDENTITY_BOOK_ROLE_ORDER.filter((role) => activeBoardRoleSet.has(role)).length;
  const normalizedSearchQuery = normalizeIdentityBookSearch(searchQuery);
  const visibleRoles = useMemo(
    () =>
      IDENTITY_BOOK_ROLE_ORDER.filter((role) => {
        const enabled = activeBoardRoleSet.has(role);
        const searchRoleSet = hasActiveBoard && enabled ? activeBoardRoleSet : undefined;
        return (
          identityBookRoleMatchesFilter(role, filter) &&
          identityBookRoleMatchesSearch(role, normalizedSearchQuery, searchRoleSet)
        );
      }),
    [activeBoardRoleSet, filter, hasActiveBoard, normalizedSearchQuery],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-book-title"
      className="role-intro-backdrop mobile-knowledge-overlay fixed inset-0 z-50 overflow-y-auto bg-black/86 px-3 py-5 backdrop-blur-md sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mobile-knowledge-card mx-auto w-full max-w-6xl rounded-[30px] border border-[#f1c76e]/30 bg-[#120c0a]/96 p-4 shadow-2xl shadow-black/70 sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mobile-knowledge-head mb-4 flex flex-col gap-3 border-b border-[#f1c76e]/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex rounded-full border border-[#f1c76e]/24 bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">
              身份书 · {visibleRoles.length}/{IDENTITY_BOOK_ROLE_ORDER.length} 个角色
            </div>
            <h2 id="identity-book-title" className="text-2xl font-semibold leading-tight text-[#f7ead5] sm:text-3xl">
              角色玩法技能
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#dcc9a7]">
              {activeBoard
                ? `当前板子：${activeBoard.name} · 启用 ${enabledRoleCount} 个身份`
                : "当前未绑定板子，按全部身份展示。"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-[#f1c76e]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
          >
            关闭
          </button>
        </div>

        <IdentityBookFocusPanel
          game={game ?? null}
          currentRole={currentRole}
          roleCounts={activeBoardRoleCounts}
          activeRoleSet={hasActiveBoard ? activeBoardRoleSet : undefined}
          onPreview={setPreviewRole}
        />

        <div className="mobile-knowledge-tools mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/14 bg-black/20 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto]">
            <div className="flex min-h-10 items-center rounded-full border border-[#f1c76e]/18 bg-[#090605]/70 px-3 focus-within:border-[#f1c76e]/48">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="搜索身份书"
                placeholder="搜索身份、技能或关键词"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#f7ead5] outline-none placeholder:text-[#7e6f5c]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-xs font-semibold text-[#ad9c7d] transition hover:text-[#f1d796]"
                >
                  清空
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {IDENTITY_BOOK_FILTERS.map((item) => {
                const active = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(item.id)}
                    className={[
                      "min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "border-[#f1c76e]/55 bg-[#3a2412]/82 text-[#f1d796]"
                        : "border-white/10 bg-black/18 text-[#ad9c7d] hover:border-[#f1c76e]/32 hover:text-[#f1d796]",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs lg:justify-end">
            {normalizedSearchQuery && (
              <span className="rounded-full border border-[#f1c76e]/18 bg-[#2a1b10]/46 px-2.5 py-1 text-[#f1d796]">
                匹配 {visibleRoles.length} 个
              </span>
            )}
            <span className="rounded-full border border-[#77d898]/18 bg-[#0f2118]/48 px-2.5 py-1 text-[#a8f0b6]">本板子</span>
            <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[#ad9c7d]">未启用置灰</span>
          </div>
        </div>

        <div className="soft-scrollbar mobile-knowledge-scroll grid gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3" style={{ maxHeight: "min(74vh, 760px)" }}>
          {visibleRoles.length > 0 ? (
            visibleRoles.map((role) => {
              const enabled = !hasActiveBoard || activeBoardRoleSet.has(role);
              return (
                <IdentityBookRoleCard
                  key={role}
                  role={role}
                  enabled={enabled}
                  hasActiveBoard={hasActiveBoard}
                  isCurrentRole={role === currentRole}
                  phaseHint={game ? getRolePhaseHint(role, game, role === currentRole) : undefined}
                  linkTips={getRoleLinkTips(role, enabled && hasActiveBoard ? activeBoardRoleSet : undefined)}
                  onPreview={setPreviewRole}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-[#f1c76e]/16 bg-[#1b120d]/56 px-4 py-8 text-center text-sm leading-6 text-[#ad9c7d] md:col-span-2 xl:col-span-3">
              未找到匹配身份。可以搜索“毒”“自爆”“决斗”“同守同救”“殉情”等关键词。
            </div>
          )}
        </div>
      </section>
      {previewRole && (
        <IdentityBookPreview
          role={previewRole}
          enabled={!hasActiveBoard || activeBoardRoleSet.has(previewRole)}
          hasActiveBoard={hasActiveBoard}
          boardName={activeBoard?.name}
          isCurrentRole={previewRole === currentRole}
          phaseHint={game ? getRolePhaseHint(previewRole, game, previewRole === currentRole) : undefined}
          linkTips={getRoleLinkTips(previewRole, hasActiveBoard && activeBoardRoleSet.has(previewRole) ? activeBoardRoleSet : undefined)}
          onClose={() => setPreviewRole(null)}
        />
      )}
    </div>
  );
}

function getRoleCounts(roles: readonly Role[] | undefined): { role: Role; count: number }[] {
  const counts = new Map<Role, number>();
  for (const role of roles ?? []) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  return IDENTITY_BOOK_ROLE_ORDER.map((role) => ({ role, count: counts.get(role) ?? 0 })).filter((item) => item.count > 0);
}

function IdentityBookFocusPanel({
  game,
  currentRole,
  roleCounts,
  activeRoleSet,
  onPreview,
}: {
  game: HumanGameView | null;
  currentRole?: Role;
  roleCounts: { role: Role; count: number }[];
  activeRoleSet?: ReadonlySet<Role>;
  onPreview: (role: Role) => void;
}) {
  if (!currentRole && roleCounts.length === 0) return null;

  const currentIntro = currentRole ? ROLE_INTROS[currentRole] : undefined;
  const currentHint = currentRole && game ? getRolePhaseHint(currentRole, game, true) : undefined;
  const currentLinkTips = currentRole ? getRoleLinkTips(currentRole, activeRoleSet).slice(0, 2) : [];
  const currentTone = currentIntro ? roleCampTone(currentIntro.camp) : undefined;

  return (
    <div className="mobile-knowledge-focus mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/16 bg-[#1b120d]/58 p-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[#f1c76e]/16 bg-black/20 p-3">
        {currentIntro && currentRole ? (
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <RoleCardArtwork
                role={currentRole}
                title={currentIntro.title}
                src={ROLE_CARD_BOOK_IMAGES[currentRole]}
                sizes="96px"
                className="w-[78px] rounded-xl border border-[#f1c76e]/36 shadow-lg shadow-black/35"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-[#f1c76e]/28 bg-[#3a2412]/58 px-2.5 py-1 text-xs font-semibold text-[#f1d796]">
                    你的身份
                  </span>
                  {currentTone && (
                    <span className={`${currentTone.pill} rounded-full border px-2.5 py-1 text-xs font-semibold`}>{currentIntro.camp}</span>
                  )}
                </div>
                <h3 className="mt-2 text-xl font-semibold text-[#f7ead5]">你是 {currentIntro.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#ad9c7d]">{game ? `当前阶段：${game.phaseLabel}` : "开局后显示阶段提示"}</p>
              </div>
            </div>
            {currentHint && <RolePhaseHintBox hint={currentHint} />}
            {currentLinkTips.length > 0 && <RoleLinkTipList tips={currentLinkTips} compact />}
            <button
              type="button"
              onClick={() => onPreview(currentRole)}
              className="min-h-10 rounded-xl border border-[#f1c76e]/25 bg-[#2c1b11]/74 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#3a2412]"
            >
              查看你的身份大图
            </button>
          </div>
        ) : (
          <div className="grid min-h-[140px] place-items-center rounded-xl border border-dashed border-[#f1c76e]/20 bg-black/16 px-4 py-5 text-center text-sm leading-6 text-[#ad9c7d]">
            开局后这里会固定显示你的身份和当前阶段提示。
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#f1c76e]/16 bg-black/18 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#f7ead5]">本局启用身份</h3>
          <span className="rounded-full border border-[#77d898]/18 bg-[#0f2118]/48 px-2.5 py-1 text-xs text-[#a8f0b6]">
            {roleCounts.length} 类
          </span>
        </div>
        {roleCounts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {roleCounts.map(({ role, count }) => {
              const intro = ROLE_INTROS[role];
              const tone = roleCampTone(intro.camp);
              const selected = role === currentRole;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => onPreview(role)}
                  className={[
                    "rounded-full border px-3 py-2 text-xs font-semibold transition",
                    selected
                      ? "border-[#f1c76e]/55 bg-[#3a2412]/84 text-[#f1d796]"
                      : `${tone.pill} hover:border-[#f1c76e]/40 hover:text-[#f1d796]`,
                  ].join(" ")}
                  aria-label={`查看本局身份${intro.title}`}
                >
                  {intro.title}
                  {count > 1 ? ` ×${count}` : ""}
                  {selected ? " · 你" : ""}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/16 px-3 py-4 text-sm text-[#ad9c7d]">当前未选择板子。</div>
        )}
      </section>
    </div>
  );
}

function RolePhaseHintBox({ hint }: { hint: RolePhaseHint }) {
  return (
    <div className={`${rolePhaseHintClass(hint.tone)} rounded-xl border px-3 py-2`}>
      <div className="mb-1 text-xs font-semibold">{hint.title}</div>
      <div className="text-xs leading-5">{hint.detail}</div>
    </div>
  );
}

function rolePhaseHintClass(tone: RolePhaseHint["tone"]): string {
  const tones = {
    green: "border-[#77d898]/24 bg-[#0f2118]/46 text-[#dff4df]",
    gold: "border-[#f1c76e]/24 bg-[#2a1b10]/46 text-[#f1d796]",
    blue: "border-[#7da8e3]/22 bg-[#0d1623]/48 text-[#d8e7ff]",
    red: "border-[#e46d55]/24 bg-[#351210]/46 text-[#ffd8cf]",
  };
  return tones[tone];
}

function RoleLinkTipList({ tips, compact = false }: { tips: RoleLinkTip[]; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-2" : "mt-4 grid gap-2"}>
      {!compact && <h4 className="text-sm font-semibold text-[#f7ead5]">身份联动提醒</h4>}
      <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
        {tips.map((tip) => (
          <div key={`${tip.title}-${tip.detail}`} className="rounded-xl border border-[#f1c76e]/14 bg-black/20 px-3 py-2">
            <div className="mb-1 text-xs font-semibold text-[#f1d796]">{tip.title}</div>
            <div className="text-xs leading-5 text-[#dcc9a7]">{tip.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRoleLinkTips(role: Role, activeRoleSet?: ReadonlySet<Role>): RoleLinkTip[] {
  const tips = ROLE_LINK_TIPS[role] ?? [];
  if (!activeRoleSet || activeRoleSet.size === 0) return tips;
  return tips.filter((tip) => !tip.relatedRoles || tip.relatedRoles.some((relatedRole) => activeRoleSet.has(relatedRole)));
}

function hasHumanAction(game: HumanGameView, type: AvailableHumanAction["type"]): boolean {
  return game.availableActions.some((action) => action.type === type);
}

function getActiveHumanActionHint(role: Role, game: HumanGameView): RolePhaseHint | undefined {
  if (hasHumanAction(game, "whiteWolfKingExplode")) {
    return {
      title: "现在可以自爆",
      detail: "这是白狼王的发言窗口。自爆会带走一名玩家，并跳过今天剩余发言和投票。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "wolfKill")) {
    return {
      title: "现在可以刀人",
      detail: "狼队夜间行动中，选择刀口时仍要考虑白天如何解释局势和票型。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "wolfBeautyCharm")) {
    return {
      title: "现在可以魅惑",
      detail: "魅惑目标会在狼美人白天出局时殉情。优先考虑明神、强归票位或会改变轮次的位置。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "guardAction")) {
    return {
      title: "现在可以守护",
      detail: "选择保护目标或空守。注意不能连续守同一人，也要避开可能的同守同救。",
      tone: "blue",
    };
  }
  if (hasHumanAction(game, "seerCheck")) {
    return {
      title: "现在可以查验",
      detail: "查验结果会成为白天最重要的信息。提前想好明天是否报结果和警徽流。",
      tone: "blue",
    };
  }
  const witchAction = game.availableActions.find((action) => action.type === "witchAction");
  if (witchAction?.type === "witchAction") {
    const medicine = [witchAction.canSave ? "解药" : "", witchAction.canPoison ? "毒药" : ""].filter(Boolean).join("或") || "药品";
    return {
      title: `现在可以使用${medicine}`,
      detail: "每晚最多使用一瓶药。救人、毒人或留药都会影响后续轮次和白天发言压力。",
      tone: "blue",
    };
  }
  if (hasHumanAction(game, "knightDuel")) {
    return {
      title: "现在可以决斗",
      detail: "决斗命中狼人会直接放逐目标；决斗好人则骑士出局。先确认目标狼面足够集中。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "hunterReveal")) {
    return {
      title: "现在确认是否翻牌",
      detail: "翻牌后会公开猎人身份并必须带走一名玩家；不翻牌则不会公开猎人发动技能。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "hunterShoot")) {
    return {
      title: "现在可以开枪",
      detail: "你已经翻牌发动猎人技能，必须选择一名存活玩家带走。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "wolfKingShoot")) {
    return {
      title: "现在可以开狼王枪",
      detail: "狼王枪要优先破坏好人归票或处理明神，但理由要能从公开信息解释。",
      tone: "red",
    };
  }
  if (hasHumanAction(game, "lastWords")) {
    return {
      title: "现在轮到你留遗言",
      detail: "遗言要明确身份信息、怀疑对象和投票建议，避免只做情绪表达。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "vote") || hasHumanAction(game, "sheriffVote")) {
    return {
      title: "现在需要投票",
      detail: "投票是公开信息。给出能被复盘的理由，比单纯跟票更有价值。",
      tone: "gold",
    };
  }
  if (hasHumanAction(game, "speak") || hasHumanAction(game, "sheriffSpeech")) {
    return {
      title: "现在轮到你发言",
      detail: ROLE_INTROS[role].camp === "狼人阵营" ? "尽量用公开信息包装判断，避免暴露狼队视角。" : "说明你的信息来源、狼坑和投票倾向，帮助好人统一判断。",
      tone: "green",
    };
  }
  if (hasHumanAction(game, "sheriffNominate") || hasHumanAction(game, "sheriffWithdraw") || hasHumanAction(game, "sheriffHandoff")) {
    return {
      title: "现在是警长相关操作",
      detail: "警徽会影响归票权和票重。选择时要考虑谁的信息最稳定、谁能带队复盘。",
      tone: "gold",
    };
  }

  return undefined;
}

function getRolePhaseHint(role: Role, game: HumanGameView, isCurrentRole: boolean): RolePhaseHint {
  const activeHint = isCurrentRole ? getActiveHumanActionHint(role, game) : undefined;
  if (activeHint) return activeHint;

  const intro = ROLE_INTROS[role];
  const isWolf = intro.camp === "狼人阵营";

  if (game.result) {
    return {
      title: "对局已结束",
      detail: "现在适合回看发言、票型和技能触发点，把身份说明和复盘信息对照起来。",
      tone: "green",
    };
  }

  switch (game.phase) {
    case "NIGHT_WOLVES":
      return isWolf
        ? { title: "夜间狼队行动", detail: `${intro.title}此时参与狼队刀人，下一天要能解释刀口带来的局势。`, tone: "red" }
        : { title: "夜间等待信息", detail: `${intro.title}此时通常不行动，重点准备根据天亮信息更新狼坑。`, tone: "blue" };
    case "NIGHT_WOLF_BEAUTY":
      return role === "WOLF_BEAUTY"
        ? { title: "狼美人行动段", detail: "此时选择魅惑目标或跳过，白天自己出局时才会触发殉情。", tone: "red" }
        : { title: "夜间等待结算", detail: "狼美人行动不会公开，白天需要结合死亡和发言判断是否存在连锁风险。", tone: "blue" };
    case "NIGHT_GUARD":
      return role === "GUARD"
        ? { title: "守卫行动段", detail: "此时选择守护目标或空守，注意连续守护和同守同救限制。", tone: "blue" }
        : { title: "夜间等待守护", detail: "当前是守卫行动段，白天只会看到结算结果，不会公开守护目标。", tone: "blue" };
    case "NIGHT_SEER":
      return role === "SEER"
        ? { title: "预言家行动段", detail: "此时查验一名玩家，明天要决定查验结果如何进入发言和归票。", tone: "blue" }
        : { title: "夜间等待查验", detail: "当前是预言家行动段，白天要通过报验、对跳和票型判断真假信息。", tone: "blue" };
    case "NIGHT_WITCH":
      return role === "WITCH"
        ? { title: "女巫行动段", detail: "解药未用时可见刀口；解药用完后只能盲毒或留药。每晚最多使用一瓶药。", tone: "blue" }
        : { title: "夜间等待药品结算", detail: "当前是女巫行动段，天亮后的死亡信息可能受救人或毒人影响。", tone: "blue" };
    case "DAY_SPEECH":
      if (role === "WHITE_WOLF_KING") {
        return { title: "发言期可自爆", detail: "白狼王只有在自己的发言窗口才能自爆带人，未轮到时先听信息和找目标。", tone: "red" };
      }
      return {
        title: "白天发言期",
        detail: isWolf ? "此时重点是伪装视角、推动好人焦点，并避免狼队信息外泄。" : "此时重点是交清信息、站边理由、狼坑和投票倾向。",
        tone: isWolf ? "red" : "gold",
      };
    case "KNIGHT_DUEL":
      return role === "KNIGHT"
        ? { title: "骑士决斗窗口", detail: "现在是骑士决斗阶段。命中狼人收益很高，错决斗会让好人少一神。", tone: "gold" }
        : { title: "等待骑士选择", detail: "骑士是否发动会直接改变白天是否进入投票。", tone: "gold" };
    case "DAY_VOTE":
    case "SHERIFF_VOTE":
    case "SHERIFF_PK_VOTE":
      return { title: "投票阶段", detail: "所有阵营都要通过投票留下公开立场。票型会成为后续复盘证据。", tone: "gold" };
    case "HUNTER_REVEAL":
      return role === "HUNTER"
        ? { title: "猎人翻牌确认", detail: "你已死亡出局，先选择是否翻牌发动技能；不翻牌不会公开猎人播报。", tone: "gold" }
        : { title: "等待出局结算", detail: "出局玩家正在完成结算，随后继续遗言或后续流程。", tone: "gold" };
    case "HUNTER_SHOT":
      return role === "HUNTER"
        ? { title: "猎人开枪窗口", detail: "猎人已经翻牌，必须选择一名存活玩家带走。", tone: "gold" }
        : { title: "等待猎人枪", detail: "猎人已翻牌发动技能，枪口会改变死亡名单和后续遗言顺序。", tone: "gold" };
    case "WOLF_KING_SHOT":
      return role === "WOLF_KING"
        ? { title: "狼王开枪窗口", detail: "狼王出局后可以开枪带人，优先破坏好人核心信息位。", tone: "red" }
        : { title: "等待狼王枪", detail: "狼王枪会改变死亡名单和好人轮次。", tone: "red" };
    case "LAST_WORDS":
      return { title: "遗言阶段", detail: "出局玩家留下的信息会影响后续站边和票型。注意区分事实、判断和情绪。", tone: "gold" };
    case "SHERIFF_NOMINATION":
    case "SHERIFF_SPEECH":
    case "SHERIFF_WITHDRAWAL":
    case "SHERIFF_PK_SPEECH":
    case "SHERIFF_HANDOFF":
      return { title: "警长流程", detail: "警徽影响归票权和票重。身份发言要围绕谁更适合带队展开。", tone: "gold" };
    case "EXILE_RESOLUTION":
    case "DAY_ANNOUNCEMENT":
      return { title: "结算阶段", detail: "此时重点看死亡、放逐和技能公开结果，再更新身份关系。", tone: "gold" };
    default:
      return {
        title: "等待流程推进",
        detail: `${intro.title}当前没有专属操作，先根据公开信息准备下一轮发言或投票。`,
        tone: isWolf ? "red" : "blue",
      };
  }
}

function normalizeIdentityBookSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function identityBookRoleMatchesSearch(role: Role, query: string, activeRoleSet?: ReadonlySet<Role>): boolean {
  if (!query) return true;
  const intro = ROLE_INTROS[role];
  const linkTips = getRoleLinkTips(role, activeRoleSet);
  return [
    intro.title,
    intro.camp,
    intro.goal,
    intro.timing,
    intro.ability,
    intro.limits,
    intro.tip,
    ...linkTips.flatMap((tip) => [tip.title, tip.detail, ...(tip.keywords ?? [])]),
  ].some((value) => normalizeIdentityBookSearch(value).includes(query));
}

function identityBookRoleMatchesFilter(role: Role, filter: IdentityBookFilter): boolean {
  if (filter === "all") return true;
  const camp = ROLE_INTROS[role].camp;
  return filter === "werewolves" ? camp === "狼人阵营" : camp === "好人阵营";
}

function roleCampTone(camp: RoleCamp): { card: string; pill: string; mutedCard: string } {
  if (camp === "狼人阵营") {
    return {
      card: "border-[#e46d55]/24 bg-[#27110f]/78",
      pill: "border-[#e46d55]/25 bg-[#572017]/38 text-[#ffb1a4]",
      mutedCard: "border-[#6f5148]/20 bg-[#18110f]/62",
    };
  }

  return {
    card: "border-[#77d898]/18 bg-[#0f2118]/62",
    pill: "border-[#77d898]/25 bg-[#1d4e33]/34 text-[#a8f0b6]",
    mutedCard: "border-[#52665c]/20 bg-[#101713]/58",
  };
}

function IdentityBookRoleCard({
  role,
  enabled,
  hasActiveBoard,
  isCurrentRole,
  phaseHint,
  linkTips,
  onPreview,
}: {
  role: Role;
  enabled: boolean;
  hasActiveBoard: boolean;
  isCurrentRole: boolean;
  phaseHint?: RolePhaseHint;
  linkTips: RoleLinkTip[];
  onPreview: (role: Role) => void;
}) {
  const intro = ROLE_INTROS[role];
  const tone = roleCampTone(intro.camp);
  const boardBadge = !hasActiveBoard ? "全部板子" : enabled ? "本板子" : "未启用";

  return (
    <button
      type="button"
      onClick={() => onPreview(role)}
      className={[
        enabled ? tone.card : tone.mutedCard,
        "mobile-knowledge-role-card group grid min-h-[330px] gap-3 rounded-2xl border p-3 text-left shadow-xl shadow-black/24 transition",
        "hover:-translate-y-0.5 hover:border-[#f1c76e]/44 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#f1d796]/55",
        enabled ? "" : "opacity-58 grayscale-[0.72] hover:opacity-88 hover:grayscale-0",
      ].join(" ")}
      aria-label={`查看${intro.title}玩法技能`}
    >
      <div className="flex items-start gap-3">
        <RoleCardArtwork
          role={role}
          title={intro.title}
          src={ROLE_CARD_BOOK_IMAGES[role]}
          sizes="112px"
          className="mobile-knowledge-role-art w-[92px] rounded-xl border border-[#f1c76e]/28 shadow-lg shadow-black/30"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {isCurrentRole && (
              <span className="inline-flex rounded-full border border-[#f1c76e]/35 bg-[#3a2412]/70 px-2.5 py-1 text-xs font-semibold text-[#f1d796]">
                你的身份
              </span>
            )}
            <span className={`${tone.pill} inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold`}>{intro.camp}</span>
            <span
              className={[
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                enabled ? "border-[#77d898]/24 bg-[#0f2118]/45 text-[#a8f0b6]" : "border-white/10 bg-black/20 text-[#ad9c7d]",
              ].join(" ")}
            >
              {boardBadge}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-[#f7ead5]">{intro.title}</h3>
          <p className="mobile-knowledge-role-summary mt-2 text-xs leading-5 text-[#ad9c7d]">{intro.goal}</p>
        </div>
      </div>

      <div className="mobile-knowledge-role-lines grid gap-2 text-xs leading-5">
        {isCurrentRole && phaseHint && <RoleBookLine label="当前阶段" value={phaseHint.title} />}
        {linkTips[0] && <RoleBookLine label="联动提醒" value={linkTips[0].detail} />}
        <RoleBookLine label="行动时机" value={intro.timing} />
        <RoleBookLine label="技能效果" value={intro.ability} />
      </div>
    </button>
  );
}

function IdentityBookPreview({
  role,
  enabled,
  hasActiveBoard,
  boardName,
  isCurrentRole,
  phaseHint,
  linkTips,
  onClose,
}: {
  role: Role;
  enabled: boolean;
  hasActiveBoard: boolean;
  boardName?: string;
  isCurrentRole: boolean;
  phaseHint?: RolePhaseHint;
  linkTips: RoleLinkTip[];
  onClose: () => void;
}) {
  const intro = ROLE_INTROS[role];
  const tone = roleCampTone(intro.camp);
  const boardStatus = !hasActiveBoard ? "全部板子可查看" : enabled ? `已加入${boardName ?? "当前板子"}` : `未加入${boardName ?? "当前板子"}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-book-preview-title"
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/82 px-3 py-5 backdrop-blur-sm sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="grid w-full max-w-5xl gap-5 rounded-[28px] border border-[#f1c76e]/30 bg-[#100b09]/97 p-4 shadow-2xl shadow-black/75 sm:p-5 lg:grid-cols-[330px_minmax(0,1fr)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="grid content-start justify-items-center gap-3 rounded-[22px] border border-[#f1c76e]/16 bg-black/28 p-4">
          <RoleCardArtwork
            role={role}
            title={intro.title}
            src={ROLE_CARD_IMAGES[role]}
            sizes="(min-width: 1024px) 300px, min(82vw, 340px)"
            className="w-full max-w-[280px] rounded-[18px] border border-[#f1c76e]/42 shadow-2xl shadow-black/55"
          />
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {isCurrentRole && (
              <span className="rounded-full border border-[#f1c76e]/35 bg-[#3a2412]/70 px-3 py-1 font-semibold text-[#f1d796]">
                你的身份
              </span>
            )}
            <span className={`${tone.pill} rounded-full border px-3 py-1 font-semibold`}>{intro.camp}</span>
            <span
              className={[
                "rounded-full border px-3 py-1 font-semibold",
                enabled ? "border-[#77d898]/24 bg-[#0f2118]/45 text-[#a8f0b6]" : "border-white/10 bg-black/20 text-[#ad9c7d]",
              ].join(" ")}
            >
              {boardStatus}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 border-b border-[#f1c76e]/14 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="identity-book-preview-title" className="text-2xl font-semibold text-[#f7ead5] sm:text-3xl">
                {intro.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#dcc9a7]">{intro.goal}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-full border border-[#f1c76e]/25 bg-black/18 px-4 py-2 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10"
            >
              关闭预览
            </button>
          </div>

          {phaseHint && (
            <div className="mb-4">
              <RolePhaseHintBox hint={phaseHint} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <RoleIntroItem label="阵营" value={intro.camp} />
            <RoleIntroItem label="胜利条件" value={intro.goal} />
            <RoleIntroItem label="行动时机" value={intro.timing} />
            <RoleIntroItem label="技能效果" value={intro.ability} />
            <RoleIntroItem label="限制条件" value={intro.limits} />
            <RoleIntroItem label="发言建议" value={intro.tip} />
          </div>

          {linkTips.length > 0 && <RoleLinkTipList tips={linkTips} />}
        </div>
      </section>
    </div>
  );
}

function RoleBookLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mobile-knowledge-line rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="mb-1 text-[11px] text-[#ad9c7d]">{label}</div>
      <div className="text-[#f7ead5]">{value}</div>
    </div>
  );
}
