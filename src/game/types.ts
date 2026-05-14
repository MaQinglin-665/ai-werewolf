export const ROLES = ["WEREWOLF", "VILLAGER", "SEER", "WITCH", "HUNTER", "GUARD"] as const;
export type Role = (typeof ROLES)[number];

export const PHASES = [
  "SETUP",
  "NIGHT_WOLVES",
  "NIGHT_GUARD",
  "NIGHT_SEER",
  "NIGHT_WITCH",
  "DAY_ANNOUNCEMENT",
  "SHERIFF_NOMINATION",
  "SHERIFF_SPEECH",
  "SHERIFF_WITHDRAWAL",
  "SHERIFF_VOTE",
  "SHERIFF_PK_SPEECH",
  "SHERIFF_PK_VOTE",
  "DAY_SPEECH",
  "DAY_VOTE",
  "EXILE_RESOLUTION",
  "LAST_WORDS",
  "HUNTER_SHOT",
  "SHERIFF_HANDOFF",
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
  | "GUARD_PROTECTED"
  | "GUARD_SKIPPED"
  | "SEER_CHECKED"
  | "WITCH_USED_ANTIDOTE"
  | "WITCH_USED_POISON"
  | "WITCH_SKIPPED"
  | "ROLE_PHASE_SKIPPED"
  | "DAY_STARTED"
  | "SHERIFF_PHASE_STARTED"
  | "SHERIFF_NOMINATED"
  | "SHERIFF_WITHDREW"
  | "SHERIFF_VOTE_CAST"
  | "SHERIFF_VOTE_REVEALED"
  | "SHERIFF_PK_STARTED"
  | "SHERIFF_ELECTED"
  | "SHERIFF_SKIPPED"
  | "SHERIFF_BADGE_PASSED"
  | "SHERIFF_BADGE_TORN"
  | "SPEECH_CREATED"
  | "ROLE_CLAIMED"
  | "STANCE_DECLARED"
  | "VOTE_CAST"
  | "VOTE_REVEALED"
  | "VOTE_TIED"
  | "PLAYER_EXILED"
  | "LAST_WORDS_CREATED"
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

export type ClaimStrength = "hard" | "soft";

export type ClaimCheck = {
  day: number;
  claimantSeatId: number;
  targetSeatId: number;
  result: "WEREWOLF" | "GOOD";
  sourceSpeechSeq?: number;
};

export type RoleClaim = {
  id: string;
  day: number;
  claimantSeatId: number;
  claimedRole: Role;
  strength: ClaimStrength;
  checks: ClaimCheck[];
  message: string;
  sourceSpeechSeq?: number;
  updatedAtSeq?: number;
};

export type StanceKind = "SUPPORT" | "QUESTION" | "PRESSURE" | "FOLLOW";

export type PublicStance = {
  id: string;
  day: number;
  actorSeatId: number;
  targetSeatId: number;
  kind: StanceKind;
  targetRole?: Role;
  reason: string;
  message: string;
  sourceSpeechSeq?: number;
  updatedAtSeq?: number;
};

export type HunterShotState = {
  shooterSeatId: number;
  cause: "WOLF_KILL" | "EXILED";
};

export type GameResult = {
  winner: Camp;
  reason: string;
};

export type BoardId = "9p-seer-witch-hunter" | "12p-sheriff-seer-witch-hunter-guard";
export type WinCondition = "side-slaughter";

export type BoardSnapshot = {
  id: BoardId;
  name: string;
  description: string;
  seatCount: number;
  roleSummary: string;
  hasGuard: boolean;
  hasSheriff: boolean;
  winCondition: WinCondition;
};

export type GameRules = {
  godRoles: Role[];
  wolfRoles: Role[];
  hasGuard: boolean;
  hasSheriff: boolean;
  winCondition: WinCondition;
  sheriffVoteWeight: number;
  guardSaveConflictKills: boolean;
};

export type SheriffState = {
  candidates: number[];
  nominationDecisions: Record<string, boolean>;
  withdrawnSeatIds: number[];
  withdrawalDecisions: Record<string, boolean>;
  votes: Record<string, number | null>;
  pkCandidates?: number[];
  speechQueue: number[];
  speechIndex: number;
  badgeHolderSeatId?: number;
  resolved: boolean;
};

export type GuardState = {
  lastGuardedSeatId?: number;
};

export type SheriffHandoffState = {
  fromSeatId: number;
  nextStep: "DAY_DEATHS" | "NIGHT_DEATHS";
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
  target?: ReviewSeat;
  abstained?: boolean;
  reason?: string;
};

export type ReviewDayRound = {
  day: number;
  speechCount: number;
  votes: ReviewVote[];
  voteTally: Array<{
    target: ReviewSeat;
    count: number;
  }>;
  exiled?: ReviewSeat;
  tiedSeatIds: number[];
};

export type ReviewKeyEvent = Pick<GameEvent, "seq" | "day" | "phase" | "message">;

export type ReviewTurningPoint = {
  day: number;
  title: string;
  description: string;
  eventSeq?: number;
};

export type ReviewClaim = {
  claimant: ReviewSeat;
  claimedRole: Role;
  claimedRoleLabel: string;
  trueRole: Role;
  trueRoleLabel: string;
  truthful: boolean;
  isCounterclaim: boolean;
  checks: Array<{
    target: ReviewSeat;
    claimedResult: "WEREWOLF" | "GOOD";
    actualResult: "WEREWOLF" | "GOOD";
    accurate: boolean;
  }>;
};

export type ReviewStanceShift = {
  actor: ReviewSeat;
  target: ReviewSeat;
  fromKind: StanceKind;
  fromKindLabel: string;
  toKind: StanceKind;
  toKindLabel: string;
  fromDay: number;
  toDay: number;
};

export type ReviewStrategyNote = {
  day: number;
  camp: Camp;
  title: string;
  description: string;
  seats: ReviewSeat[];
};

export type ReviewVoteImpact = {
  day: number;
  title: string;
  description: string;
  outcome: "exile" | "tie" | "no_exile";
  target?: ReviewSeat;
  targetRole?: Role;
  targetRoleLabel?: string;
  targetCamp?: Camp;
  leaders: Array<{
    target: ReviewSeat;
    count: number;
    role: Role;
    roleLabel: string;
    camp: Camp;
  }>;
  decisiveVoters: ReviewSeat[];
  goodVotes: number;
  wolfVotes: number;
  abstainCount: number;
  totalVotes: number;
};

export type ReviewAiInsight = {
  seat: ReviewSeat;
  role: Role;
  roleLabel: string;
  personaLabel?: string;
  finalFocus?: ReviewSeat;
  suspected?: ReviewSeat;
  trusted?: ReviewSeat;
  lastSpeechTarget?: ReviewSeat;
  lastVoteTarget?: ReviewSeat;
  lastVoteReason?: string;
  beliefSummary: string[];
  impact: string;
};

export type ReviewPlayerFeedback = {
  title: string;
  tone: "positive" | "warning" | "neutral";
  description: string;
  day?: number;
  relatedSeats: ReviewSeat[];
};

export type ReviewAiDebugEntry = {
  id: string;
  day: number;
  seat: ReviewSeat;
  phase: Phase;
  provider: string;
  actionType?: Command["type"];
  isFallback: boolean;
  publicFactBasis: string[];
  rawOutput?: unknown;
  error?: string;
  validationErrors: string[];
};

export type ReviewDebugInfo = {
  aiCalls: ReviewAiDebugEntry[];
  fallbackCount: number;
  providers: string[];
  publicFactBasisCount: number;
};

export type GameReview = {
  roleReveal: ReviewRoleReveal[];
  claims: ReviewClaim[];
  stanceShifts: ReviewStanceShift[];
  strategyNotes: ReviewStrategyNote[];
  voteImpacts: ReviewVoteImpact[];
  aiInsights: ReviewAiInsight[];
  playerFeedback: ReviewPlayerFeedback[];
  nightRounds: ReviewNightRound[];
  dayRounds: ReviewDayRound[];
  deathTimeline: ReviewDeath[];
  keyEvents: ReviewKeyEvent[];
  turningPoints: ReviewTurningPoint[];
  result?: GameResult;
};

export type GameState = {
  id: string;
  day: number;
  phase: Phase;
  humanSeatId: number;
  board: BoardSnapshot;
  rules: GameRules;
  seats: Seat[];
  events: GameEvent[];
  night: {
    wolfTargetSeatId?: number;
    guardTargetSeatId?: number;
    witchSavedSeatId?: number;
    witchPoisonTargetSeatId?: number;
  };
  guard?: GuardState;
  witch: {
    antidoteAvailable: boolean;
    poisonAvailable: boolean;
  };
  sheriff?: SheriffState;
  seerChecks: SeerCheck[];
  roleClaims: RoleClaim[];
  stances: PublicStance[];
  speeches: SpeechRecord[];
  speechQueue: number[];
  speechIndex: number;
  votes: Record<string, number | null>;
  aiMemories?: Record<string, AiSeatMemory>;
  lastWordsSeatId?: number;
  lastWordsQueue?: number[];
  lastWordsNextStep?: "DAY_DEATHS" | "NIGHT_DEATHS";
  pendingHunterShot?: HunterShotState;
  pendingSheriffHandoff?: SheriffHandoffState;
  result?: GameResult;
  createdAt: string;
  updatedAt: string;
};

type CommandReason = {
  reason?: string;
};

export type Command =
  | ({ type: "wolfKill"; actorSeatId: number; targetSeatId: number } & CommandReason)
  | ({ type: "guardAction"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "seerCheck"; actorSeatId: number; targetSeatId: number } & CommandReason)
  | ({
      type: "witchAction";
      actorSeatId: number;
      mode: "save" | "poison" | "skip";
      targetSeatId?: number;
    } & CommandReason)
  | ({ type: "speak"; actorSeatId: number; message: string } & CommandReason)
  | ({ type: "lastWords"; actorSeatId: number; message: string } & CommandReason)
  | ({ type: "vote"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "hunterShoot"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "sheriffNominate"; actorSeatId: number; run: boolean } & CommandReason)
  | ({ type: "sheriffSpeech"; actorSeatId: number; message: string } & CommandReason)
  | ({ type: "sheriffWithdraw"; actorSeatId: number; withdraw: boolean } & CommandReason)
  | ({ type: "sheriffVote"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "sheriffHandoff"; actorSeatId: number; targetSeatId?: number } & CommandReason);

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
  name: string;
  label: string;
  style: string;
  goal: string;
  riskTolerance: number;
  bluffing: number;
  preferences?: {
    logic: number;
    identity: number;
    vote: number;
    emotion: number;
    memory: number;
    leadership: number;
    deception: number;
    caution: number;
  };
};

