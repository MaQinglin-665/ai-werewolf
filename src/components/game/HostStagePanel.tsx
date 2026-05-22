"use client";

import type { HumanGameView } from "@/game/types";
import { HostStageDetail } from "./HostStageDetail";
import { getHostCue, hostToneClass } from "./HostStageCue";

export function HostStage({ game }: { game: HumanGameView }) {
  const cue = getHostCue(game);
  const action = game.availableActions[0];
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;

  return (
    <section
      key={`${game.id}-${game.day}-${game.phase}-${game.currentActorSeatId ?? "host"}`}
      className={`${hostToneClass(cue.tone)} flow-panel overflow-hidden rounded-[26px] border p-4 shadow-2xl shadow-black/35 backdrop-blur-md`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-black/24 px-3 py-1 text-xs font-semibold text-white/82">
              主持人
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/70">
              {cue.badge}
            </span>
            {currentActor && (
              <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-xs text-white/72">
                当前：{currentActor.seatId}号
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{cue.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/78">{cue.line}</p>
          <p className="mt-1 text-xs leading-5 text-white/56">{cue.detail}</p>
        </div>

        <div className="flow-detail-card rounded-2xl border border-white/12 bg-black/20 p-3">
          <HostStageDetail game={game} action={action} />
        </div>
      </div>
    </section>
  );
}
