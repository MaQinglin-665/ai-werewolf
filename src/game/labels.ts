import type { DeathReason, Phase, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  WEREWOLF: "狼人",
  VILLAGER: "平民",
  SEER: "预言家",
  WITCH: "女巫",
  HUNTER: "猎人",
  GUARD: "守卫",
};

export const PHASE_LABELS: Record<Phase, string> = {
  SETUP: "准备",
  NIGHT_WOLVES: "狼人行动",
  NIGHT_GUARD: "守卫守护",
  NIGHT_SEER: "预言家查验",
  NIGHT_WITCH: "女巫行动",
  DAY_ANNOUNCEMENT: "天亮结算",
  SHERIFF_NOMINATION: "警长上警",
  SHERIFF_SPEECH: "警上发言",
  SHERIFF_WITHDRAWAL: "警上退水",
  SHERIFF_VOTE: "警长投票",
  SHERIFF_PK_SPEECH: "警长 PK 发言",
  SHERIFF_PK_VOTE: "警长 PK 投票",
  DAY_SPEECH: "白天发言",
  DAY_VOTE: "投票放逐",
  EXILE_RESOLUTION: "放逐结算",
  LAST_WORDS: "发表遗言",
  HUNTER_SHOT: "猎人开枪",
  SHERIFF_HANDOFF: "警徽移交",
  GAME_OVER: "游戏结束",
};

export const DEATH_LABELS: Record<DeathReason, string> = {
  WOLF_KILL: "夜间死亡",
  WITCH_POISON: "夜间死亡",
  EXILED: "被放逐",
  HUNTER_SHOT: "被猎人带走",
};