export type AiSeatBelief = {
  seatId: number;
  suspicion: number;
  trust: number;
  reasons: string[];
  updatedDay: number;
};

export type AiSeatMemory = {
  seatId: number;
  day: number;
  suspectedSeatId?: number;
  trustedSeatId?: number;
  focusSeatId?: number;
  lastSpeechTargetSeatId?: number;
  lastSpeechStance?: string;
  lastVoteTargetSeatId?: number;
  lastVoteReason?: string;
  beliefs: AiSeatBelief[];
};

export type PublicSpeechItem = {
  seq: number;
  day: number;
  speaker?: ActionTarget;
  message: string;
};

export type PublicVoteItem = {
  seq: number;
  day: number;
  voter: ActionTarget;
  target?: ActionTarget;
  abstained?: boolean;
  reason?: string;
};

export type PublicVoteSnapshot = {
  votes: PublicVoteItem[];
  tally: Array<{
    target: ActionTarget;
    count: number;
  }>;
  abstainCount?: number;
  leaders: ActionTarget[];
  revealed: boolean;
};

export type ClaimBoardItem = {
  claimId: string;
  claimant: ActionTarget;
  claimedRole: Role;
  claimedRoleLabel: string;
  strength: ClaimStrength;
  checks: Array<{
    day: number;
    target: ActionTarget;
    result: "WEREWOLF" | "GOOD";
  }>;
  summary: string;
  lastUpdatedDay: number;
  sourceSpeechSeq?: number;
};

