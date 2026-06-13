import type { AgentView } from "@/game/types";
import { getCurrentDayDeathShape, hasCurrentDayDeathShapeMention, type CurrentDayDeathShape } from "./context";

export function buildDeathInfoNote(deathShape: CurrentDayDeathShape, deathShapeAlreadyDiscussed: boolean): string {
  const shared =
    "普通玩家不要展开夜间规则前提、低概率药线或具体刀毒重合盘法；非女巫仍不能编造女巫是谁或具体救了几号。真女巫可以公开自己的真实救毒信息，但不能编错目标，也不要只说“我救过人”这种半公开私密状态。";
  if (deathShape === "death") {
    return [
      deathShapeAlreadyDiscussed
        ? "有夜死已作为背景处理，后续不要主动复读药线；把发言重心转到怀疑、暂放、追问或投票条件。"
        : "首夜单死只一句带过：狼刀成功，女巫没救。不要讲规则课，也不要追问首夜狼刀意图；说完必须接一个怀疑、暂放、追问或投票条件。",
      shared,
    ].join("");
  }
  if (deathShape === "peaceful") {
    return deathShapeAlreadyDiscussed
      ? `平安夜已作为背景处理，后续发言不要主动复读药线或空刀；只在和票型、身份说法直接相关时一句带过。${shared}`
      : `平安夜只作背景，一句带过：女巫用了救药。不要解释空刀概率或展开规则背景；说完必须接一个怀疑、暂放、追问或投票条件。${shared}`;
  }
  return `当前没有需要展开的死亡形态；不要主动编造平安夜、女巫用药、刀口、毒口或自刀。${shared}`;
}

export function buildDeathBoundaryLine(deathShape: CurrentDayDeathShape, deathShapeAlreadyDiscussed: boolean): string {
  const shared =
    "普通玩家不要展开规则课；真女巫可以公开真实救毒信息，不能只说“我救过人”这种半公开私密状态。";
  if (deathShape === "death") {
    return deathShapeAlreadyDiscussed
      ? `有夜死已作为背景处理，后续不要主动复读药线；把发言重心转到怀疑、暂放、追问或投票条件；${shared}`
      : `首夜单死只一句带过：狼刀成功，女巫没救；说完必须接一个怀疑、暂放、追问或投票条件；不要追问首夜狼刀意图；${shared}`;
  }
  if (deathShape === "peaceful") {
    return deathShapeAlreadyDiscussed
      ? `平安夜已作为背景处理，不要主动复读药线或空刀；${shared}`
      : `平安夜只作背景，一句带过：女巫用了救药；说完必须接一个怀疑、暂放、追问或投票条件；不要解释空刀概率；${shared}`;
  }
  return `当前没有需要展开的死亡形态；${shared}`;
}

export function buildDeathBriefingLine(
  view: AgentView,
  deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view),
): string {
  const deathShape = getCurrentDayDeathShape(view);
  const deaths = [
    ...new Set([
      ...view.publicSummary.recentDeaths,
      ...view.publicSummary.tableMemory.deathAnnouncements,
    ]),
  ].slice(-3);
  if (deaths.length === 0) return "公开死讯：目前没有需要引用的死亡播报。";
  if (deathShape === "death") {
    return deathShapeAlreadyDiscussed
      ? `公开死讯：${deaths.join("；")}。有夜死已作为背景处理；后续不要主动复读药线，把发言重心转到怀疑、暂放、追问或投票条件。`
      : `公开死讯：${deaths.join("；")}。首夜单死只一句带过：狼刀成功，女巫没救；不要追问首夜狼刀意图；说完必须接自己的游戏动作。`;
  }
  return deathShapeAlreadyDiscussed
    ? `公开死讯：${deaths.join("；")}。平安夜已作为背景处理，本轮不要主动复读药线或空刀；把发言重心转到怀疑、暂放、追问或投票条件。`
    : `公开死讯：${deaths.join("；")}。平安夜只作背景，一句带过：女巫用了救药；说完必须接自己的游戏动作。`;
}

export function formatOrdinaryDeathShapeFallback(latestDeath: string | undefined): string {
  const deathText = latestDeath?.trim().replace(/[。！？!?,，、；;\s]+$/g, "") || "昨晚有人倒牌";
  return `${deathText}，狼刀成功，女巫没救。`;
}
