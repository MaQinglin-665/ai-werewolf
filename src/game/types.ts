export const ROLES = [
  "WEREWOLF",
  "WOLF_KING",
  "WHITE_WOLF_KING",
  "WOLF_BEAUTY",
  "VILLAGER",
  "SEER",
  "WITCH",
  "HUNTER",
  "IDIOT",
  "KNIGHT",
  "GUARD",
] as const;
export type Role = (typeof ROLES)[number];

export const PHASES = [
  "SETUP",
  "NIGHT_WOLVES",
  "NIGHT_WOLF_BEAUTY",
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
  "KNIGHT_DUEL",
  "DAY_VOTE",
  "EXILE_RESOLUTION",
  "LAST_WORDS",
  "HUNTER_REVEAL",
  "HUNTER_SHOT",
  "WOLF_KING_SHOT",
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
  | "HUNTER_SHOT"
  | "WOLF_KING_SHOT"
  | "WHITE_WOLF_KING_EXPLODE"
  | "WHITE_WOLF_KING_SHOT"
  | "WOLF_BEAUTY_CHARM"
  | "KNIGHT_DUEL"
  | "KNIGHT_DUEL_FAILED";

export type GameEventType =
  | "GAME_CREATED"
  | "ROLE_ASSIGNED"
  | "NIGHT_STARTED"
  | "NIGHT_KILL_SELECTED"
  | "WOLF_BEAUTY_CHARMED"
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
  | "SHERIFF_NOMINATION_REVEALED"
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
  | "IDIOT_REVEALED"
  | "LAST_WORDS_CREATED"
  | "PLAYER_DIED"
  | "HUNTER_REVEALED"
  | "HUNTER_SHOT"
  | "HUNTER_SKIPPED"
  | "WOLF_KING_SHOT"
  | "WOLF_KING_SKIPPED"
  | "WHITE_WOLF_KING_EXPLODED"
  | "WOLF_BEAUTY_CHARM_TRIGGERED"
  | "KNIGHT_DUEL_SUCCESS"
  | "KNIGHT_DUEL_FAILED"
  | "KNIGHT_DUEL_SKIPPED"
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
  aiFriendId?: string;
  avatarDataUrl?: string;
  llmConfig?: AiFriendLlmConfig;
  ttsVoice?: string;
  ttsConfig?: AiFriendTtsConfig;
  roleCard?: AiCharacterRoleCard;
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

export type WolfKingShotState = {
  shooterSeatId: number;
  cause: "EXILED" | "HUNTER_SHOT";
  nextStep: "DAY_DEATHS" | "NIGHT_DEATHS";
};

export type GameResult = {
  winner: Camp;
  reason: string;
};

export type BoardId = string;
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
  hasWolfBeauty: boolean;
  hasKnight: boolean;
  hasIdiot: boolean;
  winCondition: WinCondition;
  sheriffVoteWeight: number;
  guardSaveConflictKills: boolean;
};

export type AiPersonaPreferences = {
  logic: number;
  identity: number;
  vote: number;
  emotion: number;
  memory: number;
  leadership: number;
  deception: number;
  caution: number;
};

export type AiCharacterRoleCard = {
  id: string;
  displayName: string;
  theme: string;
  styleTags: string[];
  speechStyleZh: string;
  reasoningBias: string;
  voteBias: string;
  nightActionBias: string;
  asVillager: string;
  asWerewolf: string;
  pressureResponse: string;
  relationshipHints: string[];
  catchphrasePolicy: string;
  forbidden: string[];
  voiceProfileId?: string;
  voiceLocale?: string;
  voiceRewritePolicy?: string;
};

export type AiFriendLlmConfig = {
  provider: "openai-compatible";
  label?: string;
  baseUrl: string;
  model: string;
  mergeSystemIntoUser?: boolean;
};

export type AiFriendRuntimeLlmConfig = AiFriendLlmConfig & {
  apiKey?: string;
};

export type AiRuntimeMode = "mock" | "llm";

export type AiFriendTtsConfig = {
  provider: "mimo-compatible";
  label?: string;
  baseUrl: string;
  model: string;
  voice: string;
  format?: string;
  authHeader?: string;
};

export type AiFriendRuntimeTtsConfig = AiFriendTtsConfig & {
  apiKey?: string;
};

export type AiFriendConfig = {
  id: string;
  nickname: string;
  basePersonaId: string;
  avatarDataUrl?: string;
  llmConfig?: AiFriendLlmConfig;
  ttsVoice?: string;
  ttsConfig?: AiFriendTtsConfig;
  roleCard?: AiCharacterRoleCard;
  riskTolerance: number;
  bluffing: number;
  preferences: AiPersonaPreferences;
  createdAt: string;
  updatedAt: string;
};

export type AiFriendSeatSetup = {
  seatId: number;
  friendId: string;
  nickname: string;
  basePersonaId: string;
  personaName: string;
  modelLabel?: string;
  avatarDataUrl?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendTtsConfig;
  roleCard?: AiCharacterRoleCard;
  isDefault: boolean;
};

