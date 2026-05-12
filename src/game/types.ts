export const ROLES = ["WEREWOLF", "VILLAGER", "SEER", "WITCH", "HUNTER"] as const;
export type Role = (typeof ROLES)[number];

export const PHASES = [
  "SETUP",
  "NIGHT_WOLVES",
  "NIGHT_SEER",
  "NIGHT_WITCH",
  "DAY_ANNOUNCEMENT",
  "DAY_SPEECH",
  "DAY_VOTE",
  "EXILE_RESOLUTION",
  "HUNTER_SHOT",
  "GAME_OVER",
] as const;
export type Phase = (typeof PHASES)[number];

export type Camp = "GOOD" | "WEREWOLVES";
export type Visibility = "public" | "private" | "system";

export type DeathReason =
  | "WOLF_KILL"
  | "WITCH_POISON"
  | "EXILED"
  | "HUNTER_SHOT";

export type GameEventType =
  | "GAME_CREATED"
  | "ROLE_ASSIGNED"
  | "NIGHT_STARTED"
  | "NIGHT_KILL_SELECTED"
  | "SEER_CHECKED"
  | "WITCH_USED_ANTIDOTE"
  | "WITCH_USED_POISON"
  | "WITCH_SKIPPED"
  | "ROLE_PHASE_SKIPPED"
  | "DAY_STARTED"
  | "SPEECH_CREATED"
  | "VOTE_CAST"
  | "VOTE_TIED"
  | "PLAYER_EXILED"
  | "PLAYER_DIED"
  | "HUNTER_SHOT"
  | "HUNTER_SKIPPED"
  | "GAME_ENDED";

export type GameEvent = {
  seq: number;
  type: GameEventType;
  visibility: Visibility;
  day: number;
  phase: Phase;
  actorSeatId?: number;
  message: string;
  payload: Record<string, unknown>;
};

export type Seat = {
  seatId: number;
  name: string;
  isAi: boolean;
  role: Role;
  alive: boolean;
  deathReason?: DeathReason;
  persona?: AiPersona;
};

export type SeerCheck = {
  day: number;
  seerSeatId: number;
  targetSeatId: number;
  result: "WEREWOLF" | "GOOD";
};

export type SpeechRecord = {
  day: number;
  seatId: number;
  message: string;
};

export type HunterShotState = {
  shooterSeatId: number;
  cause: "WOLF_KILL" | "EXILED";
};

export type GameResult = {
  winner: Camp;
  reason: string;
};

export type ReviewSeat = {
  seatId: number;
  name: string;
};

export type ReviewRoleReveal = ReviewSeat & {
  role: Role;
  roleLabel: string;
  camp: Camp;
  alive: boolean;
  deathReason?: DeathReason;
};

export type ReviewDeath = {
  day: number;
  seat: ReviewSeat;
  reason: DeathReason;
  reasonLabel: string;
};

export type ReviewNightRound = {
  day: number;
  wolfTarget?: ReviewSeat;
  seerCheck?: {
    seer: ReviewSeat;
    target: ReviewSeat;
    result: "WEREWOLF" | "GOOD";
  };
  witchAction?: {
    mode: "save" | "poison" | "skip";
    target?: ReviewSeat;
  };
  deaths: ReviewSeat[];
};

export type ReviewVote = {
  voter: ReviewSeat;
  target: ReviewSeat;
};

export type ReviewDayRound = {
  day: number;
  speechCount: number;
  votes: ReviewVote[];
  exiled?: ReviewSeat;
  tiedSeatIds: number[];
};

export type ReviewKeyEvent = Pick<GameEvent, "seq" | "day" | "phase" | "message">;

export type GameReview = {
  roleReveal: ReviewRoleReveal[];
  nightRounds: ReviewNightRound[];
  dayRounds: ReviewDayRound[];
  deathTimeline: ReviewDeath[];
  keyEvents: ReviewKeyEvent[];
  result?: GameResult;
};

