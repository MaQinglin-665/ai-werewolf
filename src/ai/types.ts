import type { AgentView, Command, GameState, Phase } from "@/game/types";

export type AiDecisionLog = {
  gameId: string;
  seatNumber: number;
  phase: Phase;
  provider: string;
  prompt: AgentView;
  output: Command;
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
  createCommand(state: GameState, actorSeatId: number): Command;
};

export type AiSpeechProvider = {
  providerId: string;
  generateSpeech(view: AgentView): Promise<AiSpeechResult>;
};