export type GameSetupSnapshot = {
  boardId: string;
  aiFriends: AiFriendSeatSetup[];
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
  nextStep: "DAY_DEATHS" | "NIGHT_DEATHS" | "DAY_VOTE";
};

export type KnightState = {
  used: boolean;
};

export type IdiotState = {
  revealedSeatIds: number[];
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
  outputSummary?: string;
  decisionReason?: string;
  target?: ReviewSeat;
  isFallback: boolean;
  publicFactBasis: string[];
  matchedPublicLogic: string[];
  rawOutput?: unknown;
  error?: string;
  validationErrors: string[];
};

export type ReviewDebugInfo = {
  aiCalls: ReviewAiDebugEntry[];
  fallbackCount: number;
  providers: string[];
  publicFactBasisCount: number;
  matchedPublicLogicCount: number;
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
  spectatorMode?: boolean;
  board: BoardSnapshot;
  rules: GameRules;
  setup?: GameSetupSnapshot;
  seats: Seat[];
  events: GameEvent[];
  night: {
    wolfTargetSeatId?: number;
    wolfBeautyTargetSeatId?: number;
    guardTargetSeatId?: number;
    witchSavedSeatId?: number;
    witchPoisonTargetSeatId?: number;
  };
  guard?: GuardState;
  knight?: KnightState;
  idiot?: IdiotState;
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
  pendingWolfKingShot?: WolfKingShotState;
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
  | ({ type: "wolfBeautyCharm"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "speak"; actorSeatId: number; message: string } & CommandReason)
  | ({ type: "lastWords"; actorSeatId: number; message: string } & CommandReason)
  | ({ type: "vote"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "hunterReveal"; actorSeatId: number; reveal: boolean } & CommandReason)
  | ({ type: "hunterShoot"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "wolfKingShoot"; actorSeatId: number; targetSeatId?: number } & CommandReason)
  | ({ type: "whiteWolfKingExplode"; actorSeatId: number; targetSeatId: number } & CommandReason)
  | ({ type: "knightDuel"; actorSeatId: number; targetSeatId?: number } & CommandReason)
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
  modelLabel: string;
  label: string;
  style: string;
  goal: string;
  riskTolerance: number;
  bluffing: number;
  preferences?: AiPersonaPreferences;
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
  fromTarget?: ActionTarget;
  toTarget?: ActionTarget;
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
  deathKind?: "night" | "exile";
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

export type WolfNightStrategy = {
  nightTarget?: ActionTarget;
  dayPressureTarget?: ActionTarget;
  summary: string;
  discussion: string[];
};

export type WolfTeamPlan = {
  day: number;
  strategy: "COUNTERCLAIM" | "SHADOW" | "SURVIVE";
  summary: string;
  nightStrategy?: WolfNightStrategy;
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
  lastSpeechSeq?: number;
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

export type SpeechInfluenceItem = {
  sourceSpeechSeq: number;
  day: number;
  speaker: ActionTarget;
  target: ActionTarget;
  direction: "pressure" | "support";
  summary: string;
  followupActors: ActionTarget[];
  followupCount: number;
};

export type PublicReasoningCue = {
  cueId: string;
  day: number;
  kind: "claim" | "counterclaim" | "death_shape" | "seer_legacy" | "speech_influence" | "stance_shift" | "vote";
  weight: "strong" | "medium" | "light";
  summary: string;
  actor?: ActionTarget;
  target?: ActionTarget;
  evidence: string[];
};

export type TableMemory = {
  day: number;
  claimBoard: ClaimBoardItem[];
  stanceBoard: StanceBoardItem[];
  stanceShifts: StanceShiftItem[];
  seerLegacies: SeerLegacyItem[];
  speechInfluence: SpeechInfluenceItem[];
  reasoningCues: PublicReasoningCue[];
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
  lastSpeechSeq?: number;
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

export type SpeechPlayMotive = {
  kind: "bait_kill" | "self_defense" | "tempo_grab" | "wolf_misdirect" | "protect_power_role" | "public_logic";
  line: string;
  allowIdentityClaim: boolean;
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

export type SpeechTableTask = {
  mode: "set-standard" | "audit-pressure-chain" | "hold-countercase" | "pivot-alternative" | "summarize-vote";
  line: string;
  directives: string[];
  target?: ActionTarget;
};

export type SpeechTargetStatus = "none" | "spoken" | "unspoken";
export type SpeechAllowedInteraction = "none" | "review_spoken" | "ask_future" | "finalize_black_check";
export type SpeechMove =
  | "none"
  | "review_spoken_target"
  | "ask_unspoken_target"
  | "claim_black_check"
  | "claim_gold_check"
  | "identity_claim"
  | "lock_vote"
  | "soft_pressure"
  | "explain_vote";

export type SpeechPlan = {
  kind: "claim-check" | "counterclaim" | "pressure" | "defend" | "explain-vote" | "rally" | "confuse";
  target?: ActionTarget;
  targetSpeechStatus?: SpeechTargetStatus;
  allowedInteraction?: SpeechAllowedInteraction;
  speechMove?: SpeechMove;
  stance: string;
  talkingPoints: string[];
  risk: number;
  interaction?: SpeechInteractionIntent;
  personaCue?: SpeechPersonaCue;
  tableTask?: SpeechTableTask;
  playMotive?: SpeechPlayMotive;
  claimIntent?: SpeechClaimIntent;
};

export type WolfVoteTactic = "team_target" | "planned_distance" | "emergency_cut" | "avoid_teammate";

export type VotePlan = {
  target: ActionTarget;
  abstain?: boolean;
  reason: string;
  confidence: number;
  alternatives: ActionTarget[];
  wolfVoteTactic?: WolfVoteTactic;
};

export type AvailableHumanAction =
  | { type: "wolfKill"; targets: ActionTarget[] }
  | { type: "guardAction"; targets: ActionTarget[]; canSkip: boolean; lastGuardedSeatId?: number }
  | { type: "seerCheck"; targets: ActionTarget[] }
  | {
      type: "witchAction";
      canSave: boolean;
      saveTarget?: ActionTarget;
      saveBlockedReason?: string;
      canPoison: boolean;
      poisonTargets: ActionTarget[];
    }
  | { type: "wolfBeautyCharm"; targets: ActionTarget[]; canSkip: boolean }
  | { type: "speak" }
  | { type: "lastWords" }
  | { type: "vote"; targets: ActionTarget[]; canAbstain: boolean }
  | { type: "hunterReveal"; canReveal: boolean }
  | { type: "hunterShoot"; targets: ActionTarget[]; canSkip: boolean }
  | { type: "wolfKingShoot"; targets: ActionTarget[]; canSkip: boolean }
  | { type: "whiteWolfKingExplode"; targets: ActionTarget[] }
  | { type: "knightDuel"; targets: ActionTarget[]; canSkip: boolean }
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
  humanSeatId: number | null;
  myRole?: Role;
  myRoleLabel?: string;
  seats: Array<{
    seatId: number;
    name: string;
    isAi: boolean;
    isHuman: boolean;
    alive: boolean;
    role?: Role;
    roleLabel?: string;
    deathReason?: DeathReason;
    voteDisabled?: boolean;
    personaLabel?: string;
    personaStyle?: string;
    personaName?: string;
    personaModelLabel?: string;
    aiFriendId?: string;
    avatarDataUrl?: string;
    ttsVoice?: string;
    ttsConfig?: AiFriendTtsConfig;
    roleCard?: AiCharacterRoleCard;
  }>;
  publicEvents: Array<Pick<GameEvent, "seq" | "type" | "day" | "phase" | "actorSeatId" | "message" | "payload">>;
  privateEvents: Array<Pick<GameEvent, "seq" | "type" | "day" | "phase" | "actorSeatId" | "message" | "payload">>;
  availableActions: AvailableHumanAction[];
  currentActorSeatId?: number;
  currentSpeakerSeatId?: number;
  wolfTeammates: ActionTarget[];
  wolfStrategy?: WolfNightStrategy;
  seerChecks: SeerCheck[];
  guard?: GameState["guard"] & {
    guardedTarget?: ActionTarget;
  };
  witch?: GameState["witch"];
  sheriff?: Omit<NonNullable<GameState["sheriff"]>, "candidates" | "pkCandidates"> & {
    badgeHolder?: ActionTarget;
    candidates: ActionTarget[];
    pkCandidates?: ActionTarget[];
  };
  votes: Record<string, number | null>;
  tableSummary: {
    recentSpeeches: PublicSpeechItem[];
    voteSnapshot: PublicVoteSnapshot;
    sheriffVoteSnapshot?: PublicVoteSnapshot;
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
  setup?: GameSetupSnapshot;
};

export type AgentView = {
  gameId: string;
  day: number;
  phase: Phase;
  rules: Pick<GameRules, "hasGuard" | "guardSaveConflictKills" | "hasWolfBeauty" | "hasKnight"> & {
    hasIdiot?: GameRules["hasIdiot"];
    wolfRoles?: GameRules["wolfRoles"];
  };
  mySeatId: number;
  myRole: Role;
  persona?: AiPersona;
  llmConfig?: AiFriendRuntimeLlmConfig;
  roleCard?: AiCharacterRoleCard;
  aliveSeats: ActionTarget[];
  daySpeechOrder?: {
    queue: ActionTarget[];
    currentIndex: number;
  };
  publicEvents: HumanGameView["publicEvents"];
  publicSummary: {
    recentSpeeches: PublicSpeechItem[];
    recentVotes: PublicVoteItem[];
    voteSnapshot: PublicVoteSnapshot;
    sheriffVoteSnapshot?: PublicVoteSnapshot;
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
    pendingWolfKingShot?: WolfKingShotState;
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
