import type { ActionTarget, HumanGameView } from "@/game/types";
import {
  getClassTrialVotePresentation,
  type ClassTrialVotePresentationState,
} from "./classTrialVotePresentation";

export type ClassTrialVoteStageState = ClassTrialVotePresentationState;

export const getClassTrialVoteState = getClassTrialVotePresentation;

export function ClassTrialVoteStage({ game }: { game: HumanGameView }) {
  const voteState = getClassTrialVotePresentation(game);
  if (!voteState) return null;

  if (voteState.variant === "sealing") {
    return <ClassTrialVoteSealingStage voteState={voteState} />;
  }

  return <ClassTrialVoteRevealStage voteState={voteState} />;
}

type ClassTrialVoteBurstOverlayVariant = "sealing" | "exile" | "no-exile";

function ClassTrialVoteBurstOverlay({
  variant,
  title,
  subtitle,
  focusTarget,
}: {
  variant: ClassTrialVoteBurstOverlayVariant;
  title: string;
  subtitle: string;
  focusTarget?: ActionTarget;
}) {
  return (
    <div
      className={["class-trial-vote-burst-overlay", `class-trial-vote-burst-${variant}`].join(" ")}
      aria-hidden="true"
    >
      <div className="class-trial-vote-burst-slice" />
      <div className="class-trial-vote-burst-copy">
        {focusTarget && <span className="class-trial-vote-burst-target">{formatTargetLabel(focusTarget)}</span>}
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

function ClassTrialVoteSealingStage({ voteState }: { voteState: Extract<ClassTrialVoteStageState, { variant: "sealing" }> }) {
  const totalCount = voteState.eligibleSeatIds.length || voteState.lockedSeatIds.length + voteState.pendingSeatIds.length;
  const lockedSeatIdSet = new Set(voteState.lockedSeatIds);

  return (
    <section className="class-trial-vote-stage class-trial-vote-stage-sealing" aria-label="投票封票进度">
      <ClassTrialVoteBurstOverlay variant="sealing" title="TRIAL VOTE" subtitle="封票开始" />
      <header className="class-trial-vote-stage-header">
        <div>
          <p className="class-trial-vote-kicker">VOTE PHASE</p>
          <h2 className="class-trial-vote-title">封票中</h2>
        </div>
        <div className="class-trial-vote-meter" aria-label="已锁票数量">
          <strong>
            {voteState.lockedSeatIds.length} / {totalCount}
          </strong>
          <span>等待 {voteState.pendingSeatIds.length} 人</span>
        </div>
      </header>
      <div className="class-trial-vote-body">
        <div className="class-trial-vote-seat-rail" aria-label="封票座位状态">
          {voteState.eligibleSeatIds.map((seatId) => {
            const locked = lockedSeatIdSet.has(seatId);
            return (
              <div
                className={[
                  "class-trial-vote-seat-token",
                  locked ? "class-trial-vote-seat-token-locked" : "class-trial-vote-seat-token-waiting",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={seatId}
              >
                <span>{seatId}号</span>
                <strong>{locked ? "已锁票" : "等待中"}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClassTrialVoteRevealStage({ voteState }: { voteState: Extract<ClassTrialVoteStageState, { variant: "reveal" }> }) {
  const revealTitle = getRevealTitle(voteState);
  const revealSubtitle =
    voteState.verdict === "exile" && voteState.focusTarget
      ? "处刑目标"
      : voteState.leaders.length > 1
        ? "最高票并列，夜晚继续"
        : "无人形成唯一处刑目标，夜晚继续";

  return (
    <section className="class-trial-vote-stage class-trial-vote-stage-reveal" aria-label="投票结果揭示">
      <ClassTrialVoteBurstOverlay
        variant={voteState.verdict === "exile" ? "exile" : "no-exile"}
        title={revealTitle}
        subtitle={revealSubtitle}
        focusTarget={voteState.focusTarget}
      />
      <header className="class-trial-vote-stage-header">
        <div>
          <p className="class-trial-vote-kicker">VERDICT OPEN</p>
          <h2 className="class-trial-vote-title">{revealTitle}</h2>
        </div>
        <div className="class-trial-vote-meter">
          <strong>{formatFocusLabel(voteState)}</strong>
          <span>{voteState.verdict === "exile" ? "公开证据" : "票箱未形成唯一处刑目标"}</span>
        </div>
      </header>
      <div className="class-trial-vote-body class-trial-vote-reveal-grid">
        <div className="class-trial-vote-tally" aria-label="票型排行">
          {voteState.tally.map((item) => (
            <div className="class-trial-vote-tally-row" key={item.target.seatId}>
              <span>{formatTargetLabel(item.target)}</span>
              <strong>{item.count}票</strong>
            </div>
          ))}
          {voteState.abstainCount > 0 && (
            <div className="class-trial-vote-tally-row class-trial-vote-tally-row-abstain">
              <span>弃票</span>
              <strong>{voteState.abstainCount}票</strong>
            </div>
          )}
        </div>
        <div className="class-trial-vote-ledger" aria-label="逐票公开">
          {voteState.votes.map((vote) => (
            <div className="class-trial-vote-ledger-row" key={vote.seq}>
              <span>{vote.voter.seatId}号</span>
              <strong>{vote.target ? `${vote.voter.seatId}号 -> ${vote.target.seatId}号` : `${vote.voter.seatId}号 -> 弃票`}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatTargetLabel(target: ActionTarget): string {
  return `${target.seatId}号 ${target.name}`;
}

function getRevealTitle(voteState: Extract<ClassTrialVoteStageState, { variant: "reveal" }>): string {
  if (voteState.verdict === "exile") return "开票揭示";
  return voteState.leaders.length > 1 ? "平票无处刑" : "无人处刑";
}

function formatFocusLabel(voteState: Extract<ClassTrialVoteStageState, { variant: "reveal" }>): string {
  return voteState.focusTarget ? `${voteState.focusTarget.seatId}号` : "无人出局";
}
