import { advanceOneAiStep, createConfiguredAiOptions } from "@/ai/mockAgent";
import { getTurnRequirement } from "@/game/engine";
import { isPublicActorPhase } from "@/game/phaseSemantics";
import type { GameState, Phase, TurnRequirement } from "@/game/types";

export type RoomAdvanceStopReason =
  | "human-action"
  | "public-observation"
  | "finished"
  | "none"
  | "step-limit";

export type RoomAdvanceTraceEntry = {
  step: number;
  phase: Phase;
  day: number;
  requirementType: TurnRequirement["type"];
  actorSeatId?: number;
};

export type RoomAdvanceResult = {
  state: GameState;
  stopReason: RoomAdvanceStopReason;
  trace: RoomAdvanceTraceEntry[];
};

export async function advanceRoomToNextStop(
  initialState: GameState,
  options: {
    maxSteps?: number;
    forceMockAi?: boolean;
  } = {},
): Promise<RoomAdvanceResult> {
  let state = initialState;
  const trace: RoomAdvanceTraceEntry[] = [];
  const maxSteps = options.maxSteps ?? 48;
  const aiOptions = createConfiguredAiOptions({ forceMock: options.forceMockAi === true });

  for (let step = 0; step <= maxSteps; step += 1) {
    const requirement = getTurnRequirement(state);
    trace.push({
      step,
      phase: state.phase,
      day: state.day,
      requirementType: requirement.type,
      actorSeatId: "actorSeatId" in requirement ? requirement.actorSeatId : undefined,
    });

    if (state.result || state.phase === "GAME_OVER") {
      return { state, stopReason: "finished", trace };
    }

    if (requirement.type === "human") {
      return { state, stopReason: "human-action", trace };
    }

    if (requirement.type === "none") {
      return { state, stopReason: "none", trace };
    }

    if (step >= maxSteps) {
      return { state, stopReason: "step-limit", trace };
    }

    const advanced = await advanceOneAiStep(state, aiOptions);
    state = advanced.state;

    const nextRequirement = getTurnRequirement(state);
    if (
      nextRequirement.type !== "ai" &&
      isPublicActorPhase(state.phase) &&
      trace.length > 0 &&
      trace[trace.length - 1]?.phase !== state.phase
    ) {
      return { state, stopReason: "public-observation", trace };
    }
  }

  return { state, stopReason: "step-limit", trace };
}
