"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { DEATH_LABELS, ROLE_LABELS } from "@/game/labels";
import type { AvailableHumanAction, HumanGameView } from "@/game/types";

const CURRENT_GAME_KEY = "ai-werewolf-game-id";
const RECENT_GAMES_KEY = "ai-werewolf-recent-game-ids";
const EMPTY_RECENT_GAME_IDS: string[] = [];
let recentGameIdsRawCache: string | null = null;
let recentGameIdsSnapshotCache: string[] = EMPTY_RECENT_GAME_IDS;

const ROLE_CARD_IMAGES: Record<HumanGameView["myRole"] | "HIDDEN", string> = {
  WEREWOLF: "/images/role-werewolf.jpg",
  VILLAGER: "/images/role-villager.jpg",
  SEER: "/images/role-seer.jpg",
  WITCH: "/images/role-witch.jpg",
  HUNTER: "/images/role-hunter.jpg",
  HIDDEN: "/images/role-back.jpg",
};

const SEAT_ORBIT_CLASSES = [
  "lg:left-1/2 lg:top-4 lg:-translate-x-1/2",
  "lg:right-[17%] lg:top-[10%]",
  "lg:right-4 lg:top-1/2 lg:-translate-y-1/2",
  "lg:right-[13%] lg:bottom-[10%]",
  "lg:left-1/2 lg:bottom-4 lg:-translate-x-1/2",
  "lg:left-[13%] lg:bottom-[10%]",
  "lg:left-4 lg:top-1/2 lg:-translate-y-1/2",
  "lg:left-[17%] lg:top-[10%]",
  "lg:left-1/2 lg:top-[30%] lg:-translate-x-1/2",
];

type CommandPayload =
  | { type: "wolfKill"; targetSeatId: number }
  | { type: "seerCheck"; targetSeatId: number }
  | { type: "witchAction"; mode: "save" | "poison" | "skip"; targetSeatId?: number }
  | { type: "speak"; message: string }
  | { type: "vote"; targetSeatId: number }
  | { type: "hunterShoot"; targetSeatId?: number }
  | { type: "continue" };

