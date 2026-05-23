"use client";

import Image from "next/image";
import type * as React from "react";
import type { HumanSeatMode } from "./clientTypes";

type MobileLobbySeatStyle = React.CSSProperties & {
  "--lobby-seat-size": string;
  "--lobby-seat-x": string;
  "--lobby-seat-y": string;
};

type MobileLobbySeatPoint = {
  x: number;
  y: number;
  size: number;
};

const MOBILE_LOBBY_SEAT_POINTS: Record<number, MobileLobbySeatPoint[]> = {
  6: [
    { x: 22, y: 20, size: 52 },
    { x: 78, y: 20, size: 52 },
    { x: 7, y: 50, size: 52 },
    { x: 93, y: 50, size: 52 },
    { x: 22, y: 80, size: 52 },
    { x: 78, y: 80, size: 52 },
  ],
  9: [
    { x: 23, y: 18, size: 44 },
    { x: 77, y: 18, size: 44 },
    { x: 11, y: 34, size: 44 },
    { x: 89, y: 34, size: 44 },
    { x: 7, y: 52, size: 44 },
    { x: 93, y: 52, size: 44 },
    { x: 15, y: 70, size: 44 },
    { x: 85, y: 70, size: 44 },
    { x: 50, y: 84, size: 44 },
  ],
  12: [
    { x: 24, y: 16, size: 38 },
    { x: 76, y: 16, size: 38 },
    { x: 11, y: 28, size: 38 },
    { x: 89, y: 28, size: 38 },
    { x: 21, y: 42, size: 38 },
    { x: 79, y: 42, size: 38 },
    { x: 8, y: 58, size: 38 },
    { x: 92, y: 58, size: 38 },
    { x: 21, y: 72, size: 38 },
    { x: 79, y: 72, size: 38 },
    { x: 16, y: 88, size: 38 },
    { x: 84, y: 88, size: 38 },
  ],
};

export function buildMobileLobbySeatIds(seatCount: number): number[] {
  const visibleCount = Math.max(1, Math.min(12, Math.floor(seatCount)));
  return Array.from({ length: visibleCount }, (_, index) => index + 1);
}

export function getMobileLobbySeatDensityClass(seatCount: number): string {
  if (seatCount >= 10) return "mobile-lobby-seat-dense";
  if (seatCount >= 8) return "mobile-lobby-seat-many";
  return "";
}

export function getMobileLobbySeatStyle(index: number, seatCount: number): MobileLobbySeatStyle {
  const presetPoint = MOBILE_LOBBY_SEAT_POINTS[seatCount]?.[index];
  if (presetPoint) {
    return {
      "--lobby-seat-size": `${presetPoint.size}px`,
      "--lobby-seat-x": `${presetPoint.x.toFixed(1)}%`,
      "--lobby-seat-y": `${presetPoint.y.toFixed(1)}%`,
    };
  }

  const pairCount = Math.max(1, Math.ceil(seatCount / 2));
  const pairIndex = Math.floor(index / 2);
  const progress = pairCount === 1 ? 0.5 : pairIndex / (pairCount - 1);
  const sideArc = Math.abs(progress - 0.5) * 2;
  const isRightSide = index % 2 === 1;
  const isOddCenterSeat = seatCount % 2 === 1 && index === seatCount - 1;
  const xInset = seatCount >= 10 ? 8 + sideArc * 10 : 8 + sideArc * 14;
  const x = isOddCenterSeat ? 50 : isRightSide ? 100 - xInset : xInset;
  const y = seatCount >= 10 ? 16 + progress * 72 : seatCount >= 8 ? 18 + progress * 68 : 18 + progress * 66;
  const size = seatCount >= 10 ? 38 : seatCount >= 8 ? 44 : 52;

  return {
    "--lobby-seat-size": `${size}px`,
    "--lobby-seat-x": `${x.toFixed(1)}%`,
    "--lobby-seat-y": `${y.toFixed(1)}%`,
  };
}

export function LandingPromoCard({ boardLabel, humanLabel, aiLabel }: { boardLabel: string; humanLabel: string; aiLabel: string }) {
  return (
    <div className="mobile-home-promo relative min-h-[260px] overflow-hidden border-t border-[#f1c76e]/14 bg-[#0d1018] lg:min-h-full lg:border-l lg:border-t-0">
      <Image
        src="/images/promo-ai-werewolf-reference-personas.png"
        alt="AI 狼人杀宣传图"
        fill
        priority
        unoptimized
        sizes="(min-width: 1024px) 300px, 100vw"
        className="object-cover object-top opacity-[0.88]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#100b0a] via-[#100b0a]/28 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 grid gap-2 p-4">
        <div className="inline-flex w-fit rounded-full border border-[#f1c76e]/24 bg-black/42 px-3 py-1 text-[11px] font-semibold text-[#f1d796] backdrop-blur">
          多模型 AI 同桌博弈
        </div>
        <div className="grid gap-1.5 text-xs text-[#f7ead5]">
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">{boardLabel}</div>
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">{humanLabel}</div>
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">{aiLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function HumanSeatPicker({
  seatCount,
  mode,
  selectedSeatId,
  onRandom,
  onSelect,
  onNone,
}: {
  seatCount: number;
  mode: HumanSeatMode;
  selectedSeatId: number | null;
  onRandom: () => void;
  onSelect: (seatId: number) => void;
  onNone: () => void;
}) {
  if (seatCount <= 0) return null;
  const seats = Array.from({ length: seatCount }, (_, index) => index + 1);
  const seatLabel = mode === "none" ? "无真人" : selectedSeatId ? `${selectedSeatId}号` : "随机";
  return (
    <section className="mobile-seat-picker mt-4 rounded-lg border border-[#7da8e3]/18 bg-[#0d1623]/48 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#e4efff]">真人座位</h3>
        <span className="rounded-full border border-[#7da8e3]/20 bg-[#7da8e3]/10 px-2.5 py-1 text-xs text-[#b8d6ff]">
          {seatLabel}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRandom}
          className={[
            "mobile-seat-mode-button rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition",
            mode === "random" ? "border-[#7da8e3]/50 bg-[#0d2642]/78 text-[#d8e7ff]" : "border-[#7da8e3]/16 bg-black/18 text-[#b8d6ff] hover:bg-[#7da8e3]/10",
          ].join(" ")}
        >
          真人模式{selectedSeatId ? ` · 本局预览 ${selectedSeatId}号` : ""}
        </button>
        <button
          type="button"
          onClick={onNone}
          className={[
            "mobile-seat-mode-button rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition",
            mode === "none" ? "border-[#77d898]/50 bg-[#12301e]/78 text-[#dff4df]" : "border-[#77d898]/16 bg-black/18 text-[#a8f0b6] hover:bg-[#77d898]/10",
          ].join(" ")}
        >
          无真人 · 只看 AI 对局
        </button>
        <div className="mobile-seat-strip grid grid-cols-6 gap-1.5 sm:col-span-2 md:grid-cols-9">
          {seats.map((seatId) => {
            const selected = mode === "fixed" && selectedSeatId === seatId;
            return (
              <button
                key={seatId}
                type="button"
                onClick={() => onSelect(seatId)}
                className={[
                  "mobile-seat-chip-option min-h-10 rounded-md border px-2 py-2 text-sm font-semibold transition",
                  selected ? "border-[#f1c76e]/58 bg-[#3a2412]/88 text-[#f1d796]" : "border-white/10 bg-black/18 text-[#dcc9a7] hover:bg-white/8",
                ].join(" ")}
              >
                {seatId}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
