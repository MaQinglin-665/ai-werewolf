"use client";

import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type {
  CommandPayload,
} from "./clientTypes";
import { ActionButton, MobileAvatarTargetPrompt } from "./ActionTargetPrimitives";
import { SpeechActionControl } from "./SpeechActionControl";
import { GuardActionPanel, SeerCheckPanel, WitchActionPanel, WolfBeautyCharmPanel } from "./NightActionPanels";
import { KnightDuelActionPanel, SheriffVoteActionPanel, VoteActionPanel } from "./PublicActionPanels";

export { GuardActionPanel, SeerCheckPanel, WitchActionPanel, WolfBeautyCharmPanel } from "./NightActionPanels";
export { KnightDuelActionPanel, SheriffVoteActionPanel, VoteActionPanel } from "./PublicActionPanels";
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