export type StanceBoardItem = {
  stanceId: string;
  day: number;
  actor: ActionTarget;
  target: ActionTarget;
  kind: StanceKind;
  kindLabel: string;
  targetRole?: Role;
  targetRoleLabel?: string;
  summary: string;
  sourceSpeechSeq?: number;
};

export type StanceShiftItem = {
  actor: ActionTarget;
  target: ActionTarget;
  fromKind: StanceKind;
  fromKindLabel: string;
  toKind: StanceKind;
  toKindLabel: string;
  fromDay: number;
  toDay: number;
  summary: string;
};

export type SeerLegacyItem = {
  claimant: ActionTarget;
  deathDay: number;
  checks: ClaimBoardItem["checks"];
  stancesGiven: StanceBoardItem[];
  lastVote?: {
    day: number;
    target?: ActionTarget;
    abstained?: boolean;
    reason?: string;
  };
  summary: string;
};

export type WolfTeamTask = "COUNTERCLAIM_SEER" | "PUSH_MISLYNCH" | "DISTANCE" | "HIDE";

export type WolfTeamAssignment = {
  seat: ActionTarget;
  task: WolfTeamTask;
  taskLabel: string;
  target?: ActionTarget;
  supportSeat?: ActionTarget;
  reason: string;
};

export type WolfTeamPlan = {
  day: number;
  strategy: "COUNTERCLAIM" | "SHADOW" | "SURVIVE";
  summary: string;
  primaryTarget?: ActionTarget;
  threat?: ActionTarget;
  counterclaimSeat?: ActionTarget;
  assignments: WolfTeamAssignment[];
};

