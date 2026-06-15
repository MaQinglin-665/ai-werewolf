"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { AiRuntimeMode, HumanGameView } from "@/game/types";
import type { ClassTrialIntroConfig } from "./classTrialIntro";
import { ClassTrialOpeningIntro } from "./ClassTrialOpeningIntro";
import { ClassTrialGameTable } from "./ClassTrialGameTable";
import type { ClassTrialPackManifest } from "./classTrialTheme";
import type {
  AiSpeechAudioStatus,
  ClassTrialManualAudioPlayback,
  CommandPayload,
  HostAudioStatus,
  LiveAiSpeech,
} from "./clientTypes";
import { MobileGameTable } from "./MobileGameTable";
import { ActionPanel } from "./ActionPanel";
import { getHostCue } from "./HostStageCue";
import { ReviewPanel } from "./ReviewPanel";
import { RoleCardArtwork } from "./RoleCardArtwork";
import { SeatBoard } from "./SeatBoard";
import { VoteTable } from "./TablePanels";
import { buildTableEventFeed, type TableEventFeedItem } from "./tableEventFeed";
import { ROLE_CARD_BOOK_IMAGES } from "./viewHelpers";

const ORDINARY_DESKTOP_SURFACE_QUERY = "(min-width: 640px)";

export type OrdinarySurfaceMode = "both" | "mobile" | "desktop";

export type GameClientLoadedSurfaceProps = {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioEnabled: boolean;
  aiSpeechAudioEnabled: boolean;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  bufferedClassTrialContinueKey: string | null;
  classTrialThemeActive: boolean;
  classTrialIntroPending: boolean;
  classTrialIntroReady: boolean;
  classTrialIntroConfig?: ClassTrialIntroConfig;
  classTrialIntroMessage: string;
  classTrialPackManifest?: ClassTrialPackManifest;
  manualAiSpeechPlayback: ClassTrialManualAudioPlayback | null;
  effectiveAiRuntimeMode: AiRuntimeMode;
  onNewGame: () => Promise<void>;
  onReturnHome: () => Promise<void> | void;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
  onPauseAiSpeechAudio: () => void;
  onResumeAiSpeechAudio: () => void;
  onSkipAiSpeechAudio: () => void;
  onCompleteClassTrialIntro: () => void;
  onSkipClassTrialIntro: () => void;
};

export function shouldRenderOrdinaryMobileSurface(mode: OrdinarySurfaceMode): boolean {
  return mode !== "desktop";
}

export function shouldRenderOrdinaryDesktopSurface(mode: OrdinarySurfaceMode): boolean {
  return mode !== "mobile";
}

export function buildOrdinarySurfaceEventFeed(game: HumanGameView, classTrialThemeActive: boolean): TableEventFeedItem[] {
  return classTrialThemeActive ? [] : buildTableEventFeed(game);
}

