"use client";

import type * as React from "react";
import type { HumanGameView } from "@/game/types";
import type { ActionTargetView } from "./clientTypes";

export function getActionTargetSeat(game: HumanGameView, target: ActionTargetView) {
  return game.seats.find((seat) => seat.seatId === target.seatId);
}

export function NightTargetButton({
  game,
  target,
  disabled,
  index,
  tone,
  actionLabel,
  onClick,
}: {
  game: HumanGameView;
  target: ActionTargetView;
  disabled: boolean;
  index: number;
  tone: "seer" | "poison" | "vote" | "guard" | "sheriff" | "charm" | "knight";
  actionLabel: string;
  onClick: () => void;
}) {
  const seat = getActionTargetSeat(game, target);
  const toneClass = {
    seer: "border-[#7da8e3]/24 bg-[#10243a]/64 text-[#d8e6f7] hover:border-[#9dbbe6]/58 hover:bg-[#153253]/76",
    poison: "border-[#e46d55]/24 bg-[#2b1110]/66 text-[#ffd8cf] hover:border-[#ff9a6b]/58 hover:bg-[#3a1713]/82",
    vote: "border-[#e46d55]/24 bg-[#2b1110]/62 text-[#ffd8cf] hover:border-[#ff9a6b]/58 hover:bg-[#3a1713]/78",
    guard: "border-[#77d898]/24 bg-[#14311f]/62 text-[#dff4df] hover:border-[#a8f0b6]/58 hover:bg-[#1d4e33]/78",
    sheriff: "border-[#f1c76e]/24 bg-[#3a2412]/62 text-[#f1d796] hover:border-[#f1d796]/58 hover:bg-[#4a2d12]/78",
    charm: "border-[#d885c7]/24 bg-[#2b1128]/66 text-[#ffd6f7] hover:border-[#f5a9e8]/58 hover:bg-[#3d1838]/82",
    knight: "border-[#f1c76e]/30 bg-[#2b2110]/66 text-[#fff0bf] hover:border-[#fff0bf]/62 hover:bg-[#3b2d13]/82",
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ animationDelay: `${index * 42}ms` }}
      className={`${toneClass} night-target-card min-h-[92px] rounded-2xl border p-3 text-left shadow-lg shadow-black/18 transition disabled:opacity-60`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-black/28 px-2 py-0.5 text-xs font-semibold">{target.seatId}号</span>
        <span className="text-[11px] opacity-64">{actionLabel}</span>
      </div>
      <div className="mt-3 truncate text-sm font-semibold">{target.name}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px] opacity-72">
        <span>{seat?.alive ? "存活" : "出局"}</span>
        {seat?.isHuman && <span>你</span>}
        {seat?.roleLabel && <span>{seat.roleLabel}</span>}
      </div>
    </button>
  );
}

export function MobileAvatarTargetPrompt({
  children,
}: {
  targets: ActionTargetView[];
  verb: string;
  tone: "danger" | "seer" | "guard" | "vote" | "sheriff" | "charm" | "knight";
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return <div className="mobile-avatar-action-options">{children}</div>;
}

export function ActionButton({
  children,
  disabled,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  tone: "green" | "red" | "gold" | "neutral";
  onClick: () => void;
}) {
  const className =
    tone === "red"
      ? "bg-[#b74332] text-white hover:bg-[#cf513d]"
      : tone === "green"
        ? "bg-[#2f8157] text-white hover:bg-[#379566]"
        : tone === "gold"
          ? "bg-[#9f6b24] text-white hover:bg-[#b77c2a]"
        : "border border-[#f1c76e]/30 text-[#f1d796] hover:bg-[#f1c76e]/10";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`${className} min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60`}
    >
      {children}
    </button>
  );
}
