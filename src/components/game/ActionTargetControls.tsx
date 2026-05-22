"use client";

import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type {
  CommandPayload,
  KnightDuelAction,
  SeerCheckAction,
  SheriffVoteAction,
  VoteAction,
  WolfBeautyCharmAction,
  WitchAction,
} from "./clientTypes";
import { ActionButton, MobileAvatarTargetPrompt, NightTargetButton } from "./ActionTargetPrimitives";
import { SpeechActionControl } from "./SpeechActionControl";

export function ActionControl({
  game,
  action,
  loading,
  onSubmit,
  voiceInputEnabled,
  mobileCompact,
  onOpenSpeechPanel,
}: {
  game: HumanGameView;
  action: AvailableHumanAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  voiceInputEnabled: boolean;
  mobileCompact: boolean;
  onOpenSpeechPanel?: () => void;
}) {
  if (action.type === "speak" || action.type === "lastWords" || action.type === "sheriffSpeech") {
    return (
      <SpeechActionControl
        game={game}
        action={action}
        loading={loading}
        onSubmit={onSubmit}
        voiceInputEnabled={voiceInputEnabled}
        mobileCompact={mobileCompact}
        onOpenSpeechPanel={onOpenSpeechPanel}
      />
    );
  }
  if (action.type === "continue") {
    return (
      <button
        disabled={loading}
        onClick={() => onSubmit({ type: "continue" })}
        className="rounded-full bg-[#b74332] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#cf513d] disabled:opacity-60"
      >
        {loading ? "播放中" : `立即播放：${action.label}`}
      </button>
    );
  }

  if (action.type === "seerCheck") {
    return <SeerCheckPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "witchAction") {
    return <WitchActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "wolfBeautyCharm") {
    return <WolfBeautyCharmPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "guardAction") {
    return <GuardActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "sheriffNominate") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={loading} tone="gold" onClick={() => onSubmit({ type: "sheriffNominate", run: true })}>
          上警
        </ActionButton>
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffNominate", run: false })}>
          留在警下
        </ActionButton>
      </div>
    );
  }

  if (action.type === "sheriffWithdraw") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={loading} tone="gold" onClick={() => onSubmit({ type: "sheriffWithdraw", withdraw: false })}>
          留在警上
        </ActionButton>
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffWithdraw", withdraw: true })}>
          退水
        </ActionButton>
      </div>
    );
  }

  if (action.type === "sheriffVote") {
    return <SheriffVoteActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "sheriffHandoff") {
    if (mobileCompact) {
      return (
        <MobileAvatarTargetPrompt targets={action.targets} verb="移交" tone="sheriff">
          {action.canTear && (
            <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffHandoff" })}>
              撕警徽
            </ActionButton>
          )}
        </MobileAvatarTargetPrompt>
      );
    }

    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {action.targets.map((target) => (
            <ActionButton
              key={target.seatId}
              disabled={loading}
              tone="gold"
              onClick={() => onSubmit({ type: "sheriffHandoff", targetSeatId: target.seatId })}
            >
              移交给 {target.seatId}号
            </ActionButton>
          ))}
          {action.canTear && (
            <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "sheriffHandoff" })}>
              撕警徽
            </ActionButton>
          )}
        </div>
      </div>
    );
  }

  if (action.type === "vote") {
    return <VoteActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "knightDuel") {
    return <KnightDuelActionPanel game={game} action={action} loading={loading} onSubmit={onSubmit} mobileCompact={mobileCompact} />;
  }

  if (action.type === "hunterReveal") {
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border border-[#f1c76e]/24 bg-[#3a2412]/48 px-3 py-2 text-sm leading-6 text-[#f1d796]">
          你已死亡出局。选择翻牌才会公开猎人身份并进入强制带人；不翻牌则不会播报猎人发动技能。
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton disabled={loading} tone="gold" onClick={() => onSubmit({ type: "hunterReveal", reveal: true })}>
            翻牌发动技能
          </ActionButton>
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "hunterReveal", reveal: false })}>
            不翻牌
          </ActionButton>
        </div>
      </div>
    );
  }

  if (action.type === "hunterShoot") {
    if (mobileCompact) {
      return (
        <MobileAvatarTargetPrompt targets={action.targets} verb="带走" tone="danger">
          {action.canSkip && (
            <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "hunterShoot" })}>
              不开枪
            </ActionButton>
          )}
        </MobileAvatarTargetPrompt>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {action.targets.map((target) => (
          <ActionButton
            key={target.seatId}
            disabled={loading}
            tone="red"
            onClick={() => onSubmit({ type: "hunterShoot", targetSeatId: target.seatId })}
          >
            带走 {target.seatId}号
          </ActionButton>
        ))}
        {action.canSkip && (
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "hunterShoot" })}>
            不开枪
          </ActionButton>
        )}
      </div>
    );
  }

  if (action.type === "wolfKingShoot") {
    if (mobileCompact) {
      return (
        <MobileAvatarTargetPrompt targets={action.targets} verb="开枪" tone="danger">
          {action.canSkip && (
            <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "wolfKingShoot" })}>
              不开枪
            </ActionButton>
          )}
        </MobileAvatarTargetPrompt>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {action.targets.map((target) => (
          <ActionButton
            key={target.seatId}
            disabled={loading}
            tone="red"
            onClick={() => onSubmit({ type: "wolfKingShoot", targetSeatId: target.seatId })}
          >
            带走 {target.seatId}号
          </ActionButton>
        ))}
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "wolfKingShoot" })}>
          不开枪
        </ActionButton>
      </div>
    );
  }

  if (action.type === "whiteWolfKingExplode") {
    if (mobileCompact) {
      return <MobileAvatarTargetPrompt targets={action.targets} verb="自爆带走" tone="danger" />;
    }

    return (
      <div className="rounded-2xl border border-[#b74332]/28 bg-[#2a1110]/45 p-3">
        <div className="mb-3 text-sm leading-6 text-[#ffcabd]">
          白狼王可以在自己的白天发言窗口自爆，并带走一名存活玩家；发动后今日直接结算并进入夜晚。
        </div>
        <div className="flex flex-wrap gap-2">
          {action.targets.map((target) => (
            <ActionButton
              key={target.seatId}
              disabled={loading}
              tone="red"
              onClick={() => onSubmit({ type: "whiteWolfKingExplode", targetSeatId: target.seatId })}
            >
              自爆带走 {target.seatId}号
            </ActionButton>
          ))}
        </div>
      </div>
    );
  }

  if (mobileCompact) {
    return <MobileAvatarTargetPrompt targets={action.targets} verb="击杀" tone="danger" />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {action.targets.map((target) => (
        <ActionButton
          key={target.seatId}
          disabled={loading}
          tone="red"
          onClick={() => onSubmit({ type: action.type, targetSeatId: target.seatId } as CommandPayload)}
        >
          击杀 {target.seatId}号
        </ActionButton>
      ))}
    </div>
  );
}

