import type * as React from "react";
import type { HumanGameView } from "@/game/types";
import type { BrowserSpeechRecognitionConstructor, BrowserSpeechRecognitionErrorEvent, BrowserSpeechRecognitionWindow } from "./clientTypes";

export const HUMAN_SPEECH_MAX_LENGTH = 800;

export const ROLE_CARD_IMAGES: Record<HumanGameView["myRole"] | "HIDDEN", string> = {
  WEREWOLF: "/images/role-werewolf.jpg",
  VILLAGER: "/images/role-villager.jpg",
  SEER: "/images/role-seer.jpg",
  WITCH: "/images/role-witch.jpg",
  HUNTER: "/images/role-hunter.jpg",
  GUARD: "/images/role-guard.png",
  HIDDEN: "/images/role-back.jpg",
};

export const MODEL_CARD_IMAGES: Record<string, string> = {
  DeepSeek: "/images/model-deepseek.svg",
  Claude: "/images/model-claude.svg",
  GPT: "/images/model-gpt.svg",
  豆包: "/images/doubao-app-icon.jpg",
  Mimo: "/images/model-mimo.svg",
  Gemini: "/images/model-gemini.svg",
  GLM: "/images/model-glm.svg",
  Kimi: "/images/model-kimi.svg",
};

export type SeatOrbitStyle = React.CSSProperties & Record<"--seat-x" | "--seat-y", string>;

const SEAT_ORBIT_POINTS: SeatOrbitStyle[] = [
  { "--seat-x": "50%", "--seat-y": "13%" },
  { "--seat-x": "73%", "--seat-y": "15%" },
  { "--seat-x": "88%", "--seat-y": "38%" },
  { "--seat-x": "82%", "--seat-y": "66%" },
  { "--seat-x": "61%", "--seat-y": "82%" },
  { "--seat-x": "39%", "--seat-y": "82%" },
  { "--seat-x": "18%", "--seat-y": "66%" },
  { "--seat-x": "12%", "--seat-y": "38%" },
  { "--seat-x": "27%", "--seat-y": "15%" },
];

export function getSeatOrbitStyle(seatId: number, seatCount: number): SeatOrbitStyle {
  if (seatCount === SEAT_ORBIT_POINTS.length) return SEAT_ORBIT_POINTS[(seatId - 1) % SEAT_ORBIT_POINTS.length];
  const angle = -90 + ((seatId - 1) / seatCount) * 360;
  const radians = (angle * Math.PI) / 180;
  const radiusX = 39;
  const radiusY = 35;
  return {
    "--seat-x": `${50 + Math.cos(radians) * radiusX}%`,
    "--seat-y": `${50 + Math.sin(radians) * radiusY}%`,
  };
}

export function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as BrowserSpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function formatSpeechRecognitionError(event: BrowserSpeechRecognitionErrorEvent): string {
  switch (event.error) {
    case "not-allowed":
    case "service-not-allowed":
      return "浏览器没有麦克风权限。";
    case "no-speech":
      return "没有识别到发言内容。";
    case "audio-capture":
      return "没有找到可用的麦克风。";
    case "network":
      return "浏览器语音识别网络异常。";
    case "aborted":
      return "语音输入已取消。";
    default:
      return event.message || "语音识别失败。";
  }
}

export function seatNumber(seat: { seatId: number }): string {
  return `${seat.seatId}号`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatSystemMessage(game: HumanGameView, message: string): string {
  return game.seats
    .filter((seat) => seat.name !== "你")
    .sort((a, b) => b.name.length - a.name.length)
    .reduce((text, seat) => text.replace(new RegExp(escapeRegExp(seat.name), "g"), seatNumber(seat)), message);
}

export function getSeatCardImage(seat: HumanGameView["seats"][number]): string {
  if (seat.isAi) return MODEL_CARD_IMAGES[seat.name] ?? ROLE_CARD_IMAGES.HIDDEN;
  return ROLE_CARD_IMAGES[seat.role ?? "HIDDEN"];
}
