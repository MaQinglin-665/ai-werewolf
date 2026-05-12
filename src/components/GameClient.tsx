"use client";

import { useEffect, useMemo, useState } from "react";
import { DEATH_LABELS, ROLE_LABELS } from "@/game/labels";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";

type CommandPayload =
  | { type: "wolfKill"; targetSeatId: number }
  | { type: "seerCheck"; targetSeatId: number }
  | { type: "witchAction"; mode: "save" | "poison" | "skip"; targetSeatId?: number }
  | { type: "speak"; message: string }
  | { type: "vote"; targetSeatId: number }
  | { type: "hunterShoot"; targetSeatId?: number };

export function GameClient() {
  const [game, setGame] = useState<HumanGameView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const gameId = window.localStorage.getItem("ai-werewolf-game-id");
    if (!gameId) return;

    void fetch(`/api/games/${gameId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((view: HumanGameView | null) => {
        if (view) setGame(view);
      });
  }, []);

  async function startGame() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/games", { method: "POST" });
      if (!response.ok) throw new Error("创建对局失败。");
      const view = (await response.json()) as HumanGameView;
      window.localStorage.setItem("ai-werewolf-game-id", view.id);
      setGame(view);
    } catch {
      setError("创建对局失败。");
    } finally {
      setLoading(false);
    }
  }

  async function submitCommand(payload: CommandPayload) {
    if (!game) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/${game.id}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "动作执行失败。");
      }
      setGame(data as HumanGameView);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "动作执行失败。");
    } finally {
      setLoading(false);
    }
  }

  const latestEvents = useMemo(() => game?.publicEvents.slice(-16).reverse() ?? [], [game]);

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#161812]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 lg:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9dece] pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">单人 AI 狼人杀</h1>
            <p className="mt-1 text-sm text-[#5f6654]">
              9人预女猎 · 当前身份 {game ? game.myRoleLabel : "未开局"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {game && (
              <div className="rounded-md border border-[#d9dece] bg-white px-3 py-2 text-sm">
                第 {game.day} 天 · {game.phaseLabel}
              </div>
            )}
            <button
              onClick={startGame}
              disabled={loading}
              className="rounded-md bg-[#a33b2f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#872f27] disabled:opacity-60"
            >
              {game ? "新开一局" : "开始对局"}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-[#e3b5aa] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a2f24]">
            {error}
          </div>
        )}

        {!game ? (
          <section className="grid flex-1 place-items-center">
            <button
              onClick={startGame}
              disabled={loading}
              className="rounded-md bg-[#a33b2f] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#872f27] disabled:opacity-60"
            >
              {loading ? "创建中" : "进入牌桌"}
            </button>
          </section>
        ) : (
          <section className="grid flex-1 gap-5 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="flex flex-col gap-5">
              <SeatBoard game={game} />
              <ActionPanel game={game} loading={loading} onSubmit={submitCommand} />
            </div>

            <aside className="grid gap-5 lg:grid-rows-[auto_1fr]">
              <InfoPanel game={game} />
              <section className="min-h-[360px] overflow-hidden rounded-md border border-[#d9dece] bg-white">
                <div className="border-b border-[#e4e7dc] px-4 py-3">
                  <h2 className="text-sm font-semibold">公开记录</h2>
                </div>
                <div className="flex max-h-[560px] flex-col gap-3 overflow-y-auto p-4">
                  {latestEvents.map((event) => (
                    <div key={event.seq} className="border-l-2 border-[#b6a15a] pl-3 text-sm leading-6 text-[#33372d]">
                      <div className="text-xs text-[#747a68]">
                        D{event.day} · {event.phase}
                      </div>
                      {event.message}
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function SeatBoard({ game }: { game: HumanGameView }) {
  return (
    <section className="grid grid-cols-3 gap-3 md:grid-cols-5">
      {game.seats.map((seat) => {
        const isCurrent = game.currentActorSeatId === seat.seatId;
        return (
          <div
            key={seat.seatId}
            className={[
              "min-h-[122px] rounded-md border bg-white p-3 transition",
              seat.alive ? "border-[#d9dece]" : "border-[#d8c4bd] bg-[#f1ece8] text-[#7d746d]",
              isCurrent ? "ring-2 ring-[#b6a15a]" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{seat.seatId}号</div>
              <div className="rounded-sm bg-[#eef2e7] px-2 py-1 text-xs text-[#4f5b41]">
                {seat.isHuman ? "真人" : "AI"}
              </div>
            </div>
            <div className="mt-3 text-lg font-semibold">{seat.name}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={seat.alive ? "text-[#2f6f4e]" : "text-[#8a2f24]"}>
                {seat.alive ? "存活" : "出局"}
              </span>
              {seat.roleLabel && <span className="text-[#6b4f13]">{seat.roleLabel}</span>}
              {seat.deathReason && <span>{DEATH_LABELS[seat.deathReason]}</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function InfoPanel({ game }: { game: HumanGameView }) {
  return (
    <section className="rounded-md border border-[#d9dece] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">我的信息</h2>
        {game.result && (
          <span className="rounded-sm bg-[#a33b2f] px-2 py-1 text-xs font-medium text-white">
            {game.result.winner === "GOOD" ? "好人胜利" : "狼人胜利"}
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-3 text-sm text-[#33372d]">
        <div className="flex justify-between gap-3 border-b border-[#eef0e8] pb-2">
          <span>身份</span>
          <strong>{ROLE_LABELS[game.myRole]}</strong>
        </div>
        {game.wolfTeammates.length > 0 && (
          <div className="border-b border-[#eef0e8] pb-2">
            <div className="mb-1 text-[#747a68]">狼队友</div>
            {game.wolfTeammates.map((seat) => seat.name).join("、")}
          </div>
        )}
        {game.seerChecks.length > 0 && (
          <div className="border-b border-[#eef0e8] pb-2">
            <div className="mb-1 text-[#747a68]">查验</div>
            {game.seerChecks.map((check) => (
              <div key={`${check.day}-${check.targetSeatId}`}>
                D{check.day} · {check.targetSeatId}号 · {check.result === "WEREWOLF" ? "狼人" : "好人"}
              </div>
            ))}
          </div>
        )}
        {game.myRole === "WITCH" && (
          <div className="border-b border-[#eef0e8] pb-2">
            <div className="mb-1 text-[#747a68]">药品</div>
            解药 {game.witch.antidoteAvailable ? "可用" : "已用"} · 毒药 {game.witch.poisonAvailable ? "可用" : "已用"}
          </div>
        )}
        {game.privateEvents.slice(-4).map((event) => (
          <div key={event.seq} className="text-[#5f6654]">
            {event.message}
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionPanel({
  game,
  loading,
  onSubmit,
}: {
  game: HumanGameView;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  if (game.result) {
    return (
      <section className="rounded-md border border-[#d9dece] bg-white p-4">
        <h2 className="text-sm font-semibold">终局</h2>
        <p className="mt-2 text-sm text-[#33372d]">
          {game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：{game.result.reason}
        </p>
      </section>
    );
  }

  if (game.availableActions.length === 0) {
    return (
      <section className="rounded-md border border-[#d9dece] bg-white p-4 text-sm text-[#5f6654]">
        {loading ? "结算中" : "等待 AI 行动"}
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[#d9dece] bg-white p-4">
      {game.availableActions.map((action) => (
        <ActionControl key={action.type} action={action} loading={loading} onSubmit={onSubmit} />
      ))}
    </section>
  );
}

function ActionControl({
  action,
  loading,
  onSubmit,
}: {
  action: AvailableHumanAction;
  loading: boolean;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  const [message, setMessage] = useState("");

  if (action.type === "speak") {
    return (
      <div className="grid gap-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={240}
          className="min-h-24 rounded-md border border-[#d9dece] px-3 py-2 text-sm outline-none focus:border-[#b6a15a]"
          placeholder="输入本轮发言"
        />
        <button
          disabled={loading || message.trim().length === 0}
          onClick={() => onSubmit({ type: "speak", message })}
          className="rounded-md bg-[#2f6f4e] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#275d42] disabled:opacity-60"
        >
          确认发言
        </button>
      </div>
    );
  }

  if (action.type === "witchAction") {
    return (
      <div className="flex flex-wrap gap-2">
        {action.canSave && action.saveTarget && (
          <button
            disabled={loading}
            onClick={() => onSubmit({ type: "witchAction", mode: "save" })}
            className="rounded-md bg-[#2f6f4e] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#275d42] disabled:opacity-60"
          >
            救 {action.saveTarget.name}
          </button>
        )}
        {action.canPoison &&
          action.poisonTargets.map((target) => (
            <button
              key={target.seatId}
              disabled={loading}
              onClick={() => onSubmit({ type: "witchAction", mode: "poison", targetSeatId: target.seatId })}
              className="rounded-md border border-[#a33b2f] px-3 py-2 text-sm font-medium text-[#8a2f24] transition hover:bg-[#fff3ef] disabled:opacity-60"
            >
              毒 {target.name}
            </button>
          ))}
        <button
          disabled={loading}
          onClick={() => onSubmit({ type: "witchAction", mode: "skip" })}
          className="rounded-md border border-[#d9dece] px-4 py-2 text-sm font-medium transition hover:bg-[#f5f7f2] disabled:opacity-60"
        >
          不用药
        </button>
      </div>
    );
  }

  if (action.type === "hunterShoot") {
    return (
      <div className="flex flex-wrap gap-2">
        {action.targets.map((target) => (
          <button
            key={target.seatId}
            disabled={loading}
            onClick={() => onSubmit({ type: "hunterShoot", targetSeatId: target.seatId })}
            className="rounded-md bg-[#a33b2f] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#872f27] disabled:opacity-60"
          >
            带走 {target.name}
          </button>
        ))}
        <button
          disabled={loading}
          onClick={() => onSubmit({ type: "hunterShoot" })}
          className="rounded-md border border-[#d9dece] px-4 py-2 text-sm font-medium transition hover:bg-[#f5f7f2] disabled:opacity-60"
        >
          不开枪
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {action.targets.map((target) => (
        <button
          key={target.seatId}
          disabled={loading}
          onClick={() => onSubmit({ type: action.type, targetSeatId: target.seatId } as CommandPayload)}
          className="rounded-md bg-[#2f6f4e] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#275d42] disabled:opacity-60"
        >
          {action.type === "wolfKill" ? "击杀" : action.type === "seerCheck" ? "查验" : "投票"} {target.name}
        </button>
      ))}
    </div>
  );
}