export function SeerCheckPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: SeerCheckAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  if (mobileCompact) {
    return <MobileAvatarTargetPrompt targets={action.targets} verb="查验" tone="seer" />;
  }

  return (
    <div className="night-action-shell mobile-night-action-shell grid gap-3">
      <div className="mobile-night-action-summary flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9dbbe6]">Private Check</div>
          <div className="mt-1 text-sm leading-6 text-[#d8e6f7]">选择一名玩家查验阵营，结果只进入你的私密信息。</div>
        </div>
        <span className="rounded-full border border-[#7da8e3]/25 bg-[#132942]/65 px-3 py-1 text-xs text-[#cfe4ff]">
          不公开
        </span>
      </div>

      <div className="mobile-night-target-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="seer"
            actionLabel="查验"
            onClick={() => onSubmit({ type: "seerCheck", targetSeatId: target.seatId })}
          />
        ))}
      </div>
    </div>
  );
}

export function WitchActionPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: WitchAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  const medicineHint = action.saveTarget
    ? "确认当前刀口，再决定是否交药。"
    : "当前没有可见刀口；解药已用或本夜没有可救目标。";
  const antidoteLabel = action.canSave ? "解药可用" : action.saveTarget ? "不能救此刀口" : "解药不可用";

  if (mobileCompact) {
    return (
      <div className="mobile-compact-action-stack">
        {action.canPoison ? (
          <MobileAvatarTargetPrompt targets={action.poisonTargets} verb="毒" tone="danger" />
        ) : (
          <div className="mobile-avatar-action-note">毒药不可用</div>
        )}
        <div className="mobile-witch-quick-actions">
          {action.canSave && action.saveTarget && (
            <ActionButton disabled={loading} tone="green" onClick={() => onSubmit({ type: "witchAction", mode: "save" })}>
              救 {action.saveTarget.seatId}号
            </ActionButton>
          )}
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "witchAction", mode: "skip" })}>
            不用药
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="night-action-shell grid gap-4">
      <div className="grid gap-2 rounded-2xl border border-[#7da8e3]/20 bg-[#0d1623]/62 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9dbbe6]">Medicine Case</div>
            <div className="mt-1 text-sm text-[#d8e6f7]">{medicineHint}</div>
          </div>
          <div className="flex shrink-0 gap-1 text-[11px]">
            <span className={action.canSave ? "rounded-full bg-[#2f8157]/45 px-2 py-1 text-[#a8f0b6]" : "rounded-full bg-white/8 px-2 py-1 text-white/45"}>
              {antidoteLabel}
            </span>
            <span className={action.canPoison ? "rounded-full bg-[#b74332]/45 px-2 py-1 text-[#ffb1a4]" : "rounded-full bg-white/8 px-2 py-1 text-white/45"}>
              毒药{action.canPoison ? "可用" : "已用"}
            </span>
          </div>
        </div>

        {action.canSave && action.saveTarget ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "witchAction", mode: "save" })}
            className="witch-medicine-card rounded-2xl border border-[#77d898]/32 bg-[#14311f]/72 p-3 text-left transition hover:border-[#a8f0b6]/55 hover:bg-[#1d4e33]/82 disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#dff4df]">使用解药</span>
              <span className="rounded-full bg-[#77d898]/14 px-2 py-1 text-xs text-[#a8f0b6]">
                救 {action.saveTarget.seatId}号
              </span>
            </div>
            <div className="mt-1 text-xs leading-5 text-[#a8f0b6]/78">
              今夜刀口：{action.saveTarget.seatId}号 · {action.saveTarget.name}
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/18 p-3 text-sm leading-5 text-white/45">
            <div>{action.saveBlockedReason ?? "今晚没有可救目标，或解药已经用完；解药用完后不再显示后续刀口。"}</div>
            {action.saveTarget ? (
              <div className="mt-1 text-xs text-white/38">
                今夜刀口：{action.saveTarget.seatId}号 · {action.saveTarget.name}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs text-[#d8e6f7]/64">
          <span>毒药目标</span>
          <span>{action.canPoison ? "选择后立即结算本夜用药" : "毒药不可用"}</span>
        </div>
        {action.canPoison ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {action.poisonTargets.map((target, index) => (
              <NightTargetButton
                key={target.seatId}
                game={game}
                target={target}
                disabled={loading}
                index={index}
                tone="poison"
                actionLabel="毒"
                onClick={() => onSubmit({ type: "witchAction", mode: "poison", targetSeatId: target.seatId })}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 px-3 py-4 text-center text-sm text-white/45">
            毒药已用，本夜只能跳过。
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => onSubmit({ type: "witchAction", mode: "skip" })}
        className="rounded-2xl border border-[#f1c76e]/25 bg-black/18 px-4 py-3 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
      >
        本夜不用药
      </button>
    </div>
  );
}

export function WolfBeautyCharmPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: WolfBeautyCharmAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  if (mobileCompact) {
    return (
      <MobileAvatarTargetPrompt targets={action.targets} verb="魅惑" tone="charm">
        {action.canSkip && (
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "wolfBeautyCharm" })}>
            不魅惑
          </ActionButton>
        )}
      </MobileAvatarTargetPrompt>
    );
  }

  return (
    <div className="night-action-shell grid gap-3">
      <div className="rounded-2xl border border-[#d885c7]/24 bg-[#2b1128]/58 p-3 text-sm leading-6 text-[#ffd6f7]">
        选择今晚魅惑的玩家。狼美人白天出局时，当前魅惑目标会殉情出局；夜间死亡不触发。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="charm"
            actionLabel="魅惑"
            onClick={() => onSubmit({ type: "wolfBeautyCharm", targetSeatId: target.seatId })}
          />
        ))}
        {action.canSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "wolfBeautyCharm" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">不魅惑</span>
              <span className="text-[11px] opacity-64">跳过</span>
            </div>
            <div className="mt-3 text-sm font-semibold">本夜不选择目标</div>
            <div className="mt-1 text-[11px] opacity-72">保留白天发言空间</div>
          </button>
        )}
      </div>
    </div>
  );
}

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

