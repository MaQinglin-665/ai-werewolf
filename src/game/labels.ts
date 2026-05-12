import type { DeathReason, Phase, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  WEREWOLF: "狼人",
  VILLAGER: "平民",
  SEER: "预言家",
  WITCH: "女巫",
  HUNTER: "猎人",
};

export const PHASE_LABELS: Record<Phase, string> = {
  SETUP: "准备",
  NIGHT_WOLVES: "狼人行动",
  NIGHT_SEER: "预言家查验",
  NIGHT_WITCH: "女巫行动",
  DAY_ANNOUNCEMENT: "天亮结算",
  DAY_SPEECH: "白天发言",
  DAY_VOTE: "投票放逐",
  EXILE_RESOLUTION: "放逐结算",
  HUNTER_SHOT: "猎人开枪",
  GAME_OVER: "游戏结束",
};

export const DEATH_LABELS: Record<DeathReason, string> = {
  WOLF_KILL: "夜间死亡",
  WITCH_POISON: "夜间死亡",
  EXILED: "被放逐",
  HUNTER_SHOT: "被猎人带走",
};