export function GameClientLoadedSurface({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioEnabled,
  aiSpeechAudioEnabled,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  bufferedClassTrialContinueKey,
  classTrialThemeActive,
  classTrialIntroPending,
  classTrialIntroReady,
  classTrialIntroConfig,
  classTrialIntroMessage,
  classTrialPackManifest,
  manualAiSpeechPlayback,
  effectiveAiRuntimeMode,
  onNewGame,
  onReturnHome,
  onSubmit,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
  onCompleteClassTrialIntro,
  onSkipClassTrialIntro,
}: GameClientLoadedSurfaceProps) {
  const ordinarySurfaceMode = useOrdinarySurfaceMode(classTrialThemeActive);
  const renderMobileOrdinarySurface = shouldRenderOrdinaryMobileSurface(ordinarySurfaceMode);
  const renderDesktopOrdinarySurface = shouldRenderOrdinaryDesktopSurface(ordinarySurfaceMode);
  const ordinaryEvents = useMemo(
    () => buildOrdinarySurfaceEventFeed(game, classTrialThemeActive),
    [classTrialThemeActive, game],
  );
  const ordinaryVotePanelActive = shouldShowOrdinaryVotePanel(game);

  return (
    <div className="grid flex-1 gap-4">
      {classTrialThemeActive && classTrialIntroPending && classTrialIntroReady && classTrialIntroConfig ? (
        <ClassTrialOpeningIntro
          config={classTrialIntroConfig}
          onComplete={onCompleteClassTrialIntro}
          onSkip={onSkipClassTrialIntro}
        />
      ) : classTrialThemeActive && classTrialIntroPending ? (
        <section className="class-trial-opening-wait class-trial-court-stage">
          <div className="class-trial-table-background" aria-hidden="true" />
          <div className="class-trial-opening-wait-panel">
            <h2>正在准备开场片头</h2>
            <p>{classTrialIntroMessage}</p>
            <button type="button" onClick={onSkipClassTrialIntro}>
              跳过片头，进入裁判席
            </button>
          </div>
        </section>
      ) : classTrialThemeActive ? (
        <ClassTrialGameTable
          game={game}
          loading={loading || Boolean(aiSpeechAudioStatus) || Boolean(bufferedClassTrialContinueKey)}
          manifest={classTrialPackManifest}
          audioTypewriter={aiSpeechAudioStatus ?? undefined}
          manualAudioPlayback={manualAiSpeechPlayback}
          liveAiSpeech={liveAiSpeech}
          aiRuntimeMode={effectiveAiRuntimeMode}
          hostAudioEnabled={hostAudioEnabled}
          hostAudioStatus={hostAudioStatus}
          onToggleHostAudio={onToggleHostAudio}
          onReturnHome={() => void onReturnHome()}
          onSubmit={onSubmit}
        />
      ) : renderMobileOrdinarySurface ? (
        <MobileGameTable
          game={game}
          loading={loading}
          pendingCommandType={pendingCommandType}
          liveAiSpeech={liveAiSpeech}
          hostAudioEnabled={hostAudioEnabled}
          aiSpeechAudioEnabled={aiSpeechAudioEnabled}
          hostAudioStatus={hostAudioStatus}
          aiSpeechAudioStatus={aiSpeechAudioStatus}
          aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
          events={ordinaryEvents}
          onNewGame={onNewGame}
          onReturnHome={onReturnHome}
          onSubmit={onSubmit}
          onOpenIdentityBook={onOpenIdentityBook}
          onOpenGlossary={onOpenGlossary}
          onToggleAiSpeechAudio={onToggleAiSpeechAudio}
          onToggleHostAudio={onToggleHostAudio}
        />
      ) : null}

      {!classTrialThemeActive && renderDesktopOrdinarySurface && (
        <div className="ordinary-desktop-match hidden sm:grid" data-vote-active={ordinaryVotePanelActive ? "true" : "false"}>
          <header className="ordinary-desktop-topbar" aria-label="单人 AI 狼人杀局内控制栏">
            <div className="ordinary-desktop-brand">
              <span className="ordinary-desktop-mark" aria-hidden="true">
                狼
              </span>
              <div className="min-w-0">
                <div className="ordinary-desktop-title">AI 狼人杀</div>
                <div className="ordinary-desktop-subtitle">{game.board.name}</div>
              </div>
            </div>

            <div className="ordinary-desktop-status" aria-label="当前对局状态">
              <span>第 {game.day} 天</span>
              <strong>{game.phaseLabel}</strong>
              <span>{game.humanSeatId === null ? "AI 观战" : `${game.humanSeatId}号 · ${game.myRoleLabel ?? "身份未知"}`}</span>
              <span>存活 {game.seats.filter((seat) => seat.alive).length}/{game.seats.length}</span>
            </div>

            <div className="ordinary-desktop-actions">
              <button type="button" onClick={onOpenIdentityBook}>
                角色书
              </button>
              <button type="button" onClick={onOpenGlossary}>
                术语
              </button>
              <button type="button" aria-pressed={hostAudioEnabled} onClick={onToggleHostAudio}>
                {hostAudioEnabled ? "主持开" : "主持关"}
              </button>
              <button type="button" aria-pressed={aiSpeechAudioEnabled && !aiSpeechAudioUnavailable} onClick={onToggleAiSpeechAudio}>
                {aiSpeechAudioUnavailable ? "语音转写" : aiSpeechAudioEnabled ? "AI语音开" : "AI语音关"}
              </button>
              <button type="button" onClick={() => void onReturnHome()} className="ordinary-desktop-secondary">
                返回首页
              </button>
              <button type="button" onClick={() => void onNewGame()} disabled={loading} className="ordinary-desktop-primary">
                新局
              </button>
            </div>
          </header>

          <section className="ordinary-desktop-grid grid" aria-label="桌面端狼人杀对局">
            <aside className="ordinary-desktop-left-rail grid" aria-label="我的信息和流程">
              <OrdinaryPrivateSummary game={game} />
            </aside>

            <div className="ordinary-desktop-center grid" aria-label="牌桌和发言">
              <OrdinaryStageStrip game={game} />
              <SeatBoard game={game} liveAiSpeech={liveAiSpeech} aiSpeechAudioStatus={aiSpeechAudioStatus} />
              {game.review && <ReviewPanel game={game} />}
            </div>

            <aside className="ordinary-desktop-right-rail grid" aria-label="当前操作和公开信息">
              <ActionPanel
                game={game}
                loading={loading}
                onNewGame={onNewGame}
                onReturnHome={onReturnHome}
                onSubmit={onSubmit}
                mobileCompact
              />
              <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />
              <OrdinaryDesktopBriefing game={game} />
            </aside>
          </section>
        </div>
      )}
    </div>
  );
}