export function GuardActionPanel({
  game,
  action,
  loading,
  onSubmit,
  mobileCompact,
}: {
  game: HumanGameView;
  action: Extract<AvailableHumanAction, { type: "guardAction" }>;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  mobileCompact: boolean;
}) {
  if (mobileCompact) {
    return (
      <MobileAvatarTargetPrompt targets={action.targets} verb="守护" tone="guard">
        {action.canSkip && (
          <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "guardAction" })}>
            空守
          </ActionButton>
        )}
      </MobileAvatarTargetPrompt>
    );
  }

  return (
    <div className="night-action-shell grid gap-3">
      <div className="rounded-2xl border border-[#7da8e3]/20 bg-[#0d1623]/62 p-3 text-sm leading-6 text-[#d8e6f7]">
        选择今晚守护的玩家。守卫可以守自己，也可以空守，但不能连续两晚守护同一名玩家。
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {action.targets.map((target, index) => (
          <NightTargetButton
            key={target.seatId}
            game={game}
            target={target}
            disabled={loading}
            index={index}
            tone="guard"
            actionLabel="守护"
            onClick={() => onSubmit({ type: "guardAction", targetSeatId: target.seatId })}
          />
        ))}
        {action.canSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({ type: "guardAction" })}
            className="min-h-[92px] rounded-2xl border border-[#f1c76e]/25 bg-black/18 p-3 text-left text-[#f1d796] shadow-lg shadow-black/18 transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">空守</span>
              <span className="text-[11px] opacity-64">跳过</span>
            </div>
            <div className="mt-3 text-sm font-semibold">今晚不守护</div>
            <div className="mt-1 text-[11px] opacity-72">
              {action.lastGuardedSeatId ? `上次守护 ${action.lastGuardedSeatId}号` : "保留守护节奏"}
            </div>
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