export type SeatMemory = ActionTarget & {
  alive: boolean;
  speechCount: number;
  shortSpeechCount: number;
  evasiveSpeechCount: number;
  lastSpeech?: string;
  lastSpeechDay?: number;
  claims: ClaimBoardItem[];
  stancesGiven: StanceBoardItem[];
  stancedBy: StanceBoardItem[];
  claimedByChecks: Array<{
    claimant: ActionTarget;
    result: "WEREWOLF" | "GOOD";
    day: number;
  }>;
  publicReasons: string[];
};

export type TableMemory = {
  day: number;
  claimBoard: ClaimBoardItem[];
  stanceBoard: StanceBoardItem[];
  stanceShifts: StanceShiftItem[];
  seerLegacies: SeerLegacyItem[];
  counterclaims: Array<{
    claimedRole: Role;
    claimedRoleLabel: string;
    claimants: ActionTarget[];
  }>;
  focus: Array<{
    seat: ActionTarget;
    reasons: string[];
    score: number;
  }>;
  seats: SeatMemory[];
  voteHistory: Array<{
    day: number;
    tally: Array<{
      target: ActionTarget;
      count: number;
    }>;
    leaders: ActionTarget[];
    exiled?: ActionTarget;
    tiedSeatIds: number[];
  }>;
  deathAnnouncements: string[];
  publicSignals: string[];
};

export type SeatRead = ActionTarget & {
  suspicion: number;
  trust: number;
  pressure: string[];
  isSelf: boolean;
  isKnownWolf: boolean;
  isKnownGood: boolean;
  isWolfTeammate: boolean;
  speechCount: number;
  lastSpeech?: string;
  lastSpeechDay?: number;
  votedFor?: ActionTarget;
  votesReceived: number;
  publicClaims: ClaimBoardItem[];
  publicChecksAgainst: SeatMemory["claimedByChecks"];
  publicStancesGiven: StanceBoardItem[];
  publicStancedBy: StanceBoardItem[];
};

export type AiTableRead = {
  mySeatId: number;
  myRole: Role;
  day: number;
  personaLabel?: string;
  seats: SeatRead[];
  knownWolfSeatIds: number[];
  knownGoodSeatIds: number[];
  wolfTeammateSeatIds: number[];
  focus?: SeatRead;
  backupFocus?: SeatRead;
  voteSnapshot: PublicVoteSnapshot;
  recentSpeeches: PublicSpeechItem[];
  recentDeaths: string[];
  tableMemory: TableMemory;
  tableMood: string;
};

export type SpeechClaimIntent = {
  claimedRole: Role;
  strength: ClaimStrength;
  check?: ClaimCheck;
  isCounterclaim?: boolean;
};

export type SpeechInteractionIntent = {
  kind: "challenge" | "support" | "pivot" | "rally" | "probe";
  sourceSpeaker?: ActionTarget;
  target?: ActionTarget;
  line: string;
  goal: string;
};

export type SpeechPersonaCue = {
  mode: "press" | "verify" | "hedge" | "identity" | "emotion" | "steady";
  line: string;
  directives: string[];
};