function useOrdinarySurfaceMode(classTrialThemeActive: boolean): OrdinarySurfaceMode {
  const viewportMode = useSyncExternalStore(
    subscribeOrdinarySurfaceMode,
    getOrdinarySurfaceModeSnapshot,
    getOrdinarySurfaceModeServerSnapshot,
  );
  return classTrialThemeActive ? "both" : viewportMode;
}

function OrdinaryStageStrip({ game }: { game: HumanGameView }) {
  const cue = getHostCue(game);
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  const deadCount = game.seats.length - aliveCount;
  const currentSeat = game.currentSpeakerSeatId ?? game.currentActorSeatId;

  return (
    <section className="ordinary-stage-strip" aria-label="当前阶段">
      <div className="ordinary-stage-main">
        <span>{cue.badge}</span>
        <strong>{cue.title}</strong>
      </div>
      <p>{cue.line}</p>
      <div className="ordinary-stage-meta">
        {currentSeat && <span>当前 {currentSeat}号</span>}
        <span>存活 {aliveCount}</span>
        {deadCount > 0 && <span>出局 {deadCount}</span>}
      </div>
    </section>
  );
}

function OrdinaryPrivateSummary({ game }: { game: HumanGameView }) {
  const privateEvents = game.privateEvents.slice(-2);
  const wolfTeammates = game.wolfTeammates.slice(0, 3);
  const seerChecks = game.seerChecks.slice(-3);
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  const deadCount = game.seats.length - aliveCount;
  const currentActor = game.currentActorSeatId ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId) : undefined;
  const currentSpeaker = game.currentSpeakerSeatId ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId) : undefined;
  const roleObjective = getOrdinaryRoleObjective(game);
  const roleImage = ROLE_CARD_BOOK_IMAGES[game.myRole ?? "HIDDEN"];
  const roleCamp = getOrdinaryRoleCamp(game);

  return (
    <section className="ordinary-private-summary" aria-label="我的视角">
      <div className="ordinary-panel-heading">
        <span>我的身份</span>
        <em>{game.humanSeatId === null ? "观战" : `${game.humanSeatId}号位`}</em>
      </div>

      <div className="ordinary-role-card">
        {game.myRole ? (
          <RoleCardArtwork
            role={game.myRole}
            title={game.myRoleLabel ?? "身份"}
            src={roleImage}
            className="ordinary-role-portrait"
            imageClassName="object-cover"
            priority
            sizes="112px"
          />
        ) : (
          <div className="ordinary-role-portrait ordinary-role-portrait-hidden" aria-hidden="true" />
        )}
        <div className="ordinary-role-card-copy">
          <span>身份牌</span>
          <strong>{game.myRoleLabel ?? (game.humanSeatId === null ? "AI 观战" : "未知")}</strong>
          <p>{roleCamp}</p>
          {wolfTeammates.length > 0 && <em>狼队友 {wolfTeammates.map((seat) => `${seat.seatId}号`).join(" · ")}</em>}
        </div>
      </div>

      <div className="ordinary-role-objective">
        <span>本局目标</span>
        <p>{roleObjective}</p>
      </div>

      <div className="ordinary-match-stats" aria-label="当前桌况">
        <div>
          <span>存活</span>
          <strong>{aliveCount}</strong>
        </div>
        <div>
          <span>出局</span>
          <strong>{deadCount}</strong>
        </div>
        <div>
          <span>行动</span>
          <strong>{currentActor ? `${currentActor.seatId}号` : "系统"}</strong>
        </div>
        <div>
          <span>发言</span>
          <strong>{currentSpeaker ? `${currentSpeaker.seatId}号` : "待定"}</strong>
        </div>
      </div>

      <div className="ordinary-private-lines">
        {seerChecks.length > 0 && (
          <div>
            <span>查验</span>
            <strong>
              {seerChecks.map((check) => `D${check.day} ${check.targetSeatId}号${check.result === "WEREWOLF" ? "狼人" : "好人"}`).join(" · ")}
            </strong>
          </div>
        )}
        {game.myRole === "WITCH" && game.witch && (
          <div>
            <span>药品</span>
            <strong>解药 {game.witch.antidoteAvailable ? "可用" : "已用"} · 毒药 {game.witch.poisonAvailable ? "可用" : "已用"}</strong>
          </div>
        )}
        {game.myRole === "GUARD" && (
          <div>
            <span>守卫</span>
            <strong>{game.guard?.lastGuardedSeatId ? `上一晚守护 ${game.guard.lastGuardedSeatId}号` : "尚未守护"}</strong>
          </div>
        )}
        {game.sheriff?.badgeHolder && (
          <div>
            <span>警徽</span>
            <strong>{game.sheriff.badgeHolder.seatId}号持有</strong>
          </div>
        )}
      </div>

      <div className="ordinary-private-events">
        <div className="ordinary-panel-heading">
          <span>私密摘要</span>
          <em>{privateEvents.length > 0 ? `${privateEvents.length} 条` : "暂无"}</em>
        </div>
        {privateEvents.length === 0 ? (
          <span>暂无新的私密记录</span>
        ) : (
          privateEvents.map((event) => <span key={event.seq}>{event.message}</span>)
        )}
      </div>
    </section>
  );
}

