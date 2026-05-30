import type { GameEventType, HumanGameView } from "@/game/types";
import type { PhaseCurtainCue } from "./PhaseCurtain";

const CLASS_TRIAL_SCENE_DURATION_MS = 3000;

type PublicEvent = HumanGameView["publicEvents"][number];

export function getClassTrialPhaseCurtainCue(game: HumanGameView): PhaseCurtainCue | null {
  switch (game.phase) {
    case "NIGHT_WOLVES":
    case "NIGHT_WOLF_BEAUTY":
    case "NIGHT_GUARD":
    case "NIGHT_SEER":
    case "NIGHT_WITCH":
      return null;
    case "DAY_ANNOUNCEMENT": {
      const dayStart = findLatestEvent(game, "DAY_STARTED");
      return classTrialCue({
        eyebrow: `第 ${game.day} 天`,
        title: "天亮，结果公开",
        subtitle: dayStart?.message ?? "晨光撕开黑幕，昨夜结果即将公开。",
        tone: "day",
        resultLines: dayStart ? [formatDawnResult(dayStart)] : ["昨夜结果：等待公布。"],
      });
    }
    case "DAY_VOTE":
      return classTrialCue({
        eyebrow: `第 ${game.day} 天`,
        title: "投票审判开始",
        subtitle: "所有视线汇聚到票箱。现在，选择你认为该被放逐的人。",
        tone: "vote",
        resultLines: ["投票阶段：每一票都会成为公开证据。"],
      });
    case "EXILE_RESOLUTION": {
      const voteReveal = findLatestEvent(game, "VOTE_REVEALED");
      return classTrialCue({
        eyebrow: `第 ${game.day} 天`,
        title: "开票审判",
        subtitle: voteReveal?.message ?? "票箱开启，判决正在落下。",
        tone: "vote",
        resultLines: formatVoteResultLines(game, voteReveal),
      });
    }
    case "LAST_WORDS":
    case "HUNTER_REVEAL":
    case "HUNTER_SHOT":
    case "WOLF_KING_SHOT": {
      const exile = findLatestEvent(game, "PLAYER_EXILED");
      const idiotReveal = findLatestEvent(game, "IDIOT_REVEALED");
      const voteReveal = findLatestEvent(game, "VOTE_REVEALED");
      if (exile?.day === game.day) {
        return classTrialCue({
          eyebrow: `第 ${game.day} 天`,
          title: "放逐判决",
          subtitle: exile.message,
          tone: "danger",
          resultLines: formatVoteResultLines(game, voteReveal),
        });
      }
      if (idiotReveal?.day === game.day) {
        return classTrialCue({
          eyebrow: `第 ${game.day} 天`,
          title: "判决反转",
          subtitle: idiotReveal.message,
          tone: "danger",
          resultLines: formatVoteResultLines(game, voteReveal),
        });
      }
      return classTrialCue({
        eyebrow: `第 ${game.day} 天`,
        title: "出局结算",
        subtitle: "审判还没有结束，后续技能正在结算。",
        tone: "danger",
      });
    }
    case "GAME_OVER": {
      const gameEnd = findLatestEvent(game, "GAME_ENDED");
      const winner = game.result?.winner === "GOOD" ? "好人阵营" : "狼人阵营";
      return classTrialCue({
        eyebrow: "最终结算",
        title: `${winner}胜利`,
        subtitle: game.result?.reason ?? "查看复盘，回看这场审判的关键节点。",
        tone: "end",
        resultLines: gameEnd ? [gameEnd.message] : [],
      });
    }
    default:
      return classTrialCue({
        eyebrow: game.phaseLabel,
        title: "审判继续",
        subtitle: "下一轮证词即将展开。",
        tone: "day",
      });
  }
}

function classTrialCue(cue: Omit<PhaseCurtainCue, "durationMs" | "presentation">): PhaseCurtainCue {
  return {
    ...cue,
    presentation: "class-trial",
    durationMs: CLASS_TRIAL_SCENE_DURATION_MS,
  };
}

function findLatestEvent(game: HumanGameView, type: GameEventType): PublicEvent | undefined {
  return [...game.publicEvents].reverse().find((event) => event.type === type);
}

function formatDawnResult(event: PublicEvent): string {
  const deadSeatIds = Array.isArray(event.payload.deadSeatIds)
    ? event.payload.deadSeatIds.filter((seatId): seatId is number => typeof seatId === "number")
    : [];
  if (deadSeatIds.length === 0) return "昨夜结果：平安夜。";
  return `昨夜结果：${deadSeatIds.map((seatId) => `${seatId}号`).join("、")}死亡。`;
}

function formatVoteResultLines(game: HumanGameView, fallbackEvent?: PublicEvent): string[] {
  const snapshot = game.tableSummary.voteSnapshot;
  const lines: string[] = [];
  const summaryParts = snapshot.tally.map((item) => `${formatSeat(item.target)} ${item.count}票`);
  if (snapshot.abstainCount && snapshot.abstainCount > 0) {
    summaryParts.push(`弃票 ${snapshot.abstainCount}票`);
  }
  if (summaryParts.length > 0) {
    lines.push(`票型汇总：${summaryParts.join("，")}。`);
  }

  const ledgerItems = snapshot.votes.map((vote) => {
    const target = vote.target ? formatSeat(vote.target) : "弃票";
    return `${formatSeat(vote.voter)} → ${target}`;
  });
  for (let index = 0; index < ledgerItems.length; index += 3) {
    const prefix = index === 0 ? "逐票：" : "";
    lines.push(`${prefix}${ledgerItems.slice(index, index + 3).join("；")}。`);
  }

  if (lines.length > 0) return lines;
  if (fallbackEvent) return [fallbackEvent.message];
  return ["票型结果：等待公布。"];
}

function formatSeat(seat: { seatId: number; name: string }): string {
  return `${seat.seatId}号${seat.name}`;
}
