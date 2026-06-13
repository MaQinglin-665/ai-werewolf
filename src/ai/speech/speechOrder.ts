import type { ActionTarget, AgentView, SpeechPlan } from "@/game/types";

import { currentDaySpeechItems, toTargetFromSeatId } from "./context";
import type { LlmSpeechInput } from "./types";

export function buildSpeechOrderContext(view: AgentView): LlmSpeechInput["publicContext"]["speechOrder"] {
  const speakersAlreadyFinished = uniqueSeatOrder(
    currentDaySpeechItems(view)
      .filter((speech) => speech.speaker)
      .map((speech) => speech.speaker!),
  );
  const currentSpeaker = toTargetFromSeatId(view, view.mySeatId);
  const todaySpeechOrder = buildTodaySpeechOrder(view, speakersAlreadyFinished, currentSpeaker);
  const currentSpeakerOrderIndex = todaySpeechOrder.findIndex((seat) => seat.seatId === currentSpeaker.seatId);
  const currentDaySpokenSeatIds = new Set(
    speakersAlreadyFinished.map((seat) => seat.seatId),
  );
  return {
    currentSpeaker,
    todaySpeechOrder,
    currentSpeakerOrderIndex,
    speakersAlreadyFinished,
    currentDaySpokenSeats: todaySpeechOrder.filter((seat) => currentDaySpokenSeatIds.has(seat.seatId)),
    currentDayUnspokenSeats: todaySpeechOrder.filter(
      (seat) => seat.seatId !== view.mySeatId && !currentDaySpokenSeatIds.has(seat.seatId),
    ),
  };
}

export function buildTodaySpeechOrder(view: AgentView, speakersAlreadyFinished: ActionTarget[], currentSpeaker: ActionTarget): ActionTarget[] {
  const projectedQueue = view.daySpeechOrder?.queue ?? [];
  const queueHasCurrentSpeaker = projectedQueue.some((seat) => seat.seatId === currentSpeaker.seatId);
  const baseOrder = queueHasCurrentSpeaker ? projectedQueue : view.aliveSeats;
  const missingFinishedSpeakers = speakersAlreadyFinished.filter(
    (speaker) => !baseOrder.some((seat) => seat.seatId === speaker.seatId),
  );
  const remainingAliveSeats = view.aliveSeats.filter(
    (seat) =>
      !missingFinishedSpeakers.some((speaker) => speaker.seatId === seat.seatId) &&
      !baseOrder.some((orderedSeat) => orderedSeat.seatId === seat.seatId),
  );
  return uniqueSeatOrder([...missingFinishedSpeakers, ...baseOrder, ...remainingAliveSeats]);
}

export function currentDaySpokenSeats(view: AgentView): ActionTarget[] {
  return uniqueSeatOrder(
    currentDaySpeechItems(view)
      .map((speech) => speech.speaker)
      .filter((seat): seat is ActionTarget => Boolean(seat)),
  );
}

export function hasCurrentDaySpeech(view: AgentView, seatId: number): boolean {
  return currentDaySpeechItems(view).some((speech) => speech.speaker?.seatId === seatId);
}

export function getPlanTargetSpeechStatus(
  view: AgentView,
  plan: SpeechPlan,
  target: ActionTarget | undefined,
): SpeechPlan["targetSpeechStatus"] {
  if (!target) return "none";
  if (plan.target?.seatId === target.seatId && plan.targetSpeechStatus) return plan.targetSpeechStatus;
  return hasCurrentDaySpeech(view, target.seatId) ? "spoken" : "unspoken";
}

export function uniqueSeatOrder(seats: ActionTarget[]): ActionTarget[] {
  const seen = new Set<number>();
  const result: ActionTarget[] = [];
  for (const seat of seats) {
    if (seen.has(seat.seatId)) continue;
    seen.add(seat.seatId);
    result.push(seat);
  }
  return result;
}
