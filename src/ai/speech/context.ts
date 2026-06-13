import type { ActionTarget, AgentView } from "@/game/types";

export type CurrentDayDeathShape = "none" | "peaceful" | "death";

export function currentDaySpeechItems(view: AgentView): AgentView["publicSummary"]["recentSpeeches"] {
  const bySeq = new Map<number, AgentView["publicSummary"]["recentSpeeches"][number]>();
  for (const speech of view.publicSummary.recentSpeeches) {
    if (speech.day !== view.day || !speech.speaker) continue;
    bySeq.set(speech.seq, speech);
  }
  for (const event of view.publicEvents) {
    if (event.day !== view.day || event.type !== "SPEECH_CREATED" || event.payload.sheriffSpeech === true) continue;
    const seatId = readNumberValue(event.payload.seatId) ?? event.actorSeatId;
    if (!seatId) continue;
    bySeq.set(event.seq, {
      seq: event.seq,
      day: event.day,
      speaker: toTargetFromSeatId(view, seatId),
      message: readStringValue(event.payload.message) ?? event.message,
    });
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export function toTargetFromSeatId(view: AgentView, seatId: number): ActionTarget {
  return (
    view.aliveSeats.find((seat) => seat.seatId === seatId) ??
    view.publicSummary.tableMemory.seats.find((seat) => seat.seatId === seatId) ?? {
      seatId,
      name: `${seatId}号`,
    }
  );
}

export function hasCurrentDayDeathShapeMention(view: AgentView): boolean {
  const deathShape = getCurrentDayDeathShape(view);
  const currentSpeechText = currentDaySpeechItems(view)
    .map((speech) => speech.message)
    .join("\n");
  if (deathShape === "death") return /死亡|倒牌|出局|死因|女巫没救|女巫没用药|没用解药|刀口|毒口/.test(currentSpeechText);
  if (deathShape === "peaceful") return /平安夜|女巫用药|药线|空刀/.test(currentSpeechText);
  return false;
}

export function getCurrentDayDeathShape(view: AgentView): CurrentDayDeathShape {
  const text = collectCurrentDayDeathLines(view).join("\n");
  if (/(死亡|倒牌|出局)/.test(text)) return "death";
  if (/(平安夜|无人死亡|没有人死亡|没人倒牌|无人倒牌)/.test(text)) return "peaceful";
  const currentSpeechText = currentDaySpeechItems(view)
    .map((speech) => speech.message)
    .join("\n");
  if (/(平安夜|女巫用药|药线|空刀)/.test(currentSpeechText)) return "peaceful";
  return "none";
}

function collectCurrentDayDeathLines(view: AgentView): string[] {
  const eventLines = view.publicEvents
    .filter((event) => event.day === view.day && event.type === "DAY_STARTED")
    .map((event) => event.message);
  return [
    ...eventLines,
    ...view.publicSummary.recentDeaths,
    ...view.publicSummary.tableMemory.deathAnnouncements,
  ].filter((line): line is string => typeof line === "string" && line.trim().length > 0);
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