export function GameClient() {
  const [game, setGame] = useState<HumanGameView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recentGameIds = useSyncExternalStore(subscribeRecentGameIds, readRecentGameIds, getRecentGameIdsServerSnapshot);

  const rememberGame = useCallback((gameId: string) => {
    const nextIds = [gameId, ...readRecentGameIds().filter((id) => id !== gameId)].slice(0, 5);
    window.localStorage.setItem(CURRENT_GAME_KEY, gameId);
    window.localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(nextIds));
    window.dispatchEvent(new Event("ai-werewolf-recent-games-changed"));
  }, []);

  const loadGameById = useCallback(
    async (gameId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) throw new Error("对局不存在或已被清理。");
        const view = (await response.json()) as HumanGameView;
        rememberGame(view.id);
        setGame(view);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "读取对局失败。");
      } finally {
        setLoading(false);
      }
    },
    [rememberGame],
  );

  const startGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/games", { method: "POST" });
      if (!response.ok) throw new Error("创建对局失败。");
      const view = (await response.json()) as HumanGameView;
      rememberGame(view.id);
      setGame(view);
    } catch {
      setError("创建对局失败。");
    } finally {
      setLoading(false);
    }
  }, [rememberGame]);

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

  const latestEvents = useMemo(() => game?.publicEvents.slice(-18).reverse() ?? [], [game]);

  return (
    <main
      className="min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.88)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <RoomHeader game={game} loading={loading} onNewGame={startGame} />

        {error && (
          <div className="rounded-lg border border-[#e46d55]/45 bg-[#381511]/90 px-4 py-3 text-sm text-[#ffd8cf] shadow-lg">
            {error}
          </div>
        )}

        {!game ? (
          <LandingPanel
            loading={loading}
            recentGameIds={recentGameIds}
            onLoadGame={loadGameById}
            onStartGame={startGame}
          />
        ) : (
          <div className="grid flex-1 gap-4">
            <PhaseRhythm game={game} />
            <HostStage game={game} />
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_420px]">
              <div className="grid gap-4">
                <SeatBoard game={game} />
                <ActionPanel game={game} loading={loading} onNewGame={startGame} onSubmit={submitCommand} />
                {game.review && <ReviewPanel game={game} />}
              </div>

              <aside className="grid content-start gap-4">
                <InfoPanel game={game} />
                <SpeechFeed game={game} />
                <VoteTable game={game} />
                <PublicLog events={latestEvents} />
              </aside>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function RoomHeader({
  game,
  loading,
  onNewGame,
}: {
  game: HumanGameView | null;
  loading: boolean;
  onNewGame: () => Promise<void>;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f1c76e]/25 bg-[#130d0b]/75 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#f1c76e]/45 bg-[#2a1712] text-lg font-semibold text-[#f1c76e] shadow-inner">
          狼
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">单人 AI 狼人杀</h1>
          <p className="mt-1 text-xs text-[#cab995] sm:text-sm">
            9人预女猎 · {game ? `你是${game.myRoleLabel}` : "1 真人 + 8 AI"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {game && (
          <>
            <StatusPill tone="gold">第 {game.day} 天</StatusPill>
            <StatusPill tone={game.phase.startsWith("NIGHT") ? "blue" : "green"}>{game.phaseLabel}</StatusPill>
          </>
        )}
        <button
          onClick={onNewGame}
          disabled={loading}
          className="rounded-full bg-[#b74332] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#220806]/35 transition hover:bg-[#cf513d] disabled:opacity-60"
        >
          {game ? "新开一局" : "开始对局"}
        </button>
      </div>
    </header>
  );
}

function LandingPanel({
  loading,
  recentGameIds,
  onLoadGame,
  onStartGame,
}: {
  loading: boolean;
  recentGameIds: string[];
  onLoadGame: (gameId: string) => Promise<void>;
  onStartGame: () => Promise<void>;
}) {
  return (
    <section className="grid flex-1 place-items-center py-8">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-h-[420px] rounded-[28px] border border-[#f1c76e]/25 bg-[#160f0d]/55 bg-cover bg-center p-5 shadow-2xl shadow-black/45 backdrop-blur-sm">
          <div className="flex h-full flex-col justify-between rounded-[22px] border border-[#f1c76e]/20 bg-gradient-to-br from-black/55 via-[#2c160f]/35 to-black/60 p-6">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-[#f1c76e]/35 bg-black/35 px-3 py-1 text-xs text-[#f1d796]">
                本地 Alpha · 规则引擎驱动
              </div>
              <h2 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">进入牌桌，和 8 个 AI 玩完一整局</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#dcc9a7]">
                固定 9 人预女猎，AI 自动推进非真人阶段，终局后揭晓身份、刀口、查验、投票和胜负原因。
              </p>
            </div>
            <button
              onClick={onStartGame}
              disabled={loading}
              className="mt-8 w-full rounded-2xl bg-[#b74332] px-6 py-4 text-base font-semibold text-white shadow-xl shadow-black/35 transition hover:bg-[#cf513d] disabled:opacity-60 sm:w-fit"
            >
              {loading ? "创建中" : "进入牌桌"}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/80 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#f7ead5]">最近对局</h2>
            <span className="text-xs text-[#ad9c7d]">最多 5 局</span>
          </div>
          {recentGameIds.length === 0 ? (
            <div className="grid min-h-[260px] place-items-center rounded-2xl border border-dashed border-[#f1c76e]/25 text-center text-sm leading-6 text-[#ad9c7d]">
              暂无本地记录
            </div>
          ) : (
            <div className="grid gap-2">
              {recentGameIds.map((gameId, index) => (
                <button
                  key={gameId}
                  onClick={() => onLoadGame(gameId)}
                  disabled={loading}
                  className="rounded-2xl border border-[#f1c76e]/20 bg-[#211410]/80 px-4 py-3 text-left transition hover:border-[#f1c76e]/45 hover:bg-[#2d1a13] disabled:opacity-60"
                >
                  <div className="text-sm font-semibold text-[#f7ead5]">
                    {index === 0 ? "继续上一局" : "查看最近终局"}
                  </div>
                  <div className="mt-1 text-xs text-[#ad9c7d]">{gameId.slice(0, 8)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PhaseRhythm({ game }: { game: HumanGameView }) {
  return (
    <section className="rounded-[22px] border border-[#f1c76e]/20 bg-[#130d0b]/72 px-3 py-3 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="grid grid-cols-5 gap-2">
        {game.tableSummary.phaseSteps.map((step, index) => (
          <div key={step.key} className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={[
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  step.status === "done"
                    ? "border-[#77d898]/35 bg-[#1d4e33]/70 text-[#a8f0b6]"
                    : step.status === "current"
                      ? "border-[#f1c76e]/65 bg-[#4a2d12] text-[#f1d796] shadow-lg shadow-[#f1c76e]/10"
                      : "border-[#f1c76e]/18 bg-black/25 text-[#8f8065]",
                ].join(" ")}
              >
                {index + 1}
              </div>
              {index < game.tableSummary.phaseSteps.length - 1 && (
                <div
                  className={[
                    "hidden h-px flex-1 sm:block",
                    step.status === "done" ? "bg-[#77d898]/35" : "bg-[#f1c76e]/15",
                  ].join(" ")}
                />
              )}
            </div>
            <div
              className={[
                "mt-2 truncate text-xs",
                step.status === "current" ? "font-semibold text-[#f1d796]" : step.status === "done" ? "text-[#a8f0b6]" : "text-[#8f8065]",
              ].join(" ")}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type HostCue = {
  badge: string;
  title: string;
  line: string;
  detail: string;
  tone: "night" | "day" | "vote" | "danger" | "end";
};

function HostStage({ game }: { game: HumanGameView }) {
  const cue = getHostCue(game);
  const action = game.availableActions[0];
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;

  return (
    <section className={`${hostToneClass(cue.tone)} overflow-hidden rounded-[26px] border p-4 shadow-2xl shadow-black/35 backdrop-blur-md`}>
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
                当前：{currentActor.seatId}号 {currentActor.name}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{cue.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/78">{cue.line}</p>
          <p className="mt-1 text-xs leading-5 text-white/56">{cue.detail}</p>
        </div>

        <div className="rounded-2xl border border-white/12 bg-black/20 p-3">
          <HostStageDetail game={game} action={action} />
        </div>
      </div>
    </section>
  );
}

function HostStageDetail({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
  if (game.phase.startsWith("NIGHT")) {
    return <NightRoleTrack phase={game.phase} />;
  }

  if (game.phase === "DAY_SPEECH") {
    return <SpeechOrderStrip game={game} />;
  }

  if (game.phase === "DAY_VOTE") {
    return <VotePrivacyStrip game={game} action={action} />;
  }

  if (game.phase === "EXILE_RESOLUTION") {
    return <VoteRevealStrip game={game} />;
  }

  if (game.phase === "DAY_ANNOUNCEMENT") {
    const latestAnnouncement = [...game.publicEvents]
      .reverse()
      .find((event) => event.day === game.day && event.phase === "DAY_ANNOUNCEMENT");
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Dawn Report</div>
        <div>{latestAnnouncement?.message ?? "等待公布昨夜死亡情况。"}</div>
      </div>
    );
  }

  if (game.phase === "HUNTER_SHOT") {
    return (
      <div className="grid gap-2 text-sm leading-6 text-white/75">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Hunter Window</div>
        <div>猎人进入最后行动窗口，结算完成后继续进入白天或终局。</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm leading-6 text-white/75">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Result</div>
      <div>{game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：${game.result.reason}` : "流程继续推进。"}</div>
    </div>
  );
}

function NightRoleTrack({ phase }: { phase: HumanGameView["phase"] }) {
  const steps = [
    { phase: "NIGHT_WOLVES", label: "狼人睁眼", detail: "选择今晚刀口" },
    { phase: "NIGHT_SEER", label: "预言家睁眼", detail: "查验一名玩家" },
    { phase: "NIGHT_WITCH", label: "女巫睁眼", detail: "决定是否用药" },
  ] as const;
  const currentIndex = steps.findIndex((step) => step.phase === phase);

  return (
    <div className="grid gap-3">
      {steps.map((step, index) => {
        const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <div
            key={step.phase}
            className={[
              "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2",
              status === "done"
                ? "border-[#77d898]/25 bg-[#153421]/50 text-[#c9f6d0]"
                : status === "current"
                  ? "border-[#7da8e3]/40 bg-[#132942]/70 text-[#d8e6f7]"
                  : "border-white/10 bg-black/18 text-white/45",
            ].join(" ")}
          >
            <div>
              <div className="text-sm font-semibold">{step.label}</div>
              <div className="mt-0.5 text-xs opacity-70">{step.detail}</div>
            </div>
            <span className="text-xs">{status === "done" ? "已完成" : status === "current" ? "进行中" : "等待"}</span>
          </div>
        );
      })}
    </div>
  );
}

function SpeechOrderStrip({ game }: { game: HumanGameView }) {
  const spokenSeatIds = new Set(
    game.publicEvents
      .filter((event) => event.day === game.day && event.phase === "DAY_SPEECH" && typeof event.actorSeatId === "number")
      .map((event) => event.actorSeatId),
  );
  const aliveSeats = game.seats.filter((seat) => seat.alive);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-white/58">
        <span>本轮发言顺序</span>
        <span>
          已发言 {spokenSeatIds.size}/{aliveSeats.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {aliveSeats.map((seat) => {
          const isCurrent = game.currentSpeakerSeatId === seat.seatId;
          const hasSpoken = spokenSeatIds.has(seat.seatId);
          return (
            <span
              key={seat.seatId}
              className={[
                "rounded-full border px-3 py-1 text-xs",
                isCurrent
                  ? "border-[#f1c76e]/55 bg-[#4a2d12]/80 text-[#f1d796]"
                  : hasSpoken
                    ? "border-[#77d898]/25 bg-[#153421]/55 text-[#a8f0b6]"
                    : "border-white/10 bg-black/20 text-white/50",
              ].join(" ")}
            >
              {seat.seatId}号{seat.isHuman ? " 你" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function VotePrivacyStrip({ game, action }: { game: HumanGameView; action?: AvailableHumanAction }) {
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;
  const isHumanVote = action?.type === "vote";

  return (
    <div className="grid gap-3 text-sm leading-6 text-white/75">
      <div className="rounded-2xl border border-[#e46d55]/25 bg-[#351210]/45 px-3 py-2">
        投票期间不会公开任何人的投票对象，也不会显示实时票数。
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-white/65">
          {isHumanVote ? "轮到你投票" : currentActor ? `等待 ${currentActor.name} 投票` : "等待投票"}
        </span>
        <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-white/65">结束后统一开票</span>
      </div>
    </div>
  );
}

function VoteRevealStrip({ game }: { game: HumanGameView }) {
  const tally = game.tableSummary.voteSnapshot.tally;
  return (
    <div className="grid gap-2">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Final Tally</div>
      {tally.length === 0 ? (
        <div className="text-sm text-white/65">等待公开投票结果。</div>
      ) : (
        tally.map((item) => (
          <div key={item.target.seatId} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e46d55]/20 bg-black/20 px-3 py-2 text-sm text-[#ffd8cf]">
            <span>
              {item.target.seatId}号 {item.target.name}
            </span>
            <strong>{item.count} 票</strong>
          </div>
        ))
      )}
    </div>
  );
}

function getHostCue(game: HumanGameView): HostCue {
  switch (game.phase) {
    case "NIGHT_WOLVES":
      return {
        badge: `第 ${game.day} 夜`,
        title: "天黑请闭眼",
        line: "狼人请睁眼，选择今晚的击杀目标。其他身份暂时闭眼等待。",
        detail: "如果轮到 AI，点击继续会播放下一步；如果你是狼人，则直接选择刀口。",
        tone: "night",
      };
    case "NIGHT_SEER":
      return {
        badge: `第 ${game.day} 夜`,
        title: "预言家请睁眼",
        line: "预言家选择一名玩家查验身份，查验结果只进入预言家的私密信息。",
        detail: "这一阶段不会公开查验对象和结果。",
        tone: "night",
      };
    case "NIGHT_WITCH":
      return {
        badge: `第 ${game.day} 夜`,
        title: "女巫请睁眼",
        line: "女巫确认昨夜刀口，并决定是否使用解药或毒药。",
        detail: "每晚最多使用一瓶药，药品用完后不会再次出现对应操作。",
        tone: "night",
      };
    case "DAY_ANNOUNCEMENT":
      return {
        badge: `第 ${game.day} 天`,
        title: "天亮了",
        line: "主持人公布昨夜死亡情况，随后进入白天发言。",
        detail: "死亡信息公开，身份仍然只在终局复盘揭晓。",
        tone: "day",
      };
    case "DAY_SPEECH":
      return {
        badge: `第 ${game.day} 天`,
        title: "按座位顺序发言",
        line: "所有存活玩家依次发言。发言结束后才进入投票。",
        detail: "AI 只读取公开信息和自己的私密信息，不能看到完整身份表。",
        tone: "day",
      };
    case "DAY_VOTE":
      return {
        badge: `第 ${game.day} 天`,
        title: "开始投票",
        line: "所有存活玩家投票放逐一名玩家。投票结束前，票型和投票对象全部保密。",
        detail: "结束后只公布每名候选人的得票数，再结算放逐或平票。",
        tone: "vote",
      };
    case "EXILE_RESOLUTION":
      return {
        badge: `第 ${game.day} 天`,
        title: "公布投票结果",
        line: "主持人公开最终票数，并结算今日放逐结果。",
        detail: "这里不会展示个人投票理由，避免复盘之外的信息影响过程体验。",
        tone: "vote",
      };
    case "HUNTER_SHOT":
      return {
        badge: `第 ${game.day} 天`,
        title: "猎人行动窗口",
        line: "猎人出局后可以选择是否开枪带走一名玩家。",
        detail: "如果猎人被女巫毒死，则不会触发开枪。",
        tone: "danger",
      };
    case "GAME_OVER":
      return {
        badge: "终局",
        title: "游戏结束",
        line: game.result ? `${game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜。` : "对局已经结束。",
        detail: game.result?.reason ?? "可以查看复盘了解关键节点。",
        tone: "end",
      };
    default:
      return {
        badge: "准备",
        title: "准备开局",
        line: "正在创建本局座位和身份。",
        detail: "规则引擎会先生成事件，再投影出当前玩家视角。",
        tone: "day",
      };
  }
}

function hostToneClass(tone: HostCue["tone"]): string {
  const tones = {
    night: "border-[#6d93d4]/28 bg-[#0c1424]/82",
    day: "border-[#f1c76e]/26 bg-[#1c150e]/82",
    vote: "border-[#e46d55]/28 bg-[#2a1110]/84",
    danger: "border-[#ff9a6b]/30 bg-[#30140d]/86",
    end: "border-[#77d898]/28 bg-[#0f2118]/84",
  };
  return tones[tone];
}

function SeatBoard({ game }: { game: HumanGameView }) {
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  const deadCount = game.seats.length - aliveCount;

  return (
    <section
      className="relative overflow-hidden rounded-[30px] border border-[#f1c76e]/25 bg-[#120b09]/70 bg-cover bg-center p-4 shadow-2xl shadow-black/45 lg:min-h-[690px]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(8,6,5,0.20), rgba(8,6,5,0.78)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(243,192,104,0.18),transparent_42%),linear-gradient(180deg,transparent,rgba(0,0,0,0.35))]" />

      <div className="relative mb-4 grid gap-3 rounded-2xl border border-[#f1c76e]/20 bg-black/35 p-3 text-sm text-[#dcc9a7] lg:hidden">
        <div className="flex items-center justify-between">
          <span>{game.phaseLabel}</span>
          <span>
            存活 {aliveCount} · 出局 {deadCount}
          </span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-3 lg:block lg:min-h-[650px]">
        <div className="hidden lg:absolute lg:inset-[21%] lg:grid lg:place-items-center">
          <div className="grid aspect-square w-full max-w-[360px] place-items-center rounded-full border border-[#f1c76e]/30 bg-[#130d0b]/70 p-8 text-center shadow-2xl shadow-black/45 backdrop-blur-sm">
            <div>
              <div className="text-xs uppercase tracking-[0.26em] text-[#ad9c7d]">Room Phase</div>
              <div className="mt-3 text-4xl font-semibold text-[#f1d796]">第 {game.day} 天</div>
              <div className="mt-3 text-lg text-[#f7ead5]">{game.phaseLabel}</div>
              <div className="mt-5 flex justify-center gap-2 text-xs">
                <StatusPill tone="green">存活 {aliveCount}</StatusPill>
                <StatusPill tone="red">出局 {deadCount}</StatusPill>
              </div>
            </div>
          </div>
        </div>

        {game.seats.map((seat) => (
          <SeatToken
            key={seat.seatId}
            game={game}
            seat={seat}
            orbitClassName={SEAT_ORBIT_CLASSES[(seat.seatId - 1) % SEAT_ORBIT_CLASSES.length]}
          />
        ))}
      </div>
    </section>
  );
}

function SeatToken({
  game,
  seat,
  orbitClassName,
}: {
  game: HumanGameView;
  seat: HumanGameView["seats"][number];
  orbitClassName: string;
}) {
  const isCurrent = game.currentActorSeatId === seat.seatId;
  const isSpeaking = game.currentSpeakerSeatId === seat.seatId;
  const currentLabel = isSpeaking ? "发言中" : isCurrent ? "行动中" : undefined;
  const cardImage = ROLE_CARD_IMAGES[seat.role ?? "HIDDEN"];
  const isKnown = Boolean(seat.role);

  return (
    <div
      className={[
        "group min-w-0 rounded-2xl border bg-[#180f0c]/88 p-2 shadow-xl shadow-black/35 backdrop-blur-md transition",
        "lg:absolute lg:w-[150px]",
        seat.alive ? "border-[#f1c76e]/28" : "border-[#8b4a3d]/55 opacity-75",
        isSpeaking ? "ring-2 ring-[#77d898]" : isCurrent ? "ring-2 ring-[#f1d796]" : "",
        seat.isHuman ? "bg-[#25130f]/92" : "",
        orbitClassName,
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "relative h-[70px] w-[48px] shrink-0 overflow-hidden rounded-lg border bg-cover bg-center shadow-lg",
            seat.alive ? "border-[#f1c76e]/45" : "border-[#8b4a3d]/70 grayscale",
          ].join(" ")}
          style={{ backgroundImage: `url(${cardImage})` }}
          aria-label={isKnown ? `${seat.roleLabel}身份牌` : "未揭晓身份牌"}
        >
          {!isKnown && <div className="absolute inset-0 bg-black/10" />}
        </div>
        <div className="min-w-0 flex-1 text-center lg:w-full">
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-[#f1d796]">{seat.seatId}号</span>
            {seat.isHuman && <span className="rounded-full bg-[#b74332] px-2 py-0.5 text-[11px] text-white">我</span>}
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-[#f7ead5]">{seat.name}</div>
          <div className="mt-1 flex flex-wrap justify-center gap-1 text-[11px]">
            <span className={seat.alive ? "text-[#9fe0a4]" : "text-[#ffb1a4]"}>{seat.alive ? "存活" : "出局"}</span>
            {seat.roleLabel && <span className="text-[#f1d796]">{seat.roleLabel}</span>}
            {seat.deathReason && <span className="text-[#c8b99a]">{DEATH_LABELS[seat.deathReason]}</span>}
            {currentLabel && <span className="text-[#f1d796]">{currentLabel}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <section id="review" className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1c76e]/15 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#f7ead5]">终局复盘</h2>
          <p className="mt-1 text-sm text-[#dcc9a7]">
            {review.result?.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜 · {review.result?.reason}
          </p>
        </div>
        <a
          href="#review-events"
          className="rounded-full border border-[#f1c76e]/30 px-4 py-2 text-sm text-[#f1d796] transition hover:bg-[#f1c76e]/10"
        >
          查看关键事件
        </a>
      </div>

      {review.turningPoints.length > 0 && (
        <div className="mt-4">
          <SectionTitle>关键转折</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {review.turningPoints.map((point, index) => (
              <div key={`${point.day}-${point.title}-${index}`} className="rounded-2xl border border-[#f1c76e]/18 bg-[#261510]/75 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#f1c76e]/12 px-2 py-1 text-xs text-[#f1d796]">D{point.day}</span>
                  <span className="text-xs text-[#ad9c7d]">#{index + 1}</span>
                </div>
                <div className="text-sm font-semibold text-[#f7ead5]">{point.title}</div>
                <p className="mt-2 text-xs leading-5 text-[#dcc9a7]">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <SectionTitle>身份揭晓</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {review.roleReveal.map((seat) => (
              <div key={seat.seatId} className="flex gap-3 rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm">
                <div
                  className="h-16 w-11 shrink-0 rounded-md border border-[#f1c76e]/30 bg-cover bg-center"
                  style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[seat.role]})` }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#f7ead5]">
                    {seat.seatId}号 · {seat.name}
                  </div>
                  <div className={seat.role === "WEREWOLF" ? "mt-1 text-[#ff8c78]" : "mt-1 text-[#9fe0a4]"}>
                    {seat.roleLabel}
                  </div>
                  <div className="mt-1 text-xs text-[#ad9c7d]">
                    {seat.alive ? "存活到终局" : seat.deathReason ? DEATH_LABELS[seat.deathReason] : "已出局"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>死亡时间线</SectionTitle>
          <div className="mt-3 grid gap-2">
            {review.deathTimeline.length === 0 ? (
              <p className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 p-3 text-sm text-[#ad9c7d]">没有玩家死亡。</p>
            ) : (
              review.deathTimeline.map((death, index) => (
                <div key={`${death.day}-${death.seat.seatId}-${index}`} className="rounded-2xl bg-[#261510]/85 p-3 text-sm text-[#dcc9a7]">
                  D{death.day} · {death.seat.name} · {death.reasonLabel}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReviewNightRounds game={game} />
        <ReviewDayRounds game={game} />
      </div>

      <div id="review-events" className="mt-5">
        <SectionTitle>关键事件</SectionTitle>
        <div className="mt-3 grid gap-2">
          {review.keyEvents.map((event) => (
            <div key={event.seq} className="border-l-2 border-[#f1c76e] bg-black/15 py-2 pl-3 text-sm leading-6 text-[#dcc9a7]">
              <span className="text-xs text-[#ad9c7d]">D{event.day} · {event.phase}</span>
              <br />
              {event.message}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewNightRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>夜晚记录</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.nightRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#5e87b9]/25 bg-[#0d1623]/55 p-3 text-sm leading-6 text-[#d8e6f7]">
            <strong>第 {round.day} 夜</strong>
            <div>狼人刀口：{round.wolfTarget?.name ?? "无"}</div>
            <div>
              查验：
              {round.seerCheck
                ? `${round.seerCheck.seer.name} 查验 ${round.seerCheck.target.name} 为 ${
                    round.seerCheck.result === "WEREWOLF" ? "狼人" : "好人"
                  }`
                : "无"}
            </div>
            <div>
              女巫：
              {round.witchAction
                ? round.witchAction.mode === "save"
                  ? `救了 ${round.witchAction.target?.name ?? "刀口"}`
                  : round.witchAction.mode === "poison"
                    ? `毒了 ${round.witchAction.target?.name ?? "未知目标"}`
                    : "未用药"
                : "无行动"}
            </div>
            <div>死亡：{round.deaths.length > 0 ? round.deaths.map((seat) => seat.name).join("、") : "平安夜"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDayRounds({ game }: { game: HumanGameView }) {
  const review = game.review;
  if (!review) return null;

  return (
    <div>
      <SectionTitle>白天投票</SectionTitle>
      <div className="mt-3 grid gap-3">
        {review.dayRounds.map((round) => (
          <div key={round.day} className="rounded-2xl border border-[#8fd29a]/25 bg-[#0f2118]/60 p-3 text-sm leading-6 text-[#dff4df]">
            <strong>第 {round.day} 天</strong>
            <div>发言数：{round.speechCount}</div>
            <div>
              票数：
              {round.voteTally.length > 0
                ? round.voteTally.map((item) => `${item.target.name} ${item.count}票`).join("，")
                : "无"}
            </div>
            <div>
              结果：
              {round.exiled
                ? `${round.exiled.name} 被放逐`
                : round.tiedSeatIds.length > 0
                  ? `平票：${round.tiedSeatIds.join("、")}号`
                  : "无放逐"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoPanel({ game }: { game: HumanGameView }) {
  return (
    <section className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-start gap-4">
        <div
          className="h-36 w-24 shrink-0 rounded-xl border border-[#f1c76e]/35 bg-cover bg-center shadow-xl"
          style={{ backgroundImage: `url(${ROLE_CARD_IMAGES[game.myRole]})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#f7ead5]">我的身份</h2>
            {game.result && (
              <span className="rounded-full bg-[#b74332] px-2 py-1 text-xs font-medium text-white">
                {game.result.winner === "GOOD" ? "好人胜利" : "狼人胜利"}
              </span>
            )}
          </div>
          <div className="mt-2 text-3xl font-semibold text-[#f1d796]">{ROLE_LABELS[game.myRole]}</div>
          <div className="mt-3 text-xs leading-5 text-[#ad9c7d]">
            你的私密信息只在这里展示，其他 AI 身份会在终局复盘中揭晓。
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-[#dcc9a7]">
        {game.wolfTeammates.length > 0 && (
          <InfoRow label="狼队友">{game.wolfTeammates.map((seat) => seat.name).join("、")}</InfoRow>
        )}
        {game.seerChecks.length > 0 && (
          <InfoRow label="查验">
            {game.seerChecks.map((check) => (
              <div key={`${check.day}-${check.targetSeatId}`}>
                D{check.day} · {check.targetSeatId}号 · {check.result === "WEREWOLF" ? "狼人" : "好人"}
              </div>
            ))}
          </InfoRow>
        )}
        {game.myRole === "WITCH" && (
          <InfoRow label="药品">
            解药 {game.witch.antidoteAvailable ? "可用" : "已用"} · 毒药 {game.witch.poisonAvailable ? "可用" : "已用"}
          </InfoRow>
        )}
        {game.privateEvents.slice(-4).map((event) => (
          <div key={event.seq} className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 px-3 py-2 text-[#dcc9a7]">
            {event.message}
          </div>
        ))}
      </div>
    </section>
  );
}

function SpeechFeed({ game }: { game: HumanGameView }) {
  const speeches = game.tableSummary.recentSpeeches;
  const currentSpeaker = game.currentSpeakerSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#77d898]/25 bg-[#0f2118]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#77d898]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#dff4df]">发言席</h2>
        <span className="text-xs text-[#9ecfac]">
          {currentSpeaker ? `当前：${currentSpeaker.name}` : game.phase === "DAY_SPEECH" ? "等待发言" : "非发言阶段"}
        </span>
      </div>
      <div className="grid max-h-[300px] gap-3 overflow-y-auto p-4">
        {speeches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#77d898]/20 px-3 py-6 text-center text-sm text-[#9ecfac]">
            暂无公开发言
          </div>
        ) : (
          speeches.map((speech) => {
            const isHuman = speech.speaker?.seatId === game.humanSeatId;
            return (
              <div
                key={speech.seq}
                className={[
                  "rounded-2xl border px-3 py-2 text-sm leading-6",
                  isHuman ? "border-[#f1c76e]/30 bg-[#2b2110]/75 text-[#f7ead5]" : "border-[#77d898]/18 bg-black/22 text-[#dff4df]",
                ].join(" ")}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#9ecfac]">
                  <span>{speech.speaker ? `${speech.speaker.seatId}号 · ${speech.speaker.name}` : "未知发言人"}</span>
                  <span>D{speech.day}</span>
                </div>
                {speech.message}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function VoteTable({ game }: { game: HumanGameView }) {
  const voteAction = game.availableActions.find((action) => action.type === "vote");
  const voteTargets = voteAction?.type === "vote" ? voteAction.targets : [];
  const snapshot = game.tableSummary.voteSnapshot;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e46d55]/25 bg-[#2b1110]/82 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#e46d55]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#ffd8cf]">投票台</h2>
        <span className="text-xs text-[#d9a099]">
          {game.phase === "DAY_VOTE"
            ? "投票保密"
            : snapshot.leaders.length > 0
              ? `焦点：${snapshot.leaders.map((seat) => seat.name).join("、")}`
              : "暂无票型"}
        </span>
      </div>

      <div className="grid gap-3 p-4">
        {voteTargets.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-[#d9a099]">你可投目标</div>
            <div className="flex flex-wrap gap-2">
              {voteTargets.map((target) => (
                <span key={target.seatId} className="rounded-full border border-[#e46d55]/25 bg-black/20 px-3 py-1 text-xs text-[#ffd8cf]">
                  {target.seatId}号 {target.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs text-[#d9a099]">{snapshot.revealed ? "最近公开票数" : "投票状态"}</div>
          {snapshot.tally.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e46d55]/20 px-3 py-5 text-center text-sm text-[#d9a099]">
              {game.phase === "DAY_VOTE" ? "投票进行中，票数暂不公开" : "还没有公开票数"}
            </div>
          ) : (
            <div className="grid gap-2">
              {snapshot.tally.map((item) => (
                <div key={item.target.seatId} className="rounded-2xl border border-[#e46d55]/18 bg-black/22 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-sm text-[#ffd8cf]">
                    <span>
                      {item.target.seatId}号 · {item.target.name}
                    </span>
                    <strong>{item.count} 票</strong>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                    <div
                      className="h-full rounded-full bg-[#e46d55]"
                      style={{ width: `${Math.min(100, item.count * 22)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {game.tableSummary.aiReasonHighlights.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-[#d9a099]">局势提示</div>
            <div className="grid gap-2">
              {game.tableSummary.aiReasonHighlights.map((reason) => (
                <div key={reason} className="rounded-2xl bg-black/22 px-3 py-2 text-xs leading-5 text-[#ffd8cf]">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PublicLog({ events }: { events: HumanGameView["publicEvents"] }) {
  return (
    <section className="min-h-[360px] overflow-hidden rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#f1c76e]/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#f7ead5]">公开记录</h2>
        <span className="text-xs text-[#ad9c7d]">夜晚 / 白天 / 投票 / 系统</span>
      </div>
      <div className="flex max-h-[620px] flex-col gap-3 overflow-y-auto p-4">
        {events.map((event) => (
          <div key={event.seq} className={`${eventClassName(event.phase)} rounded-2xl border px-3 py-2 text-sm leading-6`}>
            <div className="mb-1 text-xs opacity-75">
              D{event.day} · {phaseCategory(event.phase)}
            </div>
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
  onNewGame,
}: {
  game: HumanGameView;
  loading: boolean;
  onNewGame: () => Promise<void>;
  onSubmit: (payload: CommandPayload) => Promise<void>;
}) {
  if (game.result) {
    return (
      <section className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 shadow-2xl shadow-black/35 backdrop-blur-md">
        <h2 className="text-lg font-semibold text-[#f7ead5]">终局</h2>
        <p className="mt-2 text-sm text-[#dcc9a7]">
          {game.result.winner === "GOOD" ? "好人阵营" : "狼人阵营"}获胜：{game.result.reason}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="#review"
            className="rounded-full bg-[#2f8157] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#379566]"
          >
            查看复盘
          </a>
          <button
            onClick={onNewGame}
            disabled={loading}
            className="rounded-full border border-[#f1c76e]/30 px-5 py-2.5 text-sm font-semibold text-[#f1d796] transition hover:bg-[#f1c76e]/10 disabled:opacity-60"
          >
            新开一局
          </button>
        </div>
      </section>
    );
  }

  if (game.availableActions.length === 0) {
    return (
      <section className="rounded-[24px] border border-[#f1c76e]/25 bg-[#130d0b]/88 p-4 text-sm text-[#dcc9a7] shadow-2xl shadow-black/35 backdrop-blur-md">
        {loading ? "结算中" : "等待 AI 行动"}
      </section>
    );
  }

  const meta = getActionMeta(game.availableActions[0]);
  const isContinueOnly = game.availableActions.every((action) => action.type === "continue");

  return (
    <section className="sticky bottom-3 z-20 rounded-[24px] border border-[#f1c76e]/30 bg-[#130d0b]/92 p-4 shadow-2xl shadow-black/45 backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-[#f1c76e]/10 px-3 py-1 text-xs text-[#f1d796]">{game.phaseLabel}</div>
          <h2 className="text-xl font-semibold text-[#f7ead5]">{meta.title}</h2>
          <p className="mt-1 text-sm text-[#dcc9a7]">{meta.description}</p>
        </div>
        <span className="rounded-full border border-[#f1c76e]/25 px-3 py-1 text-xs text-[#ad9c7d]">
          {isContinueOnly ? "观看流程" : "轮到你行动"}
        </span>
      </div>
      <div className="grid gap-3">
        {game.availableActions.map((action) => (
          <ActionControl key={action.type} action={action} loading={loading} onSubmit={onSubmit} />
        ))}
      </div>
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
          className="min-h-28 resize-none rounded-2xl border border-[#f1c76e]/25 bg-black/30 px-4 py-3 text-sm text-[#f7ead5] outline-none transition placeholder:text-[#8f8065] focus:border-[#f1d796]"
          placeholder="输入本轮发言"
        />
        <button
          disabled={loading || message.trim().length === 0}
          onClick={() => onSubmit({ type: "speak", message })}
          className="rounded-full bg-[#2f8157] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#379566] disabled:opacity-60"
        >
          确认发言
        </button>
      </div>
    );
  }

  if (action.type === "continue") {
    return (
      <button
        disabled={loading}
        onClick={() => onSubmit({ type: "continue" })}
        className="rounded-full bg-[#b74332] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#cf513d] disabled:opacity-60"
      >
        {action.label}
      </button>
    );
  }

  if (action.type === "witchAction") {
    return (
      <div className="flex flex-wrap gap-2">
        {action.canSave && action.saveTarget && (
          <ActionButton disabled={loading} tone="green" onClick={() => onSubmit({ type: "witchAction", mode: "save" })}>
            救 {action.saveTarget.name}
          </ActionButton>
        )}
        {action.canPoison &&
          action.poisonTargets.map((target) => (
            <ActionButton
              key={target.seatId}
              disabled={loading}
              tone="red"
              onClick={() => onSubmit({ type: "witchAction", mode: "poison", targetSeatId: target.seatId })}
            >
              毒 {target.name}
            </ActionButton>
          ))}
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "witchAction", mode: "skip" })}>
          不用药
        </ActionButton>
      </div>
    );
  }

  if (action.type === "hunterShoot") {
    return (
      <div className="flex flex-wrap gap-2">
        {action.targets.map((target) => (
          <ActionButton
            key={target.seatId}
            disabled={loading}
            tone="red"
            onClick={() => onSubmit({ type: "hunterShoot", targetSeatId: target.seatId })}
          >
            带走 {target.name}
          </ActionButton>
        ))}
        <ActionButton disabled={loading} tone="neutral" onClick={() => onSubmit({ type: "hunterShoot" })}>
          不开枪
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {action.targets.map((target) => (
        <ActionButton
          key={target.seatId}
          disabled={loading}
          tone={action.type === "wolfKill" ? "red" : "green"}
          onClick={() => onSubmit({ type: action.type, targetSeatId: target.seatId } as CommandPayload)}
        >
          {action.type === "wolfKill" ? "击杀" : action.type === "seerCheck" ? "查验" : "投票"} {target.name}
        </ActionButton>
      ))}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  tone: "green" | "red" | "neutral";
  onClick: () => void;
}) {
  const className =
    tone === "red"
      ? "bg-[#b74332] text-white hover:bg-[#cf513d]"
      : tone === "green"
        ? "bg-[#2f8157] text-white hover:bg-[#379566]"
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#f1c76e]/15 bg-black/20 px-3 py-2">
      <div className="mb-1 text-xs text-[#ad9c7d]">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-[#f1d796]">{children}</h3>;
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "gold" | "green" | "red" | "blue" }) {
  const colors = {
    gold: "border-[#f1c76e]/35 bg-[#f1c76e]/10 text-[#f1d796]",
    green: "border-[#77d898]/30 bg-[#1d4e33]/45 text-[#a8f0b6]",
    red: "border-[#e46d55]/35 bg-[#572017]/45 text-[#ffb1a4]",
    blue: "border-[#6797d5]/35 bg-[#142845]/50 text-[#cfe4ff]",
  };

  return <span className={`${colors[tone]} rounded-full border px-3 py-1 text-xs font-medium`}>{children}</span>;
}

function getActionMeta(action: AvailableHumanAction) {
  switch (action.type) {
    case "wolfKill":
      return { title: "狼人夜刀", description: "选择一名非狼人存活玩家作为今晚刀口。" };
    case "seerCheck":
      return { title: "预言家查验", description: "选择一名存活玩家，系统会私下告诉你阵营结果。" };
    case "witchAction":
      return { title: "女巫用药", description: "选择救人、毒人，或保留药品跳过本夜。" };
    case "speak":
      return { title: "轮到你发言", description: "公开发言会进入所有 AI 的公开信息流。" };
    case "vote":
      return { title: "投票放逐", description: "选择一名存活玩家投票，所有人投完后进入结算。" };
    case "hunterShoot":
      return { title: "猎人开枪", description: "你可以带走一名存活玩家，也可以选择不开枪。" };
    case "continue":
      return { title: action.label, description: action.description };
  }
}

function eventClassName(phase: HumanGameView["phase"]): string {
  if (phase.startsWith("NIGHT")) return "border-[#6797d5]/25 bg-[#0d1623]/65 text-[#d8e6f7]";
  if (phase === "DAY_VOTE" || phase === "EXILE_RESOLUTION") return "border-[#e46d55]/30 bg-[#2b1110]/70 text-[#ffd8cf]";
  if (phase === "DAY_SPEECH") return "border-[#77d898]/25 bg-[#0f2118]/70 text-[#dff4df]";
  return "border-[#f1c76e]/25 bg-[#261510]/65 text-[#dcc9a7]";
}

function phaseCategory(phase: HumanGameView["phase"]): string {
  if (phase.startsWith("NIGHT")) return "夜晚";
  if (phase === "DAY_SPEECH") return "白天";
  if (phase === "DAY_VOTE" || phase === "EXILE_RESOLUTION") return "投票";
  return "系统";
}

function readRecentGameIds(): string[] {
  if (typeof window === "undefined") {
    return EMPTY_RECENT_GAME_IDS;
  }

  try {
    const raw = window.localStorage.getItem(RECENT_GAMES_KEY);
    if (raw === recentGameIdsRawCache) {
      return recentGameIdsSnapshotCache;
    }

    const parsed = raw ? JSON.parse(raw) : [];
    recentGameIdsRawCache = raw;
    recentGameIdsSnapshotCache = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").slice(0, 5)
      : EMPTY_RECENT_GAME_IDS;
    return recentGameIdsSnapshotCache;
  } catch {
    recentGameIdsRawCache = null;
    recentGameIdsSnapshotCache = EMPTY_RECENT_GAME_IDS;
    return recentGameIdsSnapshotCache;
  }
}

function getRecentGameIdsServerSnapshot(): string[] {
  return EMPTY_RECENT_GAME_IDS;
}

function subscribeRecentGameIds(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener("ai-werewolf-recent-games-changed", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("ai-werewolf-recent-games-changed", handleChange);
  };
}