function getOrdinaryRoleObjective(game: HumanGameView): string {
  switch (game.myRole) {
    case "WEREWOLF":
    case "WOLF_KING":
    case "WHITE_WOLF_KING":
    case "WOLF_BEAUTY":
      return "隐藏狼队视角，制造错票，优先处理可信神职。";
    case "SEER":
      return "利用查验建立可信信息，白天引导好人站边。";
    case "WITCH":
      return "控制药品节奏，用救毒信息保护关键好人。";
    case "GUARD":
      return "判断夜间刀口，避免连续守护同一目标。";
    case "HUNTER":
      return "白天保留威慑，出局时用信息决定是否开枪。";
    case "IDIOT":
      return "减少无效抗推，必要时用翻牌身份争取轮次。";
    case "KNIGHT":
      return "保留决斗窗口，在证据足够时切开核心对跳。";
    case "VILLAGER":
      return "听发言、找矛盾，投票前给出清晰理由。";
    default:
      return game.humanSeatId === null ? "观察公开发言和投票变化，等待终局复盘。" : "根据公开信息判断阵营，不依赖隐藏身份表。";
  }
}

function getOrdinaryRoleCamp(game: HumanGameView): string {
  switch (game.myRole) {
    case "WEREWOLF":
    case "WOLF_KING":
    case "WHITE_WOLF_KING":
    case "WOLF_BEAUTY":
      return "狼人阵营";
    case "SEER":
    case "WITCH":
    case "GUARD":
    case "HUNTER":
    case "IDIOT":
    case "KNIGHT":
    case "VILLAGER":
      return "好人阵营";
    default:
      return game.humanSeatId === null ? "观战视角" : "身份未公开";
  }
}

