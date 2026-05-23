import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { checkRoomMetricsAccess } from "@/server/roomMetricsAccess";
import type { RoomMetricsSnapshot } from "@/server/roomService";
import { getRoomMetricsSnapshot } from "@/server/roomService";

export const metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "数据面板 | AI 狼人杀",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminMetricsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PrimaryMetric = {
  accent: string;
  detail: string;
  label: string;
  tone: string;
  value: number | string;
};

type FunnelStep = {
  label: string;
  note: string;
  value: number;
};

type SignalMetric = {
  color: string;
  label: string;
  value: number;
};

type RoomStatusSignal = {
  color: string;
  label: string;
  value: number;
};

export default async function AdminMetricsPage({ searchParams }: AdminMetricsPageProps) {
  const params = await searchParams;
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const access = checkRoomMetricsAccess(token);
  if (!access.allowed) notFound();

  const metrics = await getRoomMetricsSnapshot();
  const siteGamesStarted = metrics.history.mainGamesStarted + metrics.history.gamesStarted;
  const siteGamesFinished = metrics.history.mainGamesFinished + metrics.history.gamesFinished;
  const siteCompletionRate = metrics.history.siteCompletionRate;
  const mainPendingGames = Math.max(0, metrics.history.mainGamesStarted - metrics.history.mainGamesFinished);
  const roomPendingGames = Math.max(0, metrics.history.gamesStarted - metrics.history.gamesFinished);
  const sitePendingGames = Math.max(0, siteGamesStarted - siteGamesFinished);
  const primaryMetrics: PrimaryMetric[] = [
    {
      accent: "#76e4a4",
      detail: "用户打开主界面的次数",
      label: "首页打开",
      tone: "from-[#0f3727] to-[#12231d]",
      value: metrics.history.homeViews,
    },
    {
      accent: "#79b7ff",
      detail: `主界面 ${metrics.history.mainGamesStarted} / 联机房间 ${metrics.history.gamesStarted}`,
      label: "全站开局",
      tone: "from-[#102b4a] to-[#111f31]",
      value: siteGamesStarted,
    },
    {
      accent: "#f2c56f",
      detail: `完成率 ${formatPercent(siteCompletionRate)}；主界面 ${metrics.history.mainGamesFinished} / 联机房间 ${metrics.history.gamesFinished}`,
      label: "全站完局",
      tone: "from-[#4a3514] to-[#261f14]",
      value: siteGamesFinished,
    },
    {
      accent: "#f27e6f",
      detail: `主界面 ${mainPendingGames} / 联机房间 ${roomPendingGames}；用于观察开局后流失`,
      label: "待完成局",
      tone: "from-[#4a1d19] to-[#251817]",
      value: sitePendingGames,
    },
  ];
  const mainFunnelSteps: FunnelStep[] = [
    { label: "打开", note: "Home View", value: metrics.history.homeViews },
    { label: "开局", note: "Main Game Started", value: metrics.history.mainGamesStarted },
    { label: "完局", note: "Main Game Finished", value: metrics.history.mainGamesFinished },
  ];
  const roomFunnelSteps: FunnelStep[] = [
    { label: "打开", note: "/rooms View", value: metrics.history.roomPageViews },
    { label: "建房", note: "Room Created", value: metrics.history.totalRoomsEver },
    { label: "加入", note: "Room Players", value: metrics.history.totalPlayersEver },
    { label: "开局", note: "Room Started", value: metrics.history.gamesStarted },
    { label: "发言", note: "Speech", value: metrics.history.roomsReachedSpeech },
    { label: "投票", note: "Vote", value: metrics.history.roomsReachedVote },
    { label: "票决", note: "Resolved", value: metrics.history.roomsResolvedVote },
    { label: "完局", note: "Finished", value: metrics.history.gamesFinished },
    { label: "恢复", note: "Restored", value: metrics.history.roomRecoveriesRestored },
  ];
  const roomStatusTotal = Math.max(1, metrics.current.rooms.total);
  const activeRoomTotal = Math.max(1, metrics.current.rooms.activeInGame);
  const signalMetrics: SignalMetric[] = [
    { color: "#76e4a4", label: "全站完局", value: siteCompletionRate ?? 0 },
    { color: "#79b7ff", label: "主界面", value: metrics.history.mainCompletionRate ?? 0 },
    { color: "#f2c56f", label: "联机完局", value: metrics.history.roomCompletionRate ?? 0 },
    {
      color: "#f27e6f",
      label: "待完成",
      value: siteGamesStarted > 0 ? Math.round((sitePendingGames / siteGamesStarted) * 100) : 0,
    },
    {
      color: "#a6b2ff",
      label: "活跃房间",
      value: Math.round((metrics.current.rooms.activeInGame / roomStatusTotal) * 100),
    },
  ];
  const roomStatusSignals: RoomStatusSignal[] = [
    { color: "#76e4a4", label: "大厅", value: metrics.current.rooms.lobby },
    { color: "#f2c56f", label: "进行中", value: metrics.current.rooms.activeInGame },
    { color: "#f27e6f", label: "疑似流失", value: metrics.current.rooms.inactiveInGame },
    { color: "#8f9a90", label: "待清理", value: metrics.current.rooms.finished },
  ];
  const historicalScopeCopy =
    metrics.history.adapter === "postgres"
      ? "共享历史指标：打开、开局、房间发言/投票里程碑、完局和趋势会按同一个 PostgreSQL 指标库合计，可用于汇总 Render 和腾讯云的匿名使用情况。"
      : "本进程历史指标：当前未连接 PostgreSQL 指标库，统计只来自本服务进程，重启后内存统计会清空。";
  const liveScopeCopy =
    "本机实时状态：大厅、进行中、疑似流失和待清理房间来自当前服务实例，不代表腾讯云实时房间总量。";

  return (
    <main className="metrics-dashboard min-h-screen overflow-hidden bg-[#070a0f] text-[#edf3ea]">
      <div className="metrics-bg-grid pointer-events-none fixed inset-0" />
      <div className="metrics-bg-scan pointer-events-none fixed inset-0" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 border-b border-white/10 pb-5 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#76e4a4]/30 bg-[#10271d] px-3 py-1 text-xs font-black uppercase tracking-normal text-[#a9f4bf]">
                Owner Only
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-[#aeb8ad]">
                {formatAnalyticsAdapter(metrics.history.adapter)}
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl">
              AI 狼人杀运营驾驶舱
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aeb8ad]">
              私有数据面板，统计主界面打开、主界面开局/完局、联机房间打开/创建/加入/开局/发言/投票/完局、完局时长和恢复使用；不记录 IP。{historicalScopeCopy}
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#8f9a90]">{liveScopeCopy}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-[#7f8a7f]">Live Snapshot</p>
                <p className="mt-1 text-sm font-bold text-white">{formatDateTime(metrics.checkedAt)}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#76e4a4]/25 bg-[#10271d] px-3 py-1 text-xs font-black text-[#a9f4bf]">
                <span className="h-2 w-2 rounded-full bg-[#76e4a4] shadow-[0_0_18px_rgba(118,228,164,0.85)]" />
                运营快照
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <MiniHeaderStat label="本机大厅" value={metrics.current.rooms.lobby} />
              <MiniHeaderStat label="本机进行中" value={metrics.current.rooms.activeInGame} />
              <MiniHeaderStat label="本机疑似流失" value={metrics.current.rooms.inactiveInGame} />
              <MiniHeaderStat label="本机待清理" value={metrics.current.rooms.finished} />
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((item) => (
            <HeroMetricCard key={item.label} metric={item} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
          <GlassPanel title="运营态势雷达" kicker="Signal Radar">
            <OperationsRadar metrics={signalMetrics} />
          </GlassPanel>

          <GlassPanel title="本机实时房间光谱" kicker="Local Room Spectrum">
            <RoomSpectrum signals={roomStatusSignals} total={roomStatusTotal} />
          </GlassPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <GlassPanel title="完成缺口" kicker="Completion Gap">
            <div className="grid gap-4 sm:grid-cols-[190px_1fr] xl:grid-cols-1">
              <CompletionGauge percent={siteCompletionRate ?? 0} value={formatPercent(siteCompletionRate)} />
              <div className="space-y-3">
                <ProgressRow
                  color="#76e4a4"
                  label="全站开局"
                  max={Math.max(1, siteGamesStarted)}
                  value={siteGamesStarted}
                />
                <ProgressRow
                  color="#f2c56f"
                  label="全站完局"
                  max={Math.max(1, siteGamesStarted)}
                  value={siteGamesFinished}
                />
                <ProgressRow
                  color="#f27e6f"
                  label="待完成局"
                  max={Math.max(1, siteGamesStarted)}
                  value={sitePendingGames}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <InsightTile label="全站累计时长" value={formatMinutes(metrics.history.totalSiteGameMinutes)} />
                <InsightTile label="全站平均完局" value={formatMinutes(metrics.history.averageSiteGameMinutes)} />
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="可用日期趋势" kicker="Daily Activity">
            <RecentDaysChart metrics={metrics} />
          </GlassPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <GlassPanel title="主界面单人模式" kicker="Main Experience">
            <Funnel steps={mainFunnelSteps} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <InsightTile label="主界面累计时长" value={formatMinutes(metrics.history.totalMainGameMinutes)} />
              <InsightTile label="主界面平均完局" value={formatMinutes(metrics.history.averageMainGameMinutes)} />
              <InsightTile label="主界面完局率" value={formatPercent(metrics.history.mainCompletionRate)} />
            </div>
          </GlassPanel>

          <GlassPanel title="联机房间模式" kicker="Rooms Experience">
            <Funnel steps={roomFunnelSteps} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <InsightTile label="累计房间" value={metrics.history.totalRoomsEver} />
              <InsightTile label="累计联机玩家" value={metrics.history.totalPlayersEver} />
              <InsightTile label="累计房间时长" value={formatMinutes(metrics.history.totalRoomGameMinutes)} />
              <InsightTile label="平均房间完局" value={formatMinutes(metrics.history.averageFinishedGameMinutes)} />
              <InsightTile label="联机完局率" value={formatPercent(metrics.history.roomCompletionRate)} />
              <InsightTile label="联机待完成" value={roomPendingGames} />
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <GlassPanel title="本机房间状态和风险" kicker="Local Current Rooms">
            <div className="space-y-4">
              <RoomStatusBar
                color="#76e4a4"
                label="大厅中"
                percent={Math.round((metrics.current.rooms.lobby / roomStatusTotal) * 100)}
                value={metrics.current.rooms.lobby}
              />
              <RoomStatusBar
                color="#f2c56f"
                label="进行中房间"
                percent={Math.round((metrics.current.rooms.activeInGame / roomStatusTotal) * 100)}
                value={metrics.current.rooms.activeInGame}
              />
              <RoomStatusBar
                color="#f27e6f"
                label="无人在线的进行中房间"
                percent={Math.round((metrics.current.rooms.inactiveInGame / activeRoomTotal) * 100)}
                value={metrics.current.rooms.inactiveInGame}
              />
              <RoomStatusBar
                color="#8f9a90"
                label="已结束待清理房间"
                percent={Math.round((metrics.current.rooms.finished / roomStatusTotal) * 100)}
                value={metrics.current.rooms.finished}
              />
              <div className="rounded-lg border border-white/10 bg-[#0c1119] p-4">
                <p className="text-xs font-black uppercase tracking-normal text-[#7f8a7f]">Tracked Since</p>
                <p className="mt-2 text-xl font-black text-white">
                  {metrics.history.trackedSince ? formatDate(metrics.history.trackedSince) : "暂无"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#8f9a90]">历史累计从数据面板部署后的第一条房间事件开始。</p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="数据口径" kicker="Definitions">
            <div className="grid gap-3 text-sm leading-6 text-[#c6d0c2]">
              <MetricDefinition label="共享历史指标" text={historicalScopeCopy} />
              <MetricDefinition label="本机实时状态" text={liveScopeCopy} />
              <MetricDefinition label="首页打开" text="用户加载主界面 / 的次数，刷新也会计入。" />
              <MetricDefinition label="主界面开局" text="用户在主界面点击新开一局并成功创建单人/纯 AI 对局。" />
              <MetricDefinition label="主界面完局" text="主界面对局产生胜负结果。" />
              <MetricDefinition label="主界面时长" text="从主界面开局到产生胜负结果之间的累计和平均用时。" />
              <MetricDefinition label="联机房间时长" text="累计值包含已完局房间时长和进行中房间的可观测运行时长；无人在线房间只算到最后一次房间更新或玩家可见时间。" />
              <MetricDefinition label="全站累计时长" text="主界面完局时长 + 联机累计房间时长；不会把无人在线房间的保留等待时间继续当作游戏时长。" />
              <MetricDefinition label="全站开局" text="主界面单人/纯 AI 开局 + 联机房间开局。顶部总数用这个口径。" />
              <MetricDefinition label="联机房间漏斗" text="/rooms 打开、建房、加入、开局、发言、投票、票决、完局和恢复里程碑，用于定位 Alpha 流程卡点。" />
              <MetricDefinition label="待完成局" text="已开局但尚未记录完局的局数，主要用于观察中途流失或等待房主继续推进。" />
              <MetricDefinition label="进行中房间" text="房间已经开局且尚未产生胜负；即使玩家离开，房间也会保留到清理时间。" />
              <MetricDefinition label="无人在线的进行中房间" text="已经开局、未完局、且当前没有任何 presence 连接的房间，比实时连接数更适合判断疑似流失。" />
            </div>
          </GlassPanel>
        </section>
      </div>
    </main>
  );
}

function MiniHeaderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-mini-tile rounded-md border border-white/10 bg-black/20 px-2 py-3">
      <div className="text-xl font-black text-white tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-bold text-[#8f9a90]">{label}</div>
    </div>
  );
}

function HeroMetricCard({ metric }: { metric: PrimaryMetric }) {
  return (
    <article className={`metric-hero-card relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${metric.tone} p-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)]`}>
      <div className="metric-card-sheen" />
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: metric.accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-[#aeb8ad]">{metric.label}</p>
          <div className="mt-3 text-4xl font-black leading-none tracking-normal text-white tabular-nums">{metric.value}</div>
        </div>
        <span
          className="metric-orbit-dot mt-1 h-3 w-3 rounded-full"
          style={{ backgroundColor: metric.accent, boxShadow: `0 0 22px ${metric.accent}` }}
        />
      </div>
      <MetricSparkline color={metric.accent} seed={typeof metric.value === "number" ? metric.value : metric.label.length} />
      <p className="mt-4 min-h-10 text-xs leading-5 text-[#c6d0c2]">{metric.detail}</p>
    </article>
  );
}

function GlassPanel({ children, kicker, title }: { children: ReactNode; kicker: string; title: string }) {
  return (
    <section className="metrics-glass-panel rounded-lg border border-white/10 bg-[#0b1018]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="metrics-panel-line" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-[#7f8a7f]">{kicker}</p>
          <h2 className="mt-1 text-lg font-black tracking-normal text-white">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function CompletionGauge({ percent, value }: { percent: number; value: string }) {
  const safePercent = clampPercent(percent);
  return (
    <div className="completion-gauge mx-auto flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-[#0c1119] p-4">
      <div
        className="flex h-full w-full items-center justify-center rounded-full p-4"
        style={{
          background: `conic-gradient(#76e4a4 ${safePercent}%, rgba(255,255,255,0.08) ${safePercent}% 100%)`,
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#080c12] text-center">
          <div className="text-4xl font-black leading-none tracking-normal text-white">{value}</div>
          <div className="mt-2 text-xs font-black uppercase tracking-normal text-[#a9f4bf]">Finished</div>
          <div className="mt-1 text-xs text-[#7f8a7f]">全站完局率</div>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ color, label, max, value }: { color: string; label: string; max: number; value: number }) {
  const width = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold">
        <span className="text-[#c6d0c2]">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="metric-fill h-full rounded-full"
          style={{ backgroundColor: color, width: `${Math.max(3, width)}%` }}
        />
      </div>
    </div>
  );
}

function InsightTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-insight-tile rounded-lg border border-white/10 bg-[#0c1119] p-4">
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-bold text-[#8f9a90]">{label}</div>
    </div>
  );
}

function MetricSparkline({ color, seed }: { color: string; seed: number }) {
  const points = Array.from({ length: 7 }, (_, index) => {
    const x = index * 16;
    const wave = Math.sin((seed + index * 2.1) * 0.7) * 8;
    const y = 26 - Math.max(-10, Math.min(14, wave + index * 1.2));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg aria-hidden="true" className="mt-4 h-8 w-full overflow-visible" viewBox="0 0 96 34" preserveAspectRatio="none">
      <polyline
        className="metric-spark-path"
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <polyline
        fill="none"
        opacity="0.18"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
      />
    </svg>
  );
}

function OperationsRadar({ metrics }: { metrics: SignalMetric[] }) {
  const center = 118;
  const radius = 72;
  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index / metrics.length) * Math.PI * 2;
    const scaledRadius = radius * (clampPercent(metric.value) / 100);
    return {
      angle,
      color: metric.color,
      label: metric.label,
      value: clampPercent(metric.value),
      x: center + Math.cos(angle) * scaledRadius,
      y: center + Math.sin(angle) * scaledRadius,
      labelX: center + Math.cos(angle) * (radius + 24),
      labelY: center + Math.sin(angle) * (radius + 24),
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-center">
      <svg aria-label="运营态势雷达图" className="mx-auto h-64 w-full max-w-72" viewBox="0 0 236 236">
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#76e4a4" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#76e4a4" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle key={scale} cx={center} cy={center} fill="none" r={radius * scale} stroke="rgba(255,255,255,0.1)" />
        ))}
        {points.map((point) => (
          <line key={point.label} stroke="rgba(255,255,255,0.1)" x1={center} x2={point.labelX} y1={center} y2={point.labelY} />
        ))}
        <circle cx={center} cy={center} fill="url(#radarGlow)" r={radius + 26} />
        <polygon className="radar-polygon" fill="rgba(118,228,164,0.16)" points={polygon} stroke="#76e4a4" strokeWidth="2" />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="radar-node" cx={point.x} cy={point.y} fill={point.color} r="4.5" />
            <text
              fill="#aeb8ad"
              fontSize="8"
              fontWeight="700"
              textAnchor={point.labelX < center - 8 ? "end" : point.labelX > center + 8 ? "start" : "middle"}
              x={point.labelX}
              y={point.labelY}
            >
              {point.value}%
            </text>
          </g>
        ))}
      </svg>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {metrics.map((metric) => (
          <div key={metric.label} className="radar-metric-row rounded-md border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-2 text-[#c6d0c2]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                {metric.label}
              </span>
              <span className="text-white tabular-nums">{clampPercent(metric.value)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="metric-fill h-full rounded-full" style={{ backgroundColor: metric.color, width: `${Math.max(4, clampPercent(metric.value))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomSpectrum({ signals, total }: { signals: RoomStatusSignal[]; total: number }) {
  const maxValue = Math.max(1, ...signals.map((item) => item.value));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_220px] lg:items-center">
      <div>
        <div className="room-spectrum-rail flex h-16 overflow-hidden rounded-lg border border-white/10 bg-black/25 p-1">
          {signals.map((signal) => {
            const width = Math.max(8, Math.round((signal.value / Math.max(1, total)) * 100));
            return (
              <div
                key={signal.label}
                className="room-spectrum-segment relative min-w-8 rounded-md"
                style={{ backgroundColor: signal.color, flexBasis: `${width}%` }}
                title={`${signal.label}: ${signal.value}`}
              />
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <div key={signal.label} className="room-signal-row grid grid-cols-[72px_1fr_42px] items-center gap-3">
              <span className="text-xs font-bold text-[#aeb8ad]">{signal.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="metric-fill h-full rounded-full"
                  style={{ backgroundColor: signal.color, width: `${Math.max(5, (signal.value / maxValue) * 100)}%` }}
                />
              </div>
              <span className="text-right text-sm font-black text-white tabular-nums">{signal.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="room-spectrum-core mx-auto flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-[#0c1119]">
        <div className="text-center">
          <div className="text-5xl font-black leading-none text-white tabular-nums">{total}</div>
          <div className="mt-2 text-xs font-black uppercase tracking-normal text-[#a9f4bf]">Rooms</div>
          <div className="mt-1 text-xs text-[#8f9a90]">当前房间总量</div>
        </div>
      </div>
    </div>
  );
}

function RecentDaysChart({ metrics }: { metrics: RoomMetricsSnapshot }) {
  const totals = metrics.history.recentDays.map((day) => getRecentDayTotal(day));
  const maxValue = Math.max(
    1,
    ...totals,
  );
  const trendPoints = buildTrendPoints(totals, 700, 180);
  const linePath = buildLinePath(trendPoints);
  const areaPath = buildAreaPath(trendPoints, 192);
  return (
    <div className="activity-chart-shell">
      <div className="relative min-h-80 overflow-hidden rounded-lg border border-white/10 bg-[#080d14] p-4">
        <div className="activity-grid" />
        <svg aria-label="日期活动趋势线" className="relative h-56 w-full overflow-visible" viewBox="0 0 700 210" preserveAspectRatio="none">
          <defs>
            <linearGradient id="activityAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#76e4a4" stopOpacity="0.36" />
              <stop offset="72%" stopColor="#79b7ff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#79b7ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="activity-area" d={areaPath} fill="url(#activityAreaGradient)" />
          <path className="activity-line-glow" d={linePath} fill="none" stroke="#76e4a4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10" />
          <path className="activity-line" d={linePath} fill="none" stroke="#dfffe9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          {trendPoints.map((point, index) => (
            <g key={`${point.x}-${point.y}`}>
              <circle className="activity-point-halo" cx={point.x} cy={point.y} fill="#76e4a4" r="8" />
              <circle cx={point.x} cy={point.y} fill="#f5fff8" r="3.5" />
              <text fill="#edf3ea" fontSize="13" fontWeight="900" textAnchor="middle" x={point.x} y={Math.max(14, point.y - 14)}>
                {totals[index]}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div
        className="mt-4 grid min-h-56 items-end gap-2 border-b border-white/10 pb-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, metrics.history.recentDays.length)}, minmax(56px, 1fr))` }}
      >
        {metrics.history.recentDays.map((day) => {
          const total = getRecentDayTotal(day);
          return (
            <div key={day.date} className="flex min-w-0 flex-col items-center gap-2">
              <div className="text-xs font-black text-white tabular-nums">{total}</div>
              <div className="activity-column flex h-44 w-full max-w-16 items-end rounded-md border border-white/10 bg-white/[0.04] p-1">
                <div
                  className="flex w-full flex-col justify-end overflow-hidden rounded"
                  style={{ height: `${Math.max(5, (total / maxValue) * 100)}%` }}
                >
                  <StackSegment color="#f27e6f" total={total} value={day.gamesFinished} />
                  <StackSegment color="#e85d9e" total={total} value={day.roomsResolvedVote} />
                  <StackSegment color="#ff8f3d" total={total} value={day.roomsReachedVote} />
                  <StackSegment color="#17c3b2" total={total} value={day.roomsReachedSpeech} />
                  <StackSegment color="#f2c56f" total={total} value={day.gamesStarted} />
                  <StackSegment color="#3e69a6" total={total} value={day.playersJoined} />
                  <StackSegment color="#2f9f68" total={total} value={day.roomsCreated} />
                  <StackSegment color="#d0d8de" total={total} value={day.roomRecoveriesRestored} />
                  <StackSegment color="#b995ff" total={total} value={day.roomPageViews} />
                  <StackSegment color="#79b7ff" total={total} value={day.mainGamesFinished} />
                  <StackSegment color="#76e4a4" total={total} value={day.mainGamesStarted} />
                  <StackSegment color="#8f9a90" total={total} value={day.homeViews} />
                </div>
              </div>
              <div className="truncate text-xs font-bold text-[#8f9a90]">{day.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#aeb8ad]">
        <Legend color="#8f9a90" label="首页打开" />
        <Legend color="#76e4a4" label="主开局" />
        <Legend color="#79b7ff" label="主完局" />
        <Legend color="#b995ff" label="房间打开" />
        <Legend color="#d0d8de" label="房间恢复" />
        <Legend color="#2f9f68" label="房间建房" />
        <Legend color="#3e69a6" label="房间加入" />
        <Legend color="#f2c56f" label="房间开局" />
        <Legend color="#17c3b2" label="发言到达" />
        <Legend color="#ff8f3d" label="投票到达" />
        <Legend color="#e85d9e" label="票决完成" />
        <Legend color="#f27e6f" label="房间完局" />
      </div>
    </div>
  );
}

type RecentDayBucket = RoomMetricsSnapshot["history"]["recentDays"][number];

function getRecentDayTotal(day: RecentDayBucket): number {
  return (
    day.homeViews +
    day.mainGamesStarted +
    day.mainGamesFinished +
    day.roomPageViews +
    day.roomRecoveriesRestored +
    day.roomsCreated +
    day.playersJoined +
    day.gamesStarted +
    day.roomsReachedSpeech +
    day.roomsReachedVote +
    day.roomsResolvedVote +
    day.gamesFinished
  );
}

function StackSegment({ color, total, value }: { color: string; total: number; value: number }) {
  if (value <= 0 || total <= 0) return null;
  return <div className="activity-stack-segment" style={{ backgroundColor: color, height: `${(value / total) * 100}%` }} title={String(value)} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const maxValue = Math.max(1, ...steps.map((step) => step.value));
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const width = Math.max(10, (step.value / maxValue) * 100);
        const previous = index === 0 ? step.value : steps[index - 1].value;
        const conversion = index === 0 ? 100 : Math.round((step.value / Math.max(1, previous)) * 100);
        return (
          <div key={step.label} className="funnel-row grid grid-cols-[64px_minmax(0,1fr)_50px] items-center gap-2 sm:grid-cols-[96px_minmax(0,1fr)_70px]">
            <div className="min-w-0">
              <div className="text-sm font-black text-white">{step.label}</div>
              <div className="truncate text-xs text-[#7f8a7f]" title={step.note}>{step.note}</div>
            </div>
            <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.05] p-1">
              <div
                className="metric-fill flex h-10 min-w-9 items-center justify-end rounded px-2 text-sm font-black text-[#07100c] sm:px-3"
                style={{
                  background: "linear-gradient(90deg, #76e4a4, #f2c56f)",
                  width: `${width}%`,
                }}
              >
                {step.value}
              </div>
            </div>
            <div className="truncate text-right text-xs font-black text-[#a9f4bf] tabular-nums">{conversion}%</div>
          </div>
        );
      })}
    </div>
  );
}

function RoomStatusBar({ color, label, percent, value }: { color: string; label: string; percent: number; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#c6d0c2]">{label}</span>
        <span className="text-sm font-black text-white">{value}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="metric-fill h-full rounded-full" style={{ backgroundColor: color, width: `${Math.max(3, percent)}%` }} />
      </div>
    </div>
  );
}

function MetricDefinition({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="text-sm font-black text-white">{label}</div>
      <div className="mt-1 text-xs text-[#8f9a90]">{text}</div>
    </div>
  );
}

function formatAnalyticsAdapter(value: RoomMetricsSnapshot["history"]["adapter"]): string {
  return value === "postgres" ? "PostgreSQL" : "内存";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildTrendPoints(values: number[], width: number, height: number): Array<{ x: number; y: number }> {
  const maxValue = Math.max(1, ...values);
  if (values.length === 0) return [{ x: width / 2, y: height }];
  if (values.length === 1) {
    return [{ x: width / 2, y: height - (values[0] / maxValue) * (height - 18) }];
  }
  return values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - (value / maxValue) * (height - 18),
  }));
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, bottom: number): string {
  if (points.length === 0) return "";
  const line = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${bottom} L ${first.x.toFixed(1)} ${bottom} Z`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

function formatMinutes(value: number | null): string {
  return value === null ? "暂无" : `${value} 分钟`;
}

function formatPercent(value: number | null): string {
  return value === null ? "暂无" : `${value}%`;
}
