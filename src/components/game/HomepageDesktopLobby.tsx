"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { AiRuntimeMode } from "@/game/types";
import type { AiLineupPreviewItem, BoardOption, HumanSeatMode } from "./clientTypes";
import { CLASS_TRIAL_AI_RUNTIME_LABEL, type ClassTrialThemeMode } from "./classTrialTheme";
import { buildHomepageBoardCards } from "./homepageBoardModel";
import { getLineupAvatarImage } from "./LandingRailCards";

const HOMEPAGE_ANNOUNCEMENTS = [
  {
    tone: "green",
    title: "【公告】桌面大厅视觉版正在试运行",
    body: "首页已集中推荐开局、牌桌预览、AI 角色池和最近对局。若发现布局拥挤或头像遮挡，可以继续反馈具体截图。",
    meta: "今天 18:30",
  },
  {
    tone: "green",
    title: "【通知】AI 池支持本地自定义角色",
    body: "自定义模型、昵称和头像只保存在当前浏览器本地。进入牌桌前会自动补齐缺少的 AI 座位。",
    meta: "1 天前 12:00",
  },
  {
    tone: "blue",
    title: "【限时】学级裁判主题局为本地试玩入口",
    body: "将主题素材放入 local-assets/class-trial-pack 后，首页会显示素材就绪状态。该主题不会进入公网房间。",
    meta: "3 天前 20:00",
  },
] as const;

function getSelectedBoard(boards: BoardOption[], selectedBoardId: string | null): BoardOption | undefined {
  return selectedBoardId ? boards.find((board) => board.id === selectedBoardId) : undefined;
}

function getHumanModeLabel(mode: HumanSeatMode, selectedHumanSeatId: number | null): string {
  if (mode === "none") return "纯 AI 观战";
  if (selectedHumanSeatId) return `${selectedHumanSeatId}号真人`;
  return "随机真人座位";
}

function getSeatRoleLabel(lineup: AiLineupPreviewItem | undefined): string {
  if (!lineup) return "AI";
  if (lineup.isHuman) return "你";
  return lineup.personaName ?? "AI";
}

function getBoardTag(board: BoardOption): string {
  if (board.seatCount <= 6) return "快速上手";
  if (board.id.includes("white-wolf-king") || board.id.includes("wolf-beauty")) return "高压进阶";
  if (board.id.includes("sheriff")) return "警长竞选";
  return "标准阵容";
}

