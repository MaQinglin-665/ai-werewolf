import type { AgentView } from "@/game/types";

import { getCurrentDayDeathShape, hasCurrentDayDeathShapeMention } from "./context";
import { buildDeathInfoNote } from "./deathShape";
import type { LlmSpeechInput } from "./types";

export function buildSpeechRulesContext(view: AgentView): LlmSpeechInput["publicContext"]["rules"] {
  const unavailableTerms = view.privateKnowledge.sheriff ? [] : ["警上", "警下", "警徽", "警长"];
  const deathShapeAlreadyDiscussed = hasCurrentDayDeathShapeMention(view);
  const deathShape = getCurrentDayDeathShape(view);
  return {
    sheriffEnabled: Boolean(view.privateKnowledge.sheriff),
    note: view.privateKnowledge.sheriff
      ? "本局启用警长竞选、警徽和警下投票；警长白天放逐投票计 1.5 票。"
      : "本局没有警长竞选、警徽、警上、警下流程。",
    deathInfoNote: buildDeathInfoNote(deathShape, deathShapeAlreadyDiscussed),
    speechTimelineNote:
      "本日发言有先后顺序。只能评价已经发过言的玩家；已经发过言的人不能被要求后续补充、轮到时回应或后面解释；尚未发言的后置位只能被点一个具体问题，不能说他们已经信息少、没站边或没回应，也不要把追问铺成一圈通用作业。",
    unavailableTerms,
  };
}
