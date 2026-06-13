import type { AgentView } from "@/game/types";

export function repairGeneratedClassTrialSpeech(view: AgentView, speech: string): string {
  if (view.roleCard?.theme !== "class-trial") return speech;
  return speech
    .replace(/校验(?:没有|没|不)闭合/g, "话没接上")
    .replace(/证据链(?:没有|没|不)闭合/g, "说法没接上")
    .replace(/证词(?:没有|没|不)闭合/g, "证词没接上")
    .replace(/(?:没有|没|不)闭合/g, "没接上")
    .replace(/闭合|闭环/g, "接上")
    .replace(/身份动作和公开边界/g, "身份说法和公开发言")
    .replace(/公开边界的连接/g, "公开发言之间的连接")
    .replace(/外置硬身份反证/g, "外面有人拍硬身份反证")
    .replace(/票口边界/g, "今天要压哪里的界限")
    .replace(/起跳收益/g, "跳身份的收益")
    .replace(/唯一能接的线/g, "唯一说得通的路")
    .replace(/能接的线/g, "说得通的路")
    .replace(/结构接上|结构接线/g, "说法接上")
    .replace(/票口理由/g, "投票理由")
    .replace(/弱证据替代/g, "拿很薄的证据替自己下结论");
}
