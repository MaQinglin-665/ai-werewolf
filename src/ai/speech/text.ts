import type { ActionTarget } from "@/game/types";

export function seatText(seat: ActionTarget): string {
  const name = stripEvaluationModelSuffix(seat.name.trim());
  return name && name !== "你" ? `${seat.seatId}号${name}` : `${seat.seatId}号`;
}

export function clipBriefingText(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

export function formatSeatList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map((seat) => seatText(seat)).join("、") : "无";
}

export function formatSeatNumberList(seats: ActionTarget[]): string {
  return seats.length > 0 ? seats.map((seat) => `${seat.seatId}号`).join("、") : "无";
}

export function normalizeDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

export function parseSeatNumber(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return 10;
  if (/^十[一二两三四五六七八九]$/.test(value)) return 10 + (digits[value[1]!] ?? 0);
  if (/^[一二两三四五六七八九]十$/.test(value)) return (digits[value[0]!] ?? 0) * 10;
  if (/^[一二两三四五六七八九]十[一二两三四五六七八九]$/.test(value)) {
    return (digits[value[0]!] ?? 0) * 10 + (digits[value[2]!] ?? 0);
  }
  return digits[value];
}

export function stripTerminalPunctuation(text: string): string {
  return text.replace(/[。！？；，、,.!\?\s]+$/g, "").trim();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripEvaluationModelSuffix(name: string): string {
  if (!/-mimo-/i.test(name)) return name;
  return name.replace(/-mimo-[A-Za-z0-9_.-]+$/i, "").replace(/[-_\s]+$/g, "");
}