export function HomepageDesktopLobby({
  loading,
  boards,
  selectedBoardId,
  onSelectBoard,
  humanSeatMode,
  selectedHumanSeatId,
  onSelectRandomHumanSeat,
  onSelectFixedHumanSeat,
  onSelectNoHumanSeat,
  selectedAiFriendCount,
  customAiFriendCount,
  aiLineupPreview,
  recentGameIds,
  onLoadGame,
  onStartGame,
  onOpenIdentityBook = () => undefined,
  onOpenGlossary = () => undefined,
  classTrialThemeMode = "default",
  classTrialAiRuntimeMode = "mock",
  classTrialPackAvailable = false,
  classTrialPackMessage = "未找到本地主题素材包。",
  classTrialIntroMessage,
  onSelectClassTrialThemeMode = () => undefined,
}: {
  loading: boolean;
  boards: BoardOption[];
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  humanSeatMode: HumanSeatMode;
  selectedHumanSeatId: number | null;
  onSelectRandomHumanSeat: () => void;
  onSelectFixedHumanSeat: (seatId: number) => void;
  onSelectNoHumanSeat: () => void;
  selectedAiFriendCount: number;
  customAiFriendCount: number;
  aiLineupPreview: AiLineupPreviewItem[];
  recentGameIds: string[];
  onLoadGame: (gameId: string) => Promise<void>;
  onStartGame: () => Promise<void>;
  onOpenIdentityBook?: () => void;
  onOpenGlossary?: () => void;
  classTrialThemeMode?: ClassTrialThemeMode;
  classTrialAiRuntimeMode?: AiRuntimeMode;
  classTrialPackAvailable?: boolean;
  classTrialPackMessage?: string;
  classTrialIntroMessage?: string;
  onSelectClassTrialThemeMode?: (mode: ClassTrialThemeMode) => void;
}) {
  const [allBoardsOpen, setAllBoardsOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const selectedBoard = getSelectedBoard(boards, selectedBoardId);
  const recommendedCards = buildHomepageBoardCards(boards);
  const humanModeLabel = getHumanModeLabel(humanSeatMode, selectedHumanSeatId);
  const classTrialAiRuntimeLabel = classTrialAiRuntimeMode === "llm" ? `${CLASS_TRIAL_AI_RUNTIME_LABEL} 主脑` : "Mock 试玩";
  const visibleSeats = selectedBoard ? Array.from({ length: selectedBoard.seatCount }, (_, index) => index + 1) : [];
  const lineupBySeat = new Map(aiLineupPreview.map((item) => [item.seatId, item]));
  const visibleAiFriends = aiLineupPreview.filter((item) => !item.isHuman);
  const requiredAiFriendCount = selectedBoard ? Math.max(0, selectedBoard.seatCount - (humanSeatMode === "none" ? 0 : 1)) : selectedAiFriendCount;
  const tableAiFriendCount = visibleAiFriends.length > 0 ? visibleAiFriends.length : Math.min(selectedAiFriendCount, requiredAiFriendCount);

  const selectBoardFromModal = (boardId: string) => {
    onSelectBoard(boardId);
    setAllBoardsOpen(false);
  };

  return (
    <section className="homepage-game-lobby" aria-label="AI 狼人杀桌面游戏大厅">
      <header className="homepage-lobby-topbar">
        <div className="homepage-lobby-brand">
          <span className="homepage-lobby-mark" aria-hidden="true">狼</span>
          <div>
            <div className="homepage-lobby-title">AI 狼人杀</div>
            <div className="homepage-lobby-subtitle">AI WEREWOLF</div>
          </div>
        </div>
        <nav className="homepage-lobby-nav" aria-label="首页功能入口">
          <span className="homepage-nav-current">
            <img src="/icons/ant-home-filled.svg" alt="" aria-hidden="true" draggable={false} />
            首页
          </span>
          <Link href="/rooms">
            <img src="/icons/ant-team-outlined.svg" alt="" aria-hidden="true" draggable={false} />
            房间
          </Link>
          <button type="button" onClick={onOpenIdentityBook}>
            <img src="/icons/ant-book-outlined.svg" alt="" aria-hidden="true" draggable={false} />
            角色书
          </button>
          <button type="button" onClick={onOpenGlossary}>
            <img src="/icons/ant-question-circle-outlined.svg" alt="" aria-hidden="true" draggable={false} />
            术语
          </button>
        </nav>
        <div className="homepage-lobby-status">
          <button
            type="button"
            className="homepage-announcement-trigger"
            aria-label="打开系统公告"
            onClick={() => setAnnouncementOpen(true)}
          >
            <img src="/icons/ant-bell-outlined.svg" alt="" aria-hidden="true" draggable={false} />
          </button>
          <span>{selectedBoard ? `${selectedBoard.seatCount}人局` : "待选板子"}</span>
          <span>{humanModeLabel}</span>
        </div>
      </header>

      <div className="homepage-lobby-grid">
        <section className="homepage-lobby-left" aria-label="选择牌板">
          <div className="homepage-section-heading">
            <div>
              <span>选择牌板</span>
              <h2>推荐开局</h2>
            </div>
            <button type="button" onClick={() => setAllBoardsOpen(true)} className="homepage-link-button">
              查看更多
            </button>
          </div>

          <div className="homepage-board-card-grid">
            {recommendedCards.map((card) => {
              const selected = card.board.id === selectedBoardId;
              return (
                <button
                  key={card.board.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectBoard(card.board.id)}
                  className={["homepage-board-card", selected ? "homepage-board-card-selected" : ""].filter(Boolean).join(" ")}
                  style={{ backgroundImage: `url(${card.art.src})` }}
                >
                  <span className="homepage-board-card-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                  <span className="homepage-board-card-copy">
                    <strong>{card.displayTitle}</strong>
                    <small>{card.displaySubtitle}</small>
                  </span>
                  <span className="homepage-board-card-badge">{card.badge}</span>
                </button>
              );
            })}
          </div>

          {selectedBoard && (
            <section className="homepage-board-summary-strip" aria-label="当前板子摘要">
              <span>{selectedBoard.seatCount}人局</span>
              <span>{getBoardTag(selectedBoard)}</span>
              <span>{selectedBoard.seatCount <= 6 ? "新手友好" : "进阶配置"}</span>
              <span>平衡推荐</span>
              <p>{selectedBoard.description}</p>
            </section>
          )}

          <section className="homepage-current-panel" aria-label="当前选择">
            <div className="homepage-current-header">
              <span>当前选择</span>
              <em>配置有效</em>
            </div>
            <div className="homepage-current-detail-grid">
              <div className="homepage-selected-board-card">
                <span
                  className="homepage-selected-board-thumb"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${recommendedCards.find((card) => card.board.id === selectedBoard?.id)?.art.src ?? "/images/home-board-6p-beginner-seer.png"})` }}
                />
                <div>
                  <span>已选牌板</span>
                  <strong>{selectedBoard?.name ?? "待选板子"}</strong>
                  <small>{selectedBoard?.roleSummary ?? "先选择一个板子"}</small>
                </div>
              </div>
              <div className="homepage-selected-human-card">
                <span>你的人类座位</span>
                <strong>{humanModeLabel}</strong>
                <small>{humanSeatMode === "none" ? "本局全 AI 自动推进" : "可点击下方座位切换"}</small>
                <div className="homepage-current-actions">
                  <button type="button" onClick={onSelectRandomHumanSeat} className={humanSeatMode === "random" ? "homepage-mini-action-active" : ""}>
                    真人模式
                  </button>
                  <button type="button" onClick={onSelectNoHumanSeat} className={humanSeatMode === "none" ? "homepage-mini-action-active" : ""}>
                    纯 AI
                  </button>
                </div>
              </div>
              <div className="homepage-selected-ai-card">
                <span>AI 阵容</span>
                <strong>{tableAiFriendCount}/{requiredAiFriendCount}</strong>
                <small>不足座位由默认 AI 自动补齐</small>
                <div className="homepage-selected-role-row">
                  {visibleAiFriends.slice(0, 4).map((friend, index) => (
                    <em key={`${friend.seatId}-${friend.nickname}`}>{index + 1}</em>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="homepage-seat-preview-panel" aria-label="左侧座位预览">
            <div className="homepage-current-header">
              <span>座位预览</span>
              <em>{visibleSeats.length} 人</em>
            </div>
            <div className="homepage-left-seat-row">
              {visibleSeats.map((seatId) => {
                const seat = lineupBySeat.get(seatId);
                return (
                  <button
                    key={seatId}
                    type="button"
                    onClick={() => onSelectFixedHumanSeat(seatId)}
                    className={seat?.isHuman || selectedHumanSeatId === seatId ? "homepage-left-seat-active" : ""}
                  >
                    <span>{seatId}</span>
                    <small>{getSeatRoleLabel(seat)}</small>
                  </button>
                );
              })}
            </div>
            <p>提示：点击座位可以切换你的人类角色</p>
          </section>

          <section className="homepage-theme-panel" aria-label="本地主题">
            <div>
              <span>Local Theme</span>
              <strong>学级裁判主题局</strong>
              <p>{classTrialPackMessage}</p>
              {classTrialIntroMessage && <p>{classTrialIntroMessage}</p>}
            </div>
            <div className="homepage-theme-actions">
              <span>{classTrialAiRuntimeLabel}</span>
              <button
                type="button"
                aria-pressed={classTrialThemeMode === "default"}
                onClick={() => onSelectClassTrialThemeMode("default")}
                className={classTrialThemeMode === "default" ? "homepage-mini-action-active" : ""}
              >
                默认狼人杀
              </button>
              <button
                type="button"
                aria-pressed={classTrialThemeMode === "class-trial"}
                onClick={() => onSelectClassTrialThemeMode("class-trial")}
                className={classTrialThemeMode === "class-trial" ? "homepage-mini-action-active" : ""}
              >
                学级裁判
              </button>
              <span className={classTrialPackAvailable ? "homepage-theme-ready" : "homepage-theme-missing"}>
                {classTrialPackAvailable ? "素材已就绪" : "素材未就绪"}
              </span>
            </div>
          </section>
        </section>

        <section className="homepage-table-preview" aria-label="牌桌预览">
          <div className="homepage-table-scene">
            <div className="homepage-seat-orbit" aria-label={selectedBoard ? `${selectedBoard.seatCount}人座位预览` : "座位预览"}>
              {visibleSeats.map((seatId, index) => {
                const seat = lineupBySeat.get(seatId);
                const avatarImage = seat && !seat.isHuman ? getLineupAvatarImage(seat) : undefined;
                return (
                  <button
                    key={seatId}
                    type="button"
                    onClick={() => onSelectFixedHumanSeat(seatId)}
                    className={[
                      "homepage-seat-token",
                      seat?.isHuman || (humanSeatMode !== "none" && selectedHumanSeatId === seatId) ? "homepage-seat-human" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      "--seat-angle": `${(360 / Math.max(1, visibleSeats.length)) * index}deg`,
                      backgroundImage: avatarImage ? `url(${avatarImage})` : undefined,
                    } as CSSProperties}
                    aria-label={`选择 ${seatId} 号真人座位`}
                  >
                    <span>{seatId}</span>
                    <small>{getSeatRoleLabel(seat)}</small>
                  </button>
                );
              })}
            </div>
            <div className="homepage-table-core">
              <span>BOARD PREVIEW</span>
              <strong>{selectedBoard?.name ?? "待选板子"}</strong>
              <small>{humanModeLabel} · {tableAiFriendCount} 位 AI 入局</small>
            </div>
          </div>
          <div className="homepage-round-settings">
            <span>夜晚发言 120秒</span>
            <span>发言时间 90秒</span>
            <span>投票时间 60秒</span>
          </div>
          <div className="homepage-primary-actions">
            <Link href="/rooms" className="homepage-secondary-cta">进入联机房间</Link>
            <button type="button" onClick={onStartGame} disabled={loading || !selectedBoardId} className="homepage-primary-cta">
              {loading ? "创建中" : "进入牌桌"}
            </button>
          </div>
          <p className="homepage-ready-note">准备就绪，开始游戏</p>
        </section>

        <aside className="homepage-lobby-rail" aria-label="AI 和最近对局">
          <section className="homepage-rail-card">
            <div className="homepage-rail-title">
              <h2>AI 角色池</h2>
              <span>{tableAiFriendCount} / {requiredAiFriendCount}</span>
            </div>
            <div className="homepage-ai-list">
              {visibleAiFriends.slice(0, 8).map((friend) => {
                const avatarImage = getLineupAvatarImage(friend);
                return (
                  <div key={`${friend.seatId}-${friend.nickname}`} className="homepage-ai-row">
                    <span className="homepage-ai-avatar" style={{ backgroundImage: avatarImage ? `url(${avatarImage})` : undefined }}>
                      {!avatarImage ? friend.seatId : ""}
                    </span>
                    <span>
                      <strong>{friend.nickname}</strong>
                      <small>{friend.modelLabel ?? friend.personaName ?? "默认 AI"}</small>
                    </span>
                    <em>{friend.autoFilled ? "补齐" : "可用"}</em>
                  </div>
                );
              })}
            </div>
            <Link href="/ai-pool" className="homepage-rail-action">打开 AI池 · {customAiFriendCount} 自定义</Link>
          </section>

          <section className="homepage-rail-card">
            <div className="homepage-rail-title">
              <h2>最近对局</h2>
              <span>最多 5 局</span>
            </div>
            {recentGameIds.length === 0 ? (
              <div className="homepage-empty-history">暂无本地记录</div>
            ) : (
              <div className="homepage-history-list">
                {recentGameIds.map((gameId, index) => (
                  <button key={gameId} type="button" disabled={loading} onClick={() => void onLoadGame(gameId)}>
                    <strong>{index === 0 ? "继续上一局" : "查看最近终局"}</strong>
                    <span>{gameId.slice(0, 8)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {announcementOpen && (
        <div className="homepage-announcement-overlay" role="dialog" aria-modal="true" aria-labelledby="homepage-announcement-title">
          <button
            type="button"
            className="homepage-announcement-backdrop"
            aria-label="关闭系统公告"
            onClick={() => setAnnouncementOpen(false)}
          />
          <section className="homepage-announcement-dialog">
            <header className="homepage-announcement-header">
              <div>
                <span>Notice Center</span>
                <h2 id="homepage-announcement-title">系统公告</h2>
              </div>
              <div className="homepage-announcement-tabs" aria-label="公告分类">
                <span>通知</span>
                <strong>系统公告</strong>
                <button type="button" aria-label="关闭系统公告" onClick={() => setAnnouncementOpen(false)}>
                  ×
                </button>
              </div>
            </header>
            <div className="homepage-announcement-list">
              {HOMEPAGE_ANNOUNCEMENTS.map((announcement) => (
                <article key={announcement.title} className={`homepage-announcement-item homepage-announcement-${announcement.tone}`}>
                  <span aria-hidden="true" />
                  <div>
                    <h3>{announcement.title}</h3>
                    <p>{announcement.body}</p>
                    <time>{announcement.meta}</time>
                  </div>
                </article>
              ))}
            </div>
            <footer className="homepage-announcement-footer">
              <button type="button" onClick={() => setAnnouncementOpen(false)}>今日关闭</button>
              <button type="button" onClick={() => setAnnouncementOpen(false)}>关闭公告</button>
            </footer>
          </section>
        </div>
      )}

      {allBoardsOpen && (
        <div className="homepage-board-modal" role="dialog" aria-modal="true" aria-label="全部板子">
          <button type="button" className="homepage-board-modal-backdrop" aria-label="关闭全部板子" onClick={() => setAllBoardsOpen(false)} />
          <section className="homepage-board-modal-panel">
            <div className="homepage-board-modal-header">
              <div>
                <span>全部板子</span>
                <h2>选择本局配置</h2>
              </div>
              <button type="button" onClick={() => setAllBoardsOpen(false)}>关闭</button>
            </div>
            <div className="homepage-board-modal-list">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  aria-pressed={board.id === selectedBoardId}
                  onClick={() => selectBoardFromModal(board.id)}
                  className={board.id === selectedBoardId ? "homepage-board-modal-selected" : ""}
                >
                  <strong>{board.name}</strong>
                  <span>{board.seatCount}人 · {getBoardTag(board)}</span>
                  <small>{board.roleSummary}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
