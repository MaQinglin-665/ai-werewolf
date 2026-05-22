import type { HumanGameView } from "@/game/types";

export type HostCue = {
  badge: string;
  title: string;
  line: string;
  detail: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
};

export function getHostCue(game: HumanGameView): HostCue {
  switch (game.phase) {
    case "NIGHT_WOLVES":
      return {
        badge: `第 ${game.day} 夜`,
        title: "天黑请闭眼",
        line: "狼人请睁眼，选择今晚的击杀目标。其他身份暂时闭眼等待。",
        detail: "如果轮到 AI，点击继续会播放下一步；如果你是狼人，则直接选择刀口。",
        tone: "night",
      };
    case "NIGHT_WOLF_BEAUTY":
      return {
        badge: `第 ${game.day} 夜`,
        title: "狼美人请睁眼",
        line: "狼美人选择今晚魅惑的玩家，也可以跳过。",
        detail: "狼美人白天出局时，当前魅惑目标会殉情出局；夜间死亡不触发。",
        tone: "night",
      };
    case "NIGHT_GUARD":
      return {
        badge: `第 ${game.day} 夜`,
        title: "守卫请睁眼",
        line: "守卫选择今晚的守护目标，也可以空守。",
        detail: "守卫不能连续两晚守同一名玩家；同守同救同一刀口会导致目标死亡。",
        tone: "night",
      };
    case "NIGHT_SEER":
      return {
        badge: `第 ${game.day} 夜`,
        title: "预言家请睁眼",
        line: "预言家选择一名玩家查验身份，查验结果只进入预言家的私密信息。",
        detail: "这一阶段不会公开查验对象和结果。",
        tone: "night",
      };
    case "NIGHT_WITCH":
      return {
        badge: `第 ${game.day} 夜`,
        title: "女巫请睁眼",
        line: "女巫根据可见刀口和药品状态决定是否使用解药或毒药。",
        detail: "首夜可以自救，第二夜起不能自救；解药用完后不再获知后续刀口。",
        tone: "night",
      };
    case "DAY_ANNOUNCEMENT":
      return {
        badge: `第 ${game.day} 天`,
        title: "天亮了",
        line: "主持人公布昨夜死亡情况，随后进入白天发言。",
        detail: "死亡信息公开，身份仍然只在终局复盘揭晓。",
        tone: "day",
      };
    case "SHERIFF_NOMINATION":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长竞选开始",
        line: "所有存活玩家依次选择是否上警。",
        detail: "上警玩家稍后发表竞选发言，警下玩家参与警长投票。",
        tone: "day",
      };
    case "SHERIFF_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "警上发言",
        line: "警上候选人依次发表竞选发言。",
        detail: "发言结束后候选人可以选择退水或留在警上。",
        tone: "day",
      };
    case "SHERIFF_WITHDRAWAL":
      return {
        badge: `第 ${game.day} 天`,
        title: "退水选择",
        line: "警上候选人依次选择是否退水。",
        detail: "剩余候选人进入警长投票；如果只剩一人则直接当选。",
        tone: "day",
      };
    case "SHERIFF_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "警下投票",
        line: "警下玩家投票选出警长。",
        detail: "平票会进入一次 PK 发言和复投，复平则本局无警长。",
        tone: "vote",
      };
    case "SHERIFF_PK_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长 PK 发言",
        line: "平票候选人进行 PK 发言。",
        detail: "发言结束后进入警长 PK 复投。",
        tone: "day",
      };
    case "SHERIFF_PK_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "警长 PK 投票",
        line: "非 PK 玩家在平票候选人中复投。",
        detail: "复投仍平票则本局无警长。",
        tone: "vote",
      };
    case "DAY_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "按座位顺序发言",
        line: "所有存活玩家依次发言。发言结束后才进入投票。",
        detail: "AI 只读取公开信息和自己的私密信息，不能看到完整身份表。",
        tone: "day",
      };
    case "DAY_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "开始投票",
        line: "所有存活玩家投票放逐一名玩家。投票结束前，票型和投票对象全部保密。",
        detail: "结束后只公布每名候选人的得票数，再结算放逐或平票。",
        tone: "vote",
      };
    case "KNIGHT_DUEL":
      return {
        badge: `第 ${game.day} 天`,
        title: "骑士决斗窗口",
        line: "骑士可以选择是否发动决斗。目标为狼人阵营时目标出局，否则骑士出局。",
        detail: "跳过决斗会进入正常投票，骑士技能保留到后续白天。",
        tone: "danger",
      };
    case "EXILE_RESOLUTION":
      return {
        badge: `第 ${game.day} 天`,
        title: "公布投票结果",
        line: "主持人公开最终票数，并结算今日放逐结果。",
        detail: "这里不会展示个人投票理由，避免复盘之外的信息影响过程体验。",
        tone: "vote",
      };
    case "LAST_WORDS":
      return {
        badge: `第 ${game.day} 天`,
        title: "遗言时间",
        line: "出局玩家发表最后一段公开发言，随后继续结算猎人或夜晚流程。",
        detail: "遗言会进入公开发言席，也会影响后续玩家的桌面判断。",
        tone: "danger",
      };
    case "HUNTER_REVEAL":
      return {
        badge: `第 ${game.day} 天`,
        title: "出局结算",
        line: "出局玩家正在完成后续结算。",
        detail: "如果后续有公开技能结果，系统会在结果产生后再播报。",
        tone: "danger",
      };
    case "HUNTER_SHOT":
      return {
        badge: `第 ${game.day} 天`,
        title: "猎人行动窗口",
        line: "猎人已翻牌发动技能，必须带走一名存活玩家。",
        detail: "如果猎人选择不翻牌，或被女巫毒死，则不会进入这个公开开枪阶段。",
        tone: "danger",
      };
    case "WOLF_KING_SHOT":
      return {
        badge: `第 ${game.day} 天`,
        title: "狼王行动窗口",
        line: "狼王出局后可以选择是否发动狼王枪带走一名玩家。",
        detail: "被夜间击杀或女巫毒死不会触发狼王枪。",
        tone: "danger",
      };
    case "SHERIFF_HANDOFF":
      return {
        badge: `第 ${game.day} 天`,
        title: "警徽移交",
        line: "警长出局后选择移交警徽或撕掉警徽。",
        detail: "警徽持有者白天放逐投票计 1.5 票。",
        tone: "danger",
      };
    case "GAME_OVER":
      return {
        badge: "终局",
        title: "游戏结束",
        line: game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜。` : "对局已经结束。",
        detail: game.result?.reason ?? "可以查看复盘了解关键节点。",
        tone: "end",
      };
    default:
      return {
        badge: "准备",
        title: "准备开局",
        line: "正在创建本局座位和身份。",
        detail: "规则引擎会先生成事件，再投影出当前玩家视角。",
        tone: "day",
      };
  }
}

export function hostToneClass(tone: HostCue["tone"]): string {
  const tones = {
    night: "border-[#6d93d4]/28 bg-[#0c1424]/82",
    day: "border-[#f1c76e]/26 bg-[#1c150e]/82",
    vote: "border-[#e46d55]/28 bg-[#2a1110]/84",
    danger: "border-[#ff9a6b]/30 bg-[#30140d]/86",
    end: "border-[#77d898]/28 bg-[#0f2118]/84",
  };
  return tones[tone];
}