export type SpeechPlan = {
  kind: "claim-check" | "counterclaim" | "pressure" | "defend" | "explain-vote" | "rally" | "confuse";
  target?: ActionTarget;
  stance: string;
  talkingPoints: string[];
  risk: number;
  interaction?: SpeechInteractionIntent;
  personaCue?: SpeechPersonaCue;
  claimIntent?: SpeechClaimIntent;
};

export type VotePlan = {
  target: ActionTarget;
  reason: string;
  confidence: number;
  alternatives: ActionTarget[];
};

export type AvailableHumanAction =
  | { type: "wolfKill"; targets: ActionTarget[] }
  | { type: "guardAction"; targets: ActionTarget[]; canSkip: boolean; lastGuardedSeatId?: number }
  | { type: "seerCheck"; targets: ActionTarget[] }
  | {
      type: "witchAction";
      canSave: boolean;
      saveTarget?: ActionTarget;
      canPoison: boolean;
      poisonTargets: ActionTarget[];
    }
  | { type: "speak" }
  | { type: "lastWords" }
  | { type: "vote"; targets: ActionTarget[]; canAbstain: boolean }
  | { type: "hunterShoot"; targets: ActionTarget[]; canSkip: boolean }
  | { type: "sheriffNominate"; canRun: boolean }
  | { type: "sheriffSpeech" }
  | { type: "sheriffWithdraw"; canWithdraw: boolean }
  | { type: "sheriffVote"; targets: ActionTarget[]; canAbstain: boolean; isPk: boolean }
  | { type: "sheriffHandoff"; targets: ActionTarget[]; canTear: boolean }
  | { type: "continue"; label: string; description: string };

export type HumanGameView = {
  id: string;
  day: number;
  phase: Phase;
  phaseLabel: string;
  board: BoardSnapshot;
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
    personaLabel?: string;
    personaStyle?: string;
  }>;
  publicEvents: Array<Pick<GameEvent, "seq" | "type" | "day" | "phase" | "actorSeatId" | "message" | "payload">>;
  privateEvents: Array<Pick<GameEvent, "seq" | "type" | "day" | "phase" | "actorSeatId" | "message" | "payload">>;
  availableActions: AvailableHumanAction[];
  currentActorSeatId?: number;
  currentSpeakerSeatId?: number;
  wolfTeammates: ActionTarget[];
  seerChecks: SeerCheck[];
  guard?: GameState["guard"] & {
    guardedTarget?: ActionTarget;
  };
  witch: GameState["witch"];
  sheriff?: Omit<NonNullable<GameState["sheriff"]>, "candidates" | "pkCandidates"> & {
    badgeHolder?: ActionTarget;
    candidates: ActionTarget[];
    pkCandidates?: ActionTarget[];
  };
  votes: Record<string, number | null>;
  tableSummary: {
    recentSpeeches: PublicSpeechItem[];
    voteSnapshot: PublicVoteSnapshot;
    claimBoard: ClaimBoardItem[];
    tableMemory: TableMemory;
    aiReasonHighlights: string[];
    phaseSteps: Array<{
      key: Phase;
      label: string;
      status: "done" | "current" | "upcoming";
    }>;
  };
  result?: GameResult;
  review?: GameReview;
  reviewDebug?: ReviewDebugInfo;
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
    recentSpeeches: PublicSpeechItem[];
    recentVotes: PublicVoteItem[];
    voteSnapshot: PublicVoteSnapshot;
    recentDeaths: string[];
    deathSummary: string[];
    claimBoard: ClaimBoardItem[];
    tableMemory: TableMemory;
  };
  privateKnowledge: {
    wolfTeammates?: ActionTarget[];
    seerChecks?: SeerCheck[];
    witch?: GameState["witch"] & {
      currentVictim?: ActionTarget;
      savedTarget?: ActionTarget;
      poisonedTarget?: ActionTarget;
      antidoteUsedTonight?: boolean;
      poisonUsedTonight?: boolean;
    };
    pendingHunterShot?: HunterShotState;
    guard?: GameState["guard"] & {
      guardedTarget?: ActionTarget;
    };
    sheriff?: Omit<NonNullable<GameState["sheriff"]>, "candidates" | "pkCandidates"> & {
      badgeHolder?: ActionTarget;
      candidates: ActionTarget[];
      pkCandidates?: ActionTarget[];
    };
    wolfTeamPlan?: WolfTeamPlan;
    aiMemory?: AiSeatMemory;
  };
  allowedActions: AvailableHumanAction[];
};
