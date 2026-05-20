import type * as React from "react";
import type { HumanGameView, Phase } from "@/game/types";
import type { BrowserSpeechRecognitionConstructor, BrowserSpeechRecognitionErrorEvent, BrowserSpeechRecognitionWindow } from "./clientTypes";

export const HUMAN_SPEECH_MAX_LENGTH = 800;

type RoleCardImageKey = NonNullable<HumanGameView["myRole"]> | "HIDDEN";

export const ROLE_CARD_IMAGES: Record<RoleCardImageKey, string> = {
  WEREWOLF: "/images/role-werewolf.jpg",
  WOLF_KING: "/images/role-wolf-king.png",
  WHITE_WOLF_KING: "/images/role-white-wolf-king-v2-book-standard.webp",
  WOLF_BEAUTY: "/images/role-wolf-beauty-v2-book-standard-v3.webp",
  VILLAGER: "/images/role-villager.jpg",
  SEER: "/images/role-seer.jpg",
  WITCH: "/images/role-witch.jpg",
  HUNTER: "/images/role-hunter.jpg",
  IDIOT: "/images/role-idiot-book-standard-v6.webp",
  KNIGHT: "/images/role-knight-v2-book-standard.webp",
  GUARD: "/images/role-guard.png",
  HIDDEN: "/images/role-back.jpg",
};

export const ROLE_CARD_BOOK_IMAGES: typeof ROLE_CARD_IMAGES = {
  ...ROLE_CARD_IMAGES,
  WOLF_KING: "/images/role-wolf-king-book.webp",
  WHITE_WOLF_KING: "/images/role-white-wolf-king-v2-book-standard.webp",
  WOLF_BEAUTY: "/images/role-wolf-beauty-v2-book-standard-v3.webp",
  IDIOT: "/images/role-idiot-book-standard-v6.webp",
  KNIGHT: "/images/role-knight-v2-book-standard.webp",
  GUARD: "/images/role-guard-book.webp",
};

export const ROLE_CARD_ASPECT_RATIOS: Record<RoleCardImageKey, string> = {
  WEREWOLF: "2 / 3",
  WOLF_KING: "2 / 3",
  WHITE_WOLF_KING: "2 / 3",
  WOLF_BEAUTY: "2 / 3",
  VILLAGER: "2 / 3",
  SEER: "2 / 3",
  WITCH: "2 / 3",
  HUNTER: "2 / 3",
  IDIOT: "2 / 3",
  KNIGHT: "2 / 3",
  GUARD: "2 / 3",
  HIDDEN: "2 / 3",
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

export type NightRoleTrackStep = {
  phase: Phase;
  label: string;
  detail: string;
};

const NIGHT_ROLE_TRACK_STEPS: NightRoleTrackStep[] = [
  { phase: "NIGHT_WOLVES", label: "狼人睁眼", detail: "选择今晚刀口" },
  { phase: "NIGHT_WOLF_BEAUTY", label: "狼美人睁眼", detail: "选择魅惑目标" },
  { phase: "NIGHT_GUARD", label: "守卫睁眼", detail: "选择守护目标" },
  { phase: "NIGHT_SEER", label: "预言家睁眼", detail: "查验一名玩家" },
  { phase: "NIGHT_WITCH", label: "女巫睁眼", detail: "决定是否用药" },
];

export function getNightRoleTrackSteps(board: Pick<HumanGameView["board"], "roleSummary">): NightRoleTrackStep[] {
  const summary = board.roleSummary;
  return NIGHT_ROLE_TRACK_STEPS.filter((step) => {
    if (step.phase === "NIGHT_WOLVES") return true;
    if (step.phase === "NIGHT_WOLF_BEAUTY") return summary.includes("狼美人");
    if (step.phase === "NIGHT_GUARD") return summary.includes("守卫");
    if (step.phase === "NIGHT_SEER") return summary.includes("预言家");
    if (step.phase === "NIGHT_WITCH") return summary.includes("女巫");
    return false;
  });
}

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

const TWELVE_SEAT_ORBIT_POINTS: SeatOrbitStyle[] = [
  { "--seat-x": "50%", "--seat-y": "9%" },
  { "--seat-x": "75%", "--seat-y": "14%" },
  { "--seat-x": "90%", "--seat-y": "32%" },
  { "--seat-x": "91%", "--seat-y": "50%" },
  { "--seat-x": "90%", "--seat-y": "68%" },
  { "--seat-x": "75%", "--seat-y": "86%" },
  { "--seat-x": "50%", "--seat-y": "91%" },
  { "--seat-x": "25%", "--seat-y": "86%" },
  { "--seat-x": "10%", "--seat-y": "68%" },
  { "--seat-x": "9%", "--seat-y": "50%" },
  { "--seat-x": "10%", "--seat-y": "32%" },
  { "--seat-x": "25%", "--seat-y": "14%" },
];

export function getSeatOrbitStyle(seatId: number, seatCount: number): SeatOrbitStyle {
  if (seatCount === SEAT_ORBIT_POINTS.length) return SEAT_ORBIT_POINTS[(seatId - 1) % SEAT_ORBIT_POINTS.length];
  if (seatCount === TWELVE_SEAT_ORBIT_POINTS.length) return TWELVE_SEAT_ORBIT_POINTS[(seatId - 1) % TWELVE_SEAT_ORBIT_POINTS.length];
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
    .filter((seat) => {
      const name = seat.name.trim();
      return name && name !== "你" && name !== seatNumber(seat) && !/^\d+号?$/.test(name);
    })
    .sort((a, b) => b.name.length - a.name.length)
    .reduce((text, seat) => text.replace(new RegExp(escapeRegExp(seat.name), "g"), seatNumber(seat)), message);
}

export function getSeatCardImage(seat: HumanGameView["seats"][number]): string {
  if (seat.avatarDataUrl) return seat.avatarDataUrl;
  if (seat.isAi) return MODEL_CARD_IMAGES[seat.personaName ?? seat.name] ?? ROLE_CARD_IMAGES.HIDDEN;
  return ROLE_CARD_IMAGES[seat.role ?? "HIDDEN"];
}
