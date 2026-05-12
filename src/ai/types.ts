import type { AgentView, Command, Phase, SpeechPlan, VotePlan } from "@/game/types";

export type AiDecisionLog = {
  gameId: string;
  seatNumber: number;
  phase: Phase;
  provider: string;
  prompt: AgentView;
  output: Command;
  votePlan?: VotePlan;
  speechPlan?: SpeechPlan;
  rawOutput?: unknown;
  isFallback: boolean;
  error?: string;
};

export type AiSpeechResult = {
  speech: string;
  provider: string;
  rawOutput?: unknown;
  isFallback: boolean;
  error?: string;
};

export type AiActionProvider = {
  providerId: string;
  createCommand(view: AgentView): Command;
};

export type AiSpeechProvider = {
  providerId: string;
  generateSpeech(view: AgentView, plan?: SpeechPlan): Promise<AiSpeechResult>;
};
