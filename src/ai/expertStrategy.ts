import { isWolfRole } from "@/game/roleUtils";
import type { AgentView } from "@/game/types";

export function buildExpertStrategyNotes(view: AgentView): string[] {
  const notes = [
    "先按公开信息链判断：发言顺序、身份声明、验人结构、站边变化和票型结果要互相校验。",
    "发言按“观点-依据-验证”组织：先给当前立场，再给1-2条公开依据，最后留下追问、改票条件或票口，不只报听感结论。",
    "票型不要只看谁票多，要回看谁起票、谁补票、谁最后跟票，以及投票理由是否能和前面发言闭环。",
  ];
  const hasSheriff = Boolean(view.privateKnowledge.sheriff);
  const hasSeerCounterclaim = view.publicSummary.tableMemory.counterclaims.some((group) => group.claimedRole === "SEER");

  if (hasSheriff) {
    notes.push("警长局把警徽视为组织工具：预言家发言要交代验人和后续警徽流，好人要回看警上警下票型是否服务同一条逻辑。");
    notes.push("警长局判断真假预言家时，按验人力度、警徽流合理性、警下票型、后续发言、遗言和夜间倒牌六条线综合校验。");
  } else {
    notes.push("无警长局没有额外警长移交流程，白天更要把发言顺序、身份声明和投票理由说清楚，避免用不存在的警上身份线替代推理。");
  }

  if (view.rules.hasGuard) {
    notes.push("守卫局要同时考虑守护、女巫救人和夜间刀口收益；白天不要轻易把守卫、女巫、猎人当低证据出人位。");
  }

  if (view.rules.wolfRoles?.includes("WOLF_KING")) {
    notes.push("狼王局白天放逐狼人也有开枪代价，好人归票要更重视身份坑和枪口风险，狼队可围绕狼王反打制造威慑。");
  }

  if (view.rules.wolfRoles?.includes("WHITE_WOLF_KING")) {
    notes.push("白狼王局要把白天自爆视为轮次武器：狼队不要无价值交技能，好人关键身份发言要考虑被自爆带走后的遗产和票型交代。");
  }

  if (view.rules.wolfRoles?.includes("WOLF_BEAUTY")) {
    notes.push("狼美人局要把魅惑当作轮次牵制：好人白天推狼美人时要考虑殉情代价，狼队魅惑目标优先制造白天出局收益。");
  }

  if (view.rules.hasKnight) {
    notes.push("骑士局不要把决斗替代发言推理：骑士只吃强公开证据，其他好人仍要用身份线、站边和票型把狼坑讲清楚。");
  }

  if (view.rules.hasIdiot) {
    notes.push("白痴局要区分放逐和击杀：白痴被放逐会翻牌免死并失去投票权，之后仍能发言；狼人需要再用夜刀或其他死亡手段处理。");
  }

  if (hasSeerCounterclaim) {
    notes.push("真假预言家对跳时，优先比较查验结构、起跳先后、是否后置反打、金水是否被保护、以及双方票型是否一致。");
    notes.push("对跳局先剔除可公开坐好的身份和理由清晰的站边好人，再看剩余疑似狼位是否在为某条预言家线打配合。");
  } else if (view.publicSummary.claimBoard.some((claim) => claim.claimedRole === "SEER")) {
    notes.push("单边预言家线不能只听身份结论，要看验人是否落地、金水是否被乱踩、查杀位是否有回应空间。");
  }

  if (view.phase === "DAY_VOTE") {
    notes.push("投票前先把可公开复述的证据排优先级：可信查杀、金水保护、未对跳神职、票型异常、站边反复。");
    if (!isWolfRole(view.myRole, view.rules.wolfRoles)) {
      notes.push("好人首日不要只凭听感出未对跳神职或有金水结构的预言家；低证据目标优先施压，不急着归死。");
    }
  }

  if (view.myRole === "SEER") {
    notes.push("预言家要把验人、警徽流和今天的归票逻辑说成一条线；金水不是出人位，查杀也要允许对方回应。");
  }

  if (view.myRole === "WITCH") {
    notes.push("女巫用药信息要服务于白天票型：首夜可自救、第二夜起不能自救；解药用掉后不再看到后续刀口，注意同守同救风险。");
  }

  if (view.myRole === "HUNTER") {
    notes.push("猎人拍身份是为了防误推和压票型，不是替好人省略推理；开枪只吃强公开证据。");
  }

  if (view.myRole === "IDIOT") {
    notes.push("白痴可以用发言挡抗推压力，但不要只靠翻牌免死；翻牌后没有投票权，更要把公开逻辑留给还能投票的好人。");
  }

  if (view.myRole === "KNIGHT") {
    notes.push("骑士发动决斗前先确认公开证据强度；没有查杀、对跳矛盾或票型硬证据时，保留技能比低概率决斗更稳。");
  }

  if (view.myRole === "GUARD") {
    notes.push("守卫优先保护高价值公开身份和稳定发言位，同时避开连续守同人，并考虑女巫救人与守护冲突。");
  }

  if (isWolfRole(view.myRole, view.rules.wolfRoles)) {
    notes.push("狼队博弈可以悍跳、冲锋、倒钩或卖队友，但公开理由必须只来自发言、身份线和票型，不暴露狼队信息。");
    notes.push("狼队发言要先选战术再补公开理由，但理由必须像真实视角自然生成；避免只站边不交心路，或用私密信息当公开逻辑。");
  }

  return [...new Set(notes)].slice(0, 14);
}
