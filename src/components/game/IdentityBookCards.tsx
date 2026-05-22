"use client";

import type { HumanGameView, Role } from "@/game/types";
import { ROLE_CARD_BOOK_IMAGES, ROLE_CARD_IMAGES } from "./viewHelpers";
import { ROLE_INTROS, type RoleLinkTip, type RolePhaseHint } from "./RoleKnowledgeContent";
import { RoleCardArtwork } from "./RoleCardArtwork";
import { getRoleLinkTips, getRolePhaseHint, roleCampTone } from "./IdentityBookHelpers";
import { RoleIntroItem } from "./RoleIntroOverlay";

export function IdentityBookFocusPanel({
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

export function IdentityBookRoleCard({
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

export function IdentityBookPreview({
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
