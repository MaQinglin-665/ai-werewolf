import type { AgentView, AiTableRead, Command, Phase, SpeechPlan, VotePlan } from "@/game/types";

export type AiDecisionLog = {
  gameId: string;
  day: number;
  seatNumber: number;
  phase: Phase;
  provider: string;
  prompt: AgentView;
  output: Command;
  votePlan?: VotePlan;
  speechPlan?: SpeechPlan;
  publicFactBasis?: string[];
  rawOutput?: unknown;
  isFallback: boolean;
  error?: string;
  validationErrors?: string[];
};

export type AiSpeechResult = {
  speech: string;
  provider: string;
  rawOutput?: unknown;
  isFallback: boolean;
  error?: string;
  validationErrors?: string[];
};

export type AiSpeechProviderContext = {
  onTextDelta?: (text: string) => void;
  onTextSnapshot?: (text: string) => void;
};

export type AiActionProviderContext = {
  tableRead: AiTableRead;
  votePlan?: VotePlan;
  fallbackCommand: Command;
};

export type AiActionResult = {
  command: Command;
  provider: string;
  rawOutput?: unknown;
  isFallback: boolean;
  error?: string;
  validationErrors?: string[];
};

export type AiActionProvider = {
  providerId: string;
  generateCommand(view: AgentView, context: AiActionProviderContext): Promise<AiActionResult>;
};

export type AiSpeechProvider = {
  providerId: string;
  generateSpeech(view: AgentView, plan?: SpeechPlan, context?: AiSpeechProviderContext): Promise<AiSpeechResult>;
};