function OrdinaryDesktopBriefing({ game }: { game: HumanGameView }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const memory = game.tableSummary.tableMemory;
  const focusSeats = memory.focus.slice(0, 2);
  const claims = game.tableSummary.claimBoard.slice(-2);
  const latestVote = memory.voteHistory.at(-1);
  const speechHistory = useMemo(() => buildOrdinarySpeechHistory(game), [game]);
  const voteHistory = useMemo(() => buildOrdinaryVoteHistory(game), [game]);

  return (
    <section className="ordinary-desktop-briefing" aria-label="局势摘要">
      <div className="ordinary-panel-heading ordinary-briefing-heading">
        <span>局势摘要</span>
        <button type="button" className="ordinary-history-chip" onClick={() => setHistoryOpen(true)} aria-haspopup="dialog">
          历史记录
        </button>
      </div>
      <div className="ordinary-briefing-list">
        <button type="button" className="ordinary-history-entry" onClick={() => setHistoryOpen(true)} aria-haspopup="dialog">
          <span>快速回看</span>
          <strong>
            发言 {speechHistory.length} · 投票 {voteHistory.length}
          </strong>
        </button>
        {focusSeats.length > 0 ? (
          focusSeats.map((item) => (
            <span key={`focus-${item.seat.seatId}`}>
              {item.seat.seatId}号 · {item.reasons[0] ?? "公开焦点"}
            </span>
          ))
        ) : (
          <span>暂无明显公开焦点</span>
        )}
        {claims.map((claim) => (
          <span key={claim.claimId}>
            {claim.claimant.seatId}号跳{claim.claimedRoleLabel}
          </span>
        ))}
        {latestVote?.tally.length ? (
          <span>D{latestVote.day} 票型：{latestVote.tally.slice(0, 2).map((item) => `${item.target.seatId}号${item.count}票`).join("，")}</span>
        ) : null}
      </div>
      {historyOpen && (
        <OrdinaryHistoryOverlay
          speechHistory={speechHistory}
          voteHistory={voteHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </section>
  );
}

type OrdinaryHistoryTab = "speech" | "vote";

type OrdinarySpeechHistoryItem = {
  seq: number;
  day: number;
  speakerLabel: string;
  message: string;
  kind: "speech" | "lastWords";
};

type OrdinaryVoteHistoryItem = {
  id: string;
  day: number;
  title: string;
  summary: string;
  detailLines: string[];
};

function OrdinaryHistoryOverlay({
  speechHistory,
  voteHistory,
  onClose,
}: {
  speechHistory: OrdinarySpeechHistoryItem[];
  voteHistory: OrdinaryVoteHistoryItem[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<OrdinaryHistoryTab>("speech");
  const reversedSpeechHistory = [...speechHistory].reverse();
  const reversedVoteHistory = [...voteHistory].reverse();

  const overlay = (
    <div className="ordinary-history-overlay" role="dialog" aria-modal="true" aria-label="发言与投票历史">
      <button type="button" className="ordinary-history-backdrop" onClick={onClose} aria-label="关闭历史记录" />
      <section className="ordinary-history-panel">
        <header className="ordinary-history-header">
          <div>
            <span>公开记录</span>
            <h2>发言与投票历史</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="ordinary-history-tabs" role="tablist" aria-label="历史记录类型">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "speech"}
            onClick={() => setActiveTab("speech")}
          >
            发言 <strong>{speechHistory.length}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "vote"}
            onClick={() => setActiveTab("vote")}
          >
            投票 <strong>{voteHistory.length}</strong>
          </button>
        </div>

        <div className="ordinary-history-list">
          {activeTab === "speech" ? (
            reversedSpeechHistory.length > 0 ? (
              reversedSpeechHistory.map((item) => (
                <article key={item.seq} className="ordinary-history-item">
                  <div className="ordinary-history-item-head">
                    <span>D{item.day}</span>
                    <strong>{item.speakerLabel}</strong>
                    {item.kind === "lastWords" && <em>遗言</em>}
                  </div>
                  <p>{item.message}</p>
                </article>
              ))
            ) : (
              <div className="ordinary-history-empty">暂无公开发言记录</div>
            )
          ) : reversedVoteHistory.length > 0 ? (
            reversedVoteHistory.map((item) => (
              <article key={item.id} className="ordinary-history-item ordinary-history-vote-item">
                <div className="ordinary-history-item-head">
                  <span>D{item.day}</span>
                  <strong>{item.title}</strong>
                </div>
                <p>{item.summary}</p>
                {item.detailLines.length > 0 && (
                  <div className="ordinary-history-detail-lines">
                    {item.detailLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="ordinary-history-empty">暂无公开投票记录</div>
          )}
        </div>
      </section>
    </div>
  );

  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}

function buildOrdinarySpeechHistory(game: HumanGameView): OrdinarySpeechHistoryItem[] {
  const bySeq = new Map<number, OrdinarySpeechHistoryItem>();

  game.tableSummary.recentSpeeches.forEach((speech) => {
    bySeq.set(speech.seq, {
      seq: speech.seq,
      day: speech.day,
      speakerLabel: speech.speaker ? formatSeatLabel(speech.speaker) : "未知发言者",
      message: speech.message,
      kind: "speech",
    });
  });

  game.publicEvents.forEach((event) => {
    if (event.type !== "SPEECH_CREATED" && event.type !== "LAST_WORDS_CREATED") return;
    const seatId = readHistoryPayloadNumber(event.payload, "seatId") ?? event.actorSeatId;
    const speaker = typeof seatId === "number" ? game.seats.find((seat) => seat.seatId === seatId) : undefined;
    const message = readHistoryPayloadString(event.payload, "message") ?? event.message;
    if (!message.trim()) return;
    bySeq.set(event.seq, {
      seq: event.seq,
      day: event.day,
      speakerLabel: speaker ? formatSeatLabel(speaker) : "未知发言者",
      message,
      kind: event.type === "LAST_WORDS_CREATED" ? "lastWords" : "speech",
    });
  });

  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

function buildOrdinaryVoteHistory(game: HumanGameView): OrdinaryVoteHistoryItem[] {
  const rows = new Map<string, OrdinaryVoteHistoryItem>();

  game.tableSummary.tableMemory.voteHistory.forEach((vote, index) => {
    const key = `exile-${vote.day}`;
    const tallyText = formatTally(vote.tally);
    const resolution = vote.exiled
      ? `放逐 ${formatSeatLabel(vote.exiled)}`
      : vote.tiedSeatIds.length > 0
        ? `平票：${vote.tiedSeatIds.map((seatId) => `${seatId}号`).join("、")}，无人出局`
        : vote.leaders.length > 0
          ? `最高票：${vote.leaders.map(formatSeatLabel).join("、")}`
          : "无人出局";
    rows.set(key, {
      id: `${key}-${index}`,
      day: vote.day,
      title: `D${vote.day} 放逐投票`,
      summary: tallyText || "暂无有效票",
      detailLines: [resolution],
    });
  });

  mergeVoteSnapshotRow(rows, buildVoteSnapshotHistoryItem(game, game.tableSummary.voteSnapshot, "exile"));
  if (game.tableSummary.sheriffVoteSnapshot) {
    mergeVoteSnapshotRow(rows, buildVoteSnapshotHistoryItem(game, game.tableSummary.sheriffVoteSnapshot, "sheriff"));
  }

  return [...rows.values()].sort((a, b) => a.day - b.day || a.title.localeCompare(b.title, "zh-Hans-CN"));
}

function buildVoteSnapshotHistoryItem(
  game: HumanGameView,
  snapshot: HumanGameView["tableSummary"]["voteSnapshot"],
  kind: "exile" | "sheriff",
): OrdinaryVoteHistoryItem | undefined {
  if (!snapshot.revealed && snapshot.votes.length === 0 && snapshot.tally.length === 0) return undefined;
  const day = snapshot.votes[0]?.day ?? game.tableSummary.tableMemory.voteHistory.at(-1)?.day ?? game.day;
  const tallyText = formatTally(snapshot.tally);
  const detailLines = snapshot.votes.map((vote) => {
    const target = vote.target ? formatSeatLabel(vote.target) : "弃票";
    return `${formatSeatLabel(vote.voter)} → ${target}${vote.reason ? `：${vote.reason}` : ""}`;
  });
  if (snapshot.abstainCount) detailLines.push(`弃票 ${snapshot.abstainCount} 票`);
  if (snapshot.leaders.length > 0) {
    detailLines.push(`${kind === "sheriff" ? "警长票最高" : "最高票"}：${snapshot.leaders.map(formatSeatLabel).join("、")}`);
  }

  return {
    id: `${kind}-${day}-snapshot`,
    day,
    title: kind === "sheriff" ? `D${day} 警长投票` : `D${day} 放逐投票`,
    summary: tallyText || (snapshot.abstainCount ? `弃票 ${snapshot.abstainCount} 票` : "暂无有效票"),
    detailLines,
  };
}

function mergeVoteSnapshotRow(rows: Map<string, OrdinaryVoteHistoryItem>, row: OrdinaryVoteHistoryItem | undefined): void {
  if (!row) return;
  const key = row.title.includes("警长") ? `sheriff-${row.day}` : `exile-${row.day}`;
  const existing = rows.get(key);
  if (!existing) {
    rows.set(key, row);
    return;
  }
  rows.set(key, {
    ...existing,
    detailLines: [...row.detailLines, ...existing.detailLines].filter((line, index, lines) => lines.indexOf(line) === index),
  });
}

function formatTally(tally: Array<{ target: { seatId: number; name?: string }; count: number }>): string {
  return tally.map((item) => `${formatSeatLabel(item.target)} ${item.count}票`).join("，");
}

function formatSeatLabel(seat: { seatId: number; name?: string }): string {
  return seat.name ? `${seat.seatId}号 ${seat.name}` : `${seat.seatId}号`;
}

function readHistoryPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function readHistoryPayloadNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

function subscribeOrdinarySurfaceMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mediaQuery = window.matchMedia(ORDINARY_DESKTOP_SURFACE_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getOrdinarySurfaceModeSnapshot(): OrdinarySurfaceMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "both";
  return window.matchMedia(ORDINARY_DESKTOP_SURFACE_QUERY).matches ? "desktop" : "mobile";
}

function shouldShowOrdinaryVotePanel(game: HumanGameView): boolean {
  if (game.phase === "DAY_VOTE" || game.phase === "SHERIFF_VOTE" || game.phase === "SHERIFF_PK_VOTE") return true;
  const voteSnapshot = game.tableSummary.voteSnapshot;
  const sheriffVoteSnapshot = game.tableSummary.sheriffVoteSnapshot;
  return Boolean(
    voteSnapshot.revealed ||
      voteSnapshot.votes.length > 0 ||
      voteSnapshot.tally.length > 0 ||
      sheriffVoteSnapshot?.revealed ||
      sheriffVoteSnapshot?.votes.length ||
      sheriffVoteSnapshot?.tally.length,
  );
}

function getOrdinarySurfaceModeServerSnapshot(): OrdinarySurfaceMode {
  return "both";
}
