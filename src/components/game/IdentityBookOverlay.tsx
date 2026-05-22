"use client";

import { useMemo, useState } from "react";
import { getBoardPreset } from "@/game/boards";
import type { HumanGameView, Role } from "@/game/types";
import {
  IDENTITY_BOOK_FILTERS,
  IDENTITY_BOOK_ROLE_ORDER,
  type IdentityBookFilter,
} from "./RoleKnowledgeContent";
import { IdentityBookFocusPanel, IdentityBookPreview, IdentityBookRoleCard } from "./IdentityBookCards";
import {
  getRoleCounts,
  getRoleLinkTips,
  getRolePhaseHint,
  identityBookRoleMatchesFilter,
  identityBookRoleMatchesSearch,
  normalizeIdentityBookSearch,
} from "./IdentityBookHelpers";

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
