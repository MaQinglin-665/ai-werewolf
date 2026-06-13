import type { AiClaimAudit } from "../claimAudit";
import type { ClassTrialCharacterLens } from "../classTrialCharacterLens";
import type { ClassTrialLiveState } from "../classTrialLiveState";
import type { AiDebateAgenda } from "../debateAgenda";
import type { PublicInferenceLayers } from "../inferenceLayers";
import type { LlmOutputStabilityHint } from "../modelLlms";
import type { AdaptedPersonaStrategyCard, AiOrdinaryLiveIntentState } from "../personaStrategyCards";
import type { AiReasoningFrame } from "../reasoningFrame";
import type { AiRolePlaybook } from "../rolePlaybook";
import type {
  ActionTarget,
  AgentView,
  AiFriendRuntimeLlmConfig,
  ClaimCheck,
  Role,
  SpeechPlan,
  TableMemory,
} from "@/game/types";

export type SpeechStrictness = "strict" | "guided" | "loose";

export type LlmSpeechContract = {
  move: Exclude<SpeechPlan["speechMove"], undefined>;
  target?: ActionTarget;
  targetSpeechStatus: Exclude<SpeechPlan["targetSpeechStatus"], undefined>;
  allowedInteraction: Exclude<SpeechPlan["allowedInteraction"], undefined>;
  mustSay: string[];
  mayAsk: string[];
  mustNotAsk: string[];
  voteBoundary?: string;
  maxSentences: number;
  maxChars: number;
};

export type OrdinarySpeechPressure =
  | "noInformation"
  | "respondToPrevious"
  | "underQuestion"
  | "publicRoleClaim"
  | "deathShape"
  | "voteBoundary";

export type OrdinarySpeechMove =
  | "waterPass"
  | "quoteOneLine"
  | "halfAccept"
  | "discomfort"
  | "followPressure"
  | "hold"
  | "defendSelf"
  | "clarifyMotive"
  | "counterQuestion"
  | "changeRead"
  | "roleHandle"
  | "voteBoundary";

export type OrdinarySpeechDirector = {
  currentPressure: OrdinarySpeechPressure;
  tableObjects: string[];
  allowedSpeechMoves: OrdinarySpeechMove[];
  recentSurfaceMoves: string[];
  playerVoiceCard: OrdinaryPlayerVoiceCard;
  selfHistory?: OrdinarySelfHistory;
  promptLines: string[];
};

export type OrdinaryPlayerVoiceCard = {
  label: string;
  traits: string[];
  mouthHabit: string;
  emotionTell: string;
  riskHabit: string;
  promptLines: string[];
};

export type OrdinarySelfHistory = {
  lastPublicSpeech?: string;
  lastSpeechTarget?: ActionTarget;
  lastSpeechStance?: string;
  lastVoteTarget?: ActionTarget;
  lastVoteReason?: string;
  incomingPressure?: Array<{ speaker: ActionTarget; message: string }>;
  promptLines: string[];
};

export type LlmSpeechInput = {
  day: number;
  mySeatId: number;
  myRole: Role;
  persona?: AgentView["persona"];
  characterRole?: NonNullable<AgentView["roleCard"]>;
  characterLens?: ClassTrialCharacterLens;
  classTrialLiveState?: ClassTrialLiveState;
  personaStrategyCard?: AdaptedPersonaStrategyCard;
  ordinaryLiveIntent?: AiOrdinaryLiveIntentState;
  ordinarySpeechDirector?: OrdinarySpeechDirector;
  aliveSeats: ActionTarget[];
  tableBriefing: {
    text: string;
    speechProgress: {
      currentSpeaker: ActionTarget;
      spokenSeatIds: number[];
      unspokenSeatIds: number[];
      spokenCount: number;
      aliveCount: number;
    };
    publicBoundary: string[];
    privateBoundary: string[];
    publicFacts: string[];
    privateFacts: string[];
    unknowns: string[];
    legalSpeechFocus: string[];
    publicReasoningCues: string[];
  };
  publicContext: {
    rules: {
      sheriffEnabled: boolean;
      note: string;
      deathInfoNote: string;
      speechTimelineNote: string;
      unavailableTerms: string[];
    };
    recentSpeeches: AgentView["publicSummary"]["recentSpeeches"];
    voteSnapshot: AgentView["publicSummary"]["voteSnapshot"];
    recentDeaths: string[];
    claimBoard: AgentView["publicSummary"]["claimBoard"];
    speechOrder: {
      currentSpeaker: ActionTarget;
      todaySpeechOrder: ActionTarget[];
      currentSpeakerOrderIndex: number;
      speakersAlreadyFinished: ActionTarget[];
      currentDaySpokenSeats: ActionTarget[];
      currentDayUnspokenSeats: ActionTarget[];
    };
    tableMemory: Pick<
      TableMemory,
      | "day"
      | "claimBoard"
      | "stanceBoard"
      | "stanceShifts"
      | "seerLegacies"
      | "speechInfluence"
      | "reasoningCues"
      | "counterclaims"
      | "focus"
      | "voteHistory"
      | "deathAnnouncements"
      | "publicSignals"
    >;
  };
  privateContext: {
    role: Role;
    aiMemory?: AgentView["privateKnowledge"]["aiMemory"];
    seerChecks?: Array<{
      day: number;
      target: ActionTarget;
      result: ClaimCheck["result"];
    }>;
    witch?: {
      antidoteAvailable: boolean;
      poisonAvailable: boolean;
      currentVictim?: ActionTarget;
      savedTarget?: ActionTarget;
      poisonedTarget?: ActionTarget;
      antidoteUsedTonight?: boolean;
      poisonUsedTonight?: boolean;
    };
    wolfSpeechAssignment?: {
      taskLabel: string;
      target?: ActionTarget;
      supportSeat?: ActionTarget;
      publicInstruction: string;
      nightInstruction?: string;
    };
  };
  expertStrategy: string[];
  advancedReasoning: string[];
  inferenceLayers: PublicInferenceLayers;
  reasoningFrame: AiReasoningFrame;
  rolePlaybook: AiRolePlaybook;
  claimAudit: AiClaimAudit;
  debateAgenda: AiDebateAgenda;
  playerSpeechGuide: {
    tablePlayerStyle: string[];
    modelStyle: {
      modelName: string;
      softTendency: string;
      tendencies: string[];
    };
    tableTask?: NonNullable<SpeechPlan["tableTask"]>;
    softInteraction: string[];
    avoid: string[];
  };
  speechContract: LlmSpeechContract;
  speechPlan?: SpeechPlan;
  speechStrictness: SpeechStrictness;
  constraints?: string[];
  llmConfig?: AiFriendRuntimeLlmConfig;
  stability?: LlmOutputStabilityHint;
};
