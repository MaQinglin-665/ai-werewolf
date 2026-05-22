"use client";

import Image from "next/image";
import type { HumanGameView } from "@/game/types";
import { ROLE_CARD_IMAGES } from "./viewHelpers";
import { ROLE_INTROS } from "./RoleKnowledgeContent";
import { RoleCardArtwork } from "./RoleCardArtwork";

export type IdiotRevealCue = {
  key: string;
  seatId: number;
  seatName: string;
  message: string;
};

export function buildIdiotRevealCue(
  game: HumanGameView,
  event: HumanGameView["publicEvents"][number],
): IdiotRevealCue | null {
  if (event.type !== "IDIOT_REVEALED") return null;
  const payloadSeatId = typeof event.payload.seatId === "number" ? event.payload.seatId : undefined;
  const seatId = payloadSeatId ?? event.actorSeatId;
  if (!seatId) return null;
  const seat = game.seats.find((item) => item.seatId === seatId);
  return {
    key: `${game.id}:${event.seq}:${event.type}`,
    seatId,
    seatName: seat ? `${seat.seatId}号 ${seat.name}` : `${seatId}号`,
    message: event.message || `${seatId}号是白痴，翻牌免死，失去投票权。`,
  };
}

export function IdiotRevealOverlay({ cue }: { cue: IdiotRevealCue }) {
  return (
    <div className="idiot-reveal-backdrop fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-black/88 px-4 py-6 backdrop-blur-md">
      <div className="idiot-reveal-table" aria-hidden="true" />
      <section className="idiot-reveal-stage relative z-10 grid w-full max-w-4xl justify-items-center gap-5 text-center">
        <div className="idiot-reveal-copy">
          <div className="inline-flex rounded-full border border-[#77d898]/28 bg-[#0f2118]/78 px-3 py-1 text-xs font-semibold text-[#a8f0b6] shadow-lg shadow-black/30">
            白痴技能发动
          </div>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#f7ead5] sm:text-5xl">翻牌免死</h2>
          <p className="mt-3 text-sm leading-6 text-[#dcc9a7] sm:text-base">{cue.message}</p>
        </div>

        <div className="idiot-reveal-card-scene" aria-label={`${cue.seatName} 翻开白痴角色卡牌`}>
          <div className="idiot-reveal-card">
            <div className="idiot-reveal-face idiot-reveal-card-back">
              <Image
                fill
                priority
                sizes="280px"
                src={ROLE_CARD_IMAGES.HIDDEN}
                alt=""
                aria-hidden="true"
                className="rounded-[20px] object-cover"
              />
            </div>
            <div className="idiot-reveal-face idiot-reveal-card-front">
              <RoleCardArtwork
                role="IDIOT"
                title="白痴"
                priority
                sizes="280px"
                className="h-full w-full rounded-[20px] border border-[#77d898]/48 shadow-2xl shadow-black/70"
                imageClassName="object-cover object-center"
              />
            </div>
          </div>
        </div>

        <div className="idiot-reveal-seat rounded-full border border-[#f1c76e]/24 bg-[#21160d]/78 px-4 py-2 text-sm font-semibold text-[#f1d796] shadow-xl shadow-black/30">
          {cue.seatName}
        </div>
      </section>
    </div>
  );
}

export function RoleIntroOverlay({ game, onEnter }: { game: HumanGameView; onEnter: () => void }) {
  if (!game.myRole) return null;
  const intro = ROLE_INTROS[game.myRole];
  const teammates = game.wolfTeammates.map((seat) => seat.name).join("、");

  return (
    <div className="role-intro-backdrop role-intro-mobile-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/86 px-4 py-6 backdrop-blur-md">
      <section className="role-intro-shell mx-auto grid w-full max-w-5xl gap-6 rounded-[30px] border border-[#f1c76e]/30 bg-[#120c0a]/95 p-4 shadow-2xl shadow-black/70 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="role-intro-hero flex min-h-[500px] flex-col items-center justify-start rounded-[24px] border border-[#f1c76e]/18 bg-black/28 p-5 sm:p-6">
          <div className="role-card-scene role-intro-card-scene mt-1">
            <Image
              fill
              sizes="240px"
              className="role-card-shadow-card rounded-[18px] border border-[#f1c76e]/22 object-cover"
              src={ROLE_CARD_IMAGES.HIDDEN}
              alt=""
              aria-hidden="true"
            />
            <RoleCardArtwork
              role={game.myRole}
              title={intro.title}
              priority
              sizes="240px"
              className="role-card-reveal rounded-[18px] border border-[#f1c76e]/60 shadow-2xl"
            />
          </div>
          <div className="role-intro-identity mt-6 text-center">
            <div className="role-intro-eyebrow text-xs uppercase tracking-[0.28em] text-[#ad9c7d]">Your Role</div>
            <div className="role-intro-title mt-2 text-3xl font-semibold text-[#f1d796]">{intro.title}</div>
          </div>
        </div>

        <div className="role-intro-copy flex min-w-0 flex-col justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-[#f1c76e]/25 bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">
              身份已发放
            </div>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#f7ead5] sm:text-4xl">
              你是 {intro.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dcc9a7]">
              记住你的身份和胜利目标。确认后进入牌桌，系统会以主持人节奏自动推进到你需要行动的时刻。
            </p>
          </div>

          <div className="role-intro-detail-grid grid gap-3 sm:grid-cols-2">
            <RoleIntroItem label="阵营" value={intro.camp} />
            <RoleIntroItem label="胜利条件" value={intro.goal} />
            <RoleIntroItem label="行动时机" value={intro.timing} />
            <RoleIntroItem label="技能效果" value={intro.ability} />
            <RoleIntroItem label="限制条件" value={intro.limits} />
            <RoleIntroItem label="发言建议" value={intro.tip} />
            {teammates && <RoleIntroItem label="狼队友" value={teammates} />}
          </div>

          <button
            onClick={onEnter}
            className="role-intro-confirm min-h-12 rounded-full bg-[#b74332] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-black/35 transition hover:bg-[#cf513d]"
          >
            确认身份，进入游戏
          </button>
        </div>
      </section>
    </div>
  );
}

export function RoleIntroItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="role-intro-item rounded-2xl border border-[#f1c76e]/16 bg-black/24 px-4 py-3">
      <div className="mb-1 text-xs text-[#ad9c7d]">{label}</div>
      <div className="text-sm leading-6 text-[#f7ead5]">{value}</div>
    </div>
  );
}