export type GameState = {
  id: string;
  day: number;
  phase: Phase;
  humanSeatId: number;
  seats: Seat[];
  events: GameEvent[];
  night: {
    wolfTargetSeatId?: number;
    witchSavedSeatId?: number;
    witchPoisonTargetSeatId?: number;
  };
  witch: {
    antidoteAvailable: boolean;
    poisonAvailable: boolean;
  };
  seerChecks: SeerCheck[];
  speeches: SpeechRecord[];
  speechQueue: number[];
  speechIndex: number;
  votes: Record<string, number>;
  pendingHunterShot?: HunterShotState;
  result?: GameResult;
  createdAt: string;
  updatedAt: string;
};

export type Command =
  | { type: "wolfKill"; actorSeatId: number; targetSeatId: number }
  | { type: "seerCheck"; actorSeatId: number; targetSeatId: number }
  | {
      type: "witchAction";
      actorSeatId: number;
      mode: "save" | "poison" | "skip";
      targetSeatId?: number;
    }
  | { type: "speak"; actorSeatId: number; message: string }
  | { type: "vote"; actorSeatId: number; targetSeatId: number }
  | { type: "hunterShoot"; actorSeatId: number; targetSeatId?: number };

export type TurnRequirement =
  | { type: "human"; actorSeatId: number; phase: Phase }
  | { type: "ai"; actorSeatId: number; phase: Phase }
  | { type: "system"; phase: Phase }
  | { type: "none"; phase: Phase };

export type ActionTarget = {
  seatId: number;
  name: string;
};

export type AiPersona = {
  id: string;
  label: string;
  style: string;
  goal: string;
  riskTolerance: number;
  bluffing: number;
};

export type AvailableHumanAction =
  | { type: "wolfKill"; targets: ActionTarget[] }
  | { type: "seerCheck"; targets: ActionTarget[] }
  | {
      type: "witchAction";
      canSave: boolean;
      saveTarget?: ActionTarget;
      canPoison: boolean;
      poisonTargets: ActionTarget[];
    }
  | { type: "speak" }
  | { type: "vote"; targets: ActionTarget[] }
  | { type: "hunterShoot"; targets: ActionTarget[]; canSkip: boolean };

export type HumanGameView = {
  id: string;
  day: number;
  phase: Phase;
  phaseLabel: string;
  humanSeatId: number;
  myRole: Role;
  myRoleLabel: string;
  seats: Array<{
    seatId: number;
    name: string;
    isAi: boolean;
    isHuman: boolean;
    alive: boolean;
    role?: Role;
    roleLabel?: string;
    deathReason?: DeathReason;
  }>;
  publicEvents: Array<Pick<GameEvent, "seq" | "day" | "phase" | "actorSeatId" | "message">>;
  privateEvents: Array<Pick<GameEvent, "seq" | "day" | "phase" | "actorSeatId" | "message">>;
  availableActions: AvailableHumanAction[];
  currentActorSeatId?: number;
  currentSpeakerSeatId?: number;
  wolfTeammates: ActionTarget[];
  seerChecks: SeerCheck[];
  witch: GameState["witch"];
  votes: Record<string, number>;
  result?: GameResult;
  review?: GameReview;
};

export type AgentView = {
  gameId: string;
  day: number;
  phase: Phase;
  mySeatId: number;
  myRole: Role;
  persona?: AiPersona;
  aliveSeats: ActionTarget[];
  publicEvents: HumanGameView["publicEvents"];
  publicSummary: {
    recentSpeeches: string[];
    recentVotes: string[];
    recentDeaths: string[];
  };
  privateKnowledge: {
    wolfTeammates?: ActionTarget[];
    seerChecks?: SeerCheck[];
    witch?: GameState["witch"] & { currentVictim?: ActionTarget };
    pendingHunterShot?: HunterShotState;
  };
  allowedActions: AvailableHumanAction[];
};
