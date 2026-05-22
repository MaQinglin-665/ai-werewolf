"use client";

import type { AvailableHumanAction, HumanGameView } from "@/game/types";
import type { CommandPayload, SeerCheckAction, WitchAction, WolfBeautyCharmAction } from "./clientTypes";
import { ActionButton, MobileAvatarTargetPrompt, NightTargetButton } from "./ActionTargetPrimitives";

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
