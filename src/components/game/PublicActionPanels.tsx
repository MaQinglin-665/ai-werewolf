"use client";

import type { HumanGameView } from "@/game/types";
import type { CommandPayload, KnightDuelAction, SheriffVoteAction, VoteAction } from "./clientTypes";
import { ActionButton, MobileAvatarTargetPrompt, NightTargetButton } from "./ActionTargetPrimitives";

export function VoteActionPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: VoteAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  if (mobileCompact) {
    return (
      <MobileAvatarTargetPrompt targets={action.targets} verb="投票" tone="vote">
        {action.canAbstain && (
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "vote" })}>
            弃票
          </ActionButton>
        )}
      </MobileAvatarTargetPrompt>
    );
  }

  return (
    <div className="vote-action-panel grid gap-3">
      <div className="rounded-2xl border border-[#e46d55]/24 bg-[#351210]/48 px-3 py-2 text-sm leading-6 text-[#ffd8cf]">
        选择你的放逐票。锁票后，所有玩家票型会在开票阶段一次性公布。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="vote"
            actionLabel="投票"
            onClick={() => onSubmit({ type: "vote", targetSeatId: target.seatId })}
          />
        ))}
        {action.canAbstain && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "vote" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">弃票</span>
              <span className="text-[11px] opacity-64">放弃放逐票</span>
            </div>
            <div className="mt-3 text-sm font-semibold">本轮不投任何人</div>
            <div className="mt-1 text-[11px] opacity-72">仍会锁定你的投票状态</div>
          </button>
        )}
      </div>
    </div>
  );
}

export function KnightDuelActionPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: KnightDuelAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  if (mobileCompact) {
    return (
      <MobileAvatarTargetPrompt targets={action.targets} verb="决斗" tone="knight">
        {action.canSkip && (
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "knightDuel" })}>
            保留技能
          </ActionButton>
        )}
      </MobileAvatarTargetPrompt>
    );
  }

  return (
    <div className="vote-action-panel grid gap-3">
      <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-2 text-sm leading-6 text-[#f1d796]">
        骑士可以发动一次决斗。目标是狼人阵营则目标出局并结束白天；目标是好人阵营则骑士出局，随后继续投票。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="knight"
            actionLabel="决斗"
            onClick={() => onSubmit({ type: "knightDuel", targetSeatId: target.seatId })}
          />
        ))}
        {action.canSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "knightDuel" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">保留</span>
              <span className="text-[11px] opacity-64">不决斗</span>
            </div>
            <div className="mt-3 text-sm font-semibold">进入正常投票</div>
            <div className="mt-1 text-[11px] opacity-72">技能仍可留到后续白天</div>
          </button>
        )}
      </div>
    </div>
  );
}

export function SheriffVoteActionPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: SheriffVoteAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  if (mobileCompact) {
    return (
      <MobileAvatarTargetPrompt targets={action.targets} verb="警长票" tone="sheriff">
        {action.canAbstain && (
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffVote" })}>
            弃票
          </ActionButton>
        )}
      </MobileAvatarTargetPrompt>
    );
  }

  return (
    <div className="vote-action-panel grid gap-3">
      <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-2 text-sm leading-6 text-[#f1d796]">
        {action.isPk ? "警长 PK 复投，只能在 PK 候选人中选择。" : "警下投票选择本局警长，候选人不能投票。"}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="sheriff"
            actionLabel="警长票"
            onClick={() => onSubmit({ type: "sheriffVote", targetSeatId: target.seatId })}
          />
        ))}
        {action.canAbstain && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "sheriffVote" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">弃票</span>
              <span className="text-[11px] opacity-64">警长票</span>
            </div>
            <div className="mt-3 text-sm font-semibold">不投任何候选人</div>
            <div className="mt-1 text-[11px] opacity-72">仍会锁定你的警长投票状态</div>
          </button>
        )}
      </div>
    </div>
  );
}
