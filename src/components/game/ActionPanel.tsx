"use client";

import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type { CommandPayload } from "./clientTypes";
import { buildActionGuidance, type ActionGuidance } from "./actionGuidance";
import { ActionControl } from "./ActionTargetControls";

export function ActionPanel({
  game,
  loading,
  onSubmit,
  onNewGame,
  reviewHref = "#review",
  voiceInputEnabled = true,
  mobileCompact = false,
  onOpenSpeechPanel,
}: {
  game: HumanGameView;
  loading: boolean;
  onNewGame: () => Promise<void>;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  reviewHref?: string;
  voiceInputEnabled?: boolean;
  mobileCompact?: boolean;
  onOpenSpeechPanel?: () => void;
}) {
  if (game.result) {
    return (
      <section className={getActionPanelClassName(mobileCompact, "rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md")}>
        <h2 className="text-lg font-semibold text-[#f7ead5]">终局</h2>
        <p className="mt-2 text-sm text-[#dcc9a7]">
          {game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：{game.result.reason}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={reviewHref}
            className="rounded-full bg-[#2f8157] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#379566]"
          >
            查看复盘
          </a>
          <button
            onClick={onNewGame}
            disabled={loading}
            className="rounded-full border border-[#f1c76e]/30 px-5 py-2.5 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            新开一局
          </button>
        </div>
      </section>
    );
  }

  if (game.availableActions.length === 0) {
    return (
      <section className={getActionPanelClassName(mobileCompact, "rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 text-sm text-[#dcc9a7] shadow-2xl shadow-black/35 backdrop-blur-md")}>
        {loading ? "结算中" : "等待 AI 行动"}
      </section>
    );
  }

  const meta = getActionMeta(game.availableActions[0]);
  const guidance = buildActionGuidance(game.availableActions[0], game);
  const isContinueOnly = game.availableActions.every((action) => action.type === "continue");

  if (isContinueOnly && game.availableActions[0]?.type === "continue") {
    const action = game.availableActions[0];
    return (
      <section className={getActionPanelClassName(mobileCompact, "rounded-[24px] border border-[#f1c76e]/24 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md")}>
        <div className="mobile-action-panel-body grid gap-3">
          <div className="min-w-0">
            <div className="mobile-action-panel-phase mb-2 inline-flex rounded-full bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">{game.phaseLabel}</div>
            <h2 className="mobile-action-panel-title text-lg font-semibold text-[#f7ead5]">{meta.title}</h2>
            <p className="mobile-action-panel-description mt-1 text-sm text-[#dcc9a7]">{meta.description}</p>
          </div>
          {!mobileCompact && <ActionGuidanceStrip guidance={guidance} />}
          {game.wolfStrategy && <WolfStrategyPanel strategy={game.wolfStrategy} />}
          <div className="mobile-action-panel-controls flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#77d898]/25 bg-[#14311f]/55 px-3 py-2 text-xs text-[#a8f0b6]">
              <span className="h-2 w-2 rounded-full bg-[#77d898]" />
              自动播放中
            </span>
            <button
              disabled={loading}
              onClick={() => onSubmit({ type: "continue" })}
              className="rounded-full border border-[#f1c76e]/25 px-4 py-2 text-xs font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
            >
              {loading ? "播放中" : `立即跳过：${action.label}`}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={getActionPanelClassName(mobileCompact, "rounded-[24px] border border-[#f1c76e]/30 bg-[#130d0b]/92 p-4 shadow-2xl shadow-black/35 backdrop-blur-md")}>
      <div className="mobile-action-panel-header mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mobile-action-panel-phase mb-2 inline-flex rounded-full bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">{game.phaseLabel}</div>
          <h2 className="mobile-action-panel-title text-xl font-semibold text-[#f7ead5]">{meta.title}</h2>
          <p className="mobile-action-panel-description mt-1 text-sm text-[#dcc9a7]">
            {isContinueOnly ? `${meta.description} 系统会自动播放下一步。` : meta.description}
          </p>
        </div>
        <span className="mobile-action-panel-meta rounded-full border border-[#f1c76e]/25 px-3 py-1 text-xs text-[#ad9c7d]">
          {isContinueOnly ? "观看流程" : "轮到你行动"}
        </span>
      </div>
      {!mobileCompact && <ActionGuidanceStrip guidance={guidance} />}
      {game.wolfStrategy && <WolfStrategyPanel strategy={game.wolfStrategy} />}
      <div className="mobile-action-panel-controls grid gap-3">
        {game.availableActions.map((action) => (
          <ActionControl
            key={action.type}
            game={game}
            action={action}
            loading={loading}
            onSubmit={onSubmit}
            voiceInputEnabled={voiceInputEnabled}
            mobileCompact={mobileCompact}
            onOpenSpeechPanel={onOpenSpeechPanel}
          />
        ))}
      </div>
    </section>
  );
}

function getActionPanelClassName(mobileCompact: boolean, className: string): string {
  return ["mobile-action-panel", mobileCompact ? "mobile-action-panel-compact" : "", className].filter(Boolean).join(" ");
}

function ActionGuidanceStrip({ guidance }: { guidance: ActionGuidance }) {
  return (
    <div className="mb-4 grid gap-2 rounded-2xl border border-[#f1c76e]/16 bg-black/18 p-3 text-xs leading-5 text-[#dcc9a7] sm:grid-cols-[1fr_1fr]">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#f7ead5]">{guidance.title}</span>
          <span className="rounded-full border border-[#f1c76e]/20 bg-[#f1c76e]/8 px-2 py-0.5 text-[11px] text-[#f1d796]">
            {guidance.visibility}
          </span>
        </div>
        <p>{guidance.detail}</p>
      </div>
      <div className="min-w-0 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-[#f1d796]">{guidance.outcome}</div>
    </div>
  );
}

function WolfStrategyPanel({ strategy }: { strategy: NonNullable<HumanGameView["wolfStrategy"]> }) {
  return (
    <div className="mobile-wolf-strategy mb-4 rounded-2xl border border-[#d84a3a]/24 bg-[#2b1110]/55 p-3 text-xs leading-5 text-[#ffd8cf]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[#ffe5da]">狼队首夜战术</div>
        <span className="rounded-full border border-[#ff9a6b]/25 px-2 py-0.5 text-[11px] text-[#ffbd99]">私密</span>
      </div>
      <p className="mt-2 text-[#ffd8cf]/88">{strategy.summary}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <WolfStrategyTarget label="今晚刀口" target={strategy.nightTarget} fallback="先看公开可信度" />
        <WolfStrategyTarget label="明天压力" target={strategy.dayPressureTarget} fallback="先听白天发言" />
      </div>
      {strategy.discussion.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-[#ffd8cf]/82">
          {strategy.discussion.map((line, index) => (
            <li key={`${line}-${index}`} className="rounded-xl bg-black/16 px-2.5 py-1.5">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WolfStrategyTarget({
  label,
  target,
  fallback,
}: {
  label: string;
  target?: { seatId: number; name: string };
  fallback: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#ff9a6b]/12 bg-black/16 px-2.5 py-2">
      <div className="text-[11px] text-[#ffbd99]/82">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[#ffe5da]">
        {target ? `${target.seatId}号 ${target.name}` : fallback}
      </div>
    </div>
  );
}

export function getActionMeta(action: AvailableHumanAction) {
  switch (action.type) {
    case "wolfKill":
      return { title: "狼人夜刀", description: "选择一名存活玩家作为今晚刀口。" };
    case "guardAction":
      return { title: "守卫守护", description: "选择今晚守护目标，或空守。" };
    case "seerCheck":
      return { title: "预言家查验", description: "选择一名存活玩家，系统会私下告诉你阵营结果。" };
    case "witchAction":
      return { title: "女巫用药", description: "选择救人、毒人，或保留药品跳过本夜。" };
    case "wolfBeautyCharm":
      return { title: "狼美人魅惑", description: "选择今晚魅惑目标，或跳过本夜魅惑。" };
    case "speak":
      return { title: "轮到你发言", description: "公开发言会进入所有 AI 的公开信息流。" };
    case "sheriffSpeech":
      return { title: "警长竞选发言", description: "用公开视角争取警徽。" };
    case "sheriffNominate":
      return { title: "是否上警", description: "选择参与警长竞选，或留在警下投票。" };
    case "sheriffWithdraw":
      return { title: "是否退水", description: "选择留在警上，或退出警长竞选。" };
    case "sheriffVote":
      return { title: "警长投票", description: "在候选人中投出警长票。" };
    case "sheriffHandoff":
      return { title: "警徽移交", description: "选择移交警徽，或撕掉警徽。" };
    case "lastWords":
      return { title: "发表遗言", description: "出局前留下最后公开视角，遗言结束后继续结算。" };
    case "vote":
      return { title: "投票放逐", description: "选择一名存活玩家投票，所有人投完后进入结算。" };
    case "knightDuel":
      return { title: "骑士决斗", description: "选择是否发动决斗；证据不足时可以保留技能进入投票。" };
    case "hunterReveal":
      return { title: "是否翻牌", description: "死亡出局后先确认是否翻牌；翻牌后会公开发动猎人技能。" };
    case "hunterShoot":
      return { title: "猎人开枪", description: "你已经翻牌发动技能，必须带走一名存活玩家。" };
    case "wolfKingShoot":
      return { title: "狼王开枪", description: "你可以发动狼王枪带走一名存活玩家，也可以选择不开枪。" };
    case "whiteWolfKingExplode":
      return { title: "白狼王自爆", description: "你可以立即自爆并带走一名存活玩家，或继续正常发言。" };
    case "continue":
      return { title: action.label, description: action.description };
  }
}
